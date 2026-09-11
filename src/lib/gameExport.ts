import type { CharLookup } from "./text";
import { textToResolved } from "./text";
import type { Command, ExportSettings, Project, TrMap } from "../types/project";
import { findCharacter, findScene } from "./lookup";

function pickTr(tr: TrMap | undefined, langs: string[]): TrMap | null {
  if (!tr) return null;
  const o: TrMap = {};
  for (const l of langs) if (tr[l]) o[l] = tr[l];
  return Object.keys(o).length ? o : null;
}

/** ゲーム実装向けの出力データ（設定メモ・デフォルトイラスト・表情画像は常に除外） */
export function gameExportData(project: Project, cfg: ExportSettings, findChar: CharLookup): Record<string, unknown> {
  const langs = project.languages || [];
  const root: Record<string, unknown> = {
    title: project.title,
    characters: project.characters.map((c) => {
      const o: Record<string, unknown> = { id: c.id, name: c.name };
      const tr = pickTr(c.tr, langs);
      if (tr) o.tr = tr;
      if (cfg.color) o.color = c.color;
      if (cfg.face) o.expressions = c.expressions || [];
      return o;
    }),
    scenes: project.scenes.map((s) => {
      const o: Record<string, unknown> = { id: s.id };
      if (cfg.sceneName) o.name = s.name;
      o.commands = s.commands
        .filter((c) => cfg.comment || c.type !== "comment")
        .map((c): unknown => {
          if (c.type === "serif") {
            const out: Record<string, unknown> = { type: "serif", chara: c.chara, text: textToResolved(c.text, findChar) };
            if (cfg.face && c.face) out.face = c.face;
            const tr = pickTr(c.tr, langs);
            if (tr) out.tr = tr;
            return out;
          }
          if (c.type === "choice") {
            return {
              type: "choice",
              options: c.options.map((op) => {
                const oo: Record<string, unknown> = { text: op.text, target: op.target ?? null };
                const tr = pickTr(op.tr, langs);
                if (tr) oo.tr = tr;
                return oo;
              }),
            };
          }
          return c;
        });
      return o;
    }),
  };
  if (langs.length) root.languages = ["ja", ...langs];
  const ttr = pickTr(project.titleTr, langs);
  if (ttr) root.titleTr = ttr;
  return root;
}

function cmdToScriptLine(c: Command, project: Project, findChar: CharLookup): string {
  switch (c.type) {
    case "serif": {
      if (c.chara) {
        const ch = findCharacter(project.characters, c.chara);
        return `${ch ? ch.name : "？"}${c.face ? `（${c.face}）` : ""}「${textToResolved(c.text, findChar)}」`;
      }
      return `　${textToResolved(c.text, findChar)}`;
    }
    case "bg":
      return `【背景】${c.value}`;
    case "bgm":
      return `【BGM】${c.value || "停止"}`;
    case "se":
      return `【SE】${c.value}`;
    case "wait":
      return `【待機】${c.value}ms`;
    case "jump":
      return `【ジャンプ】→ ${findScene(project.scenes, c.target)?.name ?? "？"}`;
    case "choice": {
      const lines = ["【選択肢】"];
      for (const o of c.options) {
        const target = o.target ? (findScene(project.scenes, o.target)?.name ?? "？") : "続行";
        lines.push(`　◆ ${o.text} → ${target}`);
      }
      return lines.join("\n");
    }
    case "comment":
      return `※ ${c.text}`;
  }
}

/** 読みやすいテキスト台本を書き出す */
export function buildScriptText(project: Project, findChar: CharLookup): string {
  let out = `${project.title}\n${"=".repeat(30)}\n\n`;
  for (const s of project.scenes) {
    out += `■ シーン: ${s.name}\n${"-".repeat(30)}\n`;
    for (const c of s.commands) out += cmdToScriptLine(c, project, findChar) + "\n";
    out += "\n";
  }
  return out;
}
