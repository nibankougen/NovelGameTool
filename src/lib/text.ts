import type { Character } from "../types/project";

/* ---------- セリフ本文中のキャラ名参照（Alt+1〜9で挿入） ----------
   保存形式では不可視のプライベート領域文字（U+E050 … U+E051）でIDを挟んだ
   トークンとして持ち、名前を変更しても自動で追従する。
   編集欄では読みやすいよう《名前》の形で表示・入力し、確定時にトークンへ変換する。
   台本ファイルとして書き出し・ゲーム用ファイルとして書き出しなど「書き出し」時だけは、その時点の名前を平文として埋め込む。 */
export const MENTION_START = "\uE050";
export const MENTION_END = "\uE051";
const MENTION_SOURCE = `${MENTION_START}([^${MENTION_START}${MENTION_END}]*)${MENTION_END}`;

export const mentionToken = (id: string): string => `${MENTION_START}${id}${MENTION_END}`;

export type CharLookup = (id: string) => Character | null;

export function textToDisplay(text: string | undefined | null, findChar: CharLookup): string {
  const re = new RegExp(MENTION_SOURCE, "g");
  return String(text ?? "").replace(re, (_, id: string) => `《${findChar(id)?.name || "？"}》`);
}

export function textToStorage(text: string | undefined | null, characters: Array<{ id: string; name: string }>): string {
  return String(text ?? "").replace(/《([^《》]*)》/g, (whole, name: string) => {
    const c = characters.find((c) => c.name === name);
    return c ? mentionToken(c.id) : whole;
  });
}

export function textToResolved(text: string | undefined | null, findChar: CharLookup): string {
  const re = new RegExp(MENTION_SOURCE, "g");
  return String(text ?? "").replace(re, (_, id: string) => findChar(id)?.name || "？");
}

export type TextSegment = { kind: "text"; value: string } | { kind: "mention"; id: string; char: Character | null };

/** 表示用にテキストをメンション部分とプレーン部分へ分割する（JSXでの描画に使用） */
export function splitMentions(text: string | undefined | null, findChar: CharLookup): TextSegment[] {
  const s = String(text ?? "");
  const re = new RegExp(MENTION_SOURCE, "g");
  const segments: TextSegment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) segments.push({ kind: "text", value: s.slice(last, m.index) });
    segments.push({ kind: "mention", id: m[1], char: findChar(m[1]) });
    last = re.lastIndex;
  }
  if (last < s.length) segments.push({ kind: "text", value: s.slice(last) });
  return segments;
}

/** 解決済み表示（名前そのまま）上の文字位置を、編集欄の表示形式（《名前》）上の文字位置に変換する。
 * クリック位置から編集開始時のカーソル位置を推定する際に使用。 */
export function resolvedOffsetToDisplayOffset(text: string, target: number, findChar: CharLookup): number {
  const re = new RegExp(MENTION_SOURCE, "g");
  let dPos = 0,
    rPos = 0,
    sPos = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const plainLen = m.index - sPos;
    if (target <= rPos + plainLen) return dPos + (target - rPos);
    rPos += plainLen;
    dPos += plainLen;
    sPos = m.index;
    const name = findChar(m[1])?.name || "？";
    const dispLen = name.length + 2; // 《名前》
    if (target <= rPos + name.length) {
      const within = target - rPos;
      return within * 2 >= name.length ? dPos + dispLen : dPos; // トークン内は前後どちらか近い方の境界へ
    }
    rPos += name.length;
    dPos += dispLen;
    sPos = m.index + m[0].length;
  }
  const remain = text.length - sPos; // 最後のトークン以降はそのまま平文
  return dPos + Math.max(0, Math.min(target - rPos, remain));
}

export const mentionDisplayText = (name: string): string => `《${name}》`;

/** input要素のカーソル位置（選択範囲があれば置換）へテキストを挿入した結果を返す（呼び出し側で
 * controlled value を更新し、キャレット位置を setSelectionRange で復元する） */
export function insertTextAtCursor(el: HTMLInputElement, insert: string): { value: string; cursor: number } {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const v = el.value;
  const value = v.slice(0, start) + insert + v.slice(end);
  return { value, cursor: start + insert.length };
}
