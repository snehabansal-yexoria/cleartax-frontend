"use client";

import { clearClientApiCache } from "@/src/lib/clientApiCache";

export interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

export interface AccountantClientRecord {
  id: string;
  email: string;
  status: string;
  name: string;
  phoneNumber: string;
  invitedByEmail: string;
  joinedAt: string | null;
  assignedAccountantId?: string;
  assignedAccountantName?: string;
  isAssignedToCurrentAccountant?: boolean;
  isAssignedToAnotherAccountant?: boolean;
}

export interface AccountantClientsBundle {
  allClients: AccountantClientRecord[];
  myClients: AccountantClientRecord[];
  fetchedAt: number;
}

const CACHE_VERSION = "v1";
const CACHE_PREFIX = `cleartax_accountant_clients:${CACHE_VERSION}`;

let memoryCache: {
  key: string;
  bundle: AccountantClientsBundle;
} | null = null;
let inflightRequest: Promise<AccountantClientsBundle> | null = null;

function decodeTokenSubject(token: string) {
  try {
    const [, payload] = token.split(".");
    if (!payload) return "anonymous";
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(window.atob(normalized));
    return String(json.sub || json.email || "anonymous");
  } catch {
    return "anonymous";
  }
}

function getCacheKey(token: string) {
  return `${CACHE_PREFIX}:${decodeTokenSubject(token)}`;
}

function isFresh(bundle: AccountantClientsBundle) {
  return Number.isFinite(bundle.fetchedAt);
}

function readStoredBundle(key: string) {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const bundle = JSON.parse(raw) as AccountantClientsBundle;
    return isFresh(bundle) ? bundle : null;
  } catch {
    return null;
  }
}

function storeBundle(key: string, bundle: AccountantClientsBundle) {
  memoryCache = { key, bundle };
  try {
    window.sessionStorage.setItem(key, JSON.stringify(bundle));
  } catch {
    // Session storage can be unavailable in private browsing or strict modes.
  }
}

export function clearAccountantClientsCache() {
  memoryCache = null;
  inflightRequest = null;
  clearClientApiCache();

  try {
    for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith(CACHE_PREFIX)) {
        window.sessionStorage.removeItem(key);
      }
    }
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}

export async function fetchAccountantClientsBundle(
  token: string,
  options: { force?: boolean } = {},
) {
  const key = getCacheKey(token);

  if (!options.force) {
    if (memoryCache?.key === key && isFresh(memoryCache.bundle)) {
      return memoryCache.bundle;
    }

    const storedBundle = readStoredBundle(key);
    if (storedBundle) {
      memoryCache = { key, bundle: storedBundle };
      return storedBundle;
    }

    if (inflightRequest) {
      return inflightRequest;
    }
  }

  inflightRequest = fetch("/api/users/me/clients?scope=dashboard", {
    cache: options.force ? "reload" : "default",
    headers: { Authorization: `Bearer ${token}` },
  })
    .then(async (res) => {
      if (!res.ok) {
        throw new Error("Failed to load accountant clients");
      }

      const data = (await res.json()) as {
        allClients?: AccountantClientRecord[];
        myClients?: AccountantClientRecord[];
        clients?: AccountantClientRecord[];
      };

      const bundle: AccountantClientsBundle = {
        allClients: data.allClients || data.clients || [],
        myClients: data.myClients || [],
        fetchedAt: Date.now(),
      };

      storeBundle(key, bundle);
      return bundle;
    })
    .finally(() => {
      inflightRequest = null;
    });

  return inflightRequest;
}
