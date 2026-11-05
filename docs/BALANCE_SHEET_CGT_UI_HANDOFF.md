# Balance Sheet, Source filter & Capital Gain — as built

The screens are wired to the Go API. A failed call shows as a failure: nothing
falls back to sample data. Deploy order: run migration 0056, deploy Go, then the
frontend.

Account codes: migration 0056 seeds the 145 postable codes from
`Balance_sheet_codes.xlsx`. `app/components/balance-sheet/balanceSheetAccounts.ts`
holds the same list for the Opening Balance panel. Header rows (1000, 1500, 2000,
2500, 3000) are group titles and are not seeded.

## Balance Sheet (accountant and client)

`GET /api/entities/{id}/balance-sheet?from=&to=&compare=none|py|pp`, its `/export`
with `format=csv|xlsx|pdf`, and `GET`/`PUT /api/entities/{id}/opening-balance`.
Clients read only their own entities and see reviewed figures only. Opening
balances are staff-only and Current Assets only.

How the figures are made (see `internal/handlers/transaction/balance_sheet.go`):

- Account balances come from the General Ledger's rows: journal lines, Balance
  Sheet transactions whose category names an account, and opening balances.
- Profit rolls into equity using the P&L's filter: this year into 3022, earlier
  years into 3020. Depreciation is not included.
- 1071 Clearing is set to whatever makes the sheet balance. It is the amount still
  to be allocated by journal, because ordinary transactions record one side only.
- A Balance Sheet transaction with a typed category that names no account is left
  out and counted in `unmappedCount`, which the page reports.
- There is no per-month or per-quarter column view: the report has one figure per
  account plus an optional comparison.

## Source filter

`source=bank|general|property_cost_base|borrowing_cost|manual` on the transaction
lists, and `source` on each row. Worked out in SQL (`transactionSourceSQL`), so no
backfill. First match wins: General (journal entry), Property Cost Base (type
`cost_base`), Borrowing Cost (Borrowing expenses category), Bank (matched to a
bank line), Manual (everything else).

## Capital Gain (property level)

`…/properties/{id}/capital-gain`, opened by **Mark as Sold Out**.

- The cost base is the manual Property Cost Base panel (`property_cost_base`), not
  `cost_base` transactions and not settlement entries. Rows now have a date.
- It uses net amounts when the entity is registered for GST, otherwise gross. The
  screen and PDF say which.
- `POST /api/properties/{id}/selling-costs` replaces the property's selling costs,
  stored as panel rows under category **Selling Cost**. They are listed on the
  panel but kept out of its total and the Settlement Difference.
- `POST /api/properties/{id}/mark-sold` `{ sellingAmount, soldDate }` stores the
  sale. It can be repeated. The property stays enabled.

```
Net selling amount   = Selling amount − Total selling cost   (0 when "No")
Capital gain / loss  = Net selling amount − Purchase amount − Property cost base
```

The PDF is generated in the browser from the calculation screen.
