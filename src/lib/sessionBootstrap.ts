import { normalizeRoleName } from "./roleNames";

const bootstrapKey = "clearPortfolio.sessionBootstrap";
const maxBootstrapAgeMs = 60_000;

export type SessionBootstrap = {
  email: string;
  role: string;
  orgName: string;
  savedAt: number;
};

function canUseSessionStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function saveSessionBootstrap(input: {
  email?: string;
  role?: string;
  orgName?: string;
}) {
  if (!canUseSessionStorage()) return;

  const role = normalizeRoleName(input.role);
  if (!role) return;

  window.sessionStorage.setItem(
    bootstrapKey,
    JSON.stringify({
      email: input.email || "",
      role,
      orgName: input.orgName || "",
      savedAt: Date.now(),
    } satisfies SessionBootstrap),
  );
}

export function readSessionBootstrap(): SessionBootstrap | null {
  if (!canUseSessionStorage()) return null;

  try {
    const raw = window.sessionStorage.getItem(bootstrapKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<SessionBootstrap>;
    const savedAt =
      typeof parsed.savedAt === "number" && Number.isFinite(parsed.savedAt)
        ? parsed.savedAt
        : 0;

    if (Date.now() - savedAt > maxBootstrapAgeMs) {
      clearSessionBootstrap();
      return null;
    }

    const role = normalizeRoleName(parsed.role);
    if (!role) return null;

    return {
      email: typeof parsed.email === "string" ? parsed.email : "",
      role,
      orgName: typeof parsed.orgName === "string" ? parsed.orgName : "",
      savedAt,
    };
  } catch {
    clearSessionBootstrap();
    return null;
  }
}

export function clearSessionBootstrap() {
  if (!canUseSessionStorage()) return;
  window.sessionStorage.removeItem(bootstrapKey);
}
