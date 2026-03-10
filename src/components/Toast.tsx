import { useEffect, useState } from "react";

export type ToastType = "success" | "error" | "info";

export type ToastMessage = {
  id: number;
  type: ToastType;
  message: string;
};

let listeners: Array<(t: ToastMessage) => void> = [];
let nextId = 1;

export function showToast(message: string, type: ToastType = "success") {
  const toast: ToastMessage = { id: nextId++, type, message };
  listeners.forEach((l) => l(toast));
}

const typeStyles: Record<ToastType, string> = {
  success: "bg-[rgba(79,209,161,0.15)] border-[var(--good)] text-[var(--good)]",
  error: "bg-[rgba(255,107,107,0.15)] border-tz-red text-tz-red",
  info: "bg-[rgba(240,199,95,0.15)] border-tz-yellow text-tz-yellow",
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    function handler(t: ToastMessage) {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, 2500);
    }
    listeners.push(handler);
    return () => {
      listeners = listeners.filter((l) => l !== handler);
    };
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="fixed right-4 top-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`rounded-2xl border px-4 py-3 text-sm font-medium shadow-card animate-in fade-in slide-in-from-top-2 ${typeStyles[t.type]}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
