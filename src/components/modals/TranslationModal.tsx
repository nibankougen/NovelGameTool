import { useMemo, useRef, useState, type ReactNode } from "react";
import { useProjectStore } from "../../state/ProjectProvider";
import { useCharLookup } from "../../hooks/useCharLookup";
import { useUndoableSession } from "../../hooks/useUndoableSession";
import { useToast } from "../common/ToastProvider";
import { Modal, ModalHeader } from "./Modal";
import { Icon } from "../common/Icon";
import { MentionText } from "../common/MentionText";
import { collectTransItems, getTransValue, setTransValue, deleteLanguageEverywhere, type TransFieldRef } from "../../lib/translationItems";
import { findCharacter, findScene } from "../../lib/lookup";

function TransPreview({ fieldRef, findChar }: { fieldRef: TransFieldRef; findChar: ReturnType<typeof useCharLookup> }) {
  const { project } = useProjectStore();
  switch (fieldRef.kind) {
    case "title":
      return (
        <>
          <span className="text-text-dim text-[11px] mr-1.5">タイトル</span>
          {project.title || "無題"}
        </>
      );
    case "character": {
      const c = findCharacter(project.characters, fieldRef.charId);
      if (!c) return null;
      return (
        <>
          <span className="text-text-dim text-[11px] mr-1.5">キャラ名</span>
          <b style={{ color: c.color }}>{c.name}</b>
        </>
      );
    }
    case "serif": {
      const cmd = findScene(project.scenes, fieldRef.sceneId)?.commands[fieldRef.cmdIndex];
      if (cmd?.type !== "serif") return null;
      const ch = cmd.chara ? findChar(cmd.chara) : null;
      return (
        <>
          <span className="text-text-dim text-[11px] mr-1.5">{fieldRef.lineNo}</span>
          {ch ? <b style={{ color: ch.color }}>{ch.name}</b> : <span className="text-text-dim text-[11px]">地の文</span>}
          {cmd.face && <span className="face-tag text-text-dim text-[11px] ml-0.5">（{cmd.face}）</span>}{" "}
          <MentionText text={cmd.text} findChar={findChar} />
        </>
      );
    }
    case "choiceOption": {
      const cmd = findScene(project.scenes, fieldRef.sceneId)?.commands[fieldRef.cmdIndex];
      if (cmd?.type !== "choice") return null;
      const opt = cmd.options[fieldRef.optIndex];
      if (!opt) return null;
      return (
        <>
          <span className="text-text-dim text-[11px] mr-1.5">{fieldRef.lineNo} 選択肢</span>◆ {opt.text}
        </>
      );
    }
  }
}

