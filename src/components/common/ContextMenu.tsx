import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface ContextMenuItem {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}

export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: ContextMenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [pos, setPos] = useState({ left: x, top: y });

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onCloseRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    const t = setTimeout(() => {
      document.addEventListener("mousedown", onOutside);
      document.addEventListener("contextmenu", onOutside, true);
      document.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("contextmenu", onOutside, true);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const left = Math.min(x, window.innerWidth - rect.width - 8);
    const top = Math.min(y, window.innerHeight - rect.height - 8);
    setPos({ left: Math.max(4, left), top: Math.max(4, top) });
  }, [x, y]);

  return createPortal(
    <div
      ref={ref}
      className="edit-menu bg-bg-3 border border-border rounded-lg shadow-2xl min-w-[150px] max-h-[250px] overflow-y-auto"
      style={{ position: "fixed", left: pos.left, top: pos.top, zIndex: 60 }}
    >
      {items.map((it, i) => (
        <div
          key={i}
          className={`em-item px-3.5 py-1.5 text-sm whitespace-nowrap ${
            it.disabled ? "text-text-dim cursor-default" : "cursor-pointer hover:bg-accent-dim"
          }`}
          onClick={() => {
            if (it.disabled) return;
            it.onClick();
            onClose();
          }}
        >
          {it.label}
        </div>
      ))}
    </div>,
    document.body,
  );
}
