"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { CloseIcon } from "./icons";

export function Dialog({
  open,
  title,
  subtitle,
  onClose,
  footer,
  children,
}: {
  open: boolean;
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusable = panelRef.current?.querySelector<HTMLElement>("input, select, textarea, button");
    focusable?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="cpc-dialog-layer"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div ref={panelRef} className="cpc-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="cpc-dialog-head">
          <div>
            <h2 id={titleId} className="cpc-card-title">
              {title}
            </h2>
            {subtitle ? <div className="cpc-card-meta">{subtitle}</div> : null}
          </div>
          <button type="button" className="cpc-btn cpc-btn-sm cpc-icon-btn" aria-label="Close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <div className="cpc-dialog-body">{children}</div>
        {footer ? <div className="cpc-dialog-foot">{footer}</div> : null}
      </div>
    </div>
  );
}