export function TranslationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { project, mutate, patch } = useProjectStore();
  const findChar = useCharLookup();
  const toast = useToast();
  const onFocus = useUndoableSession();

  const [lang, setLang] = useState<string>(project.languages[0] ?? "");
  const [onlyEmpty, setOnlyEmpty] = useState(false);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const entries = useMemo(() => collectTransItems(project), [project]);

  const addLang = () => {
    const raw = window.prompt("翻訳先の言語コード（例: en, zh-CN, ko）:");
    if (!raw) return;
    const code = raw.trim();
    if (!code) return;
    if (code === "ja") {
      toast("「ja」はベース言語のため使用できません", true);
      return;
    }
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,14}$/.test(code)) {
      toast("言語コードの形式が正しくありません", true);
      return;
    }
    if (project.languages.includes(code)) {
      toast("すでに追加されています", true);
      return;
    }
    mutate((d) => {
      d.languages.push(code);
    });
    setLang(code);
    toast(`言語「${code}」を追加しました`);
  };

  const delLang = () => {
    if (!lang) return;
    if (!window.confirm(`言語「${lang}」を削除しますか？（この言語の翻訳データも削除されます）`)) return;
    mutate((d) => {
      const idx = d.languages.indexOf(lang);
      if (idx !== -1) d.languages.splice(idx, 1);
      deleteLanguageEverywhere(d, lang);
    });
    setLang(project.languages.find((l) => l !== lang) ?? "");
    toast(`言語「${lang}」を削除しました`);
  };

  let total = 0;
  let done = 0;
  if (lang) {
    for (const e of entries) {
      if (e.type !== "field") continue;
      total++;
      if (getTransValue(project, e.ref, lang)) done++;
    }
  }

  let shown = 0;

  return (
    <Modal open={open} onRequestClose={onClose} className="w-[92vw] max-w-[1100px] h-[86vh] max-h-[86vh] flex flex-col">
      <ModalHeader onClose={onClose}>
        <Icon name="languages" /> 翻訳
      </ModalHeader>
      <div className="flex items-center gap-2.5 mb-3 flex-wrap">
        {project.languages.length > 0 && (
          <>
            <select value={lang} onChange={(e) => setLang(e.target.value)} title="翻訳先の言語" className="min-w-[110px]">
              {project.languages.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <button onClick={delLang} title="選択中の言語と入力済みの翻訳を削除">
              <Icon name="trash-2" />
            </button>
          </>
        )}
        <button onClick={addLang} title="翻訳先の言語を追加">
          <Icon name="plus" />
          言語
        </button>
        {project.languages.length > 0 && (
          <label className="flex items-center gap-1.5 text-xs text-text-dim cursor-pointer">
            <input type="checkbox" checked={onlyEmpty} onChange={(e) => setOnlyEmpty(e.target.checked)} className="accent-accent" />
            未翻訳のみ
          </label>
        )}
        {lang && <span className="text-text-dim text-xs">翻訳済み {done} / {total}</span>}
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {!project.languages.length && (
          <div className="py-8 px-2.5 text-text-dim text-sm text-center leading-loose">
            翻訳先の言語がまだありません。
            <br />
            「＋言語」から言語コード（例: en, zh-CN, ko）を追加してください。
          </div>
        )}
        {project.languages.length > 0 && lang && (() => {
          let pendingSection: string | null = null;
          const rows: ReactNode[] = [];
          for (const entry of entries) {
            if (entry.type === "section") {
              pendingSection = entry.label;
              continue;
            }
            const val = getTransValue(project, entry.ref, lang);
            if (onlyEmpty && val) continue;
            if (pendingSection !== null) {
              rows.push(
                <div key={`sec-${rows.length}`} className="sticky top-0 bg-bg-2 z-[2] px-1 pt-2.5 pb-1.5 text-xs font-bold text-sys border-b border-border">
                  {pendingSection}
                </div>,
              );
              pendingSection = null;
            }
            const myIndex = shown;
            shown++;
            rows.push(
              <div key={entry.key} className="grid grid-cols-2 gap-2.5 items-center py-1.5 px-1 border-b border-hairline">
                <div className="text-sm leading-relaxed break-words min-w-0">
                  <TransPreview fieldRef={entry.ref} findChar={findChar} />
                </div>
                <input
                  ref={(el) => {
                    inputsRef.current[myIndex] = el;
                  }}
                  type="text"
                  className={`w-full text-sm ${!val ? "border-dashed" : ""}`}
                  placeholder=""
                  value={val}
                  onFocus={onFocus}
                  onChange={(e) => {
                    const v = e.target.value;
                    patch((d) => setTransValue(d, entry.ref, lang, v));
                  }}
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing) return;
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const next = inputsRef.current[myIndex + 1];
                      next?.focus();
                      next?.select();
                    } else if (e.key === "Escape") {
                      (e.target as HTMLInputElement).blur();
                    }
                    e.stopPropagation();
                  }}
                />
              </div>,
            );
          }
          if (!rows.length) {
            return (
              <div className="py-8 px-2.5 text-text-dim text-sm text-center leading-loose">
                {onlyEmpty ? "未翻訳の項目はありません 🎉" : "翻訳対象のテキストがありません"}
              </div>
            );
          }
          return rows;
        })()}
      </div>
    </Modal>
  );
}
