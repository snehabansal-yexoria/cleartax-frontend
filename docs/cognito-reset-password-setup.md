# Cognito password-reset email setup

The self-service "Forgot password?" flow (`/login/forgot-password`) uses Cognito's
**native** `ForgotPassword` / `ConfirmForgotPassword` APIs
([src/lib/auth.ts](../src/lib/auth.ts)). Cognito itself generates the 6-digit code,
sends the email, expires the code, and validates it on confirm — there is **no app
code or backend involved in sending this email**.

Because Cognito sends it, the email body lives on the **User Pool**, not in this repo's
SES templates (`cleartax/internal/email/templates/*` are unrelated — those are sent by
the Go backend over SES for invites/welcome). The HTML to paste into the pool is
[cognito-reset-password-email.html](./cognito-reset-password-email.html), kept here only
for version control.

## What to configure on the pool

This is a one-time AWS Console / CLI change (the pool is provisioned outside both repos,
so there is no IaC to edit).

1. **Verification message template** — Console: *User pool → Messaging → Message
   templates → Verification message → Edit*. Set the delivery method to **Code**, paste
   the HTML from `cognito-reset-password-email.html`, and set the subject to
   `Reset your ClearPortfolio password`. The body **must** contain the `{####}`
   placeholder (Cognito injects the code there). This same template is also used for
   sign-up verification emails.
2. **Account recovery** — *Sign-in / Account recovery* → ensure recovery via
   **verified email** is enabled.
3. **Email provider (recommended)** — set the pool to send via **Amazon SES**
   (`EmailSendingAccount: DEVELOPER`) using the same verified from-address the invite
   flow uses. The default Cognito sender caps at ~50 emails/day and is unsuitable for
   production.

### CLI equivalent

```sh
aws cognito-idp update-user-pool \
  --user-pool-id "$COGNITO_USER_POOL_ID" \
  --region ap-southeast-2 \
  --account-recovery-setting 'RecoveryMechanisms=[{Priority=1,Name=verified_email}]' \
  --verification-message-template "DefaultEmailOption=CONFIRM_WITH_CODE,EmailSubject=Reset your ClearPortfolio password,EmailMessage=$(cat docs/cognito-reset-password-email.html)"
```

> `update-user-pool` replaces the whole pool config — include any existing settings you
> want to keep (MFA config, policies, Lambda triggers, email/SES config) in the same call,
> or make the change in the Console to avoid clobbering them.

## Notes / caveats baked into the UX

- **Code, not link.** Cognito account recovery is code-based; there is no "reset by link"
  option. The email shows the code prominently; its "Reset Password" button just deep-links
  back to `/login/forgot-password` (Cognito can't inject the user's email into the link —
  only `{####}` and `{username}` placeholders exist, and `{username}` is the random internal
  username). The user enters the code on our page.
- **1-hour validity.** Cognito's reset-code TTL is fixed at 1 hour and is not configurable,
  so the email copy says "1 hour" (the original design said 24h — corrected).
- **Invited-but-never-activated users** (`FORCE_CHANGE_PASSWORD`) can't use this flow;
  Cognito returns `InvalidParameterException` and the UI tells them to use their invitation
  link instead.
- **Enumeration.** The request step shows the same "if an account exists…" message whether
  or not the email is registered. Enabling *Prevent user existence errors* on the app client
  hardens this further at the Cognito layer.
