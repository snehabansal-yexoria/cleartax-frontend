"use client";

import { HttpError, useAsyncRegion, type AsyncRegion } from "./useAsyncRegion";

/**
 * The signed-in user, as GET /api/users/me returns it (camelCase, normalised
 * by the BFF route).
 */
export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  roleId: number | null;
  orgId: string;
  orgName: string;
  status: string;
  phoneNumber: string;
  assignedAccountantId: string;
  assignedAccountantName: string;
  assignedAccountantEmail: string;
};

/**
 * One /api/users/me request per token, shared by everyone who asks.
 *
 * The dashboard layout, the page under it and the page's hooks each used to
 * fetch /api/users/me on mount — two or three identical calls per load, each
 * one a backend round-trip. They now share one in-flight promise. It is keyed
 * by the token, so a refreshed token (or another user signing in) starts a
 * fresh request, and a failure is never cached.
 */
let cached: { token: string; promise: Promise<CurrentUser> } | null = null;

export function fetchCurrentUser(token: string): Promise<CurrentUser> {
  if (cached && cached.token === token) return cached.promise;

  const promise = (async () => {
    const res = await fetch("/api/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body: unknown = await res.json().catch(() => null);
      const message =
        typeof body === "object" && body !== null && "error" in body
          ? String((body as { error?: unknown }).error)
          : `Request failed (${res.status}).`;
      throw new HttpError(res.status, message);
    }
    return (await res.json()) as CurrentUser;
  })();

  cached = { token, promise };
  promise.catch(() => {
    if (cached?.promise === promise) cached = null;
  });
  return promise;
}

/** Drop the cached user — after the profile is edited, or on logout. */
export function invalidateCurrentUser() {
  cached = null;
}

/** The signed-in user as a page region, sharing fetchCurrentUser's request. */
export function useCurrentUser(): AsyncRegion<CurrentUser> {
  return useAsyncRegion("me-profile", (token: string) => fetchCurrentUser(token));
}
