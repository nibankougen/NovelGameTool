import type { CharLookup } from "./text";
import { textToResolved } from "./text";
import type { Command, Project } from "../types/project";
import { findScene } from "./lookup";

export const SEARCH_MAX = 200;

type T = (key: string, opts?: Record<string, unknown>) => string;
const identityT: T = (key) => key;

export function cmdSearchTexts(c: Command, project: Project, findChar: CharLookup): string[] {
  switch (c.type) {
    case "serif": {
      const ch = c.chara ? findChar(c.chara) : null;
      return [textToResolved(c.text, findChar), ...Object.values(c.tr ?? {}), ch ? ch.name : "", c.face ?? ""];
    }
    case "bg":
    case "bgm":
    case "se":
      return [String(c.value ?? "")];
    case "wait":
      return [String(c.value ?? "")];
    case "jump": {
      const s = findScene(project.scenes, c.target);
      return s ? [s.name] : [];
    }
    case "choice": {
      const a: string[] = [];
      for (const o of c.options) {
        a.push(o.text, ...Object.values(o.tr ?? {}));
        const s = o.target ? findScene(project.scenes, o.target) : null;
        if (s) a.push(s.name);
      }
      return a;
    }
    case "comment":
      return [c.text];
    default:
      return [];
  }
}

export interface Snippet {
  text: string;
  ranges: Array<[number, number]>;
}

/** ヒット箇所を強調表示するためのスニペットを作る（長文は最初のヒット周辺に切り詰め） */
export function buildSnippet(text: string, q: string): Snippet {
  const ql = q.toLowerCase();
  let s = text;
  let prefixEllipsis = false;
  let suffixEllipsis = false;
  if (s.length > 70) {
    const pos = Math.max(0, s.toLowerCase().indexOf(ql));
    const start = Math.max(0, pos - 25);
    const end = Math.min(s.length, start + 70);
    prefixEllipsis = start > 0;
    suffixEllipsis = end < s.length;
    s = s.slice(start, end);
  }
  const sl = s.toLowerCase();
  const ranges: Array<[number, number]> = [];
  let i = 0;
  for (;;) {
    const j = sl.indexOf(ql, i);
    if (j === -1) break;
    ranges.push([j, j + q.length]);
    i = j + q.length;
  }
  const offset = prefixEllipsis ? 1 : 0;
  return {
    text: (prefixEllipsis ? "…" : "") + s + (suffixEllipsis ? "…" : ""),
    ranges: ranges.map(([a, b]) => [a + offset, b + offset]),
  };
}

export interface SearchHit {
  sceneId: string;
  /** null = シーン名自体がヒット */
  idx: number | null;
  sceneName: string;
  lineLabel: string;
  matchedText: string;
}

export interface SearchOutcome {
  hits: SearchHit[];
  total: number;
}

export function runSearch(project: Project, query: string, findChar: CharLookup, t: T = identityT): SearchOutcome {
  const q = query.trim();
  if (!q) return { hits: [], total: 0 };
  const ql = q.toLowerCase();
  const hits: SearchHit[] = [];
  let total = 0;
  for (const s of project.scenes) {
    if (s.name.toLowerCase().includes(ql)) {
      total++;
      if (hits.length < SEARCH_MAX) hits.push({ sceneId: s.id, idx: null, sceneName: t("search.sceneName"), lineLabel: "", matchedText: s.name });
    }
    s.commands.forEach((c, i) => {
      const matched = cmdSearchTexts(c, project, findChar).find((txt) => txt.toLowerCase().includes(ql));
      if (matched !== undefined) {
        total++;
        if (hits.length < SEARCH_MAX)
          hits.push({ sceneId: s.id, idx: i, sceneName: s.name, lineLabel: String(i + 1), matchedText: matched });
      }
    });
  }
  return { hits, total };
}
