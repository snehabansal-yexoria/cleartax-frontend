"use client";

import React, { useMemo } from "react";

export interface CountryCodeRule {
  code: string;
  name: string;
  flag: string;
  minLen: number;
  maxLen: number;
}

export const COUNTRY_CODES: CountryCodeRule[] = [
  { code: "61", name: "Australia", flag: "🇦🇺", minLen: 9, maxLen: 9 },
  { code: "91", name: "India", flag: "🇮🇳", minLen: 10, maxLen: 10 },
  { code: "1", name: "US/Canada", flag: "🇺🇸", minLen: 10, maxLen: 10 },
  { code: "44", name: "UK", flag: "🇬🇧", minLen: 10, maxLen: 10 },
  { code: "64", name: "New Zealand", flag: "🇳🇿", minLen: 8, maxLen: 10 },
  { code: "65", name: "Singapore", flag: "🇸🇬", minLen: 8, maxLen: 8 },
  { code: "971", name: "UAE", flag: "🇦🇪", minLen: 9, maxLen: 9 },
  { code: "33", name: "France", flag: "🇫🇷", minLen: 9, maxLen: 9 },
  { code: "49", name: "Germany", flag: "🇩🇪", minLen: 10, maxLen: 11 },
  { code: "81", name: "Japan", flag: "🇯🇵", minLen: 10, maxLen: 10 },
];

export function validatePhone(value: string): { isValid: boolean; error?: string } {
  const clean = value.replace(/[\s\-()]/g, "");
  
  if (!clean) {
    return { isValid: true };
  }
  
  if (!clean.startsWith("+")) {
    return { isValid: false, error: "Phone number must start with '+' followed by country code." };
  }
  
  const digitsOnly = clean.substring(1);
  if (!/^\d+$/.test(digitsOnly)) {
    return { isValid: false, error: "Phone number must contain only numbers after '+'." };
  }
  
  const matchedRule = [...COUNTRY_CODES]
    .sort((a, b) => b.code.length - a.code.length)
    .find((rule) => digitsOnly.startsWith(rule.code));
    
  if (matchedRule) {
    const localDigits = digitsOnly.substring(matchedRule.code.length);
    const cleanLocalDigits = localDigits.replace(/^0/, "");
    const len = cleanLocalDigits.length;
    if (len < matchedRule.minLen || len > matchedRule.maxLen) {
      if (matchedRule.minLen === matchedRule.maxLen) {
        return {
          isValid: false,
          error: `Phone number for ${matchedRule.name} must have ${matchedRule.minLen} digits (excluding leading 0).`,
        };
      } else {
        return {
          isValid: false,
          error: `Phone number for ${matchedRule.name} must be between ${matchedRule.minLen} and ${matchedRule.maxLen} digits.`,
        };
      }
    }
  } else {
    const len = digitsOnly.length;
    if (len < 7 || len > 15) {
      return {
        isValid: false,
        error: "Invalid phone number length. It should be between 7 and 15 digits (including country code).",
      };
    }
  }
  
  return { isValid: true };
}

export interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  placeholder?: string;
  disabled?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}

export function PhoneInput({
  value,
  onChange,
  error = false,
  placeholder = "Enter phone number",
  disabled = false,
  inputRef,
  onKeyDown,
}: PhoneInputProps) {
  // Parse country code and local digits from value
  const parsed = useMemo(() => {
    const clean = value.trim();
    if (!clean.startsWith("+")) {
      // Default country selection to Australia (61)
      return { selectedCode: "61", localPart: clean };
    }
    
    const digitsOnly = clean.substring(1).replace(/[\s\-()]/g, "");
    
    const matched = [...COUNTRY_CODES]
      .sort((a, b) => b.code.length - a.code.length)
      .find((c) => digitsOnly.startsWith(c.code));
      
    if (matched) {
      const local = clean.substring(1 + matched.code.length).trim();
      return { selectedCode: matched.code, localPart: local };
    }
    
    // Fallback for custom code
    const firstTwo = digitsOnly.substring(0, 2);
    return { selectedCode: firstTwo, localPart: clean.substring(1 + firstTwo.length).trim() };
  }, [value]);

  const { selectedCode, localPart } = parsed;

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCode = e.target.value;
    const local = localPart.replace(/[^0-9\s+\-()]/g, "");
    onChange(`+${newCode} ${local}`.trim());
  };

  const handleLocalNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const localRaw = e.target.value;
    const localFiltered = localRaw.replace(/[^0-9\s+\-()]/g, "");
    onChange(`+${selectedCode} ${localFiltered}`.trim());
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        width: "100%",
        gap: "6px",
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
        }}
      >
        <select
          value={selectedCode}
          onChange={handleCountryChange}
          disabled={disabled}
          style={{
            height: "100%",
            padding: "10px 30px 10px 14px",
            fontSize: "14px",
            color: "#344054",
            background: "#ffffff",
            border: `1.5px solid ${error ? "#fda29b" : "#d0d5dd"}`,
            borderRadius: "10px",
            outline: "none",
            cursor: "pointer",
            appearance: "none",
            WebkitAppearance: "none",
            MozAppearance: "none",
            fontWeight: 500,
          }}
        >
          {COUNTRY_CODES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} +{c.code}
            </option>
          ))}
          {!COUNTRY_CODES.some((c) => c.code === selectedCode) && selectedCode && (
            <option value={selectedCode}>
              🌐 +{selectedCode}
            </option>
          )}
        </select>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{
            position: "absolute",
            right: "12px",
            width: "14px",
            height: "14px",
            color: "#667085",
            pointerEvents: "none",
          }}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>

      <input
        ref={inputRef}
        type="tel"
        placeholder={placeholder}
        value={localPart}
        disabled={disabled}
        onChange={handleLocalNumberChange}
        onKeyDown={onKeyDown}
        style={{
          flex: 1,
          padding: "10px 14px",
          border: `1.5px solid ${error ? "#fda29b" : "#d0d5dd"}`,
          borderRadius: "10px",
          fontSize: "14px",
          color: "#101828",
          outline: "none",
          transition: "border-color 0.2s",
        }}
      />
    </div>
  );
}
