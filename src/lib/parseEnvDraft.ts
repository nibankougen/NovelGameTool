import type { Draft } from "immer";
import { uid } from "./id";
import { PALETTE, type Project } from "../types/project";
import { parseInput, type ParseEnv, type ParseOptions, type SpeakerState } from "./parseInput";

export interface DraftParseCallbacks {
  toast?: (message: string) => void;
}

/** parseInput() が /jump ・ /choice ・ @名前 などでシーン/キャラを自動作成する際、
 * immerのドラフトへ直接作成することで「入力内容の反映」と「自動作成」を1つのundoステップにまとめる。 */
export function makeDraftParseEnv(draft: Draft<Project>, cb: DraftParseCallbacks = {}): ParseEnv {
  return {
    characters: draft.characters,
    ensureScene: (rawName: string) => {
      const name = rawName.trim();
      let s = draft.scenes.find((s) => s.name === name);
      if (!s) {
        s = { id: uid(), name, commands: [], groupId: null, synopsis: "" };
        draft.scenes.push(s);
        cb.toast?.(`シーン「${name}」を作成しました`);
      }
      return s.id;
    },
    ensureChar: (rawName: string) => {
      const name = rawName.trim();
      let c = draft.characters.find((c) => c.name === name);
      if (!c) {
        c = {
          id: uid(),
          name,
          color: PALETTE[draft.characters.length % PALETTE.length],
          memo: "",
          thumb: null,
          expressions: [...draft.exprTemplate],
          exprImages: {},
        };
        draft.characters.push(c);
        cb.toast?.(`キャラクター「${name}」を登録しました`);
      }
      return c.id;
    },
    ensureExpression: (charId: string, expr: string) => {
      const c = draft.characters.find((c) => c.id === charId);
      if (c && !c.expressions.includes(expr)) {
        c.expressions.push(expr);
        cb.toast?.(`「${c.name}」に表情「${expr}」を追加しました`);
      }
    },
  };
}

/** 構文エラーの有無だけを確認したい場面向け（選択肢モーダルの分岐セリフの事前検証など）。
 * 実際のシーン/キャラ作成は行わず、ダミーidを返す（このパスの戻り値のid自体は使用しない） */
export function makeDryParseEnv(project: Project): ParseEnv {
  return {
    characters: project.characters,
    ensureScene: () => "__dry__",
    ensureChar: () => "__dry__",
    ensureExpression: () => {},
  };
}

/**
 * シーン/キャラ自動作成をまだ実行せずに構文エラーの有無だけを調べる（下書きへの実際の追加は
 * parseInput 呼び出し側が makeDraftParseEnv で mutate 内から改めて行う２パス方式の1パス目）。
 * 現在の文法では、シーン/キャラ作成（ensureScene/ensureChar）が呼ばれるパスは必ず成功するため、
 * この事前チェックが通れば mutate 内での本実行が構文エラーで失敗することはない。
 */
export function parseInputDry(text: string, project: Project, speaker: SpeakerState, opts?: ParseOptions): string | null {
  const r = parseInput(text, makeDryParseEnv(project), speaker, opts);
  return r.kind === "error" ? r.message : null;
}
