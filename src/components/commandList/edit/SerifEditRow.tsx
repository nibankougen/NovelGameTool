import { useRef, useState } from "react";
import { useProjectStore } from "../../../state/ProjectProvider";
import { useEditorUi } from "../../../state/EditorUiContext";
import { useAppActions } from "../../../state/AppActionsContext";
import { useCharLookup } from "../../../hooks/useCharLookup";
import { useToast } from "../../common/ToastProvider";
import { Icon, type IconName } from "../../common/Icon";
import { textToDisplay, textToStorage, insertTextAtCursor } from "../../../lib/text";
import { parseInput } from "../../../lib/parseInput";
import { parseInputDry, makeDraftParseEnv } from "../../../lib/parseEnvDraft";
import { carryTr } from "../../../lib/carryTr";
import { ColumnResizeHandle } from "../ColumnResizeHandle";
import { useSerifColumns } from "../../../state/SerifColumnsContext";
import type { Scene, SerifCommand } from "../../../types/project";

interface ChipMenuItem {
  label: string;
  color?: string;
  icon?: IconName;
  pick: () => void;
}

export function SerifEditRow({ index, cmd, scene }: { index: number; cmd: SerifCommand; scene: Scene }) {
  const { project, mutate } = useProjectStore();
  const editorUi = useEditorUi();
  const appActions = useAppActions();
  const findChar = useCharLookup();
  const toast = useToast();
  const { speakerColWidth, faceColWidth, setSpeakerColWidth, setFaceColWidth } = useSerifColumns();

  const [spk, setSpk] = useState<string | null>(cmd.chara && findChar(cmd.chara) ? cmd.chara : null);
  const [face, setFace] = useState<string | null>(cmd.face || null);
  const [text, setText] = useState(() => textToDisplay(cmd.text, findChar));
  const [menu, setMenu] = useState<{ for: "speaker" | "face"; items: ChipMenuItem[] } | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const spkChipRef = useRef<HTMLButtonElement>(null);
  const faceChipRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef(false);
  const startedRef = useRef(false);

  const ch = spk ? findChar(spk) : null;
  const thumbSrc = ch ? (face && ch.exprImages[face]) || ch.thumb : null;
  const faceChipVisible = !!ch;

  const openSpeakerMenu = () => {
    const items: ChipMenuItem[] = [
      {
        label: "地の文",
        color: "var(--narration)",
        pick: () => {
          setSpk(null);
          setFace(null);
          inputRef.current?.focus();
        },
      },
    ];
    for (const c of project.characters) {
      items.push({
        label: c.name,
        color: c.color,
        pick: () => {
          setSpk(c.id);
          setFace((f) => (f && !c.expressions.includes(f) ? null : f));
          inputRef.current?.focus();
        },
      });
    }
    items.push({
      label: "新規キャラ…",
      icon: "plus",
      color: "var(--text-dim)",
      pick: () => {
        const name = window.prompt("新しいキャラクター名:");
        if (name && name.trim()) {
          const trimmed = name.trim();
          mutate((d) => {
            const env = makeDraftParseEnv(d, { toast });
            const id = env.ensureChar(trimmed);
            setSpk(id);
          });
        }
        inputRef.current?.focus();
      },
    });
    setMenu({ for: "speaker", items });
  };

  const openFaceMenu = () => {
    if (!ch) return;
    const items: ChipMenuItem[] = [
      {
        label: "（表情なし）",
        color: "var(--text-dim)",
        pick: () => {
          setFace(null);
          inputRef.current?.focus();
        },
      },
    ];
    for (const ex of ch.expressions) {
      items.push({
        label: ex,
        pick: () => {
          setFace(ex);
          inputRef.current?.focus();
        },
      });
    }
    items.push({
      label: "新しい表情…",
      icon: "plus",
      color: "var(--text-dim)",
      pick: () => {
        const ex = window.prompt("新しい表情名:");
        if (ex && ex.trim()) {
          const trimmed = ex.trim();
          const charId = ch.id;
          mutate((d) => {
            const env = makeDraftParseEnv(d, { toast });
            env.ensureExpression(charId, trimmed);
          });
          setFace(trimmed);
        }
        inputRef.current?.focus();
      },
    });
    setMenu({ for: "face", items });
  };

  const finish = (commit: boolean) => {
    if (doneRef.current) return;
    doneRef.current = true;
    setMenu(null);
    const sceneId = scene.id;
    if (commit) {
      const t = text.replace(/[\s　]+$/, "");
      if (/^[@＠/]/.test(t)) {
        const speaker = { id: spk, face };
        const err = parseInputDry(t, project, speaker, { sticky: false });
        if (err) {
          toast(err, true);
          doneRef.current = false;
          inputRef.current?.focus();
          return;
        }
        editorUi.stopEdit();
        mutate((d) => {
          const env = makeDraftParseEnv(d, { toast });
          const r = parseInput(t, env, speaker, { sticky: false });
          if (r.kind !== "command") return;
          const sc = d.scenes.find((s) => s.id === sceneId);
          if (!sc) return;
          sc.commands[index] = carryTr(sc.commands[index], r.cmd);
        });
      } else if (t) {
        editorUi.stopEdit();
        mutate((d) => {
          const sc = d.scenes.find((s) => s.id === sceneId);
          if (!sc) return;
          sc.commands[index] = carryTr(sc.commands[index], {
            type: "serif",
            chara: spk,
            face: spk ? face : null,
            text: textToStorage(t, d.characters),
          });
        });
      } else {
        editorUi.stopEdit();
      }
    } else {
      editorUi.stopEdit();
    }
    appActions.focusMainInput();
  };

  // pendingEditClickの消費はrender中ではなくref attach時（コミット後・一度だけ実行が保証される）に行う。
  // StrictModeの開発時二重呼び出しでは、useStateの遅延初期化関数はrender中に2回評価されるため、
  // ここでconsumePendingEditClick()（副作用で消費済みにする）を呼ぶと1回目の結果が2回目で失われる。
  const inputRefCallback = (el: HTMLInputElement | null) => {
    inputRef.current = el;
    if (el && !startedRef.current) {
      startedRef.current = true;
      const info = editorUi.consumePendingEditClick();
      if (info?.zone === "speaker") {
        spkChipRef.current?.focus();
        openSpeakerMenu();
      } else if (info?.zone === "face" && faceChipVisible) {
        faceChipRef.current?.focus();
        openFaceMenu();
      } else {
        el.focus();
        const pos = info?.zone === "text" ? info.offset : el.value.length;
        el.setSelectionRange(pos, pos);
      }
    }
  };

  return (
    <div className="cmd-row flex items-start gap-2 px-2 py-1 my-px">
      <span className="drag-handle invisible pt-1">
        <Icon name="grip-vertical" />
      </span>
      <span className="w-8 shrink-0" />
      <div className="row-body flex-1 min-w-0">
        <div
          ref={wrapRef}
          className="edit-wrap flex items-center w-full relative"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if ((e.target as HTMLElement) !== inputRef.current && e.key === "Escape") {
              e.preventDefault();
              if (menu) setMenu(null);
              else finish(false);
            }
            e.stopPropagation();
          }}
          onBlur={(e) => {
            if (wrapRef.current?.contains(e.relatedTarget as Node)) return;
            setTimeout(() => {
              if (!doneRef.current && !wrapRef.current?.contains(document.activeElement)) finish(true);
            }, 0);
          }}
        >
          <div className="row-face-slot w-[26px] h-[26px] shrink-0 mr-1.5">
            {thumbSrc && (
              <img
                className="edit-thumb w-full h-full rounded object-cover bg-bg-3"
                src={thumbSrc}
                alt=""
                title="話者のサムネイル（表情画像がない場合はデフォルトイラスト）"
              />
            )}
          </div>
          <div className="speaker-col relative self-stretch shrink-0 mr-1.5" style={{ width: speakerColWidth }}>
            <button
              ref={spkChipRef}
              type="button"
              className="edit-chip edit-chip-spk flex items-center gap-1 px-1 h-[26px] w-full min-h-0 rounded font-bold text-sm hover:bg-bg-3 hover:outline hover:outline-1 hover:outline-accent"
              style={{ color: ch ? ch.color : "var(--narration)" }}
              title="クリックで話者切替／Backspaceで削除（地の文に）"
              onClick={(e) => {
                e.stopPropagation();
                openSpeakerMenu();
              }}
              onKeyDown={(e) => {
                if (e.key === "Delete" || e.key === "Backspace") {
                  e.preventDefault();
                  setSpk(null);
                  setFace(null);
                  inputRef.current?.focus();
                }
              }}
            >
              <span className="truncate flex-1 min-w-0 text-left">{ch ? ch.name : "地の文"}</span>
            </button>
            <ColumnResizeHandle width={speakerColWidth} onResize={setSpeakerColWidth} />
          </div>
          <div className="face-col relative self-stretch shrink-0 mr-1.5" style={{ width: faceColWidth }}>
            {faceChipVisible && (
              <button
                ref={faceChipRef}
                type="button"
                className="edit-chip edit-chip-face flex items-center gap-1 px-1 h-[26px] w-full min-h-0 rounded font-normal text-xs hover:bg-bg-3 hover:outline hover:outline-1 hover:outline-accent"
                style={{ color: face ? undefined : "var(--text-dim)" }}
                title="クリックで表情切替／Backspaceで表情削除"
                onClick={(e) => {
                  e.stopPropagation();
                  openFaceMenu();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Delete" || e.key === "Backspace") {
                    e.preventDefault();
                    setFace(null);
                    inputRef.current?.focus();
                  }
                }}
              >
                {face ? (
                  <span className="truncate flex-1 min-w-0 text-left">（{face}）</span>
                ) : (
                  <>
                    <Icon name="plus" />
                    <span className="truncate flex-1 min-w-0 text-left">表情</span>
                  </>
                )}
              </button>
            )}
            <ColumnResizeHandle width={faceColWidth} onResize={setFaceColWidth} />
          </div>
          <input
            ref={inputRefCallback}
            type="text"
            className="edit-text flex-1 min-w-0 text-sm px-0.5 py-px bg-transparent border-none rounded outline-none focus:bg-bg-2 focus:outline focus:outline-1 focus:outline-accent"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || e.keyCode === 229) return;
              if (e.key === "Enter") {
                e.preventDefault();
                finish(true);
              } else if (e.key === "Escape") {
                e.preventDefault();
                if (menu) setMenu(null);
                else finish(false);
              } else if (e.key === "Backspace" && e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === 0) {
                e.preventDefault();
                if (face) setFace(null);
                else if (spk) setSpk(null);
              } else if (e.altKey && /^[1-9]$/.test(e.key)) {
                e.preventDefault();
                const idx = Number(e.key) - 1;
                const target = project.characters[idx];
                if (target) {
                  const { value, cursor } = insertTextAtCursor(e.currentTarget, `《${target.name}》`);
                  setText(value);
                  requestAnimationFrame(() => inputRef.current?.setSelectionRange(cursor, cursor));
                }
              }
              e.stopPropagation();
            }}
          />
          {menu && (
            <div
              className="edit-menu absolute z-60 bg-bg-3 border border-border rounded-lg shadow-2xl min-w-[150px] max-h-[250px] overflow-y-auto"
              style={(() => {
                const chipEl = (menu.for === "speaker" ? spkChipRef : faceChipRef).current;
                const wrapEl = wrapRef.current;
                let left = 0;
                let top = 0;
                if (chipEl && wrapEl) {
                  const cr = chipEl.getBoundingClientRect();
                  const wr = wrapEl.getBoundingClientRect();
                  left = Math.max(0, Math.min(cr.left - wr.left, wrapEl.clientWidth - 160));
                  top = cr.bottom - wr.top + 4;
                }
                return { left, top };
              })()}
            >
              {menu.items.map((it, i) => (
                <div
                  key={i}
                  className="em-item px-3.5 py-1.5 text-sm whitespace-nowrap cursor-pointer hover:bg-accent-dim flex items-center gap-1"
                  style={{ color: it.color }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenu(null);
                    it.pick();
                  }}
                >
                  {it.icon && <Icon name={it.icon} />}
                  {it.label}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
