import { useMemo } from "react";
import { useProject } from "../../state/ProjectProvider";
import { useEditorUi } from "../../state/EditorUiContext";
import { useCharLookup } from "../../hooks/useCharLookup";
import { Modal, ModalTitle } from "./Modal";
import { Icon } from "../common/Icon";
import { scenesInGroupOrder, sceneStats } from "../../lib/sceneUtils";

export function StatsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const project = useProject();
  const editorUi = useEditorUi();
  const findChar = useCharLookup();

  const { groups, total } = useMemo(() => {
    const map = new Map<string, { name: string; sceneIds: string[]; count: number; chars: number }>();
    let totalCount = 0;
    let totalChars = 0;
    for (const { scene, groupName } of scenesInGroupOrder(project.scenes, project.sceneGroups)) {
      const key = groupName || "";
      let g = map.get(key);
      if (!g) {
        g = { name: groupName || "未分類", sceneIds: [], count: 0, chars: 0 };
        map.set(key, g);
      }
      const st = sceneStats(scene, findChar);
      g.sceneIds.push(scene.id);
      g.count += st.count;
      g.chars += st.chars;
      totalCount += st.count;
      totalChars += st.chars;
    }
    return { groups: [...map.values()], total: { count: totalCount, chars: totalChars } };
  }, [project.scenes, project.sceneGroups, findChar]);

  const showGroupHeads = project.sceneGroups.length > 0;

  return (
    <Modal open={open} onRequestClose={onClose} className="w-[92vw] max-w-[640px] h-[80vh] max-h-[80vh] flex flex-col">
      <div className="flex items-center gap-2.5 mb-3 flex-wrap">
        <ModalTitle>
          <span className="inline-flex items-center gap-1.5">
            <Icon name="chart-column" /> 統計情報
          </span>
        </ModalTitle>
        <button onClick={onClose} className="ml-auto">
          閉じる (Esc)
        </button>
      </div>
      <div className="grid grid-cols-[1fr_90px_90px] gap-2 items-center px-2 py-1.5 text-text-dim text-[11px] border-b border-border shrink-0">
        <span>シーン</span>
        <span className="text-right tabular-nums">セリフ数</span>
        <span className="text-right tabular-nums">文字数</span>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {!project.scenes.length && <div className="py-8 px-2.5 text-text-dim text-sm text-center leading-loose">シーンがありません</div>}
        {groups.map((g) => (
          <div key={g.name}>
            {showGroupHeads && (
              <div className="grid grid-cols-[1fr_90px_90px] gap-2 items-center px-2 py-1.5 sticky top-0 bg-bg-2 text-sm font-bold text-sys border-b border-border">
                <span>{g.name}</span>
                <span className="text-right tabular-nums">{g.count}</span>
                <span className="text-right tabular-nums">{g.chars}</span>
              </div>
            )}
            {g.sceneIds.map((id) => {
              const s = project.scenes.find((s) => s.id === id)!;
              const st = sceneStats(s, findChar);
              return (
                <div
                  key={id}
                  className="grid grid-cols-[1fr_90px_90px] gap-2 items-center px-2 py-1.5 border-b border-hairline cursor-pointer hover:bg-bg-2"
                  onClick={() => {
                    editorUi.gotoScene(id);
                    onClose();
                  }}
                >
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap">{s.name}</span>
                  <span className="text-right tabular-nums">{st.count}</span>
                  <span className="text-right tabular-nums">{st.chars}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[1fr_90px_90px] gap-2 items-center px-2 py-1.5 border-t-2 border-border mt-0.5 font-bold shrink-0">
        <span>合計</span>
        <span className="text-right tabular-nums">{total.count}</span>
        <span className="text-right tabular-nums">{total.chars}</span>
      </div>
    </Modal>
  );
}
