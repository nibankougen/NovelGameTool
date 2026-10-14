import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { SceneList } from "../scenes/SceneList";
import { CharacterList } from "../characters/CharacterList";
import { usePersistentState } from "../../state/usePersistentState";
import { SIDEBAR_WIDTH_LS_KEY } from "../../lib/storage";

const DEFAULT_WIDTH = 230;
const MIN_WIDTH = 160;

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; width: number } | null>(null);
  const [savedWidth, setWidth] = usePersistentState(SIDEBAR_WIDTH_LS_KEY, DEFAULT_WIDTH);
  const [maxWidth, setMaxWidth] = useState(() => document.documentElement.clientWidth);
  const preferredWidth = typeof savedWidth === "number" && Number.isFinite(savedWidth) ? savedWidth : DEFAULT_WIDTH;
  const minWidth = Math.min(MIN_WIDTH, maxWidth);
  const width = Math.min(maxWidth, Math.max(minWidth, preferredWidth));
  const clampWidth = (value: number) => Math.min(maxWidth, Math.max(minWidth, value));

  useLayoutEffect(() => {
    const parent = sidebarRef.current?.parentElement;
    if (!parent) return;
    const update = () => setMaxWidth(Math.min(parent.clientWidth, document.documentElement.clientWidth));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(parent);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div
      ref={sidebarRef}
      className={`relative shrink-0 min-w-0 overflow-hidden border-border ${collapsed ? "border-r-0" : "border-r"}`}
      style={{ width: collapsed ? 0 : width, maxWidth: "min(100%, 100vw)" }}
    >
      <div
        className={
          "w-full h-full flex flex-col bg-panel transition-transform duration-200 ease-in-out" +
          (collapsed ? " -translate-x-full" : " translate-x-0")
        }
      >
        <SceneList />
        <CharacterList />
      </div>
      {!collapsed && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={t("common.resizeSidebar")}
          aria-valuemin={minWidth}
          aria-valuemax={maxWidth}
          aria-valuenow={Math.round(width)}
          tabIndex={0}
          title={t("common.resizeSidebar")}
          className="absolute right-0 inset-y-0 z-20 w-1.5 cursor-col-resize touch-none select-none hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none"
          onPointerDown={(event) => {
            if (event.button !== 0 || !event.isPrimary) return;
            event.preventDefault();
            event.currentTarget.focus();
            event.currentTarget.setPointerCapture(event.pointerId);
            dragRef.current = { pointerId: event.pointerId, x: event.clientX, width: sidebarRef.current?.getBoundingClientRect().width ?? width };
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            if (!drag || drag.pointerId !== event.pointerId) return;
            setWidth(clampWidth(drag.width + event.clientX - drag.x));
          }}
          onPointerUp={(event) => {
            if (dragRef.current?.pointerId !== event.pointerId) return;
            dragRef.current = null;
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => { dragRef.current = null; }}
          onLostPointerCapture={() => { dragRef.current = null; }}
          onKeyDown={(event) => {
            let next: number;
            if (event.key === "ArrowLeft") next = width - 10;
            else if (event.key === "ArrowRight") next = width + 10;
            else if (event.key === "Home") next = minWidth;
            else if (event.key === "End") next = maxWidth;
            else return;
            event.preventDefault();
            setWidth(clampWidth(next));
          }}
        />
      )}
    </div>
  );
}
