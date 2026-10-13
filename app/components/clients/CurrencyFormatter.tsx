import React from 'react';

// Single place to change the currency configuration for all pages
export const CURRENCY_PREFIX = "A$";
export const CURRENCY_SPACER = " ";

/**
 * Helper function to format currency value according to the client spec:
 * - Positive: "A$ 348"
 * - Negative: "A$ -90K" (negative sign goes after the currency prefix and spacer)
 */
export function formatClientCurrency(
  value: number | string,
  options: { short?: boolean; decimals?: number; showPlus?: boolean } = {}
): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (num === null || num === undefined || isNaN(num)) {
    return '';
  }

  const isNegative = num < 0;
  const absValue = Math.abs(num);
  let formattedValue = '';

  if (options.short) {
    if (absValue >= 1000000) {
      formattedValue = `${(absValue / 1000000).toFixed(options.decimals ?? 2)}M`;
    } else if (absValue >= 1000) {
      const kVal = absValue / 1000;
      if (options.decimals !== undefined) {
        formattedValue = `${kVal.toFixed(options.decimals)}K`;
      } else if (kVal % 1 === 0) {
        formattedValue = `${kVal.toFixed(0)}K`;
      } else {
        formattedValue = `${kVal.toFixed(1)}K`;
      }
    } else {
      formattedValue = absValue.toLocaleString("en-US", {
        minimumFractionDigits: options.decimals ?? 0,
        maximumFractionDigits: options.decimals ?? 0,
      });
    }
  } else {
    // Normal formatting: Defaults to 0 decimals unless decimals options are provided, 
    // to match "A$ 348" format requested.
    const dec = options.decimals !== undefined ? options.decimals : 0;
    formattedValue = absValue.toLocaleString("en-US", {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    });
  }

  // The sign follows the ROUNDED value: -0.3 prints "A$ 0", never "A$ -0", and
  // a zero never gets a "+".
  const roundsToZero = !/[1-9]/.test(formattedValue);
  const sign = roundsToZero ? '' : isNegative ? '-' : (options.showPlus ? '+' : '');

  return `${CURRENCY_PREFIX}${CURRENCY_SPACER}${sign}${formattedValue}`;
}

/**
 * A signed percentage with the same rule as formatClientCurrency: the sign is
 * decided after rounding, so a tiny negative prints "0.0%", not "-0.0%".
 */
export function formatClientPercent(
  value: number,
  options: { decimals?: number; showPlus?: boolean } = {},
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  const formatted = Math.abs(value).toFixed(options.decimals ?? 1);
  const roundsToZero = !/[1-9]/.test(formatted);
  const sign = roundsToZero ? '' : value < 0 ? '-' : (options.showPlus ? '+' : '');
  return `${sign}${formatted}%`;
}

/**
 * Colour for a signed money figure: green when it is positive, red when it is
 * negative, neutral at zero. Returns a CSS custom property, so it follows the
 * client theme in light and dark mode.
 */
export function signedTone(value: number): string {
  if (value > 0) return 'var(--success)';
  if (value < 0) return 'var(--danger)';
  return 'var(--text-primary)';
}

/**
 * The class form of signedTone, for elements whose stylesheet colour is
 * `!important` green (.m-db-portfolio-value, .m-db-property-net,
 * .m-db-entity-net, .return-value) — an inline colour cannot beat those; the
 * .is-positive / .is-negative rules in client.css do.
 */
export function toneClass(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '';
  if (value > 0) return 'is-positive';
  if (value < 0) return 'is-negative';
  return '';
}

export function getCurrencyPrefix(): string {
  return `${CURRENCY_PREFIX}${CURRENCY_SPACER}`;
}

export function formatCurrency(
  value: number | string,
  options: { decimals?: number } = {}
): string {
  // If the original formatCurrency gets decimals, we pass it, otherwise default to 2 for compatibility
  return formatClientCurrency(value, { decimals: options.decimals ?? 2 });
}

export function formatCurrencyShort(value: number | string): string {
  return formatClientCurrency(value, { short: true });
}

interface CurrencyFormatterProps {
  value: number | string;
  short?: boolean;
  decimals?: number;
  className?: string;
  showPlus?: boolean;
}

/**
 * CurrencyFormatter React Component.
 * Usage: <CurrencyFormatter value={1234} /> -> A$ 1,234
 *        <CurrencyFormatter value={-90000} short /> -> A$ -90K
 */
export const CurrencyFormatter: React.FC<CurrencyFormatterProps> = ({
  value,
  short = false,
  decimals,
  className = '',
  showPlus = false,
}) => {
  const formatted = formatClientCurrency(value, { short, decimals, showPlus });
  return <span className={className}>{formatted}</span>;
};

export default CurrencyFormatter;

