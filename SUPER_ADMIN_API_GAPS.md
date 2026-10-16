# Super admin console: API status

The super admin screens live in `app/dashboard/super-admin`. They use the same
sidebar and topbar as admin and accountant (`app/dashboard/layout.tsx`); page
components and styles are in `app/dashboard/_console`.

## Sample data

`SHOW_SAMPLE_DATA` in `app/dashboard/_console/lib/sampleData.ts` is **on** so the
screens can be reviewed with realistic figures. While it's on:

- six sample organisations (with admins) are listed after the real ones;
- totals the backend doesn't return yet (accountants, RMs, clients, properties,
  equity, growth, people, MFA, last login) are filled with stable sample numbers
  for every organisation, real or sample;
- inviting an admin to a sample organisation shows the confirmation but sends nothing.

Set it to `false` before going live: screens then show real API data only, and
"—" with a tooltip wherever a figure isn't available yet.

## Connected (existing routes)

| Screen | Route |
| --- | --- |
| Dashboard, Organisations, Organisation detail | `GET /api/organizations/list` |
| Admins, admin history, recent admin changes | `GET /api/users/me/invited` (filtered to role `admin`) |
| Add organisation | `POST /api/organizations/create`, then `POST /api/invite-user` |
| Invite / change admin | `POST /api/invite-user` (`role: "admin"`, `organization_id`) |
| My profile | `GET /api/users/me` |

Add organisation sends the admin's email as `org_email`, an auto-generated
`tenant_code`, the address split from the autocomplete result, `country: "AU"`,
`subscription_plan` and `max_users_allowed` (accountants + RMs + clients + 1).

## Needed from the backend

- **Platform / per-organisation totals**: accountants, RMs, clients, properties,
  entities, equity, documents, bank accounts, monthly growth, RM → accountant breakdown.
- **Organisation update**: edit details, suspend / reactivate (status is read from `is_active`).
- **Extra org fields** on create: time zone, FY start, storage, trial end, logo upload.
- **Admin sign-in details**: phone, MFA on/off, last login, reset MFA.
- **Invite management**: resend invite; record the change reason and whether the
  previous admin was kept or deactivated.

## Organisation workspace and audit log (sample data)

`Open →` on Organisations opens an organisation's workspace
(`/dashboard/super-admin/organisations/[orgId]/workspace`): Users & roles,
Permissions and Data settings & rules. The platform Audit log is at
`/dashboard/super-admin/audit`. Their data comes from
`app/dashboard/_console/lib/workspaceData.ts` until these endpoints exist:

- users of one organisation (all roles), disable / reactivate, change role,
  invite non-admin roles as super admin;
- role permissions per organisation (screens, reports, exports) and per-person exceptions;
- master-data rules per organisation (who can add / edit / delete each list, protected values);
- a platform-wide audit event feed.

Real today: the organisation and its admins, "Create user" with the Admin role
(invite), and "Reset password" for real users (Cognito reset email).
