"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CoreChartAccount } from "@/src/lib/coreApi";
import {
  announceDropdownOpen,
  dropdownRegistryEvent,
  isDropdownRegistryEvent,
} from "@/src/lib/dropdownRegistry";
import { rankChartAccounts } from "./useChartOfAccounts";

interface Props {
  accounts: CoreChartAccount[];
  /** The code currently typed or chosen. */
  value: string;
  invalid?: boolean;
  disabled?: boolean;
  placeholder?: string;
  onSelect: (account: CoreChartAccount | null, rawText: string) => void;
  onTab?: () => void;
  inputRef?: (el: HTMLInputElement | null) => void;
}

/**
 * Searchable Chart of Accounts picker for a grid cell.
 *
 * A dedicated component rather than the app's StaticSelect because that one
 * renders a form-field wrapper (wrong inside a table cell), filters on the
 * label only, and renders every option unvirtualised — fine for twenty
 * categories, not for a chart of several hundred with one picker per line.
 *
 * A code that matches nothing keeps the typed text and reports invalid. It
 * never invents an account: the old grid labelled every unknown code "Custom
 * Account", which read as success and could not be saved.
 */
export default function AccountCodeCombobox({
  accounts,
  value,
  invalid,
  disabled,
  placeholder = "Code",
  onSelect,
  onTab,
  inputRef,
}: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const { matches, more } = useMemo(
    () => rankChartAccounts(accounts, open ? query : "", 50),
    [accounts, query, open],
  );

  // Close when another dropdown opens, or the two stack on top of each other.
  useEffect(() => {
    if (!open) return;
    const onOther = (event: Event) => {
      if (isDropdownRegistryEvent(event) && event.detail?.id !== id) {
        setOpen(false);
      }
    };
    const onClickAway = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener(dropdownRegistryEvent, onOther);
    document.addEventListener("mousedown", onClickAway);
    return () => {
      window.removeEventListener(dropdownRegistryEvent, onOther);
      document.removeEventListener("mousedown", onClickAway);
    };
  }, [open, id]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(
      `[data-index="${activeIndex}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const openList = () => {
    if (disabled) return;
    setOpen(true);
    setActiveIndex(0);
    announceDropdownOpen(id);
  };

  const commit = (account: CoreChartAccount) => {
    setQuery(account.accountCode);
    onSelect(account, account.accountCode);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) openList();
      else setActiveIndex((i) => Math.min(i + 1, matches.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      if (open && matches[activeIndex]) {
        e.preventDefault();
        commit(matches[activeIndex]);
      }
      return;
    }
    if (e.key === "Escape") {
      if (open) {
        e.stopPropagation();
        setOpen(false);
        setQuery(value);
      }
      return;
    }
    if (e.key === "Tab") {
      // Accountants tab through the grid; losing the highlighted pick on Tab
      // would be maddening, so commit it and let focus move on.
      if (open && matches[activeIndex]) commit(matches[activeIndex]);
      onTab?.();
    }
  };

  return (
    <div className="journal-combobox" ref={wrapRef}>
      <input
        ref={inputRef}
        type="text"
        className={`journal-cell-input${invalid ? " is-invalid" : ""}`}
        value={query}
        placeholder={placeholder}
        disabled={disabled}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-invalid={invalid || undefined}
        onFocus={openList}
        onChange={(e) => {
          const text = e.target.value;
          setQuery(text);
          setActiveIndex(0);
          if (!open) openList();
          const hit = accounts.find(
            (a) => a.accountCode.toUpperCase() === text.trim().toUpperCase(),
          );
          onSelect(hit ?? null, text);
        }}
        onKeyDown={handleKeyDown}
      />

      {open && (
        <ul className="journal-combobox-list" id={`${id}-list`} role="listbox" ref={listRef}>
          {matches.length === 0 && (
            <li className="journal-combobox-empty">
              No account matches “{query}”.
            </li>
          )}
          {matches.map((a, i) => (
            <li
              key={a.id}
              data-index={i}
              role="option"
              aria-selected={i === activeIndex}
              className={`journal-combobox-option${i === activeIndex ? " is-active" : ""}`}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                commit(a);
              }}
            >
              <span className="journal-combobox-code">{a.accountCode}</span>
              <span className="journal-combobox-name">{a.accountName}</span>
              <span className={`journal-account-chip is-${a.category}`}>
                {a.category}
              </span>
              <span className="journal-combobox-sub">{a.subcategory}</span>
            </li>
          ))}
          {more > 0 && (
            <li className="journal-combobox-more">
              {more} more — keep typing to narrow the list
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
