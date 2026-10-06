import {
  findDirectoryUserByIdentity,
  type VerifiedTokenLike,
} from "@/src/lib/userDirectory";
import { verifyToken } from "@/src/lib/verifyToken";

type RuleItem = { created_by?: string };

/**
 * Narrows a transaction-rules list payload (shape `{ items: [...] }`) so an
 * accountant only sees the rules they created. Admins and other roles get the
 * payload unchanged.
 *
 * This is a UX-tier filter — the core API remains the real auth boundary. If the
 * caller can't be resolved (bad/expired token, directory miss, transient error)
 * we fail open and return the payload untouched rather than break the rules page.
 */
export async function scopeRulesForAccountant(
  token: string,
  payload: unknown,
): Promise<unknown> {
  if (
    !payload ||
    typeof payload !== "object" ||
    !Array.isArray((payload as { items?: unknown }).items)
  ) {
    return payload; // unexpected shape — pass through
  }

  let requester;
  try {
    const decoded = (await verifyToken(token)) as VerifiedTokenLike | null;
    if (!decoded?.sub) return payload;
    requester = await findDirectoryUserByIdentity({
      id: decoded.sub,
      email: decoded.email,
    });
  } catch {
    return payload;
  }

  if (!requester || requester.role.toLowerCase() !== "accountant") {
    return payload;
  }
  const me = requester;

  const items = (payload as { items: RuleItem[] }).items;
  return {
    ...(payload as object),
    items: items.filter((rule) => rule.created_by === me.id),
  };
}
