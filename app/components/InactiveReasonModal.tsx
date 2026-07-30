"use client";

import React, { useState, useEffect, useRef } from "react";

interface InactiveReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  type?: "entity" | "property";
}

export default function InactiveReasonModal({
  isOpen,
  onClose,
  onConfirm,
  type = "entity",
}: InactiveReasonModalProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Safely focus textarea and reset form state when modal opens
      const timer = setTimeout(() => {
        setReason("");
        setError("");
        textareaRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!reason.trim()) {
      setError("Please fill in this field.");
      return;
    }
    onConfirm(reason);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .inactive-reason-modal-overlay {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 99999;
          padding: 20px;
        }

        .inactive-reason-modal-backdrop {
          position: absolute;
          inset: 0;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          animation: inactiveFadeIn 0.2s ease-out forwards;
        }

        .inactive-reason-modal-card {
          position: relative;
          width: 100%;
          max-width: 480px;
          background: #ffffff;
          border: 1px solid rgba(226, 232, 240, 0.8);
          border-radius: 16px;
          box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.25);
          z-index: 10;
          animation: inactiveSlideUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .inactive-reason-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 24px 24px 20px;
          border-bottom: 1px solid #f1f5f9;
        }

        .inactive-reason-modal-title-group {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .inactive-reason-modal-header h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
          letter-spacing: -0.02em;
        }

        .inactive-reason-modal-close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: transparent;
          border: none;
          border-radius: 8px;
          color: #64748b;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .inactive-reason-modal-close:hover {
          background-color: #f1f5f9;
          color: #1e293b;
        }

        .inactive-reason-modal-body {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .inactive-reason-modal-desc {
          margin: 0;
          font-size: 14px;
          line-height: 1.5;
          color: #475569;
        }

        .inactive-reason-modal-textarea-container {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .inactive-reason-modal-textarea {
          width: 100%;
          min-height: 110px;
          padding: 12px 16px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          font-size: 14px;
          color: #0f172a;
          resize: vertical;
          outline: none;
          box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.05);
          transition: all 0.2s ease;
          font-family: inherit;
        }

        .inactive-reason-modal-textarea:focus {
          background: #ffffff;
          border-color: #ef4444;
          box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.15), inset 0 1px 2px rgba(15, 23, 42, 0.05);
        }

        /* Error States matching theme */
        .inactive-reason-modal-textarea.has-error {
          border-color: #fda29b !important;
          background-color: #fffbfa !important;
        }

        .inactive-reason-modal-textarea.has-error:focus {
          border-color: #fda29b !important;
          box-shadow: 0 0 0 4px #fee4e2 !important;
        }

        .inactive-reason-modal-error {
          margin: 0;
          margin-top: 4px;
          font-size: 13px;
          font-weight: 500;
          color: #d92d20;
          display: flex;
          align-items: center;
          gap: 6px;
          animation: inactiveErrorFadeIn 0.15s ease-out;
        }

        .inactive-reason-modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 24px;
          background: #f8fafc;
          border-top: 1px solid #f1f5f9;
        }

        .inactive-reason-confirm-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 600;
          color: #ffffff;
          background: #ef4444;
          border: 1px solid #ef4444;
          border-radius: 10px;
          cursor: pointer;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
          transition: all 0.2s ease;
        }

        .inactive-reason-confirm-btn:hover {
          background: #dc2626;
          border-color: #dc2626;
          transform: translateY(-1px);
          box-shadow: 0 4px 6px -1px rgba(220, 38, 38, 0.1), 0 2px 4px -1px rgba(220, 38, 38, 0.06);
        }

        .inactive-reason-confirm-btn:active {
          background: #b91c1c;
          border-color: #b91c1c;
          transform: translateY(0);
        }

        .inactive-reason-modal-cancel-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 600;
          color: #475569;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .inactive-reason-modal-cancel-btn:hover {
          background: #f1f5f9;
          color: #0f172a;
        }

        @keyframes inactiveFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes inactiveSlideUp {
          from {
            opacity: 0;
            transform: translateY(16px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes inactiveErrorFadeIn {
          from {
            opacity: 0;
            transform: translateY(-2px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}} />

      <div className="inactive-reason-modal-overlay" role="dialog" aria-modal="true">
        <div className="inactive-reason-modal-backdrop" onClick={onClose} />
        <div className="inactive-reason-modal-card">
          <header className="inactive-reason-modal-header">
            <div className="inactive-reason-modal-title-group">
              <svg viewBox="0 0 24 24" width="22" height="22" stroke="#ef4444" fill="none" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h2>Reason for marking Inactive?</h2>
            </div>
            <button
              type="button"
              className="inactive-reason-modal-close"
              onClick={onClose}
              aria-label="Close"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </header>
          <form onSubmit={handleSubmit} noValidate>
            <div className="inactive-reason-modal-body">
              <p className="inactive-reason-modal-desc">
                Please specify the reason for changing the status of this {type} to inactive. All changes will be blocked.
              </p>
              <div className="inactive-reason-modal-textarea-container">
                <textarea
                  ref={textareaRef}
                  className={`inactive-reason-modal-textarea${error ? " has-error" : ""}`}
                  placeholder="Type reason here..."
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    if (error) setError("");
                  }}
                  onKeyDown={handleKeyDown}
                  required
                  rows={4}
                />
                {error && (
                  <p className="inactive-reason-modal-error">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {error}
                  </p>
                )}
              </div>
            </div>
            <footer className="inactive-reason-modal-footer">
              <button
                type="button"
                className="inactive-reason-modal-cancel-btn"
                onClick={onClose}
              >
                Cancel
              </button>
              <button type="submit" className="inactive-reason-confirm-btn">
                Mark Inactive
              </button>
            </footer>
          </form>
        </div>
      </div>
    </>
  );
}
