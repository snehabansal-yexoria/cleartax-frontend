"use client";

import { useEffect, useRef, useState } from "react";
import { exportRows, type ExportFormat, type ExportRequest } from "../lib/export";
import { DownloadIcon } from "./icons";
import { cx } from "./ui";

const FORMATS: { id: ExportFormat; label: string; hint: string }[] = [
  { id: "csv", label: "CSV", hint: "Plain data, opens anywhere" },
  { id: "excel", label: "Excel", hint: ".xls workbook" },
  { id: "pdf", label: "PDF", hint: "Print or save as PDF" },
];

/** Export button with a CSV / Excel / PDF menu. Builds the request lazily. */
export function ExportMenu<T>({
  build,
  label = "Export",
  small,
  disabled,
  variant,
}: {
  build: () => ExportRequest<T>;
  label?: string;
  small?: boolean;
  disabled?: boolean;
  variant?: "dark";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        className={cx("cpc-btn", small && "cpc-btn-sm", variant && `cpc-btn-${variant}`)}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        <DownloadIcon />
        {label}
      </button>
      {open ? (
        <div
          role="menu"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 0.4em)",
            zIndex: 30,
            minWidth: "14em",
            background: "#fff",
            border: "1px solid var(--cpc-line)",
            borderRadius: "0.7em",
            boxShadow: "0 12px 30px rgba(20, 22, 40, 0.14)",
            padding: "0.35em",
          }}
        >
          {FORMATS.map((format) => (
            <button
              key={format.id}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                exportRows(format.id, build());
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                width: "100%",
                padding: "0.55em 0.75em",
                border: 0,
                borderRadius: "0.5em",
                background: "transparent",
                cursor: "pointer",
                font: "inherit",
                textAlign: "left",
              }}
              onMouseEnter={(event) => (event.currentTarget.style.background = "#f6f5f2")}
              onMouseLeave={(event) => (event.currentTarget.style.background = "transparent")}
            >
              <span style={{ fontWeight: 600, fontSize: "0.93em" }}>{format.label}</span>
              <span className="cpc-muted cpc-small">{format.hint}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
