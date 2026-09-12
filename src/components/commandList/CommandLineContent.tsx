import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../common/Icon";
import { MentionText } from "../common/MentionText";
import { ColumnResizeHandle } from "./ColumnResizeHandle";
import { useSerifColumns } from "../../state/SerifColumnsContext";
import { useAssetUrl } from "../../hooks/useAssetUrl";
import type { CharLookup } from "../../lib/text";
import type { Command, EventKeyDef, Scene } from "../../types/project";

interface Props {
  cmd: Command;
  findChar: CharLookup;
  scenes: Scene[];
  eventKeys: EventKeyDef[];
  honorIssues: string[];
  acked: boolean;
  onToggleHonorAck: () => void;
  onGotoScene: (sceneId: string) => void;
}

function EventTagsRow({ cmd, eventKeys }: { cmd: Command; eventKeys: EventKeyDef[] }) {
  if (cmd.type !== "serif" || !cmd.events?.length) return null;
  const events = cmd.events;
  return (
    <div className="event-tags-row flex flex-wrap gap-1 mt-1">
      {eventKeys.map((key) => {
        const tag = events.find((e) => e.keyId === key.id);
        if (!tag) return null;
        return (
          <span key={key.id} className="event-tag inline-flex items-center gap-1 bg-bg-3 rounded px-1.5 py-0.5 text-[11px] text-text-dim">
            <Icon name="tag" />
            {key.name}
            {tag.value !== undefined && tag.value !== "" ? `: ${tag.value}` : ""}
          </span>
        );
      })}
    </div>
  );
}

