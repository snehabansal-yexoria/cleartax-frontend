"use client";

import { useEffect, useState } from "react";
import { Field } from "./ui";

export type ProfileValues = { firstName: string; lastName: string; email: string; phone: string };

export function splitName(fullName: string) {
  const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

/** Controlled form state with a "dirty" flag and a reset back to the loaded values. */
export function useFormState<T extends Record<string, string>>(initial: T | undefined) {
  const [values, setValues] = useState<T | undefined>(initial);
  const [baseline, setBaseline] = useState<T | undefined>(initial);

  useEffect(() => {
    if (!initial) return;
    setBaseline(initial);
    setValues(initial);
    // Re-seed only when the loaded data actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initial)]);

  const dirty = Boolean(values && baseline && JSON.stringify(values) !== JSON.stringify(baseline));
  const set = (key: keyof T, value: string) => setValues((current) => (current ? { ...current, [key]: value } : current));
  const reset = () => setValues(baseline);
  return { values, set, dirty, reset };
}

export function PersonalDetailsFields({
  idPrefix,
  values,
  onChange,
  disabled,
}: {
  idPrefix: string;
  values: ProfileValues | undefined;
  onChange: (key: keyof ProfileValues, value: string) => void;
  disabled?: boolean;
}) {
  const field = (key: keyof ProfileValues, label: string, type: string, autoComplete: string, readOnly = false) => (
    <Field label={label} htmlFor={`${idPrefix}-${key}`}>
      <input
        id={`${idPrefix}-${key}`}
        className="cpc-input"
        type={type}
        autoComplete={autoComplete}
        value={values?.[key] ?? ""}
        disabled={disabled || readOnly}
        onChange={(event) => onChange(key, event.target.value)}
      />
    </Field>
  );

  return (
    <div className="cpc-form-grid">
      {field("firstName", "First name", "text", "given-name")}
      {field("lastName", "Last name", "text", "family-name")}
      {field("email", "Email · sign-in", "email", "email", true)}
      {field("phone", "Phone", "tel", "tel")}
    </div>
  );
}
