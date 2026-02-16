"use client";

import { useEffect } from "react";

type ActionModalProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  testId?: string;
};

export default function ActionModal({
  open,
  title,
  subtitle,
  onClose,
  children,
  testId,
}: ActionModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      data-testid={testId}
      onClick={onClose}
    >
      <section className="modal-card" onClick={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p className="modal-subtitle">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="ghost small modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            Close
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  );
}
