import { useRef, useState } from "react";

/** 列境界のドラッグハンドル（Excelの列幅変更のイメージ）。ドラッグ中はcolumn幅を都度更新して全行に反映する。 */
export function ColumnResizeHandle({ width, onResize }: { width: number; onResize: (px: number) => void }) {
  const [dragging, setDragging] = useState(false);
  const startRef = useRef({ x: 0, width: 0 });

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startRef.current = { x: e.clientX, width };
    setDragging(true);
    const onMove = (ev: MouseEvent) => {
      onResize(startRef.current.width + (ev.clientX - startRef.current.x));
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <span
      className="col-resize-handle absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize select-none z-10 flex justify-center"
      title="ドラッグで列幅を変更"
      onMouseDown={onMouseDown}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <span className={`block w-px h-full ${dragging ? "bg-accent" : "bg-transparent hover:bg-accent"}`} />
    </span>
  );
}
