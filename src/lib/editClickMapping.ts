import { cmdToInputText } from "./commandSerialize";
import { resolvedOffsetToDisplayOffset, textToDisplay, type CharLookup } from "./text";
import { cmdBroken } from "./sceneUtils";
import type { Character, Command, Scene } from "../types/project";

export type ClickInfo = { zone: "speaker" } | { zone: "face" } | { zone: "text"; offset: number };

/**
 * 表示行のクリック位置から、インライン編集欄でカーソルを置くべき位置を推定する。
 * 話者名／表情タグをクリックした場合はそのチップのドロップダウンを開く指示を返す。
 * serif行はセリフ本文または地の文コンテナ内での絶対文字位置（解決済み表示上の位置）から算出し、
 * 《名前》表示形式のオフセットへ変換する。それ以外の行は「文末からの距離」ヒューリスティックで近似する。
 */
export function computeClickInfo(
  e: { clientX: number; clientY: number },
  c: Command,
  characters: Character[],
  scenes: Scene[],
  findChar: CharLookup,
): ClickInfo | null {
  let node: Node | null = null;
  let offset = 0;
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  if (document.caretRangeFromPoint) {
    const r = document.caretRangeFromPoint(e.clientX, e.clientY);
    if (r) {
      node = r.startContainer;
      offset = r.startOffset;
    }
  } else if (doc.caretPositionFromPoint) {
    const p = doc.caretPositionFromPoint(e.clientX, e.clientY);
    if (p) {
      node = p.offsetNode;
      offset = p.offset;
    }
  }
  if (!node || node.nodeType !== Node.TEXT_NODE) return null;
  const parent = (node as Text).parentElement;
  if (!parent) return null;
  if (parent.closest(".speaker-name")) return { zone: "speaker" };
  if (parent.closest(".face-tag")) return { zone: "face" };

  if (c.type === "serif") {
    // 本文中に名前参照（《名前》）があると1つのテキストノードに収まらないため、
    // セリフ本文または地の文全体を囲うコンテナ内での絶対位置（解決済み表示上の位置）から算出する
    const container = parent.closest(".serif-text") || parent.closest(".narration");
    let resolvedOff: number;
    if (container) {
      const range = document.createRange();
      range.selectNodeContents(container);
      range.setEnd(node, offset);
      resolvedOff = range.toString().length;
    } else {
      resolvedOff = offset;
    }
    resolvedOff = Math.max(0, resolvedOff);
    const off = Math.max(
      0,
      Math.min(resolvedOffsetToDisplayOffset(c.text, resolvedOff, findChar), textToDisplay(c.text, findChar).length),
    );
    return { zone: "text", offset: off };
  }

  if (parent.classList.contains("sys-tag")) return null; // ラベル部分（背景/BGM等の見出し語）は対象外
  if (!(parent.classList.contains("sys-cmd") || parent.classList.contains("comment-cmd"))) return null;
  if (cmdBroken(c, characters, scenes)) return null; // 壊れた参照は表示文字列が値と一致しないため対象外
  if (c.type === "bgm" && !c.value) return null; // 「（停止）」表示は値と一致しない
  const inputText = cmdToInputText(c, scenes, findChar) ?? "";
  if (!inputText) return null;
  let off = offset;
  if (c.type === "wait") off = Math.min(off, String(c.value).length); // 末尾の "ms" 分を除外
  const distFromEnd = Math.max(0, (node as Text).data.length - off);
  const pos = Math.max(0, Math.min(inputText.length, inputText.length - distFromEnd));
  return { zone: "text", offset: pos };
}
