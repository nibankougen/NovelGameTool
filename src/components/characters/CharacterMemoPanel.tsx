import { useProjectStore } from "../../state/ProjectProvider";
import { useUndoableSession } from "../../hooks/useUndoableSession";
import type { Character } from "../../types/project";

export function CharacterMemoPanel({ character }: { character: Character }) {
  const { patch } = useProjectStore();
  const onFocus = useUndoableSession();
  return (
    <div className="char-memo-panel mx-1.5 mb-1.5 ml-[26px]">
      <textarea
        placeholder="設定メモ…"
        value={character.memo}
        onFocus={onFocus}
        onChange={(e) => {
          const v = e.target.value;
          patch((d) => {
            const c = d.characters.find((c) => c.id === character.id);
            if (c) c.memo = v;
          });
        }}
        onKeyDown={(e) => e.stopPropagation()}
        className="w-full text-xs px-2 py-1.5 min-h-[56px] resize-y leading-relaxed"
      />
    </div>
  );
}
