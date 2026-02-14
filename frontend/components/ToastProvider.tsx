"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type ToastType = "success" | "error" | "info";

type ToastInput = {
  type?: ToastType;
  title: string;
  description?: string;
  durationMs?: number;
};

type ToastItem = ToastInput & {
  id: number;
  type: ToastType;
};

type ToastContextValue = {
  showToast: (toast: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: ToastInput) => {
      const id = Date.now() + Math.floor(Math.random() * 100000);
      const type = toast.type || "info";
      const next: ToastItem = {
        id,
        type,
        title: toast.title,
        description: toast.description,
        durationMs: toast.durationMs || 4500,
      };
      setToasts((prev) => [...prev, next]);
      window.setTimeout(() => dismissToast(id), next.durationMs);
    },
    [dismissToast]
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`} data-testid={`toast-${toast.type}`}>
            <div className="toast-content">
              <strong>{toast.title}</strong>
              {toast.description ? <p>{toast.description}</p> : null}
            </div>
            <button className="toast-close" onClick={() => dismissToast(toast.id)} aria-label="Close toast">
              x
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
