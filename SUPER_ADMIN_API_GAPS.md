# Super admin console: API status

The super admin screens live in `app/dashboard/super-admin` and use the shell in
`app/dashboard/_console`. Anything the backend doesn't return yet is shown as
"—" with a tooltip, never as made-up numbers.

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
