"use client";

import { useMemo, useState } from "react";
import { useOrganization, usePeople, usePortfolio, useTransactions, type ClientRecord, type Portfolio } from "./adminData";
import { findPeriod, getPeriods, type PeriodId } from "./metrics";

/** Everything the admin pages read, loaded once and shared through the cache. */
export function useAdminWorkspace() {
  const organization = useOrganization();
  const people = usePeople();
  const portfolio = usePortfolio();
  const transactions = useTransactions();

  return { organization, people, portfolio, transactions };
}

export function usePeriodState(initial: PeriodId = "fy-current") {
  const periods = useMemo(() => getPeriods(), []);
  const [periodId, setPeriodId] = useState<PeriodId>(initial);
  const period = findPeriod(periodId, periods);
  const options = periods.map((item) => ({ value: item.id, label: item.label }));
  return { periodId, setPeriodId, period, periodOptions: options, periods };
}

export type ClientScope = {
  accountantId: string;
  entityType: string;
  state: string;
};

export const ALL = "all";

/** Clients matching the dashboard-style filters. */
export function scopeClients(clients: ClientRecord[], portfolio: Portfolio | undefined, scope: ClientScope) {
  return clients.filter((client) => {
    if (scope.accountantId !== ALL) {
      if (scope.accountantId === "unassigned" ? client.assignedAccountantId : client.assignedAccountantId !== scope.accountantId) {
        return false;
      }
    }
    if (scope.entityType !== ALL) {
      const has = portfolio?.entities.some((entity) => entity.clientId === client.id && entity.entityType === scope.entityType);
      if (!has) return false;
    }
    if (scope.state !== ALL) {
      const has = portfolio?.properties.some((property) => property.clientId === client.id && property.state === scope.state);
      if (!has) return false;
    }
    return true;
  });
}

export const ENTITY_TYPE_OPTIONS = [
  { value: ALL, label: "All entity types" },
  { value: "individual", label: "Individual" },
  { value: "trust", label: "Trust" },
  { value: "smsf", label: "SMSF" },
  { value: "company", label: "Company" },
  { value: "partnership", label: "Partnership" },
];

export const STATE_OPTIONS = [
  { value: ALL, label: "All states" },
  ...["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"].map((state) => ({ value: state, label: state })),
];
