"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Skeleton } from "boneyard-js/react";
import ClientTransactionsSkeleton from "@/app/components/clients/ClientTransactionsSkeleton";
import {
  TransactionDetailController,
  transactionDetailToRow,
  type TransactionDetailChange,
} from "@/app/components/TransactionsFeature";
import { getSession } from "@/src/lib/session";
import { transactionTypeLabel } from "@/src/lib/transactionTypes";
import { formatClientCurrency, formatExactCurrency } from "@/app/components/clients/CurrencyFormatter";
import ClientPagination from "@/app/components/clients/ClientPagination";
import ClientEmailedDocuments, { EmailDocumentsHint } from "@/app/components/documentInbox/ClientEmailedDocuments";
import type {
  CoreTransactionDetail,
  CoreTransactionListItem,
  CoreTransactionTotals,
} from "@/src/lib/coreApi";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

type TypeFilter = 'all' | 'income' | 'expense';
type DateRangeFilter = 'month' | '3days' | 'week' | '30days' | 'quarter' | 'all';
type ListTab = 'reviewed' | 'pending';

// The API sends propertyNames; the dev mock interceptor's rows also carry a
// flat propertyName, which the list has always preferred.
type ClientListItem = CoreTransactionListItem & { propertyName?: string };

type FilterOption = { id: string; name: string };

type EntitiesResponse = {
  items?: {
    id: string;
    name?: string;
    properties?: { id: string; name?: string }[];
  }[];
};

// One page per request, navigated with the pager under the list. The Go API
// caps a page at 200.
const DEFAULT_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

// Type only. Duration used to share this single-select row ("This Month"), so
// picking Expense silently dropped the month and vice versa; it is its own
// control now (DATE_RANGE_OPTIONS), always visible beside these.
const TYPE_PILLS: { id: TypeFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'income', label: 'Income' },
  { id: 'expense', label: 'Expense' },
];

const TYPE_FILTER_OPTIONS: TypeFilter[] = ['all', 'income', 'expense'];

// The page opens on this month, as the Income/Expense cards always did.
const DEFAULT_DATE_RANGE: DateRangeFilter = 'month';

const DATE_RANGE_OPTIONS: { label: string; value: DateRangeFilter }[] = [
  { label: 'This month', value: 'month' },
  { label: 'Past 3 days', value: '3days' },
  { label: 'Past week', value: 'week' },
  { label: 'Last 30 days', value: '30days' },
  { label: 'This quarter', value: 'quarter' },
  { label: 'All time', value: 'all' },
];

function dateRangeLabel(value: DateRangeFilter): string {
  return DATE_RANGE_OPTIONS.find((option) => option.value === value)?.label ?? '';
}

/**
 * How a row reads. Only income and expense are signed and coloured; contra,
 * personal, cost base and balance sheet are neither, and used to be drawn as
 * expenses — so they looked "missing" from the Expense tab, which is strictly
 * type = expense.
 */
function rowTone(type: string): 'income' | 'expense' | 'neutral' {
  if (type === 'revenue') return 'income';
  if (type === 'expense') return 'expense';
  return 'neutral';
}

function rowAmountText(type: string, amount: number): string {
  const tone = rowTone(type);
  if (tone === 'income') return formatExactCurrency(amount, { showPlus: true });
  if (tone === 'expense') return formatExactCurrency(-amount, { showPlus: true });
  return formatExactCurrency(amount);
}

/** The type badge for a neutral row, unless its category already says it. */
function rowTypeBadge(type: CoreTransactionListItem['type'], categoryName: string): string | null {
  if (rowTone(type) !== 'neutral') return null;
  const label = transactionTypeLabel(type);
  return label && label.toLowerCase() !== categoryName.trim().toLowerCase() ? label : null;
}

function RowIcon({ type }: { type: string }) {
  const tone = rowTone(type);
  if (tone === 'income') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '18px', height: '18px' }}>
        <line x1="7" y1="17" x2="17" y2="7" />
        <polyline points="7 7 17 7 17 17" />
      </svg>
    );
  }
  if (tone === 'expense') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '18px', height: '18px' }}>
        <line x1="17" y1="7" x2="7" y2="17" />
        <polyline points="17 17 7 17 7 7" />
      </svg>
    );
  }
  // Two-way arrows: money moved, but not in or out of the portfolio's P&L.
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
      <polyline points="17 3 21 7 17 11" />
      <line x1="3" y1="7" x2="21" y2="7" />
      <polyline points="7 13 3 17 7 21" />
      <line x1="21" y1="17" x2="3" y2="17" />
    </svg>
  );
}

/**
 * Sets the review-tab predicates on a query. "unreviewed" rows are the ones
 * sent to the accountant via "Submit to accountant"; they live in the "To Be
 * Reviewed" tab (newest submission first), so the main tab is the ledger
 * bucket — everything else. The API also hides rejected rows from a client.
 * The totals cards always use the main tab's set (see totalsQuery).
 */
function applyTab(sp: URLSearchParams, tab: ListTab) {
  if (tab === 'pending') {
    sp.set("review_status", "unreviewed");
    sp.set("sort", "created");
  } else {
    sp.set("review_bucket", "ledger");
    sp.set("sort", "date");
  }
  sp.set("dir", "desc");
}

/** Local calendar date as YYYY-MM-DD — the only date format the API accepts. */
function toIsoDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * The invoice-date bounds for the duration filter. "Past N days" keeps no
 * upper bound, as the old in-browser filter did.
 */
function dateBounds(
  dateRange: DateRangeFilter,
  now: Date,
): { from?: string; to?: string } {
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysAgo = (n: number) =>
    toIsoDate(new Date(year, month, now.getDate() - n));

  switch (dateRange) {
    case 'month':
      return {
        from: toIsoDate(new Date(year, month, 1)),
        to: toIsoDate(new Date(year, month + 1, 0)),
      };
    case '3days':
      return { from: daysAgo(3) };
    case 'week':
      return { from: daysAgo(7) };
    case '30days':
      return { from: daysAgo(30) };
    case 'quarter': {
      const quarterStart = Math.floor(month / 3) * 3;
      return {
        from: toIsoDate(new Date(year, quarterStart, 1)),
        to: toIsoDate(new Date(year, quarterStart + 3, 0)),
      };
    }
    default:
      return {};
  }
}

async function getAuthToken(): Promise<string | null> {
  const session = (await getSession()) as SessionWithIdToken | null;
  return session ? session.getIdToken().getJwtToken() : null;
}

