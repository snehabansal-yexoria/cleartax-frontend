"use client";

import { useState } from "react";
import type { CoreTransactionSubcategory } from "@/src/lib/coreApi";
import { DataTable } from "../../_console/components/DataTable";
import { ExportMenu } from "../../_console/components/ExportMenu";
import { Badge, Card, EmptyState, Field, Notice, PageHeader, PendingAction, Skeleton, cx } from "../../_console/components/ui";
import { apiGet } from "../../_console/lib/api";
import { useCategories, useTransactions } from "../../_console/lib/adminData";
import { formatNumber } from "../../_console/lib/format";
import { useResource } from "../../_console/lib/useResource";

type ListId = "categories" | "account-codes" | "property-types" | "property-statuses" | "entity-types";

const STATIC_LISTS: Record<Exclude<ListId, "categories" | "account-codes">, { title: string; items: string[] }> = {
  "property-types": { title: "Property types", items: ["Residential", "Commercial", "Vacant land"] },
  "property-statuses": {
    title: "Property statuses",
    items: ["Self Occupied", "Vacant", "Available for Rent", "Rented", "Listed for Sale", "Under Renovation"],
  },
  "entity-types": { title: "Entity types", items: ["Individual", "Trust", "SMSF", "Company", "Partnership"] },
};

const EDIT_REASON = "Editing lists needs create/update/delete endpoints for this list";

function SubcategoryCount({ categoryId }: { categoryId: number }) {
  const { data, isLoading } = useResource(`admin:subcategories:${categoryId}`, () =>
    apiGet<{ items: CoreTransactionSubcategory[] }>(`/api/transactions/categories/${categoryId}/sub-categories`).then((r) => r.items ?? []),
  );
  return isLoading ? <Skeleton width="1.5em" /> : <>{data?.length ?? 0}</>;
}

