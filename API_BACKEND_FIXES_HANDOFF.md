# API Handoff For Backend Team

## Context

The frontend is integrating against:

- Base URL: `https://3w8pmemnqk.ap-southeast-2.awsapprunner.com`

We attempted to use the backend APIs for:

- organization creation/listing
- inviting users
- listing invited users
- fetching current user organization
- fetching admin contact
- listing organization clients

At the time of integration, the backend API was not stable enough for these flows, so some routes were temporarily moved to direct database access to keep frontend progress moving.

This document lists the fixes needed in the backend API so the frontend can safely consume the service again without any direct DB access.

---

## Current Problems Observed

### 1. Core API health was reachable, but DB was not

Health response observed from App Runner:

```json
{
  "status": "ok",
  "version": "dev",
  "db": "unreachable"
}
```

This explains the internal server errors on key endpoints.

### 2. Organization endpoints returned 500

Observed failures:

- `GET /organisations` -> `internal server error`
- `POST /organisations` -> `internal server error`

### 3. User endpoints returned 500

Observed failure:

- `GET /users` -> `internal server error`

This broke:

- current user lookup
- dashboard invited users list
- admin contact lookup
- client list lookup
- invite permission resolution

### 4. Invitation acceptance state is not reflected in API data

Frontend behavior showed users who had already accepted invites still appearing as `pending`.

This means the API/data layer currently does not expose a reliable accepted state for invited users.

### 5. Role resolution is incomplete

The frontend needs both:

- `role_id`
- `role_name`

If only numeric role IDs are returned, the API should still resolve and return role names directly.

### 6. Frontend should not need to join multiple DB tables

Current schema is spread across:

- `users`
- `org_user_mapping`
- `user_invitation`
- `roles`
- `organisation`

The backend API should join these and expose a normalized user object.

---

## Required Backend API Fixes

## 1. Fix service DB connectivity

The App Runner API must be able to connect to Aurora/Postgres consistently.

This is the first blocker. Until this is fixed, all dependent endpoints will remain unstable.

---

## 2. Make organization endpoints work

### `GET /organisations`

This endpoint must return a list of organizations.

Expected response shape:

```json
[
  {
    "id": "c965e116-ea90-48a0-88bc-ecb1ed3b4f7c",
    "org_name": "yexoria",
    "org_email": "yexoria@yexoria.com",
    "tenant_code": "123456",
    "contact_number": "1234567890",
    "address_line1": "Noida",
    "city": "Noida",
    "state": "Noida",
    "country": "AU",
    "postal_code": "201301",
    "subscription_plan": "free",
    "max_users_allowed": 5,
    "is_active": true,
    "is_verified": false,
    "created_at": "2026-04-21T20:20:25.794Z"
  }
]
```

### `POST /organisations`

Required request body:

```json
{
  "org_name": "yexoria",
  "org_email": "yexoria@yexoria.com",
  "tenant_code": "123456",
  "contact_number": "1234567890",
  "address_line1": "Noida",
  "city": "Noida",
  "state": "Noida",
  "country": "AU",
  "postal_code": "201301",
  "subscription_plan": "free",
  "max_users_allowed": 5
}
```

Expected response:

```json
{
  "id": "c965e116-ea90-48a0-88bc-ecb1ed3b4f7c",
  "org_name": "yexoria",
  "org_email": "yexoria@yexoria.com",
  "tenant_code": "123456"
}
```

### Required validations

- `org_name` required
- `org_email` required
- `tenant_code` required
- `address_line1` required
- `city` required
- `state` required
- `country` required
- `postal_code` required
- reject duplicates cleanly

Recommended duplicate error:

```json
{
  "error": "Organization name, email, or tenant code already exists"
}
```

---

## 3. Add a normalized user listing endpoint

### `GET /users`

This is the most important backend endpoint to fix.

The frontend needs a normalized list of users with:

- user identity
- role
- organization
- invitation status
- inviter info

Expected response shape:

```json
[
  {
    "id": "62334CE9DD",
    "email": "admin@admin.com",
    "full_name": "Admin User",
    "role_id": 2,
    "role_name": "admin",
    "org_id": "c965e116-ea90-48a0-88bc-ecb1ed3b4f7c",
    "org_name": "yexoria",
    "status": "pending",
    "invited_by": "7875D3F3C7",
    "invited_by_email": "super_admin@company.com",
    "created_at": "2026-04-21T20:52:05.054Z"
  }
]
```

### Backend expectation

The backend should join:

- `users`
- `org_user_mapping`
- `roles`
- `organisation`
- `user_invitation`
- `users` again for inviter email lookup

### Required filters

Recommended support:

- `GET /users?org_id=<uuid>`
- `GET /users?role_name=admin`
- `GET /users?org_id=<uuid>&role_name=client`

These filters will support:

- super admin invited admins list
- admin invited users list
- accountant/admin client list
- admin contact lookup

---

## 4. Add a working invite/create-user endpoint

The backend should own invite creation and not require the frontend to directly write DB records.

### Recommended endpoint

Either:

- `POST /users`

or preferably:

- `POST /invitations`

### Request

```json
{
  "email": "accountant@example.com",
  "full_name": "Jamie Parker",
  "role_id": 3,
  "org_id": "c965e116-ea90-48a0-88bc-ecb1ed3b4f7c",
  "invited_by": "62334CE9DD"
}
```

### Expected behavior

