// Minimal structured logger for server-side (route handler) use.
//
// Emits one-line JSON so logs are greppable and don't dump full stack traces
// or large response payloads. Errors are reduced to their meaningful fields —
// for CoreApiError that means status/code/path, not the whole object.

type LogContext = Record<string, unknown>;

interface CoreApiErrorLike {
  name: string;
  status: number;
  code: string | null;
  upstreamMessage: string | null;
  method: string;
  path: string;
}

// Structural check so we don't import CoreApiError (avoids a coupling cycle and
// works even if the error crossed a module/realm boundary).
function isCoreApiError(error: unknown): error is CoreApiErrorLike {
  return (
    error instanceof Error &&
    error.name === "CoreApiError" &&
    "status" in error &&
    "path" in error
  );
}

// A compact, structured view of an error suitable for logging.
export function errorSummary(error: unknown): Record<string, unknown> {
  if (isCoreApiError(error)) {
    return {
      kind: "CoreApiError",
      method: error.method,
      path: error.path,
      status: error.status,
      code: error.code ?? undefined,
      upstreamMessage: error.upstreamMessage ?? undefined,
    };
  }
  if (error instanceof Error) {
    return {
      kind: error.name || "Error",
      message: error.message,
    };
  }
  return { kind: "unknown", message: String(error) };
}

// A short, stable signature for grouping many similar failures.
// e.g. "CoreApiError 504/timeout" or "TypeError".
export function errorSignature(error: unknown): string {
  if (isCoreApiError(error)) {
    return `CoreApiError ${error.status}/${error.code ?? "?"}`;
  }
  if (error instanceof Error) {
    return error.name || "Error";
  }
  return "unknown";
}

function emit(
  level: "error" | "warn" | "info",
  message: string,
  context?: LogContext,
) {
  const line = JSON.stringify({ level, msg: message, ...context });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export function logError(message: string, error: unknown, context?: LogContext) {
  emit("error", message, { ...context, error: errorSummary(error) });
}

export function logWarn(message: string, context?: LogContext) {
  emit("warn", message, context);
}

export function logInfo(message: string, context?: LogContext) {
  emit("info", message, context);
}

// Collapse a batch of failures into grouped counts plus a representative
// sample, so a storm of identical errors logs as one informative line.
export function summarizeFailures(errors: readonly unknown[]): {
  total: number;
  bySignature: Record<string, number>;
  sample: Record<string, unknown> | null;
} {
  const bySignature: Record<string, number> = {};
  for (const error of errors) {
    const signature = errorSignature(error);
    bySignature[signature] = (bySignature[signature] ?? 0) + 1;
  }
  return {
    total: errors.length,
    bySignature,
    sample: errors.length > 0 ? errorSummary(errors[0]) : null,
  };
}
