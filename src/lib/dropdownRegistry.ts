"use client";

export const dropdownRegistryEvent = "cleartax:dropdown-open";

export function announceDropdownOpen(id: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(dropdownRegistryEvent, { detail: { id } }),
  );
}

export function isDropdownRegistryEvent(
  event: Event,
): event is CustomEvent<{ id?: string }> {
  return "detail" in event;
}
