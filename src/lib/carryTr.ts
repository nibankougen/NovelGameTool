import type { Command } from "../types/project";

/** 編集で行オブジェクトを置き換える際、既存の翻訳(tr)を引き継ぐ
 * （セリフはそのまま、選択肢は同一テキストの選択肢にのみ引き継ぐ） */
export function carryTr(oldCmd: Command | undefined, newCmd: Command): Command {
  if (!oldCmd) return newCmd;
  if (oldCmd.type === "serif" && newCmd.type === "serif" && oldCmd.tr) newCmd.tr = oldCmd.tr;
  if (oldCmd.type === "choice" && newCmd.type === "choice") {
    for (const o of newCmd.options) {
      const m = oldCmd.options.find((x) => x.text === o.text && x.tr);
      if (m) o.tr = m.tr;
    }
  }
  return newCmd;
}
