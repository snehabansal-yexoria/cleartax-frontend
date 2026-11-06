# Client dashboard › Upcoming payments — as built (UI)

Client panel only. Replaces the dashboard's Last Financial Year cards (desktop,
tablet and phone); nothing else on the dashboard changed.

Code: `app/components/upcoming-payments/` (`UpcomingPayments.tsx`,
`upcomingPaymentsApi.ts`, `upcoming-payments.css`), placed in
`app/dashboard/client/page.tsx` under the Net Equity / Net Position card.

## What it shows

A reminder is a transaction saved on Add Transaction with "Is this a regular
payment?" on: `metadata.is_regular_payment`, `metadata.due_date`,
`metadata.alert_name`. Amount, category, property and entity come from that
transaction.

- Sorted by due date, closest first. Overdue and 0–3 days red, 4–15 days amber,
  later grey. Chips: "Overdue by 1 day", "Due today", "1 day left", "In 28 days".
- Desktop/tablet: about three rows, the rest scroll inside the card; All /
  Within 15 days filter. Phone: one card at a time, swipe sideways.
- None open: one slim line ("No upcoming payments" + Add transaction).
- Mark as paid → Add a new transaction (pre-filled, saves through the normal
  create call) or Select an existing transaction (same amount suggested first).
  Either clears the alert. Dismiss clears it without a payment. Undo in the toast.

## APIs

Used today (exist already):

- `GET /api/transactions?sort=date&dir=desc&limit=200` — reminders are filtered
  from these rows in the browser (only the newest 200 rows are seen).
- `GET /api/transactions?sort=date&dir=desc&limit=50&search=` — payments to link.
- `POST /api/entities/{entityId}/transactions` — "Add a new transaction";
  `metadata.paid_reminder_id` points back at the reminder.

For the backend to add:

- `GET /api/reminders?status=open` → `[{ id, transactionId, alertName, dueDate,
  amount, type, categoryId, categoryName, subcategoryId, subcategoryName,
  entityId, entityName, propertyIds, propertyNames }]` — replaces the 200-row
  filter in `loadUpcomingPayments`.
- `POST /api/reminders/{transactionId}/mark-paid { transactionId }`
- `POST /api/reminders/{transactionId}/dismiss`
- `POST /api/reminders/{transactionId}/reopen` (Undo)

Closing a reminder should set `metadata.reminder_status` = `paid` | `dismissed`
on the reminder's transaction; the list already skips rows that have it.

Until the POST routes exist they return 404, and the UI remembers the cleared
reminder in that browser only (`localStorage` key
`cp-upcoming-payments-cleared`). Remove that fallback in
`upcomingPaymentsApi.ts` once the routes are live.

## Also in this change

Transaction Source label "General" now reads "Journal" everywhere
(`app/components/transactionSource.tsx`); the API value stays `general`.