export default function AdminDataSettingsPage() {
  const categories = useCategories();
  const transactions = useTransactions();
  const [list, setList] = useState<ListId>("categories");

  const usage = new Map<string, number>();
  for (const txn of transactions.data ?? []) {
    const key = txn.categoryName || "Unclassified";
    usage.set(key, (usage.get(key) ?? 0) + 1);
  }

  const lists: { id: ListId; label: string; count?: number }[] = [
    { id: "categories", label: "Transaction categories", count: categories.data?.length },
    { id: "account-codes", label: "Account codes" },
    { id: "property-types", label: "Property types", count: STATIC_LISTS["property-types"].items.length },
    { id: "property-statuses", label: "Property statuses", count: STATIC_LISTS["property-statuses"].items.length },
    { id: "entity-types", label: "Entity types", count: STATIC_LISTS["entity-types"].items.length },
  ];

  return (
    <>
      <PageHeader
        title="Data settings"
        subtitle="The lists everyone in your organisation uses for categorising transactions, properties and entities."
        actions={
          <ExportMenu
            label="Export lists"
            build={() => ({
              title: "Transaction categories",
              filename: "transaction-categories",
              columns: [
                { header: "ID", value: (c: { id: number }) => c.id },
                { header: "Category", value: (c: { name: string }) => c.name },
                { header: "Type", value: (c: { type: string }) => c.type },
                { header: "System", value: (c: { isSystem: boolean }) => (c.isSystem ? "Yes" : "No") },
                { header: "Transactions", value: (c: { name: string }) => usage.get(c.name) ?? 0 },
              ],
              rows: categories.data ?? [],
            })}
          />
        }
      />

      <Notice tone="blue" title="Changes apply organisation-wide">
        Editing or removing an item never deletes data: records are relabelled or moved to the replacement you choose, and every change is
        written to the audit trail.
      </Notice>

      <div className="cpc-split">
        <nav className="cpc-card" aria-label="Lists" style={{ flex: "1 1 15em", padding: "0.55em", alignSelf: "flex-start" }}>
          {lists.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={item.id === list ? "true" : undefined}
              className={cx("cpc-list-row")}
              onClick={() => setList(item.id)}
              style={{
                width: "100%",
                padding: "0.7em 0.8em",
                borderRadius: "0.57em",
                borderBottom: 0,
                textAlign: "left",
                border: 0,
                cursor: "pointer",
                font: "inherit",
                background: item.id === list ? "#eef1fb" : "transparent",
                color: item.id === list ? "var(--cpc-blue-d)" : "var(--cpc-ink)",
                fontWeight: item.id === list ? 600 : 400,
              }}
            >
              <span>{item.label}</span>
              <span className="cpc-small cpc-muted cpc-num">{item.count ?? "—"}</span>
            </button>
          ))}
        </nav>

        <div className="cpc-split-main">
          {list === "categories" ? (
            <Card
              flush
              title="Transaction categories"
              meta={`${formatNumber(categories.data?.length ?? 0)} categories · used across ${formatNumber(transactions.data?.length ?? 0)} transactions`}
              actions={<PendingAction small variant="primary" reason={EDIT_REASON}>+ Add category</PendingAction>}
            >
              {categories.error ? <Notice tone="red" title="Couldn't load categories">{categories.error.message}</Notice> : null}
              <DataTable
                caption="Transaction categories"
                loading={categories.isLoading}
                rows={categories.data ?? []}
                rowKey={(c) => String(c.id)}
                pageSize={50}
                empty={<EmptyState title="No categories yet" />}
                columns={[
                  { id: "name", header: "Category", cell: (c) => <span className="cpc-strong">{c.name}</span>, sortValue: (c) => c.name },
                  { id: "type", header: "Type", cell: (c) => <Badge tone={c.type === "revenue" ? "green" : "red"}>{c.type === "revenue" ? "Revenue" : "Expense"}</Badge>, sortValue: (c) => c.type },
                  { id: "subs", header: "Sub-categories", align: "right", cell: (c) => <SubcategoryCount categoryId={c.id} /> },
                  { id: "used", header: "Transactions", align: "right", cell: (c) => formatNumber(usage.get(c.name) ?? 0), sortValue: (c) => usage.get(c.name) ?? 0 },
                  { id: "system", header: "Source", cell: (c) => (c.isSystem ? <Badge tone="gray">System</Badge> : <Badge tone="blue">Custom</Badge>) },
                  {
                    id: "actions",
                    header: "",
                    cell: () => (
                      <div className="cpc-actions" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
                        <PendingAction small reason={EDIT_REASON}>Edit</PendingAction>
                        <PendingAction small variant="danger" reason={EDIT_REASON}>Delete</PendingAction>
                      </div>
                    ),
                  },
                ]}
              />
            </Card>
          ) : null}

          {list === "account-codes" ? (
            <Card title="Account codes" meta="Mapped to the ATO rental schedule" actions={<PendingAction small variant="primary" reason="Needs account-code endpoints">+ Add code</PendingAction>}>
              <EmptyState title="Account codes aren't available from the API yet">
                Once the backend exposes account codes (code, name, category, ATO schedule item, GST treatment), you&apos;ll add, edit and
                retire them here.
              </EmptyState>
              <div className="cpc-form-grid" style={{ opacity: 0.6 }} aria-hidden="true">
                <Field label="Code"><input className="cpc-input" disabled placeholder="6430" /></Field>
                <Field label="Name"><input className="cpc-input" disabled placeholder="Strata special levy" /></Field>
                <Field label="Category"><select className="cpc-select" disabled><option>Choose category</option></select></Field>
                <Field label="ATO item"><select className="cpc-select" disabled><option>Choose item</option></select></Field>
              </div>
            </Card>
          ) : null}

          {list !== "categories" && list !== "account-codes" ? (
            <Card title={STATIC_LISTS[list].title} meta="Fixed by the platform today" actions={<PendingAction small variant="primary" reason={EDIT_REASON}>+ Add item</PendingAction>}>
              <div className="cpc-list">
                {STATIC_LISTS[list].items.map((item) => (
                  <div key={item} className="cpc-list-row">
                    <span>{item}</span>
                    <Badge tone="gray">System</Badge>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
