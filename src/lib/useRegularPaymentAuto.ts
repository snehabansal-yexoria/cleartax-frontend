"use client";

import { useEffect, useRef, useState } from "react";
import { formatDateAU } from "./dates";
import { nextDueDate, regularBillFrequency, type RegularFrequency } from "./regularPayments";

/**
 * The "Is this a regular payment?" behaviour shared by every categorise form.
 *
 * - Picking Council rates, Water charges, Body Corporate / Strata, Insurance
 *   or Land tax (an expense) switches the toggle on and sets How often to that
 *   bill's usual frequency. Picking another category switches it back off,
 *   unless the user turned it on themselves.
 * - The due date fills itself in from the invoice date and How often (the
 *   next date after today), until the user types their own. Changing How
 *   often fills it in again.
 *
 * The form keeps its own toggle, due date and alert name state; this hook
 * only drives them. `autoEnabled` = false (editing a saved transaction)
 * leaves what was saved alone.
 */
export function useRegularPaymentAuto({
  type,
  categoryName,
  invoiceDate,
  isRegular,
  setIsRegular,
  dueDate,
  setDueDate,
  autoEnabled = true,
  initialFrequency,
}: {
  type: string | null | undefined;
  categoryName: string | null | undefined;
  /** YYYY-MM-DD. */
  invoiceDate: string;
  isRegular: boolean;
  setIsRegular: (on: boolean) => void;
  /** YYYY-MM-DD. */
  dueDate: string;
  setDueDate: (iso: string) => void;
  autoEnabled?: boolean;
  initialFrequency?: RegularFrequency | null;
}) {
  const billFrequency = regularBillFrequency(type, categoryName);
  const [frequency, setFrequencyState] = useState<RegularFrequency>(initialFrequency ?? "monthly");
  // Switched on by the category (not the user) — shows the "Turned on because…" note.
  const [autoOn, setAutoOn] = useState(false);
  // The due date is ours to fill until the user types a date.
  const [dueAuto, setDueAuto] = useState(autoEnabled);
  const lastKey = useRef<string | null>(null);

  const key = `${type ?? ""}|${(categoryName ?? "").trim().toLowerCase()}`;
  useEffect(() => {
    if (lastKey.current === key) return;
    lastKey.current = key;
    if (!autoEnabled) return;
    if (billFrequency) {
      setIsRegular(true);
      setFrequencyState(billFrequency);
      setAutoOn(true);
      setDueAuto(true);
    } else if (autoOn) {
      setIsRegular(false);
      setAutoOn(false);
    }
    // Runs when the category changes; the setters are stable state setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, autoEnabled]);

  useEffect(() => {
    if (!isRegular || !dueAuto) return;
    const next = nextDueDate(invoiceDate, frequency);
    if (next && next !== dueDate) setDueDate(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRegular, dueAuto, frequency, invoiceDate]);

  const invoiceLabel = /^\d{4}-\d{2}-\d{2}/.test(invoiceDate) ? formatDateAU(invoiceDate) : "";
  const dueHint = !dueAuto
    ? "Changed by you. Pick How often again to fill it in from the invoice date."
    : invoiceLabel
      ? `Next ${frequency === "annually" ? "yearly" : frequency} date after the invoice date (${invoiceLabel}). You can change it.`
      : "Enter the invoice date and this fills itself in.";

  return {
    /** The category is one of the five regular bills (and it's an expense). */
    isRegularCategory: billFrequency !== null,
    /** On because of the category, not the user. */
    autoOn: autoOn && isRegular,
    frequency,
    /** How often, picked by the user: refills the due date. */
    setFrequency: (f: RegularFrequency) => {
      setFrequencyState(f);
      setDueAuto(true);
    },
    /** Call from the toggle's onChange along with the form's own handling. */
    onToggle: (on: boolean) => {
      setAutoOn(false);
      if (on) setDueAuto(true);
    },
    /** Call from the due date input's onChange along with setDueDate. */
    onDueDateTyped: () => setDueAuto(false),
    dueHint,
  };
}
