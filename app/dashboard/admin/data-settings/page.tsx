"use client";

import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { exportCsv, exportXlsx, type ExportColumn } from "../_components/ExportMenu";

// ============================================================================
// Types & sample data
// ============================================================================
// The lists below are sample values until the data-settings API exists.

type ListId = "categories" | "sub-categories" | "account-codes" | "property-types" | "property-statuses" | "entity-types" | "document-types" | "modes";
type Item = { id: string; name: string; type?: string; used: number };
type DataList = { id: ListId; label: string; noun: string; hasType?: boolean; items: Item[] };
type Toast = { id: number; message: string; undo?: () => void };

const mk = (prefix: string, rows: [string, number, string?][]): Item[] =>
  rows.map(([name, used, type], index) => ({ id: `${prefix}-${index}`, name, used, type }));

const INITIAL_LISTS: DataList[] = [
  {
    id: "categories",
    label: "Transaction categories",
    noun: "category",
    hasType: true,
    items: mk("cat", [
      ["Rental income", 1842, "Revenue"],
      ["Other income", 214, "Revenue"],
      ["Interest / loan repayments", 512, "Expense"],
      ["Maintenance", 684, "Expense"],
      ["Management fees", 312, "Expense"],
      ["Rates & strata", 602, "Expense"],
      ["Insurance", 96, "Expense"],
      ["Other expenses", 187, "Expense"],
      ["Land tax", 0, "Expense"],
    ]),
  },
  {
    id: "sub-categories",
    label: "Sub-categories",
    noun: "sub-category",
    items: mk("sub", [["Repairs", 402], ["Gardening", 0], ["Pest control", 61], ["Council rates", 284], ["Body corporate", 318], ["Water rates", 211]]),
  },
  {
    id: "account-codes",
    label: "Account codes",
    noun: "account code",
    items: mk("code", [["4000 · Gross rent", 1790], ["4010 · Other rental income", 214], ["6110 · Body corporate fees", 318], ["6140 · Council rates", 284], ["6180 · Interest on loans", 512], ["6230 · Repairs & maintenance", 684], ["6420 · Land tax", 0]]),
  },
  { id: "property-types", label: "Property types", noun: "property type", items: mk("pt", [["House", 92], ["Apartment", 71], ["Townhouse", 38], ["Commercial", 17]]) },
  { id: "property-statuses", label: "Property statuses", noun: "status", items: mk("ps", [["Rented", 141], ["Vacant", 19], ["Available for rent", 12], ["Self occupied", 23], ["Listed for sale", 9], ["Under renovation", 14]]) },
  { id: "entity-types", label: "Entity types", noun: "entity type", items: mk("et", [["Individual", 48], ["Trust", 39], ["Company", 22], ["SMSF", 18], ["Partnership", 11], ["Joint", 5]]) },
  { id: "document-types", label: "Document types", noun: "document type", items: mk("dt", [["Bank statement", 512], ["Invoice", 301], ["Rates notice", 122], ["Lease agreement", 84], ["Insurance policy", 49], ["Depreciation schedule", 26]]) },
  { id: "modes", label: "Modes of transaction", noun: "mode", items: mk("md", [["Bank transfer", 3204], ["Direct debit", 942], ["Card", 488], ["Cash", 61], ["Cheque", 12]]) },
];

const TYPES = ["Expense", "Revenue", "Capital"];

const btn = "inline-flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
const btnSm = "px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";
const btnDangerSm = "px-3 py-1.5 border border-red-200 bg-red-50 rounded-lg text-xs font-semibold text-red-700 hover:bg-red-100 transition cursor-pointer";
const inputClass = "h-10 px-3.5 border border-slate-200 rounded-lg text-[13px] text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-sans";
const labelClass = "text-[11px] font-bold text-slate-400 uppercase tracking-wider";

// ============================================================================
// Dialog shell
// ============================================================================

function Dialog({ title, subtitle, onClose, children, footer }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-start justify-center p-6 overflow-y-auto" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="bg-white rounded-2xl shadow-xl w-full max-w-[480px] mt-20">
        <div className="flex justify-between items-start gap-4 px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="text-[17px] font-bold text-slate-900">{title}</h2>
            {subtitle ? <p className="text-[13px] text-slate-500 mt-1">{subtitle}</p> : null}
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center cursor-pointer shrink-0">
            ✕
          </button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4 text-[13px]">{children}</div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">{footer}</div>
      </div>
    </div>
  );
}

