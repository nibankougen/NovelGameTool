import { useCallback, useEffect, useRef, type MouseEvent as ReactMouseEvent, type RefObject } from "react";

let dndSuppressClickUntil = 0;
let clickSuppressorInstalled = false;

function ensureGlobalClickSuppressor() {
  if (clickSuppressorInstalled) return;
  clickSuppressorInstalled = true;
  document.addEventListener(
    "click",
    (e) => {
      if (Date.now() < dndSuppressClickUntil) {
        e.stopPropagation();
        e.preventDefault();
      }
    },
    true,
  );
}

export interface DragReorderOptions {
  itemSelector: string;
  onDrop: (fromIdx: number, toIdx: number, rawTo: number, lastY: number) => void;
  onHover?: (clientY: number | null) => void;
  /** 自動スクロール対象。省略時はコンテナ自身 */
  scrollerRef?: RefObject<HTMLElement | null>;
}

/**
 * カーソル位置ベースの並べ替えドラッグ&ドロップ（.drag-handle からのmousedownで開始）。
 * 行/シーン/シーングループ/キャラクターの並べ替えに共通で使う自前フック。
 */
export function useDragReorder<T extends HTMLElement>(options: DragReorderOptions) {
  const containerRef = useRef<T | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    ensureGlobalClickSuppressor();
  }, []);

  const onMouseDown = useCallback((e: ReactMouseEvent) => {
    if (e.button !== 0) return;
    const container = containerRef.current;
    if (!container) return;
    const target = e.target as HTMLElement;
    const handle = target.closest(".drag-handle");
    if (!handle) return;
    const { itemSelector, onDrop, onHover, scrollerRef } = optionsRef.current;
    const item = handle.closest(itemSelector) as HTMLElement | null;
    if (!item) return;
    e.preventDefault();

    const items = () => Array.from(container.querySelectorAll<HTMLElement>(itemSelector));
    const fromIdx = items().indexOf(item);
    let toIdx = fromIdx;
    let lastY = e.clientY;
    const indicator = document.createElement("div");
    indicator.className = "drop-indicator";
    item.classList.add("dragging");
    document.body.style.cursor = "grabbing";
    document.body.classList.add("dnd-dragging");
    const scroller = scrollerRef?.current ?? container;

    const move = (ev: MouseEvent) => {
      lastY = ev.clientY;
      const list = items();
      let idx = list.length;
      for (let i = 0; i < list.length; i++) {
        const r = list[i].getBoundingClientRect();
        if (ev.clientY < r.top + r.height / 2) {
          idx = i;
          break;
        }
      }
      toIdx = idx;
      if (idx < list.length) container.insertBefore(indicator, list[idx]);
      else container.appendChild(indicator);
      const sr = scroller.getBoundingClientRect();
      if (ev.clientY < sr.top + 30) scroller.scrollTop -= 12;
      else if (ev.clientY > sr.bottom - 30) scroller.scrollTop += 12;
      onHover?.(ev.clientY);
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      item.classList.remove("dragging");
      indicator.remove();
      document.body.style.cursor = "";
      document.body.classList.remove("dnd-dragging");
      onHover?.(null);
      dndSuppressClickUntil = Date.now() + 150;
      const rawTo = toIdx;
      let to = toIdx;
      if (to > fromIdx) to--;
      onDrop(fromIdx, to, rawTo, lastY);
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
    move(e.nativeEvent);
  }, []);

  return { containerRef, onMouseDown };
}
