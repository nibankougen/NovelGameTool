import { useProjectStore } from "../../state/ProjectProvider";
import { useEditorUi } from "../../state/EditorUiContext";
import { useUndoableSession } from "../../hooks/useUndoableSession";
import { Modal, ModalHeader } from "./Modal";
import { Icon } from "../common/Icon";
import { scenesInGroupOrder } from "../../lib/sceneUtils";

export function OutlineModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { project, patch } = useProjectStore();
  const editorUi = useEditorUi();
  const onFocus = useUndoableSession();

  const showGroupHeads = project.sceneGroups.length > 0;
  let lastGroup: string | null | undefined;

  return (
    <Modal open={open} onRequestClose={onClose} className="w-[92vw] max-w-[900px] h-[86vh] max-h-[86vh] flex flex-col">
      <ModalHeader onClose={onClose}>
        <Icon name="book-open" /> あらすじ
      </ModalHeader>
      <div className="shrink-0 mb-3">
        <label className="block text-text-dim text-xs mb-1">大枠メモ（設定・プロット全体・伏線など）</label>
        <textarea
          className="w-full min-h-[80px] resize-y leading-relaxed text-sm"
          placeholder="物語全体の設定・あらすじ・伏線などを自由にメモできます（ゲーム出力には含まれません）"
          value={project.overview}
          onFocus={onFocus}
          onChange={(e) => {
            const v = e.target.value;
            patch((d) => {
              d.overview = v;
            });
          }}
          onKeyDown={(e) => e.stopPropagation()}
        />
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 border-t border-border pt-1">
        {!project.scenes.length && <div className="py-8 px-2.5 text-text-dim text-sm text-center leading-loose">シーンがありません</div>}
        {scenesInGroupOrder(project.scenes, project.sceneGroups).map(({ scene: s, groupName }) => {
          const header = showGroupHeads && groupName !== lastGroup;
          lastGroup = groupName;
          return (
            <div key={s.id}>
              {header && (
                <div className="sticky top-0 bg-bg-2 z-[2] px-1 pt-2.5 pb-1.5 text-xs font-bold text-sys border-b border-border">
                  {groupName || "未分類"}
                </div>
              )}
              <div className="py-2 px-1 border-b border-hairline">
                <div className="flex items-center gap-2 mb-1">
                  <button
                    className="font-bold text-sm px-2 py-0.5 bg-transparent border-none"
                    onClick={() => {
                      editorUi.gotoScene(s.id);
                      onClose();
                    }}
                  >
                    {s.name}
                  </button>
                  <span className="text-text-dim text-xs">{s.commands.length}行</span>
                </div>
                <textarea
                  className="w-full text-xs px-2 py-1.5 min-h-[44px] resize-y leading-relaxed"
                  placeholder="このシーンのあらすじ"
                  value={s.synopsis}
                  onFocus={onFocus}
                  onChange={(e) => {
                    const v = e.target.value;
                    patch((d) => {
                      const sc = d.scenes.find((x) => x.id === s.id);
                      if (sc) sc.synopsis = v;
                    });
                  }}
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
