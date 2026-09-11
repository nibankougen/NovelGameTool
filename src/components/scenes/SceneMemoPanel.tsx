import { useProjectStore } from "../../state/ProjectProvider";
import { useUndoableSession } from "../../hooks/useUndoableSession";
import type { Scene } from "../../types/project";

export function SceneMemoPanel({ scene, indented }: { scene: Scene; indented: boolean }) {
  const { patch } = useProjectStore();
  const onFocus = useUndoableSession();
  return (
    <div className={`scene-memo-panel${indented ? " grouped" : ""} mx-1.5 mb-1.5${indented ? " ml-[42px]" : " ml-[26px]"}`}>
      <textarea
        placeholder="このシーンのあらすじ・メモ…"
        value={scene.synopsis}
        onFocus={onFocus}
        onChange={(e) => {
          const v = e.target.value;
          patch((d) => {
            const s = d.scenes.find((s) => s.id === scene.id);
            if (s) s.synopsis = v;
          });
        }}
        onKeyDown={(e) => e.stopPropagation()}
        className="w-full text-xs px-2 py-1.5 min-h-[44px] resize-y leading-relaxed"
      />
    </div>
  );
}