async function fetchTransactionPage(
  token: string,
  query: string,
  offset: number,
  signal?: AbortSignal,
): Promise<{ items: ClientListItem[]; total: number }> {
  const res = await fetch(`/api/transactions?${query}&offset=${offset}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      message?: string;
      error?: string;
    } | null;
    throw new Error(body?.message || body?.error || "Failed to load transactions.");
  }
  const data = (await res.json()) as { items?: ClientListItem[]; total?: number };
  const items = data.items ?? [];
  return {
    items,
    total: typeof data.total === "number" ? data.total : items.length,
  };
}

function toListRow(tx: ClientListItem) {
  return {
    id: tx.id,
    description: tx.description || `${transactionTypeLabel(tx.type)} - ${tx.categoryName}`,
    categoryName: tx.categoryName || "",
    meta: tx.propertyName || tx.propertyNames?.[0] || "",
    type: tx.type,
    amount: Math.abs(tx.netAmount || tx.grossAmount || 0),
    invoiceDate: tx.invoiceDate ? tx.invoiceDate.split('T')[0] : "",
    entityName: tx.entityName || "Individual",
    createdAt: tx.createdAt || "",
  };
}

type ListRow = ReturnType<typeof toListRow>;

function handleRowKeyDown(event: KeyboardEvent<HTMLDivElement>, open: () => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    open();
  }
}

// useSearchParams() needs a Suspense boundary above it, or the whole route
// bails out of static rendering at build time.
export default function ClientTransactionsPage() {
  return (
    <Suspense fallback={<ClientTransactionsSkeleton isMobile={false} />}>
      <ClientTransactionsContent />
    </Suspense>
  );
}

function ClientTransactionsContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // ?propertyId= comes from the property page's "View all" link; ?txn= is a
  // deep link to one transaction (see [transactionId]/page.tsx).
  const propertyIdParam = searchParams.get("propertyId");
  const txnParam = searchParams.get("txn");

  const [isMobile, setIsMobile] = useState(false);
  // isLoading drives the full-page skeleton and is only true until the first
  // page lands. Later refetches dim the list instead: swapping the page for a
  // skeleton would unmount the search box mid-typing.
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [listError, setListError] = useState("");
  // The current page of the active tab and filters.
  const [transactions, setTransactions] = useState<ClientListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  // Bumped after a delete so the current page refetches and backfills.
  const [listVersion, setListVersion] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  // The Income / Expense cards: totals for the listed set (null shows "—").
  const [totals, setTotals] = useState<{
    key: string;
    data: CoreTransactionTotals | null;
  } | null>(null);
  // Bumped after an edit or delete so the cards and the "To Be Reviewed"
  // badge re-read; an edited row is patched in place.
  const [statsVersion, setStatsVersion] = useState(0);
  const listTopRef = useRef<HTMLDivElement>(null);
  const [entityOptions, setEntityOptions] = useState<FilterOption[]>([]);
  const [propertyOptions, setPropertyOptions] = useState<FilterOption[]>([]);
  const [openTxn, setOpenTxn] = useState<{ id: string; row?: ClientListItem } | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  // The input is searchQuery; the query string only sees this debounced copy,
  // so a typing burst is one request rather than one per keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeTab, setActiveTab] = useState<ListTab>('reviewed');

  // Filter bottom sheet state variables
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  // This month by default; the property page's "View all" (?propertyId=)
  // means all of that property's transactions, so it opens on All time.
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>(
    () => (propertyIdParam ? 'all' : DEFAULT_DATE_RANGE),
  );
  // Entity and property filters hold ids, not names: they are sent to the API
  // as entity_id / property_id.
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [propertyFilter, setPropertyFilter] = useState<string>(
    () => propertyIdParam || 'all',
  );

  // Temp selection draft variables
  const [tempType, setTempType] = useState<TypeFilter>('all');
  const [tempDateRange, setTempDateRange] = useState<DateRangeFilter>(DEFAULT_DATE_RANGE);
  const [tempEntity, setTempEntity] = useState<string>('all');
  const [tempProperty, setTempProperty] = useState<string>('all');

  // Monotonic id for list requests. A response is applied only if no newer
  // request has started since, so a slow page can never overwrite a newer one.
  const requestSeq = useRef(0);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // A later navigation to this page with a different ?propertyId= (the page
  // stays mounted) re-applies it.
  useEffect(() => {
    setPropertyFilter(propertyIdParam || 'all');
  }, [propertyIdParam]);

  useEffect(() => {
    if (!txnParam) return;
    setOpenTxn((current) => (current?.id === txnParam ? current : { id: txnParam }));
  }, [txnParam]);

  useEffect(() => {
    if (searchQuery === debouncedSearch) return;
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery, debouncedSearch]);

  // Filter options come from the client's entities and their properties, not
  // from the loaded rows — those are one page of one filtered set now.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getAuthToken();
        if (!token || cancelled) return;
        const res = await fetch("/api/entities", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as EntitiesResponse;
        if (cancelled) return;
        const byName = (a: FilterOption, b: FilterOption) => a.name.localeCompare(b.name);
        const entities = (data.items ?? []).filter((entity) => entity.id);
        setEntityOptions(
          entities
            .map((entity) => ({ id: entity.id, name: entity.name || "Unnamed entity" }))
            .sort(byName),
        );
        const properties = new Map<string, FilterOption>();
        for (const entity of entities) {
          for (const property of entity.properties ?? []) {
            if (property.id && !properties.has(property.id)) {
              properties.set(property.id, {
                id: property.id,
                name: property.name || "Unnamed property",
              });
            }
          }
        }
        setPropertyOptions(Array.from(properties.values()).sort(byName));
      } catch (err) {
        console.error("Failed to load entities and properties:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Every filter except type, as API query params: search, duration, entity
  // and property. The Income / Expense cards read this set — they are the
  // type split themselves, so the type pill must not zero one of them.
  const scopeQuery = useMemo(() => {
    const sp = new URLSearchParams();
    const search = debouncedSearch.trim();
    if (search) sp.set("search", search);

    const { from, to } = dateBounds(dateRangeFilter, new Date());
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);

    if (entityFilter !== 'all') sp.set("entity_id", entityFilter);
    if (propertyFilter !== 'all') sp.set("property_id", propertyFilter);
    return sp.toString();
  }, [debouncedSearch, dateRangeFilter, entityFilter, propertyFilter]);

  // Every filter on the page. Shared by the list and the "To Be Reviewed"
  // badge so both describe the same set of transactions. Income and Expense
  // are strict types (revenue / expense); contra, personal and cost base
  // show only under All.
  const filterQuery = useMemo(() => {
    const sp = new URLSearchParams(scopeQuery);
    if (typeFilter === 'income') sp.set("type", "revenue");
    else if (typeFilter === 'expense') sp.set("type", "expense");
    return sp.toString();
  }, [scopeQuery, typeFilter]);

  // Any change to the filters, the tab or the page size goes back to page
  // one. Adjusted during render (React's pattern for state derived from
  // other state), so the stale page is never requested first.
  const pageResetKey = `${filterQuery}|${activeTab}|${pageSize}`;
  const [lastPageResetKey, setLastPageResetKey] = useState(pageResetKey);
  if (lastPageResetKey !== pageResetKey) {
    setLastPageResetKey(pageResetKey);
    setCurrentPage(1);
  }

  const listQuery = useMemo(() => {
    const sp = new URLSearchParams(filterQuery);
    applyTab(sp, activeTab);
    sp.set("limit", String(pageSize));
    return sp.toString();
  }, [filterQuery, activeTab, pageSize]);

  const pageOffset = (currentPage - 1) * pageSize;

  // One page per request: refetched when the query, the page or (after a
  // delete) listVersion changes.
  useEffect(() => {
    const seq = ++requestSeq.current;
    const controller = new AbortController();
    setIsRefreshing(true);
    setListError("");

    (async () => {
      try {
        const token = await getAuthToken();
        if (seq !== requestSeq.current) return;
        if (!token) {
          router.replace("/login/user");
          return;
        }
        const page = await fetchTransactionPage(token, listQuery, pageOffset, controller.signal);
        if (seq !== requestSeq.current) return;
        setTransactions(page.items);
        setTotalCount(page.total);
      } catch (err) {
        if (controller.signal.aborted || seq !== requestSeq.current) return;
        console.error("Failed to fetch transactions:", err);
        setTransactions([]);
        setTotalCount(0);
        setListError(err instanceof Error ? err.message : "Failed to load transactions.");
      } finally {
        if (seq === requestSeq.current) {
          setIsRefreshing(false);
          setIsLoading(false);
        }
      }
    })();

    return () => controller.abort();
  }, [listQuery, pageOffset, listVersion, router]);

  // A delete (here or elsewhere) can leave the page past the end: step back
  // to the last page that exists rather than show an empty one.
  const totalPages = Math.max(Math.ceil(totalCount / pageSize), 1);
  if (!isRefreshing && currentPage > totalPages) {
    setCurrentPage(totalPages);
  }

  // The badge counts the queue under the same filters as the list, whichever
  // tab is showing. limit=1: only the total is wanted.
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const token = await getAuthToken();
        if (!token || controller.signal.aborted) return;
        const sp = new URLSearchParams(filterQuery);
        sp.set("review_status", "unreviewed");
        sp.set("limit", "1");
        const page = await fetchTransactionPage(token, sp.toString(), 0, controller.signal);
        if (!controller.signal.aborted) setPendingCount(page.total);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("Failed to count transactions awaiting review:", err);
      }
    })();
    return () => controller.abort();
  }, [filterQuery, statsVersion]);

  // Income / Expense cards: server totals for exactly the listed set — same
  // duration, search, entity, property and tab, at the list's grain and with
  // the amount each row shows — minus the type pill. They used to be this
  // month's Portfolio Summary whatever the list showed, so they read A$0
  // above a list of rows. "—" while loading or if the totals endpoint is not
  // deployed yet; never a stale figure for a different filter.
  //
  // Always the main tab's set, whichever tab is showing: bills awaiting review
  // never feed a money figure in the client portal (the API enforces it for a
  // client anyway), so the cards don't change when "To Be Reviewed" is opened.
  const totalsQuery = useMemo(() => {
    const sp = new URLSearchParams(scopeQuery);
    applyTab(sp, 'reviewed');
    return sp.toString();
  }, [scopeQuery]);

  // Keyed by the query that produced them, so a figure for the previous
  // filter is never shown under the new one while it loads.
  const totalsKey = `${totalsQuery}|${statsVersion}`;
  const shownTotals = totals?.key === totalsKey ? totals.data : null;

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const token = await getAuthToken();
        if (!token || controller.signal.aborted) return;
        const res = await fetch(`/api/transactions/totals?${totalsQuery}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`totals request failed (${res.status})`);
        const data = (await res.json()) as CoreTransactionTotals;
        if (!controller.signal.aborted) setTotals({ key: totalsKey, data });
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("Failed to load income and expense totals:", err);
        setTotals({ key: totalsKey, data: null });
      }
    })();
    return () => controller.abort();
  }, [totalsQuery, totalsKey]);

  function goToPage(page: number) {
    setCurrentPage(page);
    listTopRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function replaceQuery(mutate: (sp: URLSearchParams) => void) {
    const sp = new URLSearchParams(searchParams.toString());
    mutate(sp);
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  // Keeps ?propertyId= in step with the filter so a reload or a shared link
  // shows the same list.
  function applyPropertyFilter(next: string) {
    setPropertyFilter(next);
    if ((propertyIdParam || 'all') !== next) {
      replaceQuery((sp) => {
        if (next === 'all') sp.delete("propertyId");
        else sp.set("propertyId", next);
      });
    }
  }

  // Add Transaction's Back returns here, with the same query (minus a
  // ?txn= deep link, which would reopen the popup). Passed explicitly so it
  // never depends on the layout's path history.
  const addTransactionHref = (() => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("txn");
    const qs = sp.toString();
    const back = qs ? `${pathname}?${qs}` : pathname;
    return `/dashboard/client/transactions/new?${new URLSearchParams({
      backHref: back,
      backLabel: "Transactions",
    })}`;
  })();

  function openTransaction(id: string) {
    setOpenTxn({ id, row: transactions.find((tx) => tx.id === id) });
  }

  function closeTransaction() {
    setOpenTxn(null);
    if (txnParam) replaceQuery((sp) => sp.delete("txn"));
  }

  function handleTransactionChanged(
    id: string,
    change: TransactionDetailChange,
    detail: CoreTransactionDetail | null,
  ) {
    if (change === "deleted") {
      // Refetch the page so the next row moves up into the gap (and the
      // pager's count is the server's).
      setListVersion((version) => version + 1);
    } else if (detail) {
      // Patched in place rather than refetched, so the page and the scroll
      // position survive an edit.
      setTransactions((current) =>
        current.map((tx) => (tx.id === detail.id ? transactionDetailToRow(detail, tx) : tx)),
      );
    }
    setStatsVersion((version) => version + 1);
  }

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const todayStr = today.toISOString().split('T')[0];
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const listData = transactions.map(toListRow);

  // "Submitted" is when the transaction was created in Clear (created_at), not
  // the invoice date. Falls back to the invoice date for rows created before
  // the API started returning created_at.
  const formatSubmittedAt = (createdAt: string, invoiceDate: string) => {
    const raw = createdAt || invoiceDate;
    if (!raw) return "";
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;

    const dayStr = d.toISOString().split('T')[0];
    const time = d.toLocaleTimeString("en-AU", {
      hour: "numeric",
      minute: "2-digit",
    });
    if (dayStr === todayStr) return `Today, ${time}`;
    if (dayStr === yesterdayStr) return `Yesterday, ${time}`;
    return `${d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}, ${time}`;
  };

  // The "To Be Reviewed" tab's rows — the API already returns only
  // review_status = unreviewed for that tab, newest submission first.
  const pendingTransactions = activeTab === 'pending' ? listData : [];

  // The property from ?propertyId= may not be among the options (still
  // loading, or not one of the client's own). Keep it selectable by name.
  const propertyFilterOptions = useMemo(() => {
    if (propertyFilter === 'all' || propertyOptions.some((p) => p.id === propertyFilter)) {
      return propertyOptions;
    }
    const known = transactions.find((tx) => tx.propertyIds?.includes(propertyFilter));
    const name =
      known?.propertyNames?.[known.propertyIds.indexOf(propertyFilter)] || "Selected property";
    return [...propertyOptions, { id: propertyFilter, name }];
  }, [propertyFilter, propertyOptions, transactions]);

  // The cards' figures; null shows "—" (loading, failed, or the totals
  // endpoint not deployed yet). The label names the duration they cover.
  const displayIncomeTotal = shownTotals ? shownTotals.income : null;
  const displayExpenseTotal = shownTotals ? shownTotals.expense : null;
  const durationLabel = dateRangeLabel(dateRangeFilter);

  // Group transactions by date
  const groupTransactionsByDate = (itemsList: ListRow[]) => {
    const groups: { [key: string]: ListRow[] } = {};
    const sorted = [...itemsList].sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));

    sorted.forEach(item => {
      // Undated rows sort last and get their own group; they used to be
      // dropped, so a row counted in "of N" never appeared.
      const dateLabel = item.invoiceDate ? formatDateGroupHeader(item.invoiceDate) : "No date";
      if (!groups[dateLabel]) {
        groups[dateLabel] = [];
      }
      groups[dateLabel].push(item);
    });
    return groups;
  };

  const formatDateGroupHeader = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const formattedDate = date.toLocaleDateString("en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      if (dateStr === todayStr) {
        return `Today - ${formattedDate}`;
      } else if (dateStr === yesterdayStr) {
        return `Yesterday - ${formattedDate}`;
      }
      return formattedDate;
    } catch {
      return dateStr;
    }
  };

  const groupedTransactions = activeTab === 'reviewed' ? groupTransactionsByDate(listData) : {};

  // Bottom sheet actions
  const openFilterSheet = () => {
    setTempType(typeFilter);
    setTempDateRange(dateRangeFilter);
    setTempEntity(entityFilter);
    setTempProperty(propertyFilter);
    setIsFilterSheetOpen(true);
  };

  const handleApplyFilters = () => {
    setTypeFilter(tempType);
    setDateRangeFilter(tempDateRange);
    setEntityFilter(tempEntity);
    applyPropertyFilter(tempProperty);
    setIsFilterSheetOpen(false);
  };

  const handleCancelFilters = () => {
    setIsFilterSheetOpen(false);
  };

  const handleClearAll = () => {
    setTempType('all');
    setTempDateRange('all');
    setTempEntity('all');
    setTempProperty('all');
  };

  // The pills and the visible duration control drive the same state as the
  // sheet's Type and Date Range, so the two can never disagree. "All" is all
  // types only; it no longer resets the duration, entity and property.
  const renderFilterRow = (variant: 'mobile' | 'desktop') => (
    <div
      className={variant === 'mobile' ? 'no-scrollbar' : 'd-tx-pills-row'}
      style={
        variant === 'mobile'
          ? {
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            padding: '4px 16px 16px 16px',
            WebkitOverflowScrolling: 'touch',
            alignItems: 'center',
          }
          : { alignItems: 'center' }
      }
    >
      {TYPE_PILLS.map((pill) => (
        <button
          key={pill.id}
          type="button"
          onClick={() => setTypeFilter(pill.id)}
          aria-pressed={typeFilter === pill.id}
          className={`d-tx-pill ${typeFilter === pill.id ? 'active' : 'inactive'}`}
          style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          {pill.label}
        </button>
      ))}
      <select
        className="tx-duration-select"
        aria-label="Duration"
        value={dateRangeFilter}
        onChange={(e) => setDateRangeFilter(e.target.value as DateRangeFilter)}
      >
        {DATE_RANGE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );

  // The pager under either tab's list.
  const renderListFooter = (variant: 'mobile' | 'desktop') => {
    if (totalCount === 0 && !listError) return null;
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
          margin: variant === 'mobile' ? '4px 16px 16px 16px' : '0 0 24px 0'
        }}
      >
        {listError ? (
          <div role="alert" style={{ fontSize: '13px', color: 'var(--danger)', textAlign: 'center' }}>
            {listError}
          </div>
        ) : null}
        {totalCount > 0 ? (
          <ClientPagination
            page={currentPage}
            pageSize={pageSize}
            totalItems={totalCount}
            onPageChange={goToPage}
            onPageSizeChange={variant === 'desktop' ? setPageSize : undefined}
            disabled={isRefreshing}
            compact={variant === 'mobile'}
          />
        ) : null}
      </div>
    );
  };

  // Empty-state copy, shared by both layouts and both tabs.
  const emptyListMessage = (fallback: string) =>
    listError || (isRefreshing ? "Loading transactions…" : fallback);

  // The list dims while a new query is in flight; the old rows stay put
  // rather than flashing empty.
  const listBusyStyle = {
    opacity: isRefreshing ? 0.6 : 1,
    transition: 'opacity 0.15s ease'
  };

  // Rendered beside, not inside, either layout so resizing across the mobile
  // breakpoint does not remount it (and refetch) mid-edit.
  const detailController = openTxn ? (
    <TransactionDetailController
      key={openTxn.id}
      transactionId={openTxn.id}
      initialRow={openTxn.row ?? null}
      // Approve/reject is reviewer-only; the backend 403s clients.
      canReview={false}
      onClose={closeTransaction}
      onChanged={(change, detail) => handleTransactionChanged(openTxn.id, change, detail)}
    />
  ) : null;

  // Emailed documents sit under the list: the "couldn't use a document you
  // emailed" notification links to #emailed-documents. The list renders
  // nothing for a client who has never emailed one.
  const withDetailController = (page: ReactNode) => (
    <>
      {page}
      <div id="emailed-documents" style={{ padding: isMobile ? '0 16px 96px' : '0 0 24px' }}>
        <EmailDocumentsHint compact />
        <ClientEmailedDocuments />
      </div>
      {detailController}
    </>
  );

  if (isMobile) {
    return withDetailController(
      <Skeleton
        name="client-transactions-page-skeleton"
        loading={isLoading}
        fallback={<ClientTransactionsSkeleton isMobile={true} />}
      >
        <div className="mobile-client-dashboard" style={{ background: 'var(--surface-0)', minHeight: '100vh', paddingBottom: '90px', fontFamily: "'Inter', -apple-system, sans-serif" }}>

          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 16px',
            background: 'var(--surface-1)',
            borderBottom: '1px solid var(--border)',
            position: 'sticky',
            top: 0,
            zIndex: 50
          }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Transactions</h1>
            <Link
              href={addTransactionHref}
              aria-label="Add transaction"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "40px",
                height: "40px",
                borderRadius: "20px",
                background: "#1a235a",
                color: "#ffffff",
                textDecoration: "none"
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ width: "20px", height: "20px" }}
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </Link>
          </div>

          {/* Search Box */}
          <div style={{ padding: '16px 16px 8px 16px' }}>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '18px', height: '18px', color: 'var(--text-muted)' }}>
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search Transactions"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 42px 12px 42px',
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  fontSize: '15px',
                  background: 'var(--surface-1)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)'
                }}
              />
              <button
                type="button"
                onClick={openFilterSheet}
                style={{
                  position: 'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  display: 'flex',
                  alignItems: 'center',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  outline: 'none'
                }}
                aria-label="Filter transactions"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px', color: 'var(--text-secondary)' }}>
                  <line x1="4" y1="21" x2="4" y2="14" />
                  <line x1="4" y1="10" x2="4" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12" y2="3" />
                  <line x1="20" y1="21" x2="20" y2="16" />
                  <line x1="20" y1="12" x2="20" y2="3" />
                  <line x1="1" y1="14" x2="7" y2="14" />
                  <line x1="9" y1="8" x2="15" y2="8" />
                  <line x1="17" y1="16" x2="23" y2="16" />
                </svg>
              </button>
            </div>
          </div>

          {/* Income / Expense for the listed set */}
          <div style={{ padding: '0 16px 16px 16px' }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              padding: '18px 16px', 
              borderRadius: '16px', 
              background: 'var(--surface-1)', 
              border: '1px solid var(--border)', 
              boxShadow: '0 4px 12px rgba(16, 24, 40, 0.01)' 
            }}>
              <div style={{ paddingRight: '12px', minWidth: 0 }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>Income</span>
                <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500' }}>{durationLabel}</span>
                <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--success)', marginTop: '4px' }}>
                  {displayIncomeTotal != null ? formatExactCurrency(displayIncomeTotal, { showPlus: true }) : "—"}
                </div>
              </div>
              <div style={{ paddingLeft: '20px', borderLeft: '1px solid var(--border)', minWidth: 0 }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>Expense</span>
                <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500' }}>{durationLabel}</span>
                <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--danger)', marginTop: '4px' }}>
                  {displayExpenseTotal != null ? formatExactCurrency(-displayExpenseTotal, { showPlus: true }) : "—"}
                </div>
              </div>
            </div>
          </div>

          {/* Tabs Control */}
          <div style={{
            display: 'flex',
            gap: '8px',
            padding: '4px 16px 8px 16px',
            alignItems: 'center'
          }}>
            <button
              type="button"
              onClick={() => setActiveTab('reviewed')}
              className={`m-db-subtab-btn ${activeTab === 'reviewed' ? 'is-active' : ''}`}
              style={{
                background: activeTab === 'reviewed' ? 'var(--surface-1)' : 'transparent',
                color: activeTab === 'reviewed' ? 'var(--text-primary)' : 'var(--text-muted)',
                padding: '8px 16px',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: activeTab === 'reviewed' ? '0 2px 8px rgba(0, 0, 0, 0.05)' : 'none',
                border: activeTab === 'reviewed' ? '1px solid var(--border)' : '1px solid transparent',
                transition: 'all 0.2s'
              }}
            >
              Transactions
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`m-db-subtab-btn ${activeTab === 'pending' ? 'is-active' : ''}`}
              style={{
                background: activeTab === 'pending' ? 'var(--surface-1)' : 'transparent',
                color: activeTab === 'pending' ? 'var(--text-primary)' : 'var(--text-muted)',
                padding: '8px 16px',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: activeTab === 'pending' ? '0 2px 8px rgba(0, 0, 0, 0.05)' : 'none',
                border: activeTab === 'pending' ? '1px solid var(--border)' : '1px solid transparent',
                transition: 'all 0.2s'
              }}
            >
              To Be Reviewed ({pendingCount})
            </button>
          </div>

          {/* Type + duration, above either tab: they filter both lists. */}
          <div ref={listTopRef} />
          {renderFilterRow('mobile')}

          {activeTab === 'reviewed' ? (
            <>
              {/* Grouped Transactions List */}
              {Object.keys(groupedTransactions).length === 0 ? (
                <div style={{ margin: '0 16px', textAlign: 'center', padding: '32px 16px', color: 'var(--text-secondary)', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '16px', ...listBusyStyle }}>
                  {emptyListMessage("No transactions found matching search or filter criteria.")}
                </div>
              ) : (
                Object.entries(groupedTransactions).map(([dateLabel, items]) => (
                  <div key={dateLabel} style={{ marginBottom: '20px', ...listBusyStyle }}>
                    <h4 style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)', margin: '0 16px 8px 16px' }}>
                      {dateLabel}
                    </h4>

                    <div style={{
                      margin: '0 16px',
                      background: 'var(--surface-1)',
                      border: '1px solid var(--border)',
                      borderRadius: '16px',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      boxShadow: '0 4px 12px rgba(16, 24, 40, 0.01)'
                    }}>
                      {items.map((tx, idx) => (
                        <div
                          key={tx.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => openTransaction(tx.id)}
                          onKeyDown={(e) => handleRowKeyDown(e, () => openTransaction(tx.id))}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '16px',
                            borderBottom: idx < items.length - 1 ? '1px solid var(--border)' : 'none',
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                            <div 
                              className={`m-db-activity-icon-box ${rowTone(tx.type)}`}
                              style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}
                            >
                              <RowIcon type={tx.type} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                              <strong style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {tx.description}
                              </strong>
                              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', display: 'block', wordBreak: 'break-word' }}>
                                {rowTypeBadge(tx.type, tx.categoryName) ? (
                                  <span className="tx-type-badge">{rowTypeBadge(tx.type, tx.categoryName)}</span>
                                ) : null}
                                {tx.categoryName} {tx.meta ? `- ${tx.meta}` : ''}
                              </span>
                            </div>
                          </div>
                          <span 
                            style={{ 
                              fontSize: '15px', 
                              fontWeight: '700', 
                              textAlign: 'right', 
                              flexShrink: 0, 
                              marginLeft: '12px',
                              color: rowTone(tx.type) === 'income'
                                ? 'var(--success)'
                                : rowTone(tx.type) === 'expense'
                                  ? 'var(--danger)'
                                  : 'var(--text-secondary)'
                            }}
                          >
                            {rowAmountText(tx.type, tx.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </>
          ) : (
            /* To Be Reviewed */
            <div style={{ padding: '0 16px 16px 16px', display: 'flex', flexDirection: 'column', gap: '12px', ...listBusyStyle }}>
              {pendingTransactions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-secondary)', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '16px' }}>
                  {emptyListMessage("Nothing awaiting review.")}
                </div>
              ) : (
                pendingTransactions.map((tx) => (
                <div
                  key={tx.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openTransaction(tx.id)}
                  onKeyDown={(e) => handleRowKeyDown(e, () => openTransaction(tx.id))}
                  style={{
                    background: 'var(--surface-1)',
                    border: '1px solid var(--border)',
                    borderRadius: '16px',
                    padding: '16px 20px',
                    boxShadow: '0 4px 12px rgba(16, 24, 40, 0.01)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '12px',
                      background: '#FDF2E9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5" style={{ width: '20px', height: '20px' }}>
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                      <strong style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tx.entityName}
                      </strong>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', display: 'block', wordBreak: 'break-word' }}>
                        {[tx.meta, tx.createdAt || tx.invoiceDate ? `Submitted ${formatSubmittedAt(tx.createdAt, tx.invoiceDate)}` : ""].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                  </div>
                  <span style={{
                    padding: '6px 12px',
                    borderRadius: '100px',
                    fontSize: '12px',
                    fontWeight: '600',
                    background: '#FDF2E9',
                    color: '#D97706',
                    whiteSpace: 'nowrap',
                    marginLeft: '12px'
                  }}>
                    Pending review
                  </span>
                </div>
                ))
              )}
            </div>
          )}

          {renderListFooter('mobile')}

          {/* Filters Bottom Sheet Drawer */}
          {isFilterSheetOpen && (
            <>
              {/* Backdrop */}
              <div
                className="m-filter-backdrop"
                onClick={handleCancelFilters}
                style={{
                  position: 'fixed',
                  left: 0,
                  top: 0,
                  width: '100vw',
                  height: '100vh',
                  background: 'rgba(0, 0, 0, 0.4)',
                  zIndex: 1000
                }}
              />

              {/* Sheet Drawer */}
              <div
                className="m-filter-sheet"
                style={{
                  position: 'fixed',
                  left: 0,
                  bottom: 0,
                  width: '100%',
                  maxHeight: '88vh',
                  background: 'var(--surface-1)',
                  borderTop: '1px solid var(--border)',
                  borderTopLeftRadius: '24px',
                  borderTopRightRadius: '24px',
                  boxShadow: '0 -8px 24px rgba(0, 0, 0, 0.25)',
                  padding: '8px 16px 24px 16px',
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  zIndex: 1001,
                  fontFamily: 'Inter, -apple-system, sans-serif'
                }}
              >
                {/* Drag Handle */}
                <div style={{ width: '40px', height: '4px', background: 'var(--border)', borderRadius: '2px', margin: '0 auto 16px auto' }} />

                {/* Header Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Filters</h2>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    style={{ border: 'none', background: 'none', color: 'var(--brand)', fontSize: '15px', fontWeight: 600, padding: 0, cursor: 'pointer', outline: 'none' }}
                  >
                    Clear all
                  </button>
                </div>

                {/* Scrollable Filters Content */}
                <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
                  {/* Type Filter */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '8px' }}>Type</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {TYPE_FILTER_OPTIONS.map((t) => {
                        const isActive = tempType === t;
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setTempType(t)}
                            className={`m-db-filter-pill ${isActive ? 'is-active' : ''}`}
                            style={{
                              padding: '8px 16px',
                              borderRadius: '20px',
                              fontSize: '14px',
                              fontWeight: 600,
                              border: `1px solid ${isActive ? 'var(--brand)' : 'var(--border)'}`,
                              background: isActive ? 'var(--brand)' : 'var(--surface-2)',
                              color: isActive ? '#ffffff' : 'var(--text-primary)',
                              textTransform: 'capitalize',
                              cursor: 'pointer',
                              outline: 'none'
                            }}
                          >
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ height: '1px', background: 'var(--border)', margin: '12px 0' }} />

                  {/* Date Range Filter */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '8px' }}>Date Range</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {DATE_RANGE_OPTIONS.map((d) => {
                        const isActive = tempDateRange === d.value;
                        return (
                          <button
                            key={d.value}
                            type="button"
                            onClick={() => setTempDateRange(d.value)}
                            className={`m-db-filter-pill ${isActive ? 'is-active' : ''}`}
                            style={{
                              padding: '8px 16px',
                              borderRadius: '20px',
                              fontSize: '14px',
                              fontWeight: 600,
                              border: `1px solid ${isActive ? 'var(--brand)' : 'var(--border)'}`,
                              background: isActive ? 'var(--brand)' : 'var(--surface-2)',
                              color: isActive ? '#ffffff' : 'var(--text-primary)',
                              cursor: 'pointer',
                              outline: 'none'
                            }}
                          >
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ height: '1px', background: 'var(--border)', margin: '12px 0' }} />

                  {/* Entity Filter */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '8px' }}>Entity</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setTempEntity('all')}
                        className={`m-db-filter-pill ${tempEntity === 'all' ? 'is-active' : ''}`}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '20px',
                          fontSize: '14px',
                          fontWeight: 600,
                          border: `1px solid ${tempEntity === 'all' ? 'var(--brand)' : 'var(--border)'}`,
                          background: tempEntity === 'all' ? 'var(--brand)' : 'var(--surface-2)',
                          color: tempEntity === 'all' ? '#ffffff' : 'var(--text-primary)',
                          cursor: 'pointer',
                          outline: 'none'
                        }}
                      >
                        All
                      </button>
                      {entityOptions.map((ent) => {
                        const isActive = tempEntity === ent.id;
                        return (
                          <button
                            key={ent.id}
                            type="button"
                            onClick={() => setTempEntity(ent.id)}
                            className={`m-db-filter-pill ${isActive ? 'is-active' : ''}`}
                            style={{
                              padding: '8px 16px',
                              borderRadius: '20px',
                              fontSize: '14px',
                              fontWeight: 600,
                              border: `1px solid ${isActive ? 'var(--brand)' : 'var(--border)'}`,
                              background: isActive ? 'var(--brand)' : 'var(--surface-2)',
                              color: isActive ? '#ffffff' : 'var(--text-primary)',
                              cursor: 'pointer',
                              outline: 'none'
                            }}
                          >
                            {ent.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ height: '1px', background: 'var(--border)', margin: '12px 0' }} />

                  {/* Properties Filter */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '8px' }}>Properties</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setTempProperty('all')}
                        className={`m-db-filter-pill ${tempProperty === 'all' ? 'is-active' : ''}`}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '20px',
                          fontSize: '14px',
                          fontWeight: 600,
                          border: `1px solid ${tempProperty === 'all' ? 'var(--brand)' : 'var(--border)'}`,
                          background: tempProperty === 'all' ? 'var(--brand)' : 'var(--surface-2)',
                          color: tempProperty === 'all' ? '#ffffff' : 'var(--text-primary)',
                          cursor: 'pointer',
                          outline: 'none'
                        }}
                      >
                        All
                      </button>
                      {propertyFilterOptions.map((prop) => {
                        const isActive = tempProperty === prop.id;
                        return (
                          <button
                            key={prop.id}
                            type="button"
                            onClick={() => setTempProperty(prop.id)}
                            className={`m-db-filter-pill ${isActive ? 'is-active' : ''}`}
                            style={{
                              padding: '8px 16px',
                              borderRadius: '20px',
                              fontSize: '14px',
                              fontWeight: 600,
                              border: `1px solid ${isActive ? 'var(--brand)' : 'var(--border)'}`,
                              background: isActive ? 'var(--brand)' : 'var(--surface-2)',
                              color: isActive ? '#ffffff' : 'var(--text-primary)',
                              cursor: 'pointer',
                              outline: 'none'
                            }}
                          >
                            {prop.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div style={{ height: '1px', background: 'var(--border)', margin: '16px 0' }} />

                {/* Footer buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={handleCancelFilters}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '16px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface-2)',
                      color: 'var(--text-secondary)',
                      fontSize: '15px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyFilters}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '16px',
                      border: 'none',
                      background: 'var(--brand)',
                      color: '#ffffff',
                      fontSize: '15px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </Skeleton>
    );
  }

  // Desktop / Tablet Responsive View
  return withDetailController(
    <Skeleton
      name="client-transactions-page-skeleton-desktop"
      loading={isLoading}
      fallback={<ClientTransactionsSkeleton isMobile={false} />}
    >
      <div className="desktop-client-dashboard">

        {/* Header */}
        <div className="d-tx-header">
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Transactions</h1>
          <Link
            href={addTransactionHref}
            className="d-tx-add-btn"
            aria-label="Add transaction"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ width: "20px", height: "20px" }}
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </Link>
        </div>

        {/* Content Area */}
        <div className="d-tx-content-area">
          {/* Search Box & Filters Button */}
          <div className="d-tx-search-container">
            <div className="d-tx-search-wrapper">
              <div className="d-tx-search-icon-box">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '18px', height: '18px', color: '#98a2b3' }}>
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search transactions"
                value={searchQuery}
                className="d-tx-search-input"
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={openFilterSheet}
              className="d-tx-filter-btn"
              aria-label="Filter transactions"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '20px', height: '20px' }}>
                <line x1="4" y1="21" x2="4" y2="14" />
                <line x1="4" y1="10" x2="4" y2="3" />
                <line x1="12" y1="21" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12" y2="3" />
                <line x1="20" y1="21" x2="20" y2="16" />
                <line x1="20" y1="12" x2="20" y2="3" />
                <line x1="1" y1="14" x2="7" y2="14" />
                <line x1="9" y1="8" x2="15" y2="8" />
                <line x1="17" y1="16" x2="23" y2="16" />
              </svg>
            </button>
          </div>

          {/* Income / Expense for the listed set */}
          <div className="d-tx-mtd-grid">
            <div className="d-tx-mtd-card">
              <span className="d-tx-mtd-label">Income · {durationLabel}</span>
              <div className="d-tx-mtd-value income">
                {displayIncomeTotal != null ? formatExactCurrency(displayIncomeTotal) : "—"}
              </div>
            </div>
            <div className="d-tx-mtd-card">
              <span className="d-tx-mtd-label">Expense · {durationLabel}</span>
              <div className="d-tx-mtd-value expense">
                {displayExpenseTotal != null ? formatExactCurrency(-displayExpenseTotal) : "—"}
              </div>
            </div>
          </div>

          {/* Tabs Control */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '24px',
            alignItems: 'center'
          }}>
            <button
              type="button"
              onClick={() => setActiveTab('reviewed')}
              style={{
                background: activeTab === 'reviewed' ? 'var(--surface-1)' : 'transparent',
                color: activeTab === 'reviewed' ? 'var(--text-primary)' : 'var(--text-muted)',
                padding: '8px 16px',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: activeTab === 'reviewed' ? '0 2px 8px rgba(0, 0, 0, 0.05)' : 'none',
                border: activeTab === 'reviewed' ? '1px solid var(--border)' : '1px solid transparent',
                transition: 'all 0.2s'
              }}
            >
              Transactions
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              style={{
                background: activeTab === 'pending' ? 'var(--surface-1)' : 'transparent',
                color: activeTab === 'pending' ? 'var(--text-primary)' : 'var(--text-muted)',
                padding: '8px 16px',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: activeTab === 'pending' ? '0 2px 8px rgba(0, 0, 0, 0.05)' : 'none',
                border: activeTab === 'pending' ? '1px solid var(--border)' : '1px solid transparent',
                transition: 'all 0.2s'
              }}
            >
              To Be Reviewed ({pendingCount})
            </button>
          </div>

          {/* Type + duration, above either tab: they filter both lists. */}
          <div ref={listTopRef} />
          {renderFilterRow('desktop')}

          {activeTab === 'reviewed' ? (
            <>
              {/* Grouped Transactions List */}
              {Object.keys(groupedTransactions).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-secondary)', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '16px', fontSize: '15px', ...listBusyStyle }}>
                  {emptyListMessage("No transactions found matching search or filter criteria.")}
                </div>
              ) : (
                Object.entries(groupedTransactions).map(([dateLabel, items]) => (
                  <div key={dateLabel} style={{ marginBottom: '24px', ...listBusyStyle }}>
                    <h4 className="d-tx-group-title">
                      {dateLabel}
                    </h4>

                    <div className="d-tx-list-card">
                      {items.map((tx) => (
                        <div
                          key={tx.id}
                          className="d-tx-row"
                          role="button"
                          tabIndex={0}
                          onClick={() => openTransaction(tx.id)}
                          onKeyDown={(e) => handleRowKeyDown(e, () => openTransaction(tx.id))}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="d-tx-left">
                            <div className={`d-tx-icon-box ${rowTone(tx.type)}`}>
                              <RowIcon type={tx.type} />
                            </div>
                            <div className="d-tx-info">
                              <strong className="d-tx-desc">{tx.description}</strong>
                              <span className="d-tx-meta">
                                {rowTypeBadge(tx.type, tx.categoryName) ? (
                                  <span className="tx-type-badge">{rowTypeBadge(tx.type, tx.categoryName)}</span>
                                ) : null}
                                {tx.categoryName} {tx.meta ? `— ${tx.meta}` : ''}
                              </span>
                            </div>
                          </div>
                          <span className={`d-tx-amount ${rowTone(tx.type)}`}>
                            {rowAmountText(tx.type, tx.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </>
          ) : (
            /* To Be Reviewed */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px', ...listBusyStyle }}>
              {pendingTransactions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--text-secondary)', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '16px' }}>
                  {emptyListMessage("Nothing awaiting review.")}
                </div>
              ) : (
                pendingTransactions.map((tx) => (
                <div
                  key={tx.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openTransaction(tx.id)}
                  onKeyDown={(e) => handleRowKeyDown(e, () => openTransaction(tx.id))}
                  style={{
                    background: 'var(--surface-1)',
                    border: '1px solid var(--border)',
                    borderRadius: '16px',
                    padding: '20px 24px',
                    boxShadow: '0 4px 12px rgba(16, 24, 40, 0.01)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: 0 }}>
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '12px',
                      background: '#FDF2E9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5" style={{ width: '22px', height: '22px' }}>
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                      <strong style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tx.entityName}
                      </strong>
                      <span style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '2px', display: 'block', wordBreak: 'break-word' }}>
                        {[tx.meta, tx.createdAt || tx.invoiceDate ? `Submitted ${formatSubmittedAt(tx.createdAt, tx.invoiceDate)}` : ""].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                  </div>
                  <span style={{
                    padding: '6px 14px',
                    borderRadius: '100px',
                    fontSize: '13px',
                    fontWeight: '600',
                    background: '#FDF2E9',
                    color: '#D97706',
                    whiteSpace: 'nowrap',
                    marginLeft: '16px'
                  }}>
                    Pending review
                  </span>
                </div>
                ))
              )}
            </div>
          )}

          {renderListFooter('desktop')}
        </div>

        {/* Desktop Filters Modal */}
        {isFilterSheetOpen && (
          <div className="d-filter-modal-overlay" onClick={handleCancelFilters}>
            <div className="d-filter-modal-card" onClick={(e) => e.stopPropagation()}>

              {/* Header Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Filters</h2>
                <button
                  type="button"
                  onClick={handleClearAll}
                  style={{ border: 'none', background: 'none', color: 'var(--brand)', fontSize: '15px', fontWeight: 600, padding: 0, cursor: 'pointer', outline: 'none' }}
                >
                  Clear all
                </button>
              </div>

              {/* Scrollable Filters Content */}
              <div style={{ overflowY: 'auto', maxHeight: '55vh', paddingRight: '4px' }}>
                {/* Type Filter */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '8px' }}>Type</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {TYPE_FILTER_OPTIONS.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTempType(t)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '20px',
                          fontSize: '14px',
                          fontWeight: 600,
                          border: `1px solid ${tempType === t ? 'var(--brand)' : 'var(--border)'}`,
                          background: tempType === t ? 'var(--brand)' : 'var(--surface-2)',
                          color: tempType === t ? '#ffffff' : 'var(--text-primary)',
                          textTransform: 'capitalize',
                          cursor: 'pointer',
                          outline: 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ height: '1px', background: 'var(--border)', margin: '14px 0' }} />

                {/* Date Range Filter */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '8px' }}>Date Range</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {DATE_RANGE_OPTIONS.map((d) => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => setTempDateRange(d.value)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '20px',
                          fontSize: '14px',
                          fontWeight: 600,
                          border: `1px solid ${tempDateRange === d.value ? 'var(--brand)' : 'var(--border)'}`,
                          background: tempDateRange === d.value ? 'var(--brand)' : 'var(--surface-2)',
                          color: tempDateRange === d.value ? '#ffffff' : 'var(--text-primary)',
                          cursor: 'pointer',
                          outline: 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ height: '1px', background: 'var(--border)', margin: '14px 0' }} />

                {/* Entity Filter */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '8px' }}>Entity</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setTempEntity('all')}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '20px',
                        fontSize: '14px',
                        fontWeight: 600,
                        border: `1px solid ${tempEntity === 'all' ? 'var(--brand)' : 'var(--border)'}`,
                        background: tempEntity === 'all' ? 'var(--brand)' : 'var(--surface-2)',
                        color: tempEntity === 'all' ? '#ffffff' : 'var(--text-primary)',
                        cursor: 'pointer',
                        outline: 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      All
                    </button>
                    {entityOptions.map((ent) => (
                      <button
                        key={ent.id}
                        type="button"
                        onClick={() => setTempEntity(ent.id)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '20px',
                          fontSize: '14px',
                          fontWeight: 600,
                          border: `1px solid ${tempEntity === ent.id ? 'var(--brand)' : 'var(--border)'}`,
                          background: tempEntity === ent.id ? 'var(--brand)' : 'var(--surface-2)',
                          color: tempEntity === ent.id ? '#ffffff' : 'var(--text-primary)',
                          cursor: 'pointer',
                          outline: 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {ent.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ height: '1px', background: 'var(--border)', margin: '14px 0' }} />

                {/* Properties Filter */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '8px' }}>Properties</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setTempProperty('all')}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '20px',
                        fontSize: '14px',
                        fontWeight: 600,
                        border: `1px solid ${tempProperty === 'all' ? 'var(--brand)' : 'var(--border)'}`,
                        background: tempProperty === 'all' ? 'var(--brand)' : 'var(--surface-2)',
                        color: tempProperty === 'all' ? '#ffffff' : 'var(--text-primary)',
                        cursor: 'pointer',
                        outline: 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      All
                    </button>
                    {propertyFilterOptions.map((prop) => (
                      <button
                        key={prop.id}
                        type="button"
                        onClick={() => setTempProperty(prop.id)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '20px',
                          fontSize: '14px',
                          fontWeight: 600,
                          border: `1px solid ${tempProperty === prop.id ? 'var(--brand)' : 'var(--border)'}`,
                          background: tempProperty === prop.id ? 'var(--brand)' : 'var(--surface-2)',
                          color: tempProperty === prop.id ? '#ffffff' : 'var(--text-primary)',
                          cursor: 'pointer',
                          outline: 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {prop.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ height: '1px', background: 'var(--border)', margin: '16px 0' }} />

              {/* Footer buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <button
                  type="button"
                  onClick={handleCancelFilters}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface-2)',
                    color: 'var(--text-secondary)',
                    fontSize: '15px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyFilters}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'var(--brand)',
                    color: '#ffffff',
                    fontSize: '15px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Skeleton>
  );
}
