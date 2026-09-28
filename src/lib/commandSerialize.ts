import { textToDisplay, type CharLookup } from "./text";
import type { Command, Scene } from "../types/project";

/** コマンドオブジェクトから「/」「@」構文のテキスト表現を再構築する（プレーン編集欄のプレフィル用）。
 * choice は対象外（choiceModalでのみ編集するため null を返す）。 */
export function cmdToInputText(c: Command, scenes: Scene[], findChar: CharLookup): string | null {
  switch (c.type) {
    case "counter":
      return "/count";
    case "serif": {
      // serif は常にチップ編集(SerifEditRow)で扱われ、このブランチは通常使われない（原実装と同様に残す）
      if (!c.chara) return `@ ${c.text}`;
      const name = findChar(c.chara)?.name ?? "?";
      const face = c.face ? `(${c.face})` : "";
      return `@${name}${face} ${c.text}`;
    }
    case "bg":
    case "bgm":
    case "se":
      return `/${c.type} ${c.value}`;
    case "wait":
      return `/wait ${c.value}`;
    case "jump": {
      const scene = scenes.find((s) => s.id === c.target);
      return `/jump ${scene ? scene.name : ""}`;
    }
    case "comment":
      return `//${textToDisplay(c.text, findChar)}`;
    case "choice":
      return null;
    default:
      return null;
  }
}
