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
  const eventKeyById = new Map(project.eventKeys.map((k) => [k.id, k]));
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
            if (c.events?.length) {
              const events = c.events
                .map((e) => {
                  const key = eventKeyById.get(e.keyId);
                  if (!key) return null;
                  return e.value !== undefined ? { key: key.name, value: e.value } : { key: key.name };
                })
                .filter((e): e is { key: string; value?: number | string } => !!e);
              if (events.length) out.events = events;
            }
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
  if (langs.length) root.languages = [project.baseLanguage, ...langs];
  const ttr = pickTr(project.titleTr, langs);
  if (ttr) root.titleTr = ttr;
  return root;
}

type T = (key: string, opts?: Record<string, unknown>) => string;

function cmdToScriptLine(c: Command, project: Project, findChar: CharLookup, t: T): string {
  switch (c.type) {
    case "serif": {
      if (c.chara) {
        const ch = findCharacter(project.characters, c.chara);
        return `${ch ? ch.name : t("common.unknownRef")}${c.face ? `（${c.face}）` : ""}「${textToResolved(c.text, findChar)}」`;
      }
      return `　${textToResolved(c.text, findChar)}`;
    }
    case "bg":
      return t("gameExport.script.bg", { value: c.value });
    case "bgm":
      return t("gameExport.script.bgm", { value: c.value || t("gameExport.script.bgmStopped") });
    case "se":
      return t("gameExport.script.se", { value: c.value });
    case "wait":
      return t("gameExport.script.wait", { ms: c.value });
    case "jump":
      return t("gameExport.script.jump", { target: findScene(project.scenes, c.target)?.name ?? t("common.unknownRef") });
    case "choice": {
      const lines = [t("gameExport.script.choiceHeader")];
      for (const o of c.options) {
        const target = o.target ? (findScene(project.scenes, o.target)?.name ?? t("common.unknownRef")) : t("common.continue");
        lines.push(t("gameExport.script.choiceLine", { text: o.text, target }));
      }
      return lines.join("\n");
    }
    case "comment":
      return `※ ${c.text}`;
  }
}

/** 読みやすいテキスト台本を書き出す */
export function buildScriptText(project: Project, findChar: CharLookup, t: T): string {
  let out = `${project.title}\n${"=".repeat(30)}\n\n`;
  for (const s of project.scenes) {
    out += `${t("gameExport.sceneHeader", { name: s.name })}\n${"-".repeat(30)}\n`;
    for (const c of s.commands) out += cmdToScriptLine(c, project, findChar, t) + "\n";
    out += "\n";
  }
  return out;
}
