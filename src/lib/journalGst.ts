/**
 * The six GST codes a journal entry line may carry.
 *
 * These are the exact strings the spec allows, and only these. They are
 * DIRECTION-SPECIFIC — "GST Free 0% Sales" and "GST Free Purchases 0%" are
 * different codes — which is why a short-code scheme with a single "FRE" cannot
 * represent them, and why the value stored is the display string itself.
 *
 * The backend holds the same six in Go and again as a `gst_code` table with an
 * FK, so a code that is not one of these is rejected at three levels.
 */
export const JOURNAL_GST_CODES = [
  "GST 10% Sales",
  "GST Free 0% Sales",
  "Out of Scope 0% Sales",
  "GST on Purchases 10%",
  "GST Free Purchases 0%",
  "Out of Scope 0% Purchases",
] as const;

export type GstCode = (typeof JOURNAL_GST_CODES)[number];

/** Which side of the ledger a code belongs to. */
export const GST_CODE_DIRECTION: Record<GstCode, "sales" | "purchases"> = {
  "GST 10% Sales": "sales",
  "GST Free 0% Sales": "sales",
  "Out of Scope 0% Sales": "sales",
  "GST on Purchases 10%": "purchases",
  "GST Free Purchases 0%": "purchases",
  "Out of Scope 0% Purchases": "purchases",
};

export const GST_CODE_RATE: Record<GstCode, number> = {
  "GST 10% Sales": 0.1,
  "GST Free 0% Sales": 0,
  "Out of Scope 0% Sales": 0,
  "GST on Purchases 10%": 0.1,
  "GST Free Purchases 0%": 0,
  "Out of Scope 0% Purchases": 0,
};

export function isGstCode(value: string): value is GstCode {
  return (JOURNAL_GST_CODES as readonly string[]).includes(value);
}

/**
 * Accept the six case- and whitespace-insensitively, so a spreadsheet that
 * lower-cased a column or doubled a space still imports. Anything outside the
 * six is rejected — leniency about formatting, never about the value.
 */
export function normalizeGstCode(raw: string): GstCode | null {
  const want = raw.trim().toLowerCase().split(/\s+/).join(" ");
  if (!want) return null;
  for (const code of JOURNAL_GST_CODES) {
    if (code.toLowerCase().split(/\s+/).join(" ") === want) return code;
  }
  return null;
}

/** Account categories, mirroring the backend's chart_of_account.category. */
export type AccountCategory =
  | "income"
  | "expense"
  | "asset"
  | "liability"
  | "equity";

/** Income and expense accounts post into `transaction`; the rest do not. */
export function isPostableCategory(category: string): boolean {
  return category === "income" || category === "expense";
}

/**
 * Order the dropdown for an account, and pick a sensible default.
 *
 * The code is NOT derived from the account, deliberately. Three of the six are
 * 0% and differ only in intent — bank fees are GST-free, ASIC fees are out of
 * scope, and both hit expense accounts — so no account code can tell them
 * apart. Contra lines make it worse: once an expense account can be credited,
 * the account no longer implies a direction of intent either. So the accountant
 * always chooses, and this only puts the likely three first.
 */
export function gstCodesFor(category: string): {
  preferred: GstCode[];
  rest: GstCode[];
  suggested: GstCode | "";
} {
  if (!isPostableCategory(category)) {
    return { preferred: [], rest: [], suggested: "" };
  }
  const want = category === "income" ? "sales" : "purchases";
  const preferred = JOURNAL_GST_CODES.filter(
    (c) => GST_CODE_DIRECTION[c] === want,
  );
  const rest = JOURNAL_GST_CODES.filter((c) => GST_CODE_DIRECTION[c] !== want);
  return {
    preferred,
    rest,
    suggested: category === "income" ? "GST 10% Sales" : "GST on Purchases 10%",
  };
}

/**
 * Whether a code may be used on an account. The backend rejects a mismatch with
 * a 400; checking here means the accountant sees it on the cell instead.
 */
export function gstCodeAllowedFor(
  category: string,
  code: string,
): { ok: boolean; reason?: string } {
  if (!isPostableCategory(category)) {
    return code
      ? { ok: false, reason: `A ${category} account does not take a GST code` }
      : { ok: true };
  }
  if (!code) return { ok: false, reason: "GST code is required" };
  if (!isGstCode(code)) {
    return { ok: false, reason: "Not one of the approved GST codes" };
  }
  const want = category === "income" ? "sales" : "purchases";
  if (GST_CODE_DIRECTION[code] !== want) {
    return {
      ok: false,
      reason: `${code} is a ${GST_CODE_DIRECTION[code]} code and cannot be used on an ${category} account`,
    };
  }
  return { ok: true };
}
