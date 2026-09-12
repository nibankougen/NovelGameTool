import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useProjectStore } from "../../state/ProjectProvider";
import { useEditorUi } from "../../state/EditorUiContext";
import { useAppActions } from "../../state/AppActionsContext";
import { useDragReorder } from "../../hooks/useDragReorder";
import { Icon } from "../common/Icon";
import { CharacterRow } from "./CharacterRow";
import { CharacterMemoPanel } from "./CharacterMemoPanel";

export function CharacterList() {
  const { t } = useTranslation();
  const { project, mutate } = useProjectStore();
  const editorUi = useEditorUi();
  const a = useAppActions();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const drag = useDragReorder<HTMLDivElement>({
    itemSelector: ".char-item",
    onDrop: (from, to) => {
      if (from === to) return;
      mutate((d) => {
        const [c] = d.characters.splice(from, 1);
        d.characters.splice(to, 0, c);
      });
    },
  });

  return (
    <>
      <div className="side-head flex items-center justify-between px-2.5 pt-2 pb-1 text-text-dim text-xs font-semibold border-t border-border">
        <span>{t("character.listLabel")}</span>
        <button onClick={() => a.openCharModal(null)} title={t("character.addTitle")} className="text-sm px-2 py-0">
          <Icon name="plus" />
        </button>
      </div>
      <div ref={drag.containerRef} onMouseDown={drag.onMouseDown} className="max-h-[35%] overflow-y-auto px-1.5 pt-0.5 pb-2">
        {project.characters.map((c, i) => (
          <div key={c.id}>
            <CharacterRow
              character={c}
              hotkeyIndex={i < 9 ? i : null}
              memoOpen={expanded.has(c.id)}
              onEdit={() => a.openCharModal(c.id)}
              onToggleMemo={() =>
                setExpanded((prev) => {
                  const next = new Set(prev);
                  next.has(c.id) ? next.delete(c.id) : next.add(c.id);
                  return next;
                })
              }
              onSelectSpeaker={() => {
                editorUi.setSpeaker(c.id);
                a.focusMainInput();
              }}
            />
            {expanded.has(c.id) && <CharacterMemoPanel character={c} />}
          </div>
        ))}
      </div>
    </>
  );
}
