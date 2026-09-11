import { useEffect, useRef, type RefObject } from "react";
import type { Character } from "../types/project";

export interface GlobalHotkeysConfig {
  mainInputRef: RefObject<HTMLInputElement | null>;
  anyModalOpen: () => boolean;
  closeAllClosableModals: () => void;
  undo: () => void;
  redo: () => void;
  exportJson: () => void;
  toggleSidebar: () => void;
  openPlay: () => void;
  openSearch: () => void;
  openHelp: () => void;
  setSpeaker: (id: string | null) => void;
  characters: Character[];
}

/** グローバルキーボードショートカット。モーダル表示中はEscapeのみ有効。 */
export function useGlobalHotkeys(config: GlobalHotkeysConfig) {
  const ref = useRef(config);
  ref.current = config;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229) return;
      const c = ref.current;

      if (c.anyModalOpen()) {
        if (e.key === "Escape") {
          c.closeAllClosableModals();
          c.mainInputRef.current?.focus();
        }
        return;
      }

      if (e.ctrlKey && !e.shiftKey && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        c.undo();
        return;
      }
      if (e.ctrlKey && ((e.key === "y" || e.key === "Y") || (e.shiftKey && (e.key === "z" || e.key === "Z")))) {
        e.preventDefault();
        c.redo();
        return;
      }
      if (e.ctrlKey && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        c.exportJson();
        return;
      }
      if (e.ctrlKey && !e.shiftKey && !e.altKey && (e.key === "b" || e.key === "B")) {
        e.preventDefault();
        c.toggleSidebar();
        return;
      }
      if (e.ctrlKey && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        c.openPlay();
        return;
      }
      if (e.ctrlKey && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        c.openSearch();
        return;
      }
      if (e.key === "F1") {
        e.preventDefault();
        c.openHelp();
        return;
      }

      if (e.ctrlKey && /^[0-9]$/.test(e.key)) {
        e.preventDefault();
        const n = parseInt(e.key, 10);
        if (n === 0) c.setSpeaker(null);
        else if (c.characters[n - 1]) c.setSpeaker(c.characters[n - 1].id);
        c.mainInputRef.current?.focus();
        return;
      }

      const tag = document.activeElement ? document.activeElement.tagName : "";
      if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT" && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        c.mainInputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
}