The backend should:

1. validate inviter permission
2. create Cognito user
3. create user record
4. create org mapping
5. create invitation record
6. return success response

### Expected response

```json
{
  "id": "25EA5CEB39",
  "email": "accountant@example.com",
  "role_id": 3,
  "role_name": "accountant",
  "org_id": "c965e116-ea90-48a0-88bc-ecb1ed3b4f7c",
  "status": "pending",
  "temporary_password": "abc123A1!"
}
```

---

## 5. Enforce invite permission rules in backend

These rules must be enforced server-side:

- `super_admin -> admin`
- `admin -> accountant | client`
- `accountant -> client`

If a role tries to invite an invalid target role, return:

```json
{
  "error": "You are not allowed to invite this role"
}
```

with HTTP `403`.

---

## 6. Fix invitation acceptance tracking

This is currently missing or incomplete.

### Problem

Users who accepted the invite were still returned as `pending`.

### Required backend fix

The API must update invitation state when the invited user completes onboarding.

### Recommended endpoint

`POST /invitations/accept`

### Request

```json
{
  "email": "accountant@example.com"
}
```

### Expected backend behavior

Update matching invitation row:

- `status = 'accepted'`
- `accepted_at = now()`

### Expected response

```json
{
  "success": true,
  "updated": 1
}
```

### Better option

Even better than an explicit endpoint: backend should automatically sync invitation acceptance based on Cognito confirmed status.

---

## 7. Return resolved invitation/user status

The frontend should receive a final resolved status from API.

Expected possible values:

- `pending`
- `invited`
- `accepted`
- `active`

If `accepted_at` is present, API should not continue returning `pending`.

---

## 8. Return role names directly

The API should return both:

```json
{
  "role_id": 3,
  "role_name": "accountant"
}
```

This prevents frontend role mismatches and avoids `unknown` labels in dashboards.

---

## 9. Add bulk invite endpoint

Bulk upload is now a frontend requirement.

### Recommended endpoint

`POST /invitations/bulk`

### Super admin CSV use case

Each row contains:

- `organization`
- `admin_email`
- `full_name` optional

Request example:

```json
{
  "rows": [
    {
      "organization": "yexoria",
      "admin_email": "admin1@example.com",
      "full_name": "Alex Morgan"
    }
  ]
}
```

### Admin CSV use case

Each row contains:

- `role`
- `email`
- `full_name` optional

Request example:

```json
{
  "rows": [
    {
      "role": "accountant",
      "email": "accountant1@example.com",
      "full_name": "Jamie Parker"
    },
    {
      "role": "client",
      "email": "client1@example.com",
      "full_name": "Riley Harper"
    }
  ]
}
```

### Expected response

```json
{
  "total": 2,
  "successful": 1,
  "failed": 1,
  "results": [
    {
      "row": 2,
      "email": "accountant1@example.com",
      "role": "accountant",
      "success": true,
      "temporary_password": "abc123A1!"
    },
    {
      "row": 3,
      "email": "bad@example.com",
      "role": "client",
      "success": false,
      "error": "A pending invitation already exists"
    }
  ]
}
```

---

## 10. Normalize external API contract

Please keep the external API contract stable and consistent.

Recommended principle:

- DB naming can stay internal
- API responses should be consistent

### Suggested naming consistency

Use one style consistently:

- `org_id`
- `org_name`
- `role_id`
- `role_name`
- `full_name`
- `created_at`

Do not mix these inconsistently with:

- `name`
- `organization_id`
- `organizationName`
- `role`

unless the response always includes both.

---

## 11. Provide structured non-500 errors

Right now many backend failures surfaced as generic `internal server error`.

Please return useful error payloads for common failure cases.

Examples:

### Duplicate organization

```json
{
  "error": "Organization name, email, or tenant code already exists"
}
```

### Invalid invite role

```json
{
  "error": "You are not allowed to invite this role"
}
```

### Pending invitation already exists

```json
{
  "error": "A pending invitation already exists for this email"
}
```

### Organization not found

```json
{
  "error": "Selected organization does not exist"
}
```

---

## Minimum Priority Order

These should be fixed first:

1. App Runner DB connectivity
2. `GET /organisations`
3. `POST /organisations`
4. `GET /users`
5. `POST /users` or `POST /invitations`
6. `POST /invitations/accept`
7. `POST /invitations/bulk`

---

## Frontend Features Depending On These Fixes

These frontend areas currently depend on the above:

- super admin create organization
- super admin invite admin
- super admin bulk upload admins
- admin invite accountant/client
- admin bulk upload accountant/client
- admin dashboard invited users
- super admin dashboard invited admins
- accountant/admin organization name display
- accountant profile admin contact
- accountant/admin client list
- accepted vs pending invite status

---

## Notes For Backend Team

- Current database schema observed by frontend integration:
  - `organisation`
  - `users`
  - `org_user_mapping`
  - `roles`
  - `user_invitation`
- `users.id` / `org_user_mapping.user_id` / `user_invitation.invited_by` are `varchar(10)`
- role data appears to be stored primarily through `org_user_mapping.role_id`
- invitation acceptance needs reliable sync against Cognito lifecycle

---

## Suggested Outcome

Once the above endpoints are fixed, the frontend can remove the temporary direct database workarounds and consume the backend API cleanly for:

- org management
- user invites
- bulk uploads
- dashboards
- accepted/pending state

