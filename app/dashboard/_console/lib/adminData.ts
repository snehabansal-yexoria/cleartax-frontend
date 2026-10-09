"use client";

import type {
  CoreEntity,
  CoreProperty,
  CoreTransactionCategory,
  CoreTransactionListItem,
  ReconciliationListItem,
} from "@/src/lib/coreApi";
import { apiGet, mapWithConcurrency } from "./api";
import { useResource } from "./useResource";

/* -------------------------------------------------------------- shapes */

/** GET /api/users/me/invited */
export type InvitedUser = {
  id: string;
  email: string;
  role: string;
  status: string;
  name: string;
  organizationName: string;
  invitedByEmail: string;
  createdAt: string | null;
};

type InvitedUsersResponse = {
  summary: { total: number; pending: number; admins: number; accountants: number; clients: number; organizations: number };
  users: InvitedUser[];
};

/** GET /api/users/me/clients */
export type ClientRecord = {
  id: string;
  email: string;
  status: string;
  name: string;
  phoneNumber: string;
  invitedByEmail: string;
  joinedAt: string | null;
  assignedAccountantId: string;
  assignedAccountantName: string;
};

export type OrgEntity = CoreEntity & { clientId: string };

export type OrgProperty = CoreProperty & {
  clientId: string;
  entityName: string;
  entityType: string;
  loanBalance: number;
  equity: number;
  state: string;
};

export type OrgStatement = ReconciliationListItem & { entityId: string; clientId: string };

export type Portfolio = {
  entities: OrgEntity[];
  properties: OrgProperty[];
  statements: OrgStatement[];
  /** Number of entity/property calls that failed (e.g. permissions upstream). */
  failedCalls: number;
};

export type OrgTransaction = CoreTransactionListItem;

export type People = {
  accountants: InvitedUser[];
  invitedClients: InvitedUser[];
  clients: ClientRecord[];
  pendingInvites: number;
};

/* ------------------------------------------------------------- helpers */

const STATE_PATTERN = /\b(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\b/i;

export function stateFromLocation(location: string) {
  return location.match(STATE_PATTERN)?.[1]?.toUpperCase() ?? "Other";
}

function loanBalanceOf(property: CoreProperty) {
  const raw = property.loanDetails?.loan_amount ?? property.loanDetails?.loanAmount;
  const amount = Number(raw);
  return Number.isFinite(amount) ? amount : 0;
}

export function isPendingStatus(status: string) {
  return ["INVITED", "PENDING", "FORCE_CHANGE_PASSWORD"].includes(String(status).toUpperCase());
}

/* ------------------------------------------------------------- loaders */

async function loadOrganization() {
  const data = await apiGet<{ organization: { id: string; name: string } | null }>("/api/users/me/organization");
  return data.organization;
}

async function loadPeople(): Promise<People> {
  const [invited, clientsResponse] = await Promise.all([
    apiGet<InvitedUsersResponse>("/api/users/me/invited"),
    apiGet<{ clients: ClientRecord[] }>("/api/users/me/clients"),
  ]);
  const users = invited.users ?? [];
  return {
    accountants: users.filter((user) => user.role === "accountant"),
    invitedClients: users.filter((user) => user.role === "client" || user.role === "user"),
    clients: clientsResponse.clients ?? [],
    pendingInvites: invited.summary?.pending ?? users.filter((user) => isPendingStatus(user.status)).length,
  };
}

async function loadPortfolio(clients: ClientRecord[]): Promise<Portfolio> {
  let failedCalls = 0;
  const entityLists = await mapWithConcurrency(clients, 6, async (client) => {
    try {
      const { items } = await apiGet<{ items: CoreEntity[] }>(
        `/api/entities?client_id=${encodeURIComponent(client.id)}`,
      );
      return (items ?? []).map((entity) => ({ ...entity, clientId: client.id }));
    } catch {
      failedCalls += 1;
      return [] as OrgEntity[];
    }
  });
  const entities = entityLists.flat();

  const perEntity = await mapWithConcurrency(entities, 6, async (entity) => {
    const [properties, statements] = await Promise.all([
      apiGet<{ items: CoreProperty[] }>(`/api/entities/${encodeURIComponent(entity.id)}/properties`)
        .then((data) => data.items ?? [])
        .catch(() => {
          failedCalls += 1;
          return [] as CoreProperty[];
        }),
      apiGet<ReconciliationListItem[]>(`/api/entities/${encodeURIComponent(entity.id)}/reconciliations`)
        .then((data) => (Array.isArray(data) ? data : []))
        .catch(() => [] as ReconciliationListItem[]),
    ]);

    return {
      properties: properties.map((property): OrgProperty => {
        const loanBalance = loanBalanceOf(property);
        const value = Number(property.estimatedMarketValue) || 0;
        return {
          ...property,
          clientId: entity.clientId,
          entityName: entity.name,
          entityType: entity.entityType,
          loanBalance,
          equity: value - loanBalance,
          state: stateFromLocation(property.locationText || ""),
        };
      }),
      statements: statements.map((statement) => ({ ...statement, entityId: entity.id, clientId: entity.clientId })),
    };
  });

  return {
    entities,
    properties: perEntity.flatMap((item) => item.properties),
    statements: perEntity.flatMap((item) => item.statements),
    failedCalls,
  };
}

async function loadTransactions(): Promise<OrgTransaction[]> {
  const pageSize = 100;
  const first = await apiGet<{ items: OrgTransaction[]; total: number }>(
    `/api/transactions?page=1&pageSize=${pageSize}`,
  );
  const pages = Math.ceil((first.total || 0) / pageSize);
  if (pages <= 1) return first.items ?? [];

  const rest = await mapWithConcurrency(
    Array.from({ length: pages - 1 }, (_, index) => index + 2),
    3,
    (page) =>
      apiGet<{ items: OrgTransaction[] }>(`/api/transactions?page=${page}&pageSize=${pageSize}`)
        .then((data) => data.items ?? [])
        .catch(() => [] as OrgTransaction[]),
  );
  return [...(first.items ?? []), ...rest.flat()];
}

async function loadCategories() {
  const { items } = await apiGet<{ items: CoreTransactionCategory[] }>("/api/transactions/categories");
  return items ?? [];
}

/* --------------------------------------------------------------- hooks */

export function useOrganization() {
  return useResource("admin:org", loadOrganization, 10 * 60 * 1000);
}

export function usePeople() {
  return useResource("admin:people", loadPeople);
}

/** Entities, properties and bank statements for every client in the org. */
export function usePortfolio() {
  const people = usePeople();
  const clients = people.data?.clients;
  const key = clients ? `admin:portfolio:${clients.map((client) => client.id).join(",")}` : null;
  const portfolio = useResource(key, () => loadPortfolio(clients ?? []), 5 * 60 * 1000);
  return { ...portfolio, isLoading: people.isLoading || portfolio.isLoading, error: people.error ?? portfolio.error };
}

export function useTransactions() {
  return useResource("admin:transactions", loadTransactions, 5 * 60 * 1000);
}

export function useCategories() {
  return useResource("admin:categories", loadCategories, 10 * 60 * 1000);
}
