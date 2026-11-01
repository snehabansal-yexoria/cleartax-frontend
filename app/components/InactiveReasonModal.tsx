"use client";

import React, { useState, useEffect, useRef } from "react";

interface InactiveReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  type?: "entity" | "property";
  infoMessage?: string;
}

export default function InactiveReasonModal({
  isOpen,
  onClose,
  onConfirm,
  type = "entity",
  infoMessage,
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
          background: rgba(21, 23, 25, 0.6);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          animation: inactiveFadeIn 0.2s ease-out forwards;
        }

        .inactive-reason-modal-card {
          position: relative;
          width: 100%;
          max-width: 480px;
          background: #FFFFFF;
          border: 1px solid rgba(226, 224, 217, 0.8);
          border-radius: 16px;
          box-shadow: 0 25px 50px -12px rgba(21, 23, 25, 0.25);
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
          border-bottom: 1px solid #F3F0E9;
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
          color: #151719;
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
          color: #6C6C6B;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .inactive-reason-modal-close:hover {
          background-color: #F3F0E9;
          color: #151719;
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
          color: #505050;
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
          background: #F3F0E9;
          border: 1px solid #E2E0D9;
          border-radius: 12px;
          font-size: 14px;
          color: #151719;
          resize: vertical;
          outline: none;
          box-shadow: inset 0 1px 2px rgba(21, 23, 25, 0.05);
          transition: all 0.2s ease;
          font-family: inherit;
        }

        .inactive-reason-modal-textarea:focus {
          background: #FFFFFF;
          border-color: #C46A4C;
          box-shadow: 0 0 0 4px rgba(196, 106, 76, 0.15), inset 0 1px 2px rgba(21, 23, 25, 0.05);
        }

        /* Error States matching theme */
        .inactive-reason-modal-textarea.has-error {
          border-color: #ECCBBC !important;
          background-color: #FAF8F3 !important;
        }

        .inactive-reason-modal-textarea.has-error:focus {
          border-color: #ECCBBC !important;
          box-shadow: 0 0 0 4px #F6EAE2 !important;
        }

        .inactive-reason-modal-error {
          margin: 0;
          margin-top: 4px;
          font-size: 13px;
          font-weight: 500;
          color: #C46A4C;
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
          background: #F3F0E9;
          border-top: 1px solid #F3F0E9;
        }

        .inactive-reason-confirm-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 600;
          color: #FFFFFF;
          background: #C46A4C;
          border: 1px solid #C46A4C;
          border-radius: 10px;
          cursor: pointer;
          box-shadow: 0 1px 2px rgba(21, 23, 25, 0.05);
          transition: all 0.2s ease;
        }

        .inactive-reason-confirm-btn:hover {
          background: #C46A4C;
          border-color: #C46A4C;
          transform: translateY(-1px);
          box-shadow: 0 4px 6px -1px rgba(196, 106, 76, 0.1), 0 2px 4px -1px rgba(196, 106, 76, 0.06);
        }

        .inactive-reason-confirm-btn:active {
          background: #C46A4C;
          border-color: #C46A4C;
          transform: translateY(0);
        }

        .inactive-reason-modal-cancel-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 600;
          color: #505050;
          background: #FFFFFF;
          border: 1px solid #E2E0D9;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .inactive-reason-modal-cancel-btn:hover {
          background: #F3F0E9;
          color: #151719;
        }

        .inactive-reason-modal-info-toast {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 12px 16px;
          background-color: #F3F0E9;
          border: 1px solid #D6CCF5;
          border-radius: 10px;
          color: #7A5CFA;
          font-size: 13px;
          line-height: 1.5;
        }

        .inactive-reason-modal-info-toast svg {
          color: #7A5CFA;
          flex-shrink: 0;
          margin-top: 2px;
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
              <svg viewBox="0 0 24 24" width="22" height="22" stroke="#C46A4C" fill="none" strokeWidth="2.5" style={{ flexShrink: 0 }}>
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
              {infoMessage && (
                <div className="inactive-reason-modal-info-toast">
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4" />
                    <path d="M12 16h.01" />
                  </svg>
                  <span>{infoMessage}</span>
                </div>
              )}
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
