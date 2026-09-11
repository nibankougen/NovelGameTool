import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

interface ToastMessage {
  text: string;
  err: boolean;
}

interface ToastContextValue {
  toast: (message: string, isErr?: boolean) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  const toast = useCallback((text: string, isErr = false) => {
    window.clearTimeout(timerRef.current);
    setMessage({ text, err: isErr });
    timerRef.current = window.setTimeout(() => setMessage(null), 2600);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {message && <div className={`toast${message.err ? " err" : ""}`}>{message.text}</div>}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue["toast"] {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx.toast;
}
