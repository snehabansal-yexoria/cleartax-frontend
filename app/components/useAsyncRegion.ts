"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AUTH_EXPIRED_MESSAGE,
  AuthTokenError,
  getIdToken,
} from "@/src/lib/authToken";

/**
 * One request = one independently rendering region of a page.
 *
 * A region is the unit the entity page paints in: the header, a stat card, the
 * GST tiles, a panel, a tab body. Each owns exactly one request and exposes a
 * status the UI maps onto shimmer / content / error-with-retry. Nothing here
 * ever rejects the page — a failed region shows its own error, so this gives
 * `Promise.allSettled` semantics without anyone writing `allSettled`.
 *
 * Loading is DERIVED, not stored: a request is identified by `key` plus a
 * reload nonce, and the region is loading whenever the last settled request id
 * is not the current one. That means no `setState` inside an effect body and no
 * ref writes during render, which eslint-plugin-react-hooks 7 rejects.
 */

export type RegionStatus = "idle" | "loading" | "ready" | "error";

export type RegionErrorKind = "auth" | "http" | "network";

export type AsyncRegion<T> = {
  status: RegionStatus;
  /** Last good value. Kept while the same key reloads; cleared on a key change. */
  data: T | null;
  error: string | null;
  errorKind: RegionErrorKind | null;
  /** Refetch the current key. No-op while the key is `null`. */
  reload: () => void;
  /** Optimistic local edit of the current key's data (mutations, rollbacks). */
  setData: (updater: (current: T | null) => T | null) => void;
};

/** A non-2xx response from a BFF route, carrying the status for branching. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

function messageFromBody(body: unknown, status: number): string {
  if (typeof body === "object" && body !== null) {
    const record = body as { message?: unknown; error?: unknown };
    if (typeof record.message === "string" && record.message) return record.message;
    if (typeof record.error === "string" && record.error) return record.error;
  }
  return `Request failed (${status}).`;
}

/**
 * Authenticated JSON GET against a same-origin BFF route.
 *
 * Throws {@link HttpError} on a non-2xx response, with the message taken from
 * the `{message}` shape `renderUpstreamError` produces or the `{error}` shape
 * the older routes use.
 */
export async function fetchJson<T>(
  url: string,
  token: string,
  signal: AbortSignal,
): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    throw new HttpError(res.status, messageFromBody(body, res.status));
  }
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

function isAbortError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    (err as { name?: unknown }).name === "AbortError"
  );
}

function classify(err: unknown): { message: string; kind: RegionErrorKind } {
  if (err instanceof AuthTokenError) {
    return { message: err.message, kind: "auth" };
  }
  if (err instanceof HttpError) {
    return { message: err.message, kind: err.status === 401 ? "auth" : "http" };
  }
  if (err instanceof TypeError) {
    // fetch() rejects with a TypeError when the request never got a response.
    return {
      message: "Could not reach the server. Check your connection and try again.",
      kind: "network",
    };
  }
  return {
    message: err instanceof Error && err.message ? err.message : "Something went wrong.",
    kind: "network",
  };
}

type Settled<T> = {
  /** The request id that produced this entry. */
  id: string;
  key: string;
  data: T | null;
  error: string | null;
  errorKind: RegionErrorKind | null;
};

const noop = () => {};

/**
 * Load `key` with `load(token, signal)` and expose it as an {@link AsyncRegion}.
 *
 * - `key === null` → `idle`, nothing is fetched.
 * - A key change or {@link AsyncRegion.reload} starts a new request; the
 *   previous one is aborted and its rejection ignored.
 * - The last good `data` survives a reload of the SAME key (and an error on
 *   it), so a Retry never blanks a region that already had content.
 *
 * `load` is read through a ref at request time, so callers need not memoise it.
 */
export function useAsyncRegion<T>(
  key: string | null,
  load: (token: string, signal: AbortSignal) => Promise<T>,
): AsyncRegion<T> {
  const [nonce, setNonce] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);

  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const requestId = key === null ? null : `${nonce}:${key}`;

  useEffect(() => {
    if (requestId === null || key === null) return;

    const controller = new AbortController();
    const { signal } = controller;
    const id = requestId;
    const requestKey = key;

    const fail = (err: unknown) => {
      if (signal.aborted || isAbortError(err)) return;
      const { message, kind } = classify(err);
      setSettled((prev) => ({
        id,
        key: requestKey,
        data: prev && prev.key === requestKey ? prev.data : null,
        error: message,
        errorKind: kind,
      }));
    };

    (async () => {
      let token: string;
      try {
        token = await getIdToken();
      } catch (err) {
        fail(err);
        return;
      }
      if (signal.aborted) return;
      try {
        const data = await loadRef.current(token, signal);
        if (signal.aborted) return;
        setSettled({ id, key: requestKey, data, error: null, errorKind: null });
      } catch (err) {
        fail(err);
      }
    })();

    return () => controller.abort();
  }, [requestId, key]);

  const reload = useCallback(() => {
    setNonce((n) => n + 1);
  }, []);

  const setData = useCallback(
    (updater: (current: T | null) => T | null) => {
      if (key === null) return;
      setSettled((prev) => {
        if (!prev || prev.key !== key) return prev;
        return { ...prev, data: updater(prev.data) };
      });
    },
    [key],
  );

  if (requestId === null) {
    return {
      status: "idle",
      data: null,
      error: null,
      errorKind: null,
      reload: noop,
      setData: noop,
    };
  }

  const sameKey = settled !== null && settled.key === key;
  const isLoading = !settled || settled.id !== requestId;
  const data = sameKey ? settled.data : null;

  if (isLoading) {
    return { status: "loading", data, error: null, errorKind: null, reload, setData };
  }
  if (settled.error) {
    return {
      status: "error",
      data,
      error: settled.error,
      errorKind: settled.errorKind,
      reload,
      setData,
    };
  }
  return { status: "ready", data, error: null, errorKind: null, reload, setData };
}

/**
 * Adapts the legacy `{ isLoading, error, data, reload }` hooks (GST, personal,
 * asset, depreciation) to the region shape so presentational components take
 * one prop type. `setData` is a no-op: those hooks own their state.
 */
export function toRegion<T>(
  isLoading: boolean,
  error: string | null,
  data: T | null,
  reload: () => void,
): AsyncRegion<T> {
  if (isLoading) {
    return { status: "loading", data, error: null, errorKind: null, reload, setData: noop };
  }
  if (error) {
    return {
      status: "error",
      data,
      error,
      errorKind: error === AUTH_EXPIRED_MESSAGE ? "auth" : "http",
      reload,
      setData: noop,
    };
  }
  return { status: "ready", data, error: null, errorKind: null, reload, setData: noop };
}
