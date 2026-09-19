"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { getSession } from "@/src/lib/session";
import {
  announceDropdownOpen,
  dropdownRegistryEvent,
  isDropdownRegistryEvent,
} from "@/src/lib/dropdownRegistry";

interface SessionWithIdToken {
  getIdToken(): { getJwtToken(): string };
}

type Suggestion = {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
};

export type AddressAutocompleteProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  inputClassName?: string;
  id?: string;
  /** Minimum characters before a lookup fires. */
  minChars?: number;
  /** Debounce window in ms between keystroke and lookup. */
  debounceMs?: number;
  maxLength?: number;
};

const DEFAULT_MIN_CHARS = 3;
const DEFAULT_DEBOUNCE_MS = 250;

async function fetchSuggestions(
  query: string,
  signal: AbortSignal,
): Promise<Suggestion[]> {
  let token = "";
  try {
    const session = (await getSession()) as SessionWithIdToken | null;
    token = session?.getIdToken?.().getJwtToken() ?? "";
  } catch {
    // Fall through with an empty token; the route also accepts the idToken
    // cookie, which the browser sends automatically on same-origin requests.
  }

  const res = await fetch(
    `/api/places/autocomplete?q=${encodeURIComponent(query)}`,
    {
      signal,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    },
  );
  if (!res.ok) {
    throw new Error(`Location search failed (${res.status}).`);
  }
  const payload = (await res.json()) as { suggestions?: Suggestion[] };
  return payload.suggestions ?? [];
}

export default function AddressAutocomplete({
  value,
  onChange,
  onBlur,
  placeholder,
  inputClassName,
  id,
  minChars = DEFAULT_MIN_CHARS,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  maxLength,
}: AddressAutocompleteProps) {
  const generatedId = useId();
  const dropdownId = id ?? `location-autocomplete-${generatedId}`;
  const listboxId = `${dropdownId}-listbox`;

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [hasQueried, setHasQueried] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cancelPending = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  // Clean up any in-flight timer / request when the component unmounts.
  useEffect(() => cancelPending, [cancelPending]);

  const openMenu = useCallback(() => {
    setIsOpen(true);
    announceDropdownOpen(dropdownId);
  }, [dropdownId]);

  // Close when another registered dropdown (e.g. property type/status) opens.
  useEffect(() => {
    function closeIfAnotherOpened(event: Event) {
      if (!isDropdownRegistryEvent(event)) return;
      const openedId = event.detail?.id;
      if (openedId && openedId !== dropdownId) setIsOpen(false);
    }
    window.addEventListener(dropdownRegistryEvent, closeIfAnotherOpened);
    return () =>
      window.removeEventListener(dropdownRegistryEvent, closeIfAnotherOpened);
  }, [dropdownId]);

  const runLookup = useCallback(
    (query: string) => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsLoading(true);
      setHasQueried(true);
      fetchSuggestions(query, controller.signal)
        .then((results) => {
          if (controller.signal.aborted) return;
          setSuggestions(results);
          setActiveIndex(-1);
          openMenu();
        })
        .catch((error) => {
          if (controller.signal.aborted || error?.name === "AbortError") return;
          setSuggestions([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    },
    [openMenu],
  );

  // Only user typing triggers a lookup — programmatic value changes (edit-mode
  // prefill, selecting a suggestion) never call this, so they never re-open the
  // menu or spend quota.
  function handleInputChange(next: string) {
    onChange(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const query = next.trim();
    if (query.length < minChars) {
      if (abortRef.current) abortRef.current.abort();
      setSuggestions([]);
      setIsOpen(false);
      setIsLoading(false);
      setHasQueried(false);
      return;
    }
    debounceRef.current = setTimeout(() => runLookup(query), debounceMs);
  }

  function selectSuggestion(suggestion: Suggestion) {
    cancelPending();
    onChange(suggestion.description);
    setSuggestions([]);
    setIsOpen(false);
    setActiveIndex(-1);
    setIsLoading(false);
    setHasQueried(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      if (!isOpen && suggestions.length > 0) {
        event.preventDefault();
        openMenu();
        setActiveIndex(0);
        return;
      }
      if (suggestions.length === 0) return;
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      if (suggestions.length === 0) return;
      event.preventDefault();
      setActiveIndex((prev) =>
        prev <= 0 ? suggestions.length - 1 : prev - 1,
      );
    } else if (event.key === "Enter") {
      if (isOpen && activeIndex >= 0 && suggestions[activeIndex]) {
        event.preventDefault();
        selectSuggestion(suggestions[activeIndex]);
      }
    } else if (event.key === "Escape") {
      if (isOpen) {
        event.preventDefault();
        setIsOpen(false);
      }
    }
  }

  const showMenu = isOpen && value.trim().length >= minChars;
  const showEmptyState =
    showMenu && !isLoading && hasQueried && suggestions.length === 0;

  return (
    <div className="location-autocomplete">
      <input
        id={dropdownId}
        type="text"
        role="combobox"
        aria-expanded={showMenu}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
        }
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={value}
        className={`w-full ${inputClassName || ""}`}
        maxLength={maxLength}
        onChange={(event) => handleInputChange(event.target.value)}
        onFocus={() => {
          if (suggestions.length > 0 && value.trim().length >= minChars) {
            openMenu();
          }
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          // Suggestion buttons use onMouseDown/preventDefault, so a click won't
          // blur the input before it registers. A real blur closes the menu.
          setIsOpen(false);
          onBlur?.();
        }}
      />

      {(showMenu && (suggestions.length > 0 || isLoading)) || showEmptyState ? (
        <ul className="location-autocomplete-menu" id={listboxId} role="listbox">
          {isLoading && suggestions.length === 0 && (
            <li className="location-autocomplete-status" aria-live="polite">
              Searching…
            </li>
          )}
          {suggestions.map((suggestion, index) => (
            <li key={suggestion.placeId} role="presentation">
              <button
                type="button"
                id={`${listboxId}-option-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                className={`location-autocomplete-option${
                  index === activeIndex ? " is-active" : ""
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectSuggestion(suggestion)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 21s-7-6.5-7-11a7 7 0 0 1 14 0c0 4.5-7 11-7 11z" />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
                <span className="location-autocomplete-option-text">
                  <span className="location-autocomplete-option-main">
                    {suggestion.mainText || suggestion.description}
                  </span>
                  {suggestion.secondaryText && (
                    <span className="location-autocomplete-option-secondary">
                      {suggestion.secondaryText}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
          {showEmptyState && (
            <li className="location-autocomplete-status">
              No matching locations
            </li>
          )}
        </ul>
      ) : null}
    </div>
  );
}
