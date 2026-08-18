// Global currency prefix configuration (change "A$" to "$" or other symbols here)
export const CURRENCY_PREFIX = "A$";

// Spacer between currency symbol and amount (e.g. " " for "A$ 1,230.00")
export const CURRENCY_SPACER = " ";

/**
 * Returns the customized currency symbol prefix (e.g. "A$ ")
 */
export function getCurrencyPrefix(): string {
  return `${CURRENCY_PREFIX}${CURRENCY_SPACER}`;
}

export interface FormatCurrencyOptions {
  decimals?: number;
}

/**
 * Formats a numeric value into a standard currency format (e.g. "A$ 1,230.00")
 */
export function formatCurrency(value: number, options: FormatCurrencyOptions = {}): string {
  const val = value || 0;
  const decimals = options.decimals !== undefined ? options.decimals : 2;
  const formatted = new Intl.NumberFormat("en-AU", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(val));
  return `${getCurrencyPrefix()}${val < 0 ? "-" : ""}${formatted}`;
}

/**
 * Formats a transaction currency value. For expenses, adds a minus sign.
 */
export function formatTransactionCurrency(value: number, isRevenue: boolean): string {
  const val = Math.abs(value || 0);
  const formatted = formatCurrency(val);
  if (isRevenue || val === 0) return formatted;
  return formatted.replace(getCurrencyPrefix(), `${getCurrencyPrefix()}-`);
}

/**
 * Formats a numeric value into a short format with K or M (e.g. "A$ 1.38M" or "A$ -680K")
 */
export function formatCurrencyShort(value: number): string {
  const sign = value < 0 ? "-" : "";
  const absValue = Math.abs(value);
  let numericPart = "";

  if (absValue >= 1000000) {
    numericPart = `${(absValue / 1000000).toFixed(2)}M`;
  } else if (absValue >= 10000) {
    const kVal = absValue / 1000;
    if (kVal % 1 === 0) {
      numericPart = `${kVal.toFixed(0)}K`;
    } else {
      numericPart = `${kVal.toFixed(1)}K`;
    }
  } else {
    numericPart = absValue.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }

  return `${getCurrencyPrefix()}${sign}${numericPart}`;
}
