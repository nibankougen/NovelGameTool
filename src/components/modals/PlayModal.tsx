import { useProjectStore } from "../../state/ProjectProvider";
import { useEditorUi } from "../../state/EditorUiContext";
import { useCharLookup } from "../../hooks/useCharLookup";
import { usePlaySession } from "../../hooks/usePlaySession";
import { useAssetUrl } from "../../hooks/useAssetUrl";
import { Modal, ModalCloseButton } from "./Modal";
import { Icon } from "../common/Icon";

export function PlayModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return open ? <PlayModalInner onClose={onClose} /> : null;
}

function PlayModalInner({ onClose }: { onClose: () => void }) {
  const { project, dirHandle } = useProjectStore();
  const editorUi = useEditorUi();
  const findChar = useCharLookup();
  const { state, advance, restart } = usePlaySession(project, dirHandle, editorUi.currentSceneId, findChar);
  const bgImageUrl = useAssetUrl(state.bgImage);
  const faceImgUrl = useAssetUrl(state.faceImg);

  // テストプレイの舞台は実際のゲーム画面（常に暗めのVNスタイル）を模したプレビューのため、
  // エディタのライト／ダークテーマに関わらず常に読める配色で固定する（var(--text)等は使わない）。
  return (
    <Modal open={true} onRequestClose={onClose} bare className="w-[min(860px,92vw)] h-[min(560px,80vh)]">
      <div
        className="w-full h-full relative flex flex-col rounded-xl border overflow-hidden select-none"
        style={{ background: "linear-gradient(180deg,#2a2f3a,#171a21)", borderColor: "#3a4050" }}
      >
        <div
          className="px-3.5 py-2 flex items-center gap-3.5 text-xs"
          style={{ background: "rgba(0,0,0,.4)", color: "#aab0bf" }}
        >
          <span className="bg-black/50 rounded px-2.5 py-0.5">背景: {state.bgLabel}</span>
          <span className="bg-black/50 rounded px-2.5 py-0.5">BGM: {state.bgmLabel}</span>
          <ModalCloseButton onClick={onClose} className="ml-auto text-[#aab0bf] hover:text-white" />
        </div>
        <div className="flex-1 relative cursor-pointer" onClick={() => advance()}>
          {bgImageUrl && (
            <img src={bgImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
          )}
          <div
            className="absolute left-3 right-3 bottom-3 min-h-[130px] rounded-[10px] border px-4.5 py-3 leading-loose text-base flex gap-3.5 items-start"
            style={{ background: "rgba(15,17,22,.9)", borderColor: "#3a4050", color: "#eef0f4" }}
          >
            {faceImgUrl && (
              <img
                src={faceImgUrl}
                alt=""
                className="w-[100px] h-[100px] rounded-lg object-cover shrink-0 pointer-events-none"
                style={{ background: "#1a1d24", border: "1px solid #3a4050" }}
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="font-bold mb-0.5 text-[15px]" style={{ color: state.speakerColor }}>
                {state.speakerName}
              </div>
              <div className="whitespace-pre-wrap">{state.text}</div>
            </div>
            {!state.isEnd && (
              <div className="absolute right-3.5 bottom-2 text-accent animate-pulse">
                <Icon name="chevron-down" />
              </div>
            )}
          </div>
          {state.waitingChoice && (
            <div className="absolute inset-0 flex flex-col gap-2.5 items-center justify-center" style={{ background: "rgba(0,0,0,.3)" }}>
              {state.choices.map((c, i) => (
                <button
                  key={i}
                  className="min-w-[300px] px-5 py-2.5 text-[15px] text-[#eef0f4] hover:bg-[#2a2e38] hover:border-[#5a6275]"
                  style={{ background: "#1e2128ee", borderColor: "#4a5163" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    c.onPick();
                  }}
                >
                  {c.text}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2 justify-between px-3.5 py-2.5" style={{ background: "rgba(0,0,0,.4)" }}>
          <span className="text-xs self-center" style={{ color: "#aab0bf" }}>
            {state.sceneName}
          </span>
          <button
            className="bg-[#262b35] text-[#eef0f4] border border-[#3a4050] hover:bg-[#2f3542] hover:border-[#5a6275]"
            onClick={restart}
          >
            最初から
          </button>
        </div>
      </div>
    </Modal>
  );
}
