# Admin & Super Admin console: API status

The admin (`/dashboard/admin/*`) and super admin (`/dashboard/super-admin/*`) screens were rebuilt on a shared console in
`app/dashboard/_console/`. Accountant and client portals are unchanged; `app/dashboard/layout.tsx` only routes the
`admin` and `super_admin` roles to the new `ConsoleShell`.

Controls whose endpoint doesn't exist yet render **disabled with a tooltip** (`PendingAction`), and numbers that can't
be computed show **—** with a "Waiting on API" hint (`ApiPending`). Nothing is faked.

## Connected (existing routes)

| Screen | Endpoints |
| --- | --- |
| Admin dashboard, clients, accountants, efficiency, properties, entities, audit trail | `GET /api/users/me/organization`, `GET /api/users/me/invited`, `GET /api/users/me/clients`, `GET /api/entities?client_id=`, `GET /api/entities/:id/properties`, `GET /api/entities/:id/reconciliations`, `GET /api/transactions` (paged) |
| Client detail | `GET /api/users/me/clients/:clientId` + the above |
| Data settings | `GET /api/transactions/categories`, `GET /api/transactions/categories/:id/sub-categories` |
| Admin invite | `POST /api/invite-user` (accountant, client); bulk upload page unchanged |
| Super admin dashboard, organisations, organisation detail, admins | `GET /api/organizations/list`, `GET /api/users/me/invited` |
| Add organisation | `POST /api/organizations/create`, then `POST /api/invite-user` (role `admin`) |
| Change / invite admin | `POST /api/invite-user` (role `admin`, `organization_id`) |
| Profiles | `GET /api/users/me`, `GET /api/users/me/organization` |

Derived on the client: equity = property `estimated_market_value` − `loan_details.loan_amount`; state is parsed from
`location_text`; "bank statements processed" = reconciliations with status `done`. The audit trail is built from the
create/update stamps on users, entities, properties and statements (no before/after values yet).

## Needed from the backend

1. **Relationship managers**: an RM role, an RM → accountant link, and list/invite/assign endpoints.
2. **Admin reassignment**: change a client's accountant, transfer clients between accountants.
3. **Deactivate user**: clients, accountants, and the previous admin after an admin change.
4. **Audit log**: `GET /audit-logs` with actor, role, client, module, record, before/after values, IP/device, and filters.
5. **Documents**: count/list of uploaded documents and which are matched to a transaction.
6. **Data settings writes**: create/update/delete for categories and sub-categories; account codes (code, name,
   category, ATO rental schedule item, GST) with CRUD.
7. **Organisation & user updates**: `PATCH /organisations/:id` (trading name, contact, address, logo) and
   `PATCH /users/me` (name, phone, photo).
8. **Platform totals for super admin**: per-organisation counts (accountants, RMs, clients, properties, entities,
   equity). Super admins can't read org-scoped client data through the current routes.
9. **Invite lifecycle**: resend an invite; reset a user's MFA (Cognito admin).
