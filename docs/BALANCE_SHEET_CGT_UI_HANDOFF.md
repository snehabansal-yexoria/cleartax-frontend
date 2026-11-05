# Balance Sheet, Source filter & Capital Gain — UI handoff for the backend

The screens are built. Each one calls the endpoint listed here. Where an
endpoint does not exist yet, the UI falls back to sample data (and says
"Sample figures") or keeps the value on screen only. As soon as the endpoint
returns the shape below, the real data appears with no frontend change, apart
from the two small proxy notes marked **Frontend note**.

Account codes: `app/components/balance-sheet/balanceSheetAccounts.ts` holds
the 150 codes from `Balance_sheet_codes.xlsx` (category, subcategory, name).
Header rows (1000, 1500, 2000, 2500, 3000) are group titles, not postable.

---

## 1. Balance Sheet (accountant, entity level)

Page: `/dashboard/accountant/clients/{clientId}/entities/{entityId}/balance-sheet`
(opened from the new **Balance Sheet** button in the entity header).

### GET `/api/entities/{entityId}/balance-sheet`

Query: `from`, `to` (YYYY-MM-DD; `to` is the "as at" date), `columns`
(`total|month|quarter|year`), `compare` (`none|py|pp`).

```json
{
  "entityName": "Veena Bansal Trust",
  "asAt": "2026-06-30",
  "compareAsAt": "2025-06-30",
  "sections": [
    {
      "key": "assets",
      "title": "Assets",
      "groups": [
        {
          "name": "Current Assets",
          "subgroups": [
            { "name": "Cash and Bank",
              "lines": [ { "code": "1010", "name": "Operating Bank Account", "amount": 25000, "compareAmount": 21400 } ] }
          ]
        }
      ]
    }
  ]
}
```

- `compareAsAt` is `null` and `compareAmount` is omitted when `compare=none`.
  The UI shows the comparison column only when the user picks a comparison.
- Groups: Current / Non-Current Assets, Current / Non-Current Liabilities;
  Equity has one group with `name: null`. Subgroups are the spreadsheet's
  subcategories. Lines with a zero balance can be left out.
- Contra accounts (accumulated depreciation, allowance for doubtful debts) are
  sent as negative amounts.
- Totals and the balance check are computed in the UI from the lines.

### GET `/api/entities/{entityId}/balance-sheet/export?…same query…&format=csv|xlsx|pdf`

Returns the file. Until it exists, CSV is built in the browser; XLSX/PDF show
a "needs the export endpoint" message.

### Opening balance — Current Assets only

`GET /api/entities/{entityId}/opening-balance` → `{ "asAt": "2025-07-01", "lines": [ { "code": "1010", "amount": 18200 } ] }`
or 404 when none has been entered (the button then reads **Add Opening Balance**;
otherwise **Edit Opening Balance**).

`PUT /api/entities/{entityId}/opening-balance` with the same body. Only Current
Asset codes (1010–1499) are sent. The opening balance must flow into the
balance sheet figures.

### Account codes

Seed the 150 codes (category, subcategory, account code, name) into the
account-code / category table so they are available for transaction input and
Journal Entry. The Journal Entry screen is unchanged: once the codes are in the
chart of accounts it already lists them.

---

## 2. Client portal — Reports → Balance Sheet

Page: `/dashboard/client/reports/balance-sheet` (new card on the Reports page).
Entity + financial year + compare (None / Previous year / Previous quarter) →
Build report → Download PDF / Excel. View only.

Uses the same `GET /api/entities/{entityId}/balance-sheet` (from = 1 Jul,
to = 30 Jun of the chosen FY, `columns=total`) and the export endpoint with
`format=xlsx`. The client must only get entities they own.

Also removed from the client Portfolio Summary report: the
"How each figure is calculated" table (it was a UI reference only).

---

## 3. All Transactions — Source filter

New **Source** dropdown (All, Bank, General, Property Cost Base, Borrowing
Cost, Manual) and a **Source** column.

- The list request now includes `source=bank|general|property_cost_base|borrowing_cost|manual`
  when a source is picked.
- Each transaction should return `source` with one of those values; existing
  rows need a backfill.
- **Frontend note:** `parseTransactionListQuery` (src/lib) whitelists list
  query params; add `source` there when the Go endpoint accepts it.
- Until `source` is returned, the badge is inferred (cost_base type → Property
  Cost Base, "borrowing" category → Borrowing Cost, reconciliation metadata →
  Bank, journal metadata → Manual, otherwise General).

---

## 4. Capital Gain (property level)

Entry: new **Mark as Sold Out** button in the property header →
`…/properties/{propertyId}/capital-gain`.

Reads (already exist): `GET /api/properties/{id}` (`purchaseAmount`,
`purchaseDate`, `name`, `locationText`) and `GET /api/properties/{id}/cost-base`
(settlement entries are a separate list and are never included).

- **Needed:** a `date` on each cost base entry (today there is none, so the
  table shows "—"). Send it as `date: "YYYY-MM-DD"`.
- **Add More** goes to the property page with `?view=pnl#property-cost-base`,
  which opens View P&L Statement and scrolls to the existing Property Cost Base
  grid. No new page.

Writes (planned):

`POST /api/properties/{id}/selling-costs`
```json
[ { "subcategory": "Agent commission", "description": "Ray White", "date": "2026-11-05", "amount": 18700 } ]
```
Subcategories: Agent commission, PEXA fees, Advertisement / Marketing,
Professional fees, Others. Dates must not be in the future. Save them as
Property Cost Base entries with category **"Selling cost"** — the UI leaves
that category out of the cost base total so selling costs are not deducted
twice (they are already taken off the selling amount).

`POST /api/properties/{id}/mark-sold` `{ "sellingAmount": 880000, "soldDate": "2026-11-05" }`

Calculation (done in the UI):

```
Net selling amount   = Selling amount − Total selling cost   (0 when "No")
Capital gain / loss  = Net selling amount − Purchase amount − Property cost base
```

The PDF is generated in the browser from the calculation screen.
