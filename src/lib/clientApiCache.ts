"use client";

type CachedApiResponse = {
  body: string;
  contentType: string;
  status: number;
  statusText: string;
  storedAt: number;
};

const CACHE_VERSION = "v1";
const CACHE_PREFIX = `cleartax_api_cache:${CACHE_VERSION}:`;
const INSTALL_FLAG = "__cleartaxApiCacheInstalled";
const ORIGINAL_FETCH = "__cleartaxOriginalFetch";

declare global {
  interface Window {
    [INSTALL_FLAG]?: boolean;
    [ORIGINAL_FETCH]?: typeof fetch;
  }
}

function getOriginalFetch() {
  return window[ORIGINAL_FETCH] || window.fetch.bind(window);
}

function isInternalApiUrl(url: URL) {
  return url.origin === window.location.origin && url.pathname.startsWith("/api/");
}

function normalizeMethod(init?: RequestInit, input?: RequestInfo | URL) {
  const method =
    init?.method || (input instanceof Request ? input.method : undefined) || "GET";
  return method.toUpperCase();
}

function shouldBypassCache(init?: RequestInit, input?: RequestInfo | URL) {
  if (init?.cache === "no-store" || init?.cache === "reload") return true;
  if (input instanceof Request) {
    return input.cache === "no-store" || input.cache === "reload";
  }
  return false;
}

function getHeaderValue(
  name: string,
  init?: RequestInit,
  input?: RequestInfo | URL,
) {
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  if (init?.headers) {
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  }
  return headers.get(name) || "";
}

function getRequestUrl(input: RequestInfo | URL) {
  const value = input instanceof Request ? input.url : input.toString();
  return new URL(value, window.location.origin);
}

function getCacheKey(input: RequestInfo | URL, init?: RequestInit) {
  const url = getRequestUrl(input);
  const auth = getHeaderValue("authorization", init, input);
  const accept = getHeaderValue("accept", init, input);
  return `${CACHE_PREFIX}${url.toString()}:auth=${auth}:accept=${accept}`;
}

function readCachedResponse(key: string) {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as CachedApiResponse) : null;
  } catch {
    return null;
  }
}

function writeCachedResponse(key: string, value: CachedApiResponse) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable or full; the app should keep working normally.
  }
}

function createResponse(cached: CachedApiResponse) {
  return new Response(cached.body, {
    status: cached.status,
    statusText: cached.statusText,
    headers: {
      "content-type": cached.contentType,
      "x-cleartax-cache": "HIT",
    },
  });
}

export function clearClientApiCache() {
  if (typeof window === "undefined") return;

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

export function installClientApiCache() {
  if (typeof window === "undefined" || window[INSTALL_FLAG]) return;

  window[INSTALL_FLAG] = true;
  window[ORIGINAL_FETCH] = window.fetch.bind(window);

  const originalFetch = getOriginalFetch();

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = normalizeMethod(init, input);
    const url = getRequestUrl(input);
    const isInternalApi = isInternalApiUrl(url);

    if (!isInternalApi) {
      return originalFetch(input, init);
    }

    if (method !== "GET") {
      const response = await originalFetch(input, init);
      if (response.ok) {
        clearClientApiCache();
      }
      return response;
    }

    if (shouldBypassCache(init, input) || init?.signal?.aborted) {
      return originalFetch(input, init);
    }

    const key = getCacheKey(input, init);
    const cached = readCachedResponse(key);
    if (cached) {
      return createResponse(cached);
    }

    const response = await originalFetch(input, init);
    if (!response.ok) {
      return response;
    }

    const contentType = response.headers.get("content-type") || "";
    if (
      contentType.includes("application/json") ||
      contentType.startsWith("text/")
    ) {
      const body = await response.clone().text();
      writeCachedResponse(key, {
        body,
        contentType,
        status: response.status,
        statusText: response.statusText,
        storedAt: Date.now(),
      });
    }

    return response;
  };
}