function GotoSceneButton({ sceneId, onGotoScene }: { sceneId: string; onGotoScene: (id: string) => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className="opt-goto inline-flex items-center px-0.5 min-h-0 ml-1 border-none bg-transparent text-text-dim rounded hover:text-accent hover:bg-bg-3 align-middle"
      title={t("commandList.gotoScene")}
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

export function CommandLineContent({ cmd, findChar, scenes, eventKeys, honorIssues, acked, onToggleHonorAck, onGotoScene }: Props) {
  const { t } = useTranslation();
  const { speakerColWidth, faceColWidth, setSpeakerColWidth, setFaceColWidth } = useSerifColumns();
  const serifChar = cmd.type === "serif" && cmd.chara ? findChar(cmd.chara) : null;
  const serifImgPath = serifChar ? (cmd.type === "serif" && cmd.face && serifChar.exprImages[cmd.face]) || serifChar.thumb : null;
  const img = useAssetUrl(serifImgPath);
  switch (cmd.type) {
    case "serif": {
      const ch = serifChar;
      const faceBroken = !!(cmd.face && ch && !ch.expressions.includes(cmd.face));
      const badge = honorIssues.length > 0;
      const ackTitle = acked ? t("commandList.honorAck.confirmed") : t("commandList.honorAck.markConfirmed");
      const badgeEl = badge && (
        <div className="honor-badge-row flex">
          <span
            className={`honor-badge inline-flex items-center shrink-0 text-warn pb-0.5 cursor-pointer${acked ? " opacity-35" : ""}`}
            data-act="honor-ack"
            title={t("commandList.honorAck.tooltip", { ackTitle, issues: honorIssues.join(t("commandList.honorAck.separator")) })}
            onClick={(e) => {
              e.stopPropagation();
              onToggleHonorAck();
            }}
          >
            <Icon name="circle-alert" />
          </span>
        </div>
      );
      return (
        <div className="serif-row-inner flex items-start">
          <div className="row-face-slot w-[26px] h-[26px] shrink-0 mr-1.5">
            {img && <img className="row-face w-full h-full rounded object-cover align-middle bg-bg-3" src={img} alt="" />}
          </div>
          <div className="speaker-col relative self-stretch shrink-0 mr-1.5" style={{ width: speakerColWidth }}>
            <div className="h-[26px] flex items-center">
              {cmd.chara && (
                <span
                  className="speaker-name font-bold text-sm truncate flex-1 min-w-0"
                  style={{ color: ch ? ch.color : "var(--danger)" }}
                  title={ch ? ch.name : undefined}
                >
                  {ch ? ch.name : <BrokenRef>{t("commandList.deletedCharacter")}</BrokenRef>}
                </span>
              )}
            </div>
            <ColumnResizeHandle width={speakerColWidth} onResize={setSpeakerColWidth} />
          </div>
          <div className="face-col relative self-stretch shrink-0 mr-1.5" style={{ width: faceColWidth }}>
            <div className="h-[26px] flex items-center">
              {cmd.chara &&
                cmd.face &&
                (faceBroken ? (
                  <span
                    className="face-tag broken-ref text-danger text-xs font-normal truncate flex-1 min-w-0"
                    title={t("commandList.expressionRemoved")}
                  >
                    <Icon name="triangle-alert" />（{cmd.face}）
                  </span>
                ) : (
                  <span className="face-tag text-text-dim text-xs font-normal truncate flex-1 min-w-0" title={cmd.face}>
                    （{cmd.face}）
                  </span>
                ))}
            </div>
            <ColumnResizeHandle width={faceColWidth} onResize={setFaceColWidth} />
          </div>
          <div className="serif-content flex-1 min-w-0">
            {badgeEl}
            <span className={cmd.chara ? "serif-text" : "narration text-narration"}>
              <MentionText text={cmd.text} findChar={findChar} />
            </span>
            <EventTagsRow cmd={cmd} eventKeys={eventKeys} />
          </div>
        </div>
      );
    }
    case "bg":
      return (
        <span className="sys-cmd text-sys text-sm">
          <span className="sys-tag inline-block bg-accent-dim rounded px-1.5 mr-2 text-[11px]">{t("commandList.tags.bg")}</span>
          {cmd.value}
        </span>
      );
    case "bgm":
      return (
        <span className="sys-cmd text-sys text-sm">
          <span className="sys-tag inline-block bg-accent-dim rounded px-1.5 mr-2 text-[11px]">{t("commandList.tags.bgm")}</span>
          {cmd.value || t("commandList.stopped")}
        </span>
      );
    case "se":
      return (
        <span className="sys-cmd text-sys text-sm">
          <span className="sys-tag inline-block bg-accent-dim rounded px-1.5 mr-2 text-[11px]">{t("commandList.tags.se")}</span>
          {cmd.value}
        </span>
      );
    case "wait":
      return (
        <span className="sys-cmd text-sys text-sm">
          <span className="sys-tag inline-block bg-accent-dim rounded px-1.5 mr-2 text-[11px]">{t("commandList.tags.wait")}</span>
          {cmd.value}ms
        </span>
      );
    case "jump": {
      const s = scenes.find((s) => s.id === cmd.target);
      return (
        <span className="sys-cmd text-sys text-sm">
          <span className="sys-tag inline-block bg-accent-dim rounded px-1.5 mr-2 text-[11px]">{t("commandList.tags.jump")}</span>
          {s ? (
            <>
              → {s.name}
              <GotoSceneButton sceneId={s.id} onGotoScene={onGotoScene} />
            </>
          ) : (
            <BrokenRef>→{t("commandList.deletedSceneRef")}</BrokenRef>
          )}
        </span>
      );
    }
    case "choice":
      return (
        <>
          <span className="choice-cmd text-sys text-sm">
            <span className="sys-tag inline-block bg-accent-dim rounded px-1.5 mr-2 text-[11px]">{t("commandList.tags.choice")}</span>
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
                      <Icon name="triangle-alert" />→{t("commandList.deletedSceneRef")}
                    </span>
                  )
                ) : (
                  <span className="opt-arrow text-text-dim text-xs ml-2">→ {t("common.continue")}</span>
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
