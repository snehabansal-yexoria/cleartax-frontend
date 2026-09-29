import type {
  CognitoRefreshToken,
  CognitoUser,
  CognitoUserSession,
} from "amazon-cognito-identity-js";
import { userPool } from "./cognito";

/**
 * One memoised, deduplicated accessor for the Cognito session and id token.
 *
 * `src/lib/session.ts#getSession` calls `userPool.getCurrentUser()` on every
 * call, which constructs a fresh `CognitoUser`. The library keeps its parsed
 * session on the *instance* (`signInUserSession`), so a fresh instance never
 * hits that in-memory fast path: each call re-reads ~5 localStorage keys and
 * re-decodes the JWTs, and when the token has expired every concurrent caller
 * fires its own Cognito refresh. A page mount with six hooks meant six of each.
 *
 * This module keeps ONE `CognitoUser` per username, caches the last session it
 * produced, and funnels every concurrent caller through a single in-flight
 * promise. It also refreshes pre-emptively inside a short expiry skew so a
 * request never leaves the browser carrying a token that expires in transit.
 *
 * Only the entity page and the dashboard layout use this today; the other
 * `getSession()` call sites migrate later via
 * `export const getSession = getAuthSession` once this has soaked.
 */

/** Refresh when the id token has less than this long left to live. */
const EXPIRY_SKEW_MS = 30_000;

export const AUTH_EXPIRED_MESSAGE =
  "Your session has expired. Please sign in again.";

/** Thrown by {@link getIdToken} when no usable session can be obtained. */
export class AuthTokenError extends Error {
  constructor(message: string = AUTH_EXPIRED_MESSAGE) {
    super(message);
    this.name = "AuthTokenError";
  }
}

let cachedUser: CognitoUser | null = null;
let cachedSession: CognitoUserSession | null = null;
let inFlight: Promise<CognitoUserSession | null> | null = null;
// Bumped by resetAuthCache() and on a username change so a request that was
// already in flight cannot write a stale session into the fresh cache.
let generation = 0;

function clearCache() {
  generation += 1;
  cachedUser = null;
  cachedSession = null;
  inFlight = null;
}

/**
 * The signed-in user, reusing the same `CognitoUser` instance across calls.
 *
 * `userPool.getCurrentUser()` is still consulted every time — it is one
 * localStorage read — because the signed-in username can change underneath us
 * (a login in another tab, or a login page that never called `logout()`), and a
 * cached instance for the previous user would keep serving their tokens.
 */
function currentUser(): CognitoUser | null {
  const latest = userPool.getCurrentUser();
  if (!latest) {
    if (cachedUser) clearCache();
    return null;
  }
  if (!cachedUser || cachedUser.getUsername() !== latest.getUsername()) {
    clearCache();
    cachedUser = latest;
  }
  return cachedUser;
}

function millisUntilExpiry(session: CognitoUserSession): number {
  return session.getIdToken().getExpiration() * 1000 - Date.now();
}

/** Valid per the library AND outside the pre-emptive refresh window. */
function isFresh(
  session: CognitoUserSession | null,
): session is CognitoUserSession {
  return (
    !!session && session.isValid() && millisUntilExpiry(session) > EXPIRY_SKEW_MS
  );
}

function refreshTokenOf(session: CognitoUserSession | null): CognitoRefreshToken | null {
  if (!session) return null;
  try {
    const refresh = session.getRefreshToken();
    return refresh && refresh.getToken() ? refresh : null;
  } catch {
    return null;
  }
}

/**
 * Synchronous: the cached session when it is still fresh, otherwise `null`.
 * Never touches the network. Use it to render optimistically (e.g. a role
 * claim) before {@link getAuthSession} resolves.
 */
export function peekSession(): CognitoUserSession | null {
  const user = currentUser();
  if (!user) return null;
  if (isFresh(cachedSession)) return cachedSession;

  const inMemory = user.getSignInUserSession();
  if (isFresh(inMemory)) {
    cachedSession = inMemory;
    return inMemory;
  }
  return null;
}

/**
 * The current session, or `null` when nobody is signed in.
 *
 * Returns the cached session when it is fresh. Otherwise every concurrent
 * caller shares ONE in-flight promise: a `refreshSession` when the cached
 * session is technically valid but inside the expiry skew (the library's own
 * `getSession` would happily hand that near-expired token back), else the
 * library's `getSession`, which reads storage and refreshes only if expired.
 *
 * Rejects when the refresh fails; {@link getIdToken} turns that into an
 * `AuthTokenError` for callers that only need the bearer string.
 */
export function getAuthSession(): Promise<CognitoUserSession | null> {
  const user = currentUser();
  if (!user) return Promise.resolve(null);
  if (isFresh(cachedSession)) return Promise.resolve(cachedSession);
  if (inFlight) return inFlight;

  const gen = generation;
  const request = new Promise<CognitoUserSession | null>((resolve, reject) => {
    const settle = (err: unknown, session: CognitoUserSession | null) => {
      if (err) {
        if (gen === generation) cachedSession = null;
        reject(err instanceof Error ? err : new Error(String(err)));
        return;
      }
      if (gen === generation) cachedSession = session;
      resolve(session);
    };

    try {
      const stale = cachedSession;
      const refreshToken = stale && stale.isValid() ? refreshTokenOf(stale) : null;
      if (refreshToken) {
        // Inside the skew: valid now, but not for long enough. Refresh
        // pre-emptively so no request leaves with a token that dies in transit.
        user.refreshSession(refreshToken, (err: unknown, session: unknown) => {
          settle(err, (session as CognitoUserSession | null) ?? null);
        });
      } else {
        user.getSession(
          (err: Error | null, session: CognitoUserSession | null) => {
            settle(err, session);
          },
        );
      }
    } catch (err) {
      settle(err, null);
    }
  }).finally(() => {
    if (inFlight === request) inFlight = null;
  });

  inFlight = request;
  return request;
}

/**
 * The id token as a bearer string. Throws {@link AuthTokenError} when there is
 * no signed-in user or the refresh failed — one message, so every region on a
 * page reports the same thing instead of six variations of it.
 */
export async function getIdToken(): Promise<string> {
  let session: CognitoUserSession | null;
  try {
    session = await getAuthSession();
  } catch {
    throw new AuthTokenError();
  }
  const token = session?.getIdToken().getJwtToken();
  if (!token) throw new AuthTokenError();
  return token;
}

/** One claim from the id token payload (`"custom:role"`, `"email"`, …). */
export function idTokenClaim(
  session: CognitoUserSession | null | undefined,
  key: string,
): unknown {
  if (!session) return undefined;
  const payload = session.getIdToken().payload as Record<string, unknown> | undefined;
  return payload?.[key];
}

/**
 * Forget the cached user and session. Call on sign-out so the next page load
 * cannot serve the previous user's token from memory.
 */
export function resetAuthCache(): void {
  clearCache();
}
