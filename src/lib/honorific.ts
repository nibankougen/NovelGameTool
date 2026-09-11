import type { CharLookup } from "./text";
import { textToResolved } from "./text";
import { HONOR_SECOND, type HonorificRule, type HonorificVocab, type SerifCommand } from "../types/project";

/**
 * 人称チェック（簡易）: セリフ内の一人称・二人称・（名前＋敬称／呼び捨て）が、
 * そのキャラクターに登録されたルールから外れていないかを判定する。
 * narration（話者なし）は対象外。ルール未登録のキャラも対象外。
 */
export function honorificIssues(
  cmd: SerifCommand,
  rules: HonorificRule[],
  vocab: HonorificVocab,
  findChar: CharLookup,
): string[] {
  if (!cmd.chara) return [];
  const myRules = rules.filter((r) => r.speakerId === cmd.chara);
  if (!myRules.length) return [];
  const text = textToResolved(cmd.text, findChar);
  const issues: string[] = [];

  // 一人称: 候補語のうち、登録パターンに一致しないものが本文に出てきたら通知
  const selfRules = myRules.filter((r) => !r.targetId && r.pattern);
  if (selfRules.length) {
    const re = compileAlternation(selfRules.map((r) => r.pattern));
    if (re) {
      for (const w of vocab.self) {
        if (w && text.includes(w) && !re.test(w)) issues.push(`一人称「${w}」`);
      }
    }
  }

  // 二人称（名前を伴わない呼びかけ: キミ・あなた等）: 一人称と同様に候補語と照合
  const secondRules = myRules.filter((r) => r.targetId === HONOR_SECOND && r.pattern);
  if (secondRules.length) {
    const re = compileAlternation(secondRules.map((r) => r.pattern));
    if (re) {
      for (const w of vocab.second) {
        if (w && text.includes(w) && !re.test(w)) issues.push(`二人称「${w}」`);
      }
    }
  }

  // 呼び方（対他キャラ）: 対象名＋敬称候補が出てきたとき、登録パターン（＋呼び捨て許可）に一致しなければ通知
  const byTarget = new Map<string, HonorificRule[]>();
  for (const r of myRules) {
    if (!r.targetId || r.targetId === HONOR_SECOND) continue;
    const arr = byTarget.get(r.targetId) ?? [];
    arr.push(r);
    byTarget.set(r.targetId, arr);
  }
  for (const [targetId, rs] of byTarget) {
    const target = findChar(targetId);
    if (!target || !target.name) continue;
    const pat = rs
      .map((r) => r.pattern)
      .filter(Boolean)
      .join("|");
    let re: RegExp | null = null;
    if (pat) {
      try {
        re = new RegExp("^(?:" + pat + ")");
      } catch {
        re = null;
      }
    }
    const allowBare = rs.some((r) => r.allowBare);
    const name = target.name;
    let idx = 0;
    for (;;) {
      const p = text.indexOf(name, idx);
      if (p === -1) break;
      idx = p + name.length;
      const rest = text.slice(idx);
      const suffix = vocab.suffix.find((s) => s && rest.startsWith(s));
      if (suffix) {
        if (!re || !re.test(rest)) issues.push(`「${name}${suffix}」`);
      } else if (!allowBare) {
        issues.push(`「${name}」を呼び捨て`);
      }
    }
  }

  return [...new Set(issues)];
}

function compileAlternation(patterns: string[]): RegExp | null {
  try {
    return new RegExp(patterns.map((p) => `(?:${p})`).join("|"));
  } catch {
    return null;
  }
}
