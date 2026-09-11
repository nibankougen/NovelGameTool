import type { ReactNode } from "react";
import { Icon } from "../common/Icon";
import { MentionText } from "../common/MentionText";
import type { CharLookup } from "../../lib/text";
import type { Command, Scene } from "../../types/project";

interface Props {
  cmd: Command;
  findChar: CharLookup;
  scenes: Scene[];
  honorIssues: string[];
  acked: boolean;
  onToggleHonorAck: () => void;
  onGotoScene: (sceneId: string) => void;
}

function GotoSceneButton({ sceneId, onGotoScene }: { sceneId: string; onGotoScene: (id: string) => void }) {
  return (
    <button
      type="button"
      className="opt-goto inline-flex items-center px-0.5 min-h-0 ml-1 border-none bg-transparent text-text-dim rounded hover:text-accent hover:bg-bg-3 align-middle"
      title="このシーンへ移動"
      onClick={(e) => {
        e.stopPropagation();
        onGotoScene(sceneId);
      }}
    >
      <Icon name="corner-down-right" />
    </button>
  );
}

function BrokenRef({ children }: { children: ReactNode }) {
  return (
    <span className="broken-ref text-danger inline-flex items-center gap-1">
      <Icon name="triangle-alert" />
      {children}
    </span>
  );
}

export function CommandLineContent({ cmd, findChar, scenes, honorIssues, acked, onToggleHonorAck, onGotoScene }: Props) {
  switch (cmd.type) {
    case "serif": {
      if (!cmd.chara) {
        return (
          <span className="narration text-narration">
            <MentionText text={cmd.text} findChar={findChar} />
          </span>
        );
      }
      const ch = findChar(cmd.chara);
      const faceBroken = !!(cmd.face && ch && !ch.expressions.includes(cmd.face));
      const img = ch ? (cmd.face && ch.exprImages[cmd.face]) || ch.thumb : null;
      const badge = honorIssues.length > 0;
      const ackTitle = acked ? "確認済み（クリックで戻す）" : "クリックで確認済みにする（薄く表示）";
      const body = (
        <>
          <span className="speaker-name font-bold mr-0.5" style={{ color: ch ? ch.color : "var(--danger)" }}>
            {ch ? ch.name : <BrokenRef>（削除済キャラ）</BrokenRef>}
          </span>
          {cmd.face &&
            (faceBroken ? (
              <span className="face-tag broken-ref text-danger text-xs font-normal mr-0.5" title="表情候補から削除された表情です">
                <Icon name="triangle-alert" />（{cmd.face}）
              </span>
            ) : (
              <span className="face-tag text-text-dim text-xs font-normal mr-0.5">（{cmd.face}）</span>
            ))}
          <span className="serif-text">
            「
            <MentionText text={cmd.text} findChar={findChar} />」
          </span>
        </>
      );
      const badgeEl = badge && (
        <div className="honor-badge-row flex">
          <span
            className={`honor-badge inline-flex items-center shrink-0 text-warn pb-0.5 cursor-pointer${acked ? " opacity-35" : ""}`}
            data-act="honor-ack"
            title={`${ackTitle}\n人称の表記ゆれ: ${honorIssues.join("、")}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleHonorAck();
            }}
          >
            <Icon name="circle-alert" />
          </span>
        </div>
      );
      if (img || badge) {
        return (
          <div className="serif-row-inner flex items-center">
            {img && <img className="row-face w-[26px] h-[26px] rounded object-cover shrink-0 align-middle mr-1.5 bg-bg-3" src={img} alt="" />}
            <div className="serif-content flex-1 min-w-0">
              {badgeEl}
              {body}
            </div>
          </div>
        );
      }
      return body;
    }
    case "bg":
      return (
        <span className="sys-cmd text-sys text-sm">
          <span className="sys-tag inline-block bg-accent-dim rounded px-1.5 mr-2 text-[11px]">背景</span>
          {cmd.value}
        </span>
      );
    case "bgm":
      return (
        <span className="sys-cmd text-sys text-sm">
          <span className="sys-tag inline-block bg-accent-dim rounded px-1.5 mr-2 text-[11px]">BGM</span>
          {cmd.value || "（停止）"}
        </span>
      );
    case "se":
      return (
        <span className="sys-cmd text-sys text-sm">
          <span className="sys-tag inline-block bg-accent-dim rounded px-1.5 mr-2 text-[11px]">効果音</span>
          {cmd.value}
        </span>
      );
    case "wait":
      return (
        <span className="sys-cmd text-sys text-sm">
          <span className="sys-tag inline-block bg-accent-dim rounded px-1.5 mr-2 text-[11px]">待機</span>
          {cmd.value}ms
        </span>
      );
    case "jump": {
      const s = scenes.find((s) => s.id === cmd.target);
      return (
        <span className="sys-cmd text-sys text-sm">
          <span className="sys-tag inline-block bg-accent-dim rounded px-1.5 mr-2 text-[11px]">ジャンプ</span>
          {s ? (
            <>
              → {s.name}
              <GotoSceneButton sceneId={s.id} onGotoScene={onGotoScene} />
            </>
          ) : (
            <BrokenRef>→（削除済シーン）</BrokenRef>
          )}
        </span>
      );
    }
    case "choice":
      return (
        <>
          <span className="choice-cmd text-sys text-sm">
            <span className="sys-tag inline-block bg-accent-dim rounded px-1.5 mr-2 text-[11px]">選択肢</span>
          </span>
          {cmd.options.map((o, i) => {
            const s = o.target ? scenes.find((sc) => sc.id === o.target) : null;
            return (
              <span key={i} className="choice-opt block ml-3.5 my-0.5">
                ◆ {o.text}
                {o.target ? (
                  s ? (
                    <span className="opt-arrow text-text-dim text-xs ml-2">
                      → {s.name}
                      <GotoSceneButton sceneId={s.id} onGotoScene={onGotoScene} />
                    </span>
                  ) : (
                    <span className="opt-arrow broken-ref text-danger text-xs ml-2 inline-flex items-center gap-1">
                      <Icon name="triangle-alert" />→（削除済シーン）
                    </span>
                  )
                ) : (
                  <span className="opt-arrow text-text-dim text-xs ml-2">→ 続行</span>
                )}
              </span>
            );
          })}
        </>
      );
    case "comment":
      return <span className="comment-cmd text-comment text-sm">💬 {cmd.text}</span>;
    default:
      return null;
  }
}
