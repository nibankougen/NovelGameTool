import type { Command } from "../types/project";
import { textToResolved, type CharLookup } from "./text";

export interface CounterReading {
  index: number;
  total: number;
  delta: number;
}

/** Scene-local counts: dialogue/narration and the longest choice label.
 * Comments, speaker labels, system commands and other scenes are excluded.
 * Resolve name references before counting Unicode code points. */
export function characterCounters(commands: Command[], findChar: CharLookup): Map<number, CounterReading> {
  const readings = new Map<number, CounterReading>();
  const length = (text: string) => Array.from(textToResolved(text, findChar)).length;
  let total = 0;
  let previous = 0;
  commands.forEach((cmd, row) => {
    if (cmd.type === "serif") total += length(cmd.text);
    if (cmd.type === "choice") {
      total += cmd.options.reduce((max, option) => Math.max(max, length(option.text)), 0);
    }
    if (cmd.type === "counter") {
      readings.set(row, { index: readings.size + 1, total, delta: total - previous });
      previous = total;
    }
  });
  return readings;
}
