import type { Command } from "../types/project";
import { textToStorage } from "./text";

export const SLASH_CMDS = [
  { cmd: "/bg", desc: "背景を変更　例: /bg 教室" },
  { cmd: "/bgm", desc: "BGMを変更（引数なしで停止）　例: /bgm 日常テーマ" },
  { cmd: "/se", desc: "効果音を再生　例: /se ドア開閉" },
  { cmd: "/wait", desc: "ウェイト（ミリ秒）　例: /wait 1000" },
  { cmd: "/jump", desc: "シーンへジャンプ（未作成なら自動作成）　例: /jump ルートA" },
  { cmd: "/choice", desc: "選択肢　例: /choice はい>ルートA | いいえ>ルートB（引数なしで編集画面）" },
  { cmd: "/memo", desc: "コメント行（// でも可）" },
] as const;

/** parseInput が入力を解釈するうえで必要とする、キャラ/シーンの自動作成などの副作用を注入するための環境。
 * 呼び出し側は「実際にドラフトへ作成する」実装と「作成せず構文検証のみ行う」実装を使い分けられる。 */
export interface ParseEnv {
  characters: Array<{ id: string; name: string }>;
  ensureScene: (name: string) => string;
  ensureChar: (name: string) => string;
  ensureExpression: (charId: string, expr: string) => void;
}

export interface SpeakerState {
  id: string | null;
  face: string | null;
}

export type ParseOutcome =
  | { kind: "empty" }
  | { kind: "error"; message: string }
  | { kind: "openChoiceModal" }
  | { kind: "switchSpeaker"; speaker: SpeakerState }
  | { kind: "command"; cmd: Command; setSpeaker?: SpeakerState };

export interface ParseOptions {
  /** true(既定): @name での話者切替を次回入力まで保持するsetSpeakerを結果に含める */
  sticky?: boolean;
}

export function parseInput(
  raw: string,
  env: ParseEnv,
  currentSpeaker: SpeakerState,
  opts: ParseOptions = {},
): ParseOutcome {
  const sticky = opts.sticky ?? true;
  const text = raw.replace(/[\s　]+$/, "");
  if (!text.trim()) return { kind: "empty" };

  if (text.startsWith("//")) {
    return { kind: "command", cmd: { type: "comment", text: text.slice(2).trim() } };
  }

  if (text.startsWith("/")) {
    const m = text.match(/^\/(\S*)[\s　]*([\s\S]*)$/)!;
    const name = m[1].toLowerCase();
    const arg = m[2].trim();
    switch (name) {
      case "bg":
      case "bgm":
      case "se": {
        if (name !== "bgm" && !arg) return { kind: "error", message: `/${name} には名前を指定してください` };
        return { kind: "command", cmd: { type: name, value: arg } };
      }
      case "wait": {
        const n = parseInt(arg, 10);
        if (isNaN(n) || n < 0) return { kind: "error", message: "/wait にはミリ秒数を指定してください　例: /wait 1000" };
        return { kind: "command", cmd: { type: "wait", value: n } };
      }
      case "jump": {
        if (!arg) return { kind: "error", message: "/jump ジャンプ先シーン名" };
        return { kind: "command", cmd: { type: "jump", target: env.ensureScene(arg) } };
      }
      case "choice": {
        if (!arg) return { kind: "openChoiceModal" };
        const options = arg
          .split(/[|｜]/)
          .map((part) => {
            const [label, target] = part.split(/[>＞]/).map((s) => s.trim());
            if (!label) return null;
            return { text: label, target: target ? env.ensureScene(target) : null };
          })
          .filter((o): o is { text: string; target: string | null } => o !== null);
        if (!options.length) return { kind: "error", message: "選択肢がありません　例: /choice はい>ルートA | いいえ>ルートB" };
        return { kind: "command", cmd: { type: "choice", options } };
      }
      case "memo":
      case "comment":
        return { kind: "command", cmd: { type: "comment", text: arg } };
      default:
        return { kind: "error", message: `不明なコマンド: /${name}（F1でヘルプ）` };
    }
  }

  // @話者
  if (text.startsWith("@") || text.startsWith("＠")) {
    const m = text.match(/^[@＠]([^\s　]*)(?:[\s　]+([\s\S]+))?$/);
    if (m) {
      let name = m[1];
      let face: string | null = null;
      const body = m[2];
      // 名前末尾の (表情) / （表情） を分離
      const fm = name.match(/^(.+?)[（(]([^（）()]*)[）)]$/);
      if (fm) {
        name = fm[1];
        face = fm[2].trim() || null;
      }
      let chara: string | null = null;
      if (name === "") {
        chara = null; // "@" → 地の文
      } else {
        chara = env.ensureChar(name);
        if (face) env.ensureExpression(chara, face);
      }
      const speaker: SpeakerState = { id: chara, face: chara ? face : null };
      if (body === undefined) {
        return sticky ? { kind: "switchSpeaker", speaker } : { kind: "empty" };
      }
      const cmd: Command = { type: "serif", chara, face: chara ? face : null, text: textToStorage(body, env.characters) };
      return sticky ? { kind: "command", cmd, setSpeaker: speaker } : { kind: "command", cmd };
    }
  }

  return {
    kind: "command",
    cmd: {
      type: "serif",
      chara: currentSpeaker.id,
      face: currentSpeaker.id ? currentSpeaker.face : null,
      text: textToStorage(text, env.characters),
    },
  };
}
