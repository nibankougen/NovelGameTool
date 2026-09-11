import { useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent, type RefObject } from "react";
import { useProjectStore } from "../../state/ProjectProvider";
import { useEditorUi } from "../../state/EditorUiContext";
import { useAppActions } from "../../state/AppActionsContext";
import { useToast } from "../common/ToastProvider";
import { useClickOutside } from "../../hooks/useClickOutside";
import { useInsertCommand } from "../../hooks/useInsertCommand";
import { Icon } from "../common/Icon";
import { SLASH_CMDS, parseInput, type ParseOutcome } from "../../lib/parseInput";
import { parseInputDry, makeDraftParseEnv } from "../../lib/parseEnvDraft";
import { insertTextAtCursor } from "../../lib/text";
import { scenesInGroupOrder } from "../../lib/sceneUtils";

export function InputBar({ inputRef }: { inputRef: RefObject<HTMLInputElement | null> }) {
  const { project, mutate } = useProjectStore();
  const editorUi = useEditorUi();
  const appActions = useAppActions();
  const toast = useToast();
  const insertCommand = useInsertCommand();

  const [value, setValue] = useState("");
  const [slashHl, setSlashHl] = useState(0);
  const [slashDismissed, setSlashDismissed] = useState(false);
  const [speakerOpen, setSpeakerOpen] = useState(false);
  const [faceOpen, setFaceOpen] = useState(false);
  const [jumpOpen, setJumpOpen] = useState(false);

  const speakerChipRef = useRef<HTMLButtonElement>(null);
  const faceChipRef = useRef<HTMLButtonElement>(null);
  const jumpBtnRef = useRef<HTMLButtonElement>(null);

  const speakerCh = editorUi.speakerId ? project.characters.find((c) => c.id === editorUi.speakerId) : null;

  const slashMatches = useMemo(() => {
    if (!value.startsWith("/") || value.startsWith("//") || value.includes(" ")) return [];
    const m = SLASH_CMDS.filter((c) => c.cmd.startsWith(value));
    if (m.length === 1 && m[0].cmd === value) return [];
    return m;
  }, [value]);
  const slashVisible = slashMatches.length > 0 && !slashDismissed;
  const activeSlashHl = Math.min(slashHl, Math.max(0, slashMatches.length - 1));

  const speakerPopupRef = useClickOutside<HTMLDivElement>(speakerOpen, () => setSpeakerOpen(false), speakerChipRef);
  const facePopupRef = useClickOutside<HTMLDivElement>(faceOpen, () => setFaceOpen(false), faceChipRef);
  const jumpPopupRef = useClickOutside<HTMLDivElement>(jumpOpen, () => setJumpOpen(false), jumpBtnRef);

  const closeAllPopups = () => {
    setSpeakerOpen(false);
    setFaceOpen(false);
    setJumpOpen(false);
  };

  const applyOutcome = (outcome: ParseOutcome) => {
    if (outcome.kind === "command" && outcome.setSpeaker) editorUi.setSpeaker(outcome.setSpeaker.id, outcome.setSpeaker.face);
    else if (outcome.kind === "switchSpeaker") editorUi.setSpeaker(outcome.speaker.id, outcome.speaker.face);
    else if (outcome.kind === "openChoiceModal") appActions.openChoiceModal(null);
  };

  const submitInput = () => {
    const raw = value;
    if (!raw.trim()) return;
    const speaker = { id: editorUi.speakerId, face: editorUi.speakerFace };
    const err = parseInputDry(raw, project, speaker);
    if (err) {
      toast(err, true);
      return;
    }
    const scene = project.scenes.find((s) => s.id === editorUi.currentSceneId);
    if (!scene) return;
    const at = editorUi.selIndex === null ? scene.commands.length : editorUi.selIndex + 1;
    const sceneId = scene.id;
    const holder: { outcome: ParseOutcome | null } = { outcome: null };
    mutate((d) => {
      const env = makeDraftParseEnv(d, { toast });
      const r = parseInput(raw, env, speaker);
      holder.outcome = r;
      if (r.kind === "command") {
        const sc = d.scenes.find((s) => s.id === sceneId);
        if (sc) sc.commands.splice(at, 0, r.cmd);
      }
    });
    setValue("");
    setSlashHl(0);
    const finalOutcome = holder.outcome;
    if (finalOutcome) {
      applyOutcome(finalOutcome);
      if (finalOutcome.kind === "command" && editorUi.selIndex !== null) editorUi.setSelIndex(at);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (!text || !/\r?\n/.test(text.trim())) return;
    e.preventDefault();
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return;
    if (!window.confirm(`${lines.length} 行をまとめて追加しますか？\n（@名前 や /コマンド の記法も解釈されます）`)) return;
    let added = 0;
    let errors = 0;
    let curSpeaker = { id: editorUi.speakerId, face: editorUi.speakerFace };
    let newSelIndex = editorUi.selIndex;
    const sceneId = editorUi.currentSceneId;
    mutate((d) => {
      const env = makeDraftParseEnv(d, { toast });
      const sc = d.scenes.find((s) => s.id === sceneId);
      if (!sc) return;
      for (const line of lines) {
        const r = parseInput(line, env, curSpeaker);
        if (r.kind === "command") {
          const at = newSelIndex === null ? sc.commands.length : newSelIndex + 1;
          sc.commands.splice(at, 0, r.cmd);
          if (newSelIndex !== null) newSelIndex = at;
          if (r.setSpeaker) curSpeaker = r.setSpeaker;
          added++;
        } else if (r.kind === "switchSpeaker") {
          curSpeaker = r.speaker;
        } else if (r.kind === "error") {
          errors++;
        }
      }
    });
    editorUi.setSelIndex(newSelIndex);
    editorUi.setSpeaker(curSpeaker.id, curSpeaker.face);
    toast(`${added} 行を追加しました` + (errors ? `（${errors} 行はエラーでスキップ）` : ""));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;

    if (e.altKey && /^[1-9]$/.test(e.key)) {
      e.preventDefault();
      const target = project.characters[Number(e.key) - 1];
      if (target && inputRef.current) {
        const { value: v, cursor } = insertTextAtCursor(inputRef.current, `《${target.name}》`);
        setValue(v);
        requestAnimationFrame(() => inputRef.current?.setSelectionRange(cursor, cursor));
      }
      return;
    }

    if (slashVisible) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashHl((h) => (h + 1 + slashMatches.length) % slashMatches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashHl((h) => (h - 1 + slashMatches.length) % slashMatches.length);
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        setValue(slashMatches[activeSlashHl].cmd + " ");
        setSlashHl(0);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSlashDismissed(true);
        return;
      }
    }

    const empty = value === "";
    const cmds = project.scenes.find((s) => s.id === editorUi.currentSceneId)?.commands ?? [];

    if (e.key === "Enter") {
      e.preventDefault();
      if (empty && editorUi.selIndex !== null) {
        editorUi.startEdit(editorUi.selIndex);
        return;
      }
      submitInput();
      return;
    }
    if (empty) {
      const n = cmds.length;
      if (e.key === "ArrowUp" && !e.ctrlKey) {
        e.preventDefault();
        if (!n) return;
        editorUi.setSelIndex(editorUi.selIndex === null ? n - 1 : Math.max(0, editorUi.selIndex - 1));
        return;
      }
      if (e.key === "ArrowDown" && !e.ctrlKey) {
        e.preventDefault();
        if (editorUi.selIndex === null) return;
        editorUi.setSelIndex(editorUi.selIndex >= n - 1 ? null : editorUi.selIndex + 1);
        return;
      }
      if (e.key === "Delete" && editorUi.selIndex !== null) {
        e.preventDefault();
        const i = editorUi.selIndex;
        const sceneId = editorUi.currentSceneId;
        let newSel: number | null = i;
        if (newSel === i) newSel = i > 0 ? i - 1 : cmds.length > 1 ? 0 : null;
        mutate((d) => {
          const sc = d.scenes.find((s) => s.id === sceneId);
          sc?.commands.splice(i, 1);
        });
        editorUi.setSelIndex(newSel);
        return;
      }
    }
    if (e.ctrlKey && (e.key === "ArrowUp" || e.key === "ArrowDown") && editorUi.selIndex !== null) {
      e.preventDefault();
      const i = editorUi.selIndex;
      const dir = e.key === "ArrowUp" ? -1 : 1;
      const j = i + dir;
      if (j < 0 || j >= cmds.length) return;
      const sceneId = editorUi.currentSceneId;
      mutate((d) => {
        const sc = d.scenes.find((s) => s.id === sceneId);
        if (!sc) return;
        const [c] = sc.commands.splice(i, 1);
        sc.commands.splice(j, 0, c);
      });
      editorUi.setSelIndex(j);
      return;
    }
    if (e.ctrlKey && (e.key === "d" || e.key === "D") && editorUi.selIndex !== null) {
      e.preventDefault();
      const i = editorUi.selIndex;
      const sceneId = editorUi.currentSceneId;
      mutate((d) => {
        const sc = d.scenes.find((s) => s.id === sceneId);
        if (!sc) return;
        sc.commands.splice(i + 1, 0, JSON.parse(JSON.stringify(sc.commands[i])));
      });
      editorUi.setSelIndex(i + 1);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      if (editorUi.selIndex !== null) editorUi.setSelIndex(null);
      closeAllPopups();
      return;
    }
  };

  return (
    <div id="inputBar" className="shrink-0 border-t border-border bg-panel pt-2.5 px-4 pb-2 relative">
      {slashVisible && (
        <div className="popup absolute bottom-full left-0 right-0 z-50">
          <div className="popup-inner max-w-[860px] mx-auto mb-1.5 bg-bg-3 border border-border rounded-lg overflow-hidden shadow-2xl">
            {slashMatches.map((c, i) => (
              <div
                key={c.cmd}
                className={`popup-item flex gap-3 py-1.5 px-3.5 cursor-pointer items-center ${i === activeSlashHl ? "bg-accent-dim" : "hover:bg-accent-dim"}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setValue(c.cmd + " ");
                  setSlashHl(0);
                  inputRef.current?.focus();
                }}
              >
                <span className="p-cmd font-bold text-sys w-[150px] shrink-0">{c.cmd}</span>
                <span className="p-desc text-text-dim text-xs">{c.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {speakerOpen && (
        <div className="popup absolute bottom-full left-0 right-0 z-50">
          <div ref={speakerPopupRef} className="popup-inner max-w-[860px] mx-auto mb-1.5 bg-bg-3 border border-border rounded-lg overflow-hidden shadow-2xl">
            <div
              className="popup-item flex gap-3 py-1.5 px-3.5 cursor-pointer items-center hover:bg-accent-dim"
              onMouseDown={(e) => {
                e.preventDefault();
                setSpeakerOpen(false);
                editorUi.setSpeaker(null);
                inputRef.current?.focus();
              }}
            >
              <span className="p-cmd font-bold w-[150px] shrink-0" style={{ color: "var(--narration)" }}>
                地の文
              </span>
              <span className="p-desc text-text-dim text-xs">Ctrl+0</span>
            </div>
            {project.characters.map((c, i) => (
              <div
                key={c.id}
                className="popup-item flex gap-3 py-1.5 px-3.5 cursor-pointer items-center hover:bg-accent-dim"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setSpeakerOpen(false);
                  editorUi.setSpeaker(c.id);
                  inputRef.current?.focus();
                }}
              >
                <span className="p-cmd font-bold w-[150px] shrink-0" style={{ color: c.color }}>
                  {c.name}
                </span>
                <span className="p-desc text-text-dim text-xs">{i < 9 ? `Ctrl+${i + 1}` : ""}</span>
              </div>
            ))}
            <div
              className="popup-item flex gap-3 py-1.5 px-3.5 cursor-pointer items-center hover:bg-accent-dim"
              onMouseDown={(e) => {
                e.preventDefault();
                setSpeakerOpen(false);
                appActions.openCharModal(null);
              }}
            >
              <span className="p-cmd font-bold w-[150px] shrink-0 inline-flex items-center gap-1">
                <Icon name="plus" /> 新規キャラ
              </span>
              <span className="p-desc text-text-dim text-xs">キャラクターを追加</span>
            </div>
          </div>
        </div>
      )}
      {faceOpen && speakerCh && (
        <div className="popup absolute bottom-full left-0 right-0 z-50">
          <div ref={facePopupRef} className="popup-inner max-w-[860px] mx-auto mb-1.5 bg-bg-3 border border-border rounded-lg overflow-hidden shadow-2xl">
            <div
              className="popup-item flex gap-3 py-1.5 px-3.5 cursor-pointer items-center hover:bg-accent-dim"
              onMouseDown={(e) => {
                e.preventDefault();
                setFaceOpen(false);
                editorUi.setSpeaker(speakerCh.id, null);
                inputRef.current?.focus();
              }}
            >
              <span className="p-cmd text-text-dim">（表情なし）</span>
            </div>
            {speakerCh.expressions.map((ex) => (
              <div
                key={ex}
                className="popup-item flex gap-3 py-1.5 px-3.5 cursor-pointer items-center hover:bg-accent-dim"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setFaceOpen(false);
                  editorUi.setSpeaker(speakerCh.id, ex);
                  inputRef.current?.focus();
                }}
              >
                <span className="p-cmd">{ex}</span>
              </div>
            ))}
            <div
              className="popup-item flex gap-3 py-1.5 px-3.5 cursor-pointer items-center hover:bg-accent-dim"
              onMouseDown={(e) => {
                e.preventDefault();
                setFaceOpen(false);
                const v = window.prompt("新しい表情名:");
                if (!v || !v.trim()) return;
                const f = v.trim();
                const charId = speakerCh.id;
                mutate((d) => {
                  const c = d.characters.find((c) => c.id === charId);
                  if (c && !c.expressions.includes(f)) c.expressions.push(f);
                });
                editorUi.setSpeaker(speakerCh.id, f);
                inputRef.current?.focus();
              }}
            >
              <span className="p-cmd inline-flex items-center gap-1">
                <Icon name="plus" /> 新しい表情…
              </span>
              <span className="p-desc text-text-dim text-xs">表情候補に追加</span>
            </div>
          </div>
        </div>
      )}
      {jumpOpen && (
        <div className="popup absolute bottom-full left-0 right-0 z-50">
          <div ref={jumpPopupRef} className="popup-inner max-w-[860px] mx-auto mb-1.5 bg-bg-3 border border-border rounded-lg overflow-hidden shadow-2xl max-h-[50vh] overflow-y-auto">
            {(() => {
              const grouped = project.sceneGroups.length > 0;
              let lastGroup: string | null | undefined;
              return scenesInGroupOrder(project.scenes, project.sceneGroups).map(({ scene: s, groupName }) => {
                const header = grouped && groupName !== lastGroup;
                lastGroup = groupName;
                return (
                  <div key={s.id}>
                    {header && <div className="popup-section px-3.5 pt-1.5 pb-0.5 text-text-dim text-[11px] font-bold border-t border-hairline first:border-t-0">{groupName || "未分類"}</div>}
                    <div
                      className="popup-item flex gap-3 py-1.5 px-3.5 cursor-pointer items-center hover:bg-accent-dim"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setJumpOpen(false);
                        insertCommand({ type: "jump", target: s.id });
                        inputRef.current?.focus();
                      }}
                    >
                      <span className="p-cmd font-bold">{s.name}</span>
                      <span className="p-desc text-text-dim text-xs">このシーンへジャンプ</span>
                    </div>
                  </div>
                );
              });
            })()}
            <div
              className="popup-item flex gap-3 py-1.5 px-3.5 cursor-pointer items-center hover:bg-accent-dim"
              onMouseDown={(e) => {
                e.preventDefault();
                setJumpOpen(false);
                const name = window.prompt("新規シーン名:");
                if (!name || !name.trim()) return;
                const scene = project.scenes.find((s) => s.id === editorUi.currentSceneId);
                if (!scene) return;
                const at = editorUi.selIndex === null ? scene.commands.length : editorUi.selIndex + 1;
                const sceneId = scene.id;
                mutate((d) => {
                  const env = makeDraftParseEnv(d, { toast });
                  const targetId = env.ensureScene(name.trim());
                  const sc = d.scenes.find((s) => s.id === sceneId);
                  if (sc) sc.commands.splice(at, 0, { type: "jump", target: targetId });
                });
                if (editorUi.selIndex !== null) editorUi.setSelIndex(at);
                inputRef.current?.focus();
              }}
            >
              <span className="p-cmd inline-flex items-center gap-1">
                <Icon name="plus" /> 新規シーン…
              </span>
              <span className="p-desc text-text-dim text-xs">シーンを作成してジャンプ</span>
            </div>
          </div>
        </div>
      )}

      <div id="inputInner" className="max-w-[860px] mx-auto flex gap-2 items-center">
        <button
          ref={speakerChipRef}
          id="speakerChip"
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-bg-3 border border-border cursor-pointer min-w-[96px] justify-center font-semibold shrink-0 select-none hover:border-accent"
          style={{ color: speakerCh ? speakerCh.color : "var(--narration)" }}
          title="クリックで話者切替 (Ctrl+0〜9)"
          onClick={() => setSpeakerOpen((v) => !v)}
        >
          {speakerCh && <span className="inline-block w-3 h-3 rounded shrink-0" style={{ background: speakerCh.color }} />}
          {speakerCh ? speakerCh.name : "地の文"}
        </button>
        {speakerCh && (
          <button
            ref={faceChipRef}
            id="faceChip"
            type="button"
            className="flex items-center px-2.5 py-1.5 rounded-md bg-bg-3 border border-border cursor-pointer shrink-0 select-none text-sm hover:border-accent"
            style={{ color: editorUi.speakerFace ? "var(--text)" : "var(--text-dim)" }}
            title="クリックで表情切替"
            onClick={() => setFaceOpen((v) => !v)}
          >
            {editorUi.speakerFace ? `（${editorUi.speakerFace}）` : "表情"}
          </button>
        )}
        <input
          ref={inputRef}
          id="mainInput"
          type="text"
          autoComplete="off"
          className="flex-1 min-w-0 px-3 py-2 text-[15px]"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSlashDismissed(false);
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
        />
        <button
          id="btnChoiceCmd"
          title="選択肢を挿入 (/choice)"
          onClick={() => appActions.openChoiceModal(null)}
        >
          <Icon name="split" />
        </button>
        <button
          ref={jumpBtnRef}
          id="btnJumpCmd"
          title="シーンへのジャンプを挿入 (/jump)"
          onClick={() => {
            if (jumpOpen) {
              setJumpOpen(false);
              return;
            }
            setSpeakerOpen(false);
            setJumpOpen(true);
          }}
        >
          <Icon name="corner-down-right" />
        </button>
      </div>
    </div>
  );
}
