import { useCallback, useEffect, useLayoutEffect, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { useEditorUi } from "../../state/EditorUiContext";
import { useProjectStore } from "../../state/ProjectProvider";
import { useModalRegistry } from "../modals/ModalRegistry";
import { Icon } from "../common/Icon";

export function SelectionJumpButton({ scrollWrapRef }: { scrollWrapRef: RefObject<HTMLDivElement | null> }) {
  const { t } = useTranslation();
  const { selIndex, currentSceneId, editIndex } = useEditorUi();
  const { project } = useProjectStore();
  const { hasOpen } = useModalRegistry();
  const [direction, setDirection] = useState<"up" | "down" | null>(null);

  useLayoutEffect(() => {
    const wrap = scrollWrapRef.current;
    const row = selIndex === null ? null : wrap?.querySelector<HTMLElement>(`[data-idx="${selIndex}"]`);
    if (!wrap || !row) {
      setDirection(null);
      return;
    }
    const update = () => {
      const viewport = wrap.getBoundingClientRect();
      const bounds = row.getBoundingClientRect();
      const top = viewport.top + wrap.clientTop;
      const bottom = top + wrap.clientHeight;
      setDirection(bounds.bottom <= top ? "up" : bounds.top >= bottom ? "down" : null);
    };
    update();
    wrap.addEventListener("scroll", update, { passive: true });
    const resize = new ResizeObserver(update);
    resize.observe(wrap);
    // Earlier rows can change height as images load or text wraps.
    for (const child of wrap.querySelectorAll(".cmd-row")) resize.observe(child);
    return () => {
      wrap.removeEventListener("scroll", update);
      resize.disconnect();
    };
  }, [scrollWrapRef, selIndex, currentSceneId, editIndex, project]);

  const jumpToSelected = useCallback(() => {
    scrollWrapRef.current?.querySelector(`[data-idx="${selIndex}"]`)?.scrollIntoView({ block: "center" });
  }, [scrollWrapRef, selIndex]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.keyCode === 229 || hasOpen() || selIndex === null) return;
      if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.key.toLowerCase() === "j") {
        event.preventDefault();
        jumpToSelected();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [hasOpen, selIndex, jumpToSelected]);

  if (!direction) return null;
  return (
    <button
      type="button"
      title={`${t("commandList.jumpToSelected")} (Alt+J)`}
      aria-keyshortcuts="Alt+J"
      className={`absolute z-20 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full border border-accent bg-accent-dim text-accent px-2.5 py-1 text-xs font-medium shadow-sm hover:brightness-95 focus-visible:outline-2 focus-visible:outline-accent ${direction === "up" ? "top-3" : "bottom-3"}`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={jumpToSelected}
    >
      <Icon name={direction === "up" ? "chevron-up" : "chevron-down"} />
      {t("commandList.jumpToSelected")}
    </button>
  );
}