// ============================================================================
// Page
// ============================================================================

export default function DataSettingsPage() {
  const [lists, setLists] = useState<DataList[]>(INITIAL_LISTS);
  const [activeId, setActiveId] = useState<ListId>("categories");
  // Order saved for each list; the working order differs until "Save order".
  const [savedOrder, setSavedOrder] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(INITIAL_LISTS.map((list) => [list.id, list.items.map((item) => item.id)])),
  );
  const [lifted, setLifted] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("Expense");
  const [newPosition, setNewPosition] = useState("end");

  const [editing, setEditing] = useState<{ item: Item; name: string; type: string } | null>(null);
  const [deleting, setDeleting] = useState<{ item: Item; moveTo: string; confirm: string } | null>(null);
  const [exporting, setExporting] = useState<{ format: "csv" | "xlsx"; ids: ListId[]; perSheet: boolean } | null>(null);
  const toastId = useRef(0);

  const list = lists.find((entry) => entry.id === activeId)!;
  const orderChanged = list.items.map((item) => item.id).join() !== savedOrder[activeId]?.join();

  function toast(message: string, undo?: () => void) {
    const id = ++toastId.current;
    setToasts((all) => [...all, { id, message, undo }]);
    window.setTimeout(() => setToasts((all) => all.filter((entry) => entry.id !== id)), 4500);
  }

  function updateItems(id: ListId, next: Item[]) {
    setLists((all) => all.map((entry) => (entry.id === id ? { ...entry, items: next } : entry)));
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= list.items.length || from === to) return;
    const next = list.items.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    updateItems(activeId, next);
    setLifted(item.id);
  }

  function undoOrder() {
    const byId = new Map(list.items.map((item) => [item.id, item]));
    updateItems(activeId, savedOrder[activeId].map((id) => byId.get(id)).filter(Boolean) as Item[]);
    setLifted(null);
  }

  function saveOrder() {
    const previous = savedOrder[activeId];
    const current = list.items.map((item) => item.id);
    const id = activeId;
    setSavedOrder((all) => ({ ...all, [id]: current }));
    setLifted(null);
    toast("Order saved for everyone in your organisation.", () => {
      setSavedOrder((all) => ({ ...all, [id]: previous }));
      setLists((all) =>
        all.map((entry) => {
          if (entry.id !== id) return entry;
          const byId = new Map(entry.items.map((item) => [item.id, item]));
          return { ...entry, items: previous.map((key) => byId.get(key)).filter(Boolean) as Item[] };
        }),
      );
    });
  }

  // Native drag and drop between rows.
  function onDragOver(event: DragEvent<HTMLDivElement>, overIndex: number) {
    event.preventDefault();
    if (!dragId) return;
    const from = list.items.findIndex((item) => item.id === dragId);
    if (from !== -1 && from !== overIndex) move(from, overIndex);
  }

  function addItem(event: FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const item: Item = { id: `${activeId}-new-${++toastId.current}`, name, used: 0, type: list.hasType ? newType : undefined };
    const next = list.items.slice();
    const index = newPosition === "top" ? 0 : newPosition === "end" ? next.length : Math.min(next.length, Number(newPosition) + 1);
    next.splice(index, 0, item);
    updateItems(activeId, next);
    setSavedOrder((all) => ({ ...all, [activeId]: next.map((entry) => entry.id) }));
    setNewName("");
    toast(`“${name}” added at position ${index + 1}.`);
  }

  function saveEdit() {
    if (!editing || !editing.name.trim()) return;
    updateItems(
      activeId,
      list.items.map((item) => (item.id === editing.item.id ? { ...item, name: editing.name.trim(), type: list.hasType ? editing.type : item.type } : item)),
    );
    toast(`“${editing.name.trim()}” saved.`);
    setEditing(null);
  }

  function confirmDelete() {
    if (!deleting) return;
    const { item, moveTo } = deleting;
    const next = list.items
      .filter((entry) => entry.id !== item.id)
      .map((entry) => (entry.id === moveTo ? { ...entry, used: entry.used + item.used } : entry));
    updateItems(activeId, next);
    setSavedOrder((all) => ({ ...all, [activeId]: next.map((entry) => entry.id) }));
    const target = list.items.find((entry) => entry.id === moveTo);
    toast(item.used && target ? `“${item.name}” deleted. ${item.used.toLocaleString()} moved to “${target.name}”.` : `“${item.name}” deleted.`);
    setDeleting(null);
  }

  async function runExport() {
    if (!exporting || exporting.ids.length === 0) return;
    const chosen = lists.filter((entry) => exporting.ids.includes(entry.id));
    const columns: ExportColumn<Item & { list?: string; position?: number }>[] = [
      { header: "Position", value: (row) => row.position },
      { header: "Name", value: (row) => row.name },
      { header: "Type", value: (row) => row.type ?? "" },
      { header: "Used in", value: (row) => row.used },
    ];
    const rowsFor = (entry: DataList) => entry.items.map((item, index) => ({ ...item, list: entry.label, position: index + 1 }));
    const filename = chosen.length === 1 ? chosen[0].label.toLowerCase().replace(/\s+/g, "-") : "data-settings";
    if (exporting.format === "csv") {
      exportCsv(filename, [{ header: "List", value: (row: Item & { list?: string }) => row.list }, ...columns], chosen.flatMap(rowsFor));
    } else if (exporting.perSheet) {
      await exportXlsx(filename, chosen.map((entry) => ({ name: entry.label, columns: columns as ExportColumn<unknown>[], rows: rowsFor(entry) })));
    } else {
      await exportXlsx(filename, [
        { name: "Lists", columns: [{ header: "List", value: (row: Item & { list?: string }) => row.list }, ...columns] as ExportColumn<unknown>[], rows: chosen.flatMap(rowsFor) },
      ]);
    }
    setExporting(null);
  }

  const total = list.items.reduce((sum, item) => sum + item.used, 0);
  const deleteTargets = deleting ? list.items.filter((item) => item.id !== deleting.item.id) : [];
  const deleteReady = deleting ? (deleting.item.used === 0 || (deleting.moveTo && deleting.confirm.trim() === "DELETE")) : false;

  return (
    <div className="flex flex-col gap-8 pb-12 w-full font-sans relative">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Data settings</h1>
          <p className="text-sm text-slate-500 mt-1.5">Add, edit, remove and reorder the dropdown lists everyone in your organisation uses.</p>
        </div>
        <button type="button" className={btn} onClick={() => setExporting({ format: "xlsx", ids: lists.map((entry) => entry.id), perSheet: true })}>
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          Export all lists
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-6 items-start">
        {/* Lists */}
        <nav aria-label="Lists" className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-2 flex flex-col gap-0.5">
          {lists.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => {
                setActiveId(entry.id);
                setLifted(null);
              }}
              className={`flex justify-between items-center h-10 px-3.5 rounded-lg text-[13px] transition cursor-pointer text-left ${
                entry.id === activeId ? "bg-blue-50 text-blue-700 font-semibold" : "text-slate-600 hover:bg-slate-50 font-medium"
              }`}
            >
              <span>{entry.label}</span>
              <span className={`text-[12.5px] ${entry.id === activeId ? "text-blue-600" : "text-slate-400"}`}>{entry.items.length}</span>
            </button>
          ))}
        </nav>

        {/* Values */}
        <section className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="flex justify-between items-start gap-4 flex-wrap px-6 pt-5 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{list.label}</h2>
              <p className="text-[13px] text-slate-500 mt-0.5">Drag rows to change the order people see in every dropdown</p>
            </div>
            <button type="button" className={btnSm} onClick={() => setExporting({ format: "xlsx", ids: [activeId], perSheet: true })}>
              Export
            </button>
          </div>

          {orderChanged ? (
            <div className="mx-6 mb-3 flex justify-between items-center gap-3 flex-wrap bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5">
              <span className="text-[13px] text-slate-700">
                <strong className="text-slate-900">Order changed.</strong> Dropdowns update for everyone once you save.
              </span>
              <div className="flex gap-2">
                <button type="button" className={btnSm} onClick={undoOrder}>
                  Undo
                </button>
                <button type="button" onClick={saveOrder} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs font-semibold text-white transition cursor-pointer">
                  Save order
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5 px-6 pb-5" onDragEnd={() => setDragId(null)}>
            {list.items.map((item, index) => {
              const isLifted = item.id === lifted || item.id === dragId;
              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(event) => {
                    setDragId(item.id);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(event) => onDragOver(event, index)}
                  className={`flex items-center gap-3 min-h-12 px-3 py-1.5 rounded-xl border bg-white text-[13.5px] transition ${
                    isLifted ? "border-indigo-400 shadow-[0_10px_24px_rgba(38,45,107,0.15)] bg-indigo-50/40" : "border-slate-200"
                  }`}
                >
                  <span className="text-slate-400 cursor-grab active:cursor-grabbing" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="9" cy="6" r="1.6" />
                      <circle cx="15" cy="6" r="1.6" />
                      <circle cx="9" cy="12" r="1.6" />
                      <circle cx="15" cy="12" r="1.6" />
                      <circle cx="9" cy="18" r="1.6" />
                      <circle cx="15" cy="18" r="1.6" />
                    </svg>
                  </span>
                  <span className="w-6 text-right text-xs text-slate-400 tabular-nums">{index + 1}</span>
                  <span className="flex-1 font-medium text-slate-900">{item.name}</span>
                  {item.type ? <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">{item.type}</span> : null}
                  <span className="w-36 text-right text-xs text-slate-500">{item.used.toLocaleString()} in use</span>
                  <div className="flex gap-1.5">
                    <button type="button" className={btnSm} aria-label={`Move ${item.name} up`} disabled={index === 0} onClick={() => move(index, index - 1)}>
                      ↑
                    </button>
                    <button type="button" className={btnSm} aria-label={`Move ${item.name} down`} disabled={index === list.items.length - 1} onClick={() => move(index, index + 1)}>
                      ↓
                    </button>
                    <button type="button" className={btnSm} onClick={() => setEditing({ item, name: item.name, type: item.type ?? "Expense" })}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className={btnDangerSm}
                      onClick={() => setDeleting({ item, moveTo: list.items.find((entry) => entry.id !== item.id)?.id ?? "", confirm: "" })}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <form onSubmit={addItem} className="flex flex-wrap items-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <label className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
              <span className={labelClass}>New {list.noun}</span>
              <input className={inputClass} value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="e.g. Strata special levy" />
            </label>
            {list.hasType ? (
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Type</span>
                <select className={inputClass} value={newType} onChange={(event) => setNewType(event.target.value)}>
                  {TYPES.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Position</span>
              <select className={inputClass} value={newPosition} onChange={(event) => setNewPosition(event.target.value)}>
                <option value="end">At the end</option>
                <option value="top">At the top</option>
                {list.items.map((item, index) => (
                  <option key={item.id} value={String(index)}>
                    After “{item.name}”
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={!newName.trim()} className="h-10 px-5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-[13px] rounded-lg transition cursor-pointer disabled:opacity-50">
              Add {list.noun}
            </button>
          </form>
          <div className="flex justify-between flex-wrap gap-2 px-6 py-3 border-t border-slate-100 text-xs text-slate-500">
            <span>Drag the handle, or use ↑ ↓ with the keyboard · {total.toLocaleString()} records use this list</span>
            <span>Every change is saved to the audit trail</span>
          </div>
        </section>
      </div>

      {/* Edit */}
      {editing ? (
        <Dialog
          title={`Edit ${list.noun}`}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button type="button" className={btn} onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button type="button" disabled={!editing.name.trim()} onClick={saveEdit} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold text-white transition cursor-pointer disabled:opacity-50">
                Save changes
              </button>
            </>
          }
        >
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Name</span>
            <input className={inputClass} value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} autoFocus />
          </label>
          {list.hasType ? (
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Type</span>
              <select className={inputClass} value={editing.type} onChange={(event) => setEditing({ ...editing, type: event.target.value })}>
                {TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
          ) : null}
          {editing.item.used > 0 ? (
            <p className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-slate-700">
              Used in {editing.item.used.toLocaleString()} records. Renaming relabels them; nothing is deleted.
            </p>
          ) : null}
        </Dialog>
      ) : null}

      {/* Delete */}
      {deleting ? (
        <Dialog
          title={`Delete “${deleting.item.name}”?`}
          onClose={() => setDeleting(null)}
          footer={
            <>
              <button type="button" className={btn} onClick={() => setDeleting(null)}>
                Cancel
              </button>
              <button type="button" disabled={!deleteReady} onClick={confirmDelete} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold text-white transition cursor-pointer disabled:opacity-50">
                {deleting.item.used ? `Delete and move ${deleting.item.used.toLocaleString()}` : "Delete"}
              </button>
            </>
          }
        >
          {deleting.item.used > 0 ? (
            <>
              <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                <p className="font-semibold text-red-800">{deleting.item.used.toLocaleString()} records use this {list.noun}</p>
                <p className="text-red-700/80 mt-0.5">Pick where they go. Their history stays in the audit trail.</p>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Move them to</span>
                <select className={inputClass} value={deleting.moveTo} onChange={(event) => setDeleting({ ...deleting, moveTo: event.target.value })}>
                  {deleteTargets.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Type DELETE to confirm</span>
                <input className={inputClass} value={deleting.confirm} onChange={(event) => setDeleting({ ...deleting, confirm: event.target.value })} placeholder="DELETE" />
              </label>
            </>
          ) : (
            <p className="text-slate-600">Nothing uses it yet, so nothing else changes.</p>
          )}
        </Dialog>
      ) : null}

      {/* Export */}
      {exporting ? (
        <Dialog
          title="Export lists"
          onClose={() => setExporting(null)}
          footer={
            <>
              <button type="button" className={btn} onClick={() => setExporting(null)}>
                Cancel
              </button>
              <button type="button" disabled={exporting.ids.length === 0} onClick={runExport} className="px-4 py-2 bg-slate-900 hover:bg-slate-800 rounded-lg text-sm font-semibold text-white transition cursor-pointer disabled:opacity-50">
                Download .{exporting.format}
              </button>
            </>
          }
        >
          <div className="flex flex-col gap-1.5">
            <span className={labelClass}>Format</span>
            <div className="inline-flex w-fit border border-slate-200 rounded-lg overflow-hidden" role="group" aria-label="Format">
              {(["csv", "xlsx"] as const).map((format) => (
                <button
                  key={format}
                  type="button"
                  onClick={() => setExporting({ ...exporting, format })}
                  className={`px-4 py-2 text-xs font-semibold cursor-pointer ${exporting.format === format ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`}
                >
                  {format === "csv" ? "CSV" : "Excel"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className={labelClass}>
              Lists · {exporting.ids.length} of {lists.length}
            </span>
            <div className="grid grid-cols-2 gap-2">
              {lists.map((entry) => (
                <label key={entry.id} className="flex items-center gap-2 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-blue-600"
                    checked={exporting.ids.includes(entry.id)}
                    onChange={(event) =>
                      setExporting({ ...exporting, ids: event.target.checked ? [...exporting.ids, entry.id] : exporting.ids.filter((id) => id !== entry.id) })
                    }
                  />
                  {entry.label}
                </label>
              ))}
            </div>
          </div>
          {exporting.format === "xlsx" ? (
            <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 accent-blue-600" checked={exporting.perSheet} onChange={(event) => setExporting({ ...exporting, perSheet: event.target.checked })} />
              One sheet per list
            </label>
          ) : null}
        </Dialog>
      ) : null}

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
        {toasts.map((entry) => (
          <div key={entry.id} className="flex items-center gap-3 bg-slate-900 text-white px-4 py-3.5 rounded-xl shadow-xl min-w-[300px] border border-slate-800 text-sm font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="flex-1">{entry.message}</span>
            {entry.undo ? (
              <button
                type="button"
                onClick={() => {
                  entry.undo?.();
                  setToasts((all) => all.filter((item) => item.id !== entry.id));
                }}
                className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-xs font-semibold cursor-pointer"
              >
                Undo
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
