"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

/**
 * Tiny stale-while-revalidate cache shared by every console page.
 *
 * Resources are keyed strings; concurrent callers share one in-flight
 * promise, and a page visited again renders instantly from memory while it
 * refreshes in the background once the entry is older than `staleMs`.
 */

type Entry<T> = {
  data?: T;
  error?: Error;
  promise?: Promise<T>;
  fetchedAt: number;
};

const store = new Map<string, Entry<unknown>>();
const listeners = new Map<string, Set<() => void>>();
const fetchers = new Map<string, () => Promise<unknown>>();
const DEFAULT_STALE_MS = 2 * 60 * 1000;

function notify(key: string) {
  listeners.get(key)?.forEach((listener) => listener());
}

function subscribe(key: string, listener: () => void) {
  const set = listeners.get(key) ?? new Set();
  set.add(listener);
  listeners.set(key, set);
  return () => {
    set.delete(listener);
  };
}

export function loadResource<T>(key: string, fetcher: () => Promise<T>, force = false): Promise<T> {
  const entry = (store.get(key) as Entry<T> | undefined) ?? { fetchedAt: 0 };
  if (entry.promise && !force) return entry.promise;

  const promise = fetcher()
    .then((data) => {
      store.set(key, { data, fetchedAt: Date.now() });
      notify(key);
      return data;
    })
    .catch((error: unknown) => {
      const current = store.get(key) as Entry<T> | undefined;
      store.set(key, {
        data: current?.data,
        error: error instanceof Error ? error : new Error(String(error)),
        fetchedAt: Date.now(),
      });
      notify(key);
      throw error;
    });

  store.set(key, { ...entry, promise });
  notify(key);
  return promise;
}

/**
 * Marks matching entries stale. Entries with mounted readers refetch straight
 * away (keeping their current data on screen); the rest refetch on next use.
 */
export function invalidateResource(prefix: string) {
  for (const key of [...store.keys()]) {
    if (!key.startsWith(prefix)) continue;
    const fetcher = fetchers.get(key);
    if (fetcher && listeners.get(key)?.size) {
      loadResource(key, fetcher, true).catch(() => undefined);
    } else {
      store.delete(key);
    }
  }
}

export type Resource<T> = {
  data: T | undefined;
  error: Error | undefined;
  isLoading: boolean;
  reload: () => void;
};

export function useResource<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  staleMs = DEFAULT_STALE_MS,
): Resource<T> {
  const snapshot = useSyncExternalStore(
    useCallback((listener) => (key ? subscribe(key, listener) : () => undefined), [key]),
    () => (key ? (store.get(key) as Entry<T> | undefined) : undefined),
    () => undefined,
  );
  if (key) fetchers.set(key, fetcher);

  useEffect(() => {
    if (!key) return;
    const entry = store.get(key);
    const isStale = !entry || Date.now() - entry.fetchedAt > staleMs;
    if (!entry?.promise && isStale) {
      loadResource(key, fetcher).catch(() => undefined);
    } else if (entry?.promise && entry.data === undefined && !entry.error) {
      entry.promise.catch(() => undefined);
    }
    // The fetcher identity changes every render; the key is the cache identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, staleMs]);

  const reload = useCallback(() => {
    if (!key) return;
    loadResource(key, fetcher, true).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return {
    data: snapshot?.data,
    error: snapshot?.data === undefined ? snapshot?.error : undefined,
    isLoading: Boolean(key) && snapshot?.data === undefined && !snapshot?.error,
    reload,
  };
}
