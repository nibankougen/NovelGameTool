import type { Project } from "../types/project";
import { findCharacter, findScene } from "./lookup";

export type TransFieldRef =
  | { kind: "title" }
  | { kind: "character"; charId: string }
  | { kind: "serif"; sceneId: string; cmdIndex: number; lineNo: number }
  | { kind: "choiceOption"; sceneId: string; cmdIndex: number; optIndex: number; lineNo: number };

export type TransEntry = { type: "section"; label: string } | { type: "field"; key: string; ref: TransFieldRef };

/** 翻訳対象の項目を、原文画面に表示する順序どおりに列挙する（project/キャラ見出し → タイトル → 各キャラ名 → シーンごとにセリフ/選択肢） */
export function collectTransItems(project: Project): TransEntry[] {
  const items: TransEntry[] = [{ type: "section", label: "プロジェクト・キャラクター" }];
  items.push({ type: "field", key: "title", ref: { kind: "title" } });
  for (const c of project.characters) {
    items.push({ type: "field", key: `char:${c.id}`, ref: { kind: "character", charId: c.id } });
  }
  for (const s of project.scenes) {
    items.push({ type: "section", label: `シーン: ${s.name}` });
    s.commands.forEach((cmd, i) => {
      if (cmd.type === "serif") {
        items.push({
          type: "field",
          key: `serif:${s.id}:${i}`,
          ref: { kind: "serif", sceneId: s.id, cmdIndex: i, lineNo: i + 1 },
        });
      } else if (cmd.type === "choice") {
        cmd.options.forEach((_, oi) => {
          items.push({
            type: "field",
            key: `choice:${s.id}:${i}:${oi}`,
            ref: { kind: "choiceOption", sceneId: s.id, cmdIndex: i, optIndex: oi, lineNo: i + 1 },
          });
        });
      }
    });
  }
  return items;
}

export function getTransValue(project: Project, ref: TransFieldRef, lang: string): string {
  switch (ref.kind) {
    case "title":
      return project.titleTr?.[lang] ?? "";
    case "character":
      return findCharacter(project.characters, ref.charId)?.tr?.[lang] ?? "";
    case "serif": {
      const cmd = findScene(project.scenes, ref.sceneId)?.commands[ref.cmdIndex];
      return cmd?.type === "serif" ? (cmd.tr?.[lang] ?? "") : "";
    }
    case "choiceOption": {
      const cmd = findScene(project.scenes, ref.sceneId)?.commands[ref.cmdIndex];
      return cmd?.type === "choice" ? (cmd.options[ref.optIndex]?.tr?.[lang] ?? "") : "";
    }
  }
}

/** 空文字なら未翻訳として扱うため、キー自体を削除する（進捗カウント・「未翻訳のみ」フィルタの整合性のため） */
function setTr(holder: { tr?: Record<string, string> }, lang: string, value: string): void {
  if (value) {
    if (!holder.tr) holder.tr = {};
    holder.tr[lang] = value;
  } else if (holder.tr) {
    delete holder.tr[lang];
  }
}

export function setTransValue(draft: Project, ref: TransFieldRef, lang: string, value: string): void {
  switch (ref.kind) {
    case "title": {
      if (value) {
        if (!draft.titleTr) draft.titleTr = {};
        draft.titleTr[lang] = value;
      } else if (draft.titleTr) {
        delete draft.titleTr[lang];
      }
      return;
    }
    case "character": {
      const c = findCharacter(draft.characters, ref.charId);
      if (c) setTr(c, lang, value);
      return;
    }
    case "serif": {
      const cmd = findScene(draft.scenes, ref.sceneId)?.commands[ref.cmdIndex];
      if (cmd?.type === "serif") setTr(cmd, lang, value);
      return;
    }
    case "choiceOption": {
      const cmd = findScene(draft.scenes, ref.sceneId)?.commands[ref.cmdIndex];
      if (cmd?.type === "choice") {
        const opt = cmd.options[ref.optIndex];
        if (opt) setTr(opt, lang, value);
      }
      return;
    }
  }
}

/** 言語を削除する際、全項目からその言語の翻訳データを一括で消す */
export function deleteLanguageEverywhere(draft: Project, lang: string): void {
  for (const entry of collectTransItems(draft)) {
    if (entry.type === "field") setTransValue(draft, entry.ref, lang, "");
  }
}
