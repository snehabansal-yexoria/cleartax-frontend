"use client";

import React, { forwardRef, useCallback } from "react";

export interface DateValidationResult {
  isValid: boolean;
  sanitizedValue: string;
  error?: string;
}

export interface ValidatedDateInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  min?: string;
  max?: string;
  minYear?: number;
  maxYear?: number;
  disallowFuture?: boolean;
  disallowPast?: boolean;
  onValidationError?: (error: string | null) => void;
}

/**
 * Checks if a given year is a leap year.
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Gets the maximum number of days in a given month of a given year.
 */
export function getDaysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  if ([4, 6, 9, 11].includes(month)) {
    return 30;
  }
  return 31;
}

/**
 * Formats a Date object or date parts into YYYY-MM-DD format.
 */
export function toISODateString(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, "0");
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Gets today's date in YYYY-MM-DD format based on local time.
 */
export function getTodayDateString(): string {
  const now = new Date();
  return toISODateString(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/**
 * Parses and sanitizes various date formats (e.g., DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY)
 * into standard YYYY-MM-DD and validates all constraints.
 */
export function validateAndSanitizeDate(
  value: string,
  options: {
    min?: string;
    max?: string;
    minYear?: number;
    maxYear?: number;
    disallowFuture?: boolean;
    disallowPast?: boolean;
  } = {}
): DateValidationResult {
  if (!value || typeof value !== "string") {
    return { isValid: true, sanitizedValue: "" };
  }

  const {
    min = "1900-01-01",
    max = "2099-12-31",
    minYear = 1900,
    maxYear = 2099,
    disallowFuture = false,
    disallowPast = false,
  } = options;

  let clean = value.replace(/^\+/, "").trim();

  // Try parsing DD/MM/YYYY or DD-MM-YYYY if pasted
  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(clean)) {
    const separator = clean.includes("/") ? "/" : "-";
    const [d, m, y] = clean.split(separator).map(Number);
    clean = toISODateString(y, m, d);
  }

  const parts = clean.split("-");

  // 1. Year Validation & Sanitization (Strictly 4 digits max)
  if (parts.length >= 1 && parts[0]) {
    let yearStr = parts[0];
    if (yearStr.length > 4) {
      yearStr = yearStr.slice(0, 4);
    }
    parts[0] = yearStr;
  }

  // 2. Month Validation (01 - 12)
  if (parts.length >= 2 && parts[1]) {
    let monthNum = parseInt(parts[1], 10);
    if (!Number.isNaN(monthNum)) {
      if (monthNum > 12) monthNum = 12;
      if (monthNum < 1 && parts[1].length === 2) monthNum = 1;
      parts[1] = String(monthNum).padStart(2, "0");
    }
  }

  // 3. Day & Leap Year Validation (01 - 28/29/30/31)
  if (parts.length >= 3 && parts[2]) {
    const yearNum = parseInt(parts[0], 10);
    const monthNum = parseInt(parts[1], 10);
    let dayNum = parseInt(parts[2], 10);

    if (!Number.isNaN(yearNum) && !Number.isNaN(monthNum) && !Number.isNaN(dayNum)) {
      const maxDays = getDaysInMonth(yearNum, monthNum);
      if (dayNum > maxDays) dayNum = maxDays;
      if (dayNum < 1 && parts[2].length === 2) dayNum = 1;
      parts[2] = String(dayNum).padStart(2, "0");
    }
  }

  const sanitized = parts.join("-");

  // Full date check (YYYY-MM-DD complete)
  if (parts.length === 3 && parts[0].length === 4 && parts[1].length === 2 && parts[2].length === 2) {
    const year = parseInt(parts[0], 10);
    const today = getTodayDateString();

    if (year < minYear) {
      return {
        isValid: false,
        sanitizedValue: sanitized,
        error: `Year cannot be earlier than ${minYear}.`,
      };
    }

    if (year > maxYear) {
      return {
        isValid: false,
        sanitizedValue: sanitized,
        error: `Year cannot be later than ${maxYear}.`,
      };
    }

    if (min && sanitized < min) {
      return {
        isValid: false,
        sanitizedValue: sanitized,
        error: `Date cannot be earlier than ${min}.`,
      };
    }

    if (max && sanitized > max) {
      return {
        isValid: false,
        sanitizedValue: sanitized,
        error: `Date cannot be later than ${max}.`,
      };
    }

    if (disallowFuture && sanitized > today) {
      return {
        isValid: false,
        sanitizedValue: sanitized,
        error: "Future dates are not allowed.",
      };
    }

    if (disallowPast && sanitized < today) {
      return {
        isValid: false,
        sanitizedValue: sanitized,
        error: "Past dates are not allowed.",
      };
    }
  }

  return {
    isValid: true,
    sanitizedValue: sanitized,
  };
}

export const ValidatedDateInput = forwardRef<HTMLInputElement, ValidatedDateInputProps>(
  (
    {
      min = "1900-01-01",
      max = "2099-12-31",
      minYear = 1900,
      maxYear = 2099,
      disallowFuture = false,
      disallowPast = false,
      value,
      onChange,
      onBlur,
      onKeyDown,
      onValidationError,
      style,
      className,
      ...props
    },
    ref
  ) => {
    const computedMax = disallowFuture
      ? getTodayDateString() < max
        ? getTodayDateString()
        : max
      : max;

    const computedMin = disallowPast
      ? getTodayDateString() > min
        ? getTodayDateString()
        : min
      : min;

    const handleSanitizeAndValidate = useCallback(
      (rawVal: string, targetEl?: HTMLInputElement) => {
        const result = validateAndSanitizeDate(rawVal, {
          min: computedMin,
          max: computedMax,
          minYear,
          maxYear,
          disallowFuture,
          disallowPast,
        });

        if (targetEl) {
          if (!result.isValid && result.error) {
            targetEl.setCustomValidity(result.error);
          } else {
            targetEl.setCustomValidity("");
          }
        }

        if (onValidationError) {
          onValidationError(result.error || null);
        }

        return result;
      },
      [computedMin, computedMax, minYear, maxYear, disallowFuture, disallowPast, onValidationError]
    );

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawVal = e.target.value;
        const result = handleSanitizeAndValidate(rawVal, e.target);

        if (result.sanitizedValue !== rawVal) {
          e.target.value = result.sanitizedValue;
        }

        if (onChange) {
          onChange(e);
        }
      },
      [handleSanitizeAndValidate, onChange]
    );

    const handleBlur = useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        const rawVal = e.target.value;
        if (rawVal) {
          const result = handleSanitizeAndValidate(rawVal, e.target);
          if (result.sanitizedValue !== rawVal) {
            e.target.value = result.sanitizedValue;
            if (onChange) {
              onChange(e as unknown as React.ChangeEvent<HTMLInputElement>);
            }
          }
        }

        if (onBlur) {
          onBlur(e);
        }
      },
      [handleSanitizeAndValidate, onChange, onBlur]
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        // Prevent typing non-numeric characters in date fields (except Tab, Backspace, Arrow keys, etc.)
        if (
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey &&
          e.key.length === 1 &&
          !/[0-9\-/]/.test(e.key)
        ) {
          e.preventDefault();
        }

        if (onKeyDown) {
          onKeyDown(e);
        }
      },
      [onKeyDown]
    );

    return (
      <input
        {...props}
        ref={ref}
        type="date"
        min={computedMin}
        max={computedMax}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        style={style}
        className={className}
      />
    );
  }
);

ValidatedDateInput.displayName = "ValidatedDateInput";

export default ValidatedDateInput;
