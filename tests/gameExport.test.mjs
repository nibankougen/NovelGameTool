import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function loadTs(url) {
  const source = readFileSync(url, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => loadTs(new URL(`${name}.ts`, url)),
  });
  return exports;
}

const { gameExportData, buildScriptText } = loadTs(new URL("../src/lib/gameExport.ts", import.meta.url));
const findChar = () => null;
const t = (key, options) => options?.name ?? key;
const cfg = { face: true, sceneName: true, color: true, comment: true, pretty: true };
const project = {
  title: "Project", characters: [], languages: [], eventKeys: [], baseLanguage: "ja", anonymousLabel: {},
  scenes: [
    { id: "a", name: "Legacy", commands: [{ type: "comment", text: "legacy content" }] },
    { id: "b", name: "Hidden", hidden: true, commands: [{ type: "serif", text: "hidden content", anonymous: true }] },
    { id: "c", name: "Visible", hidden: false, commands: [{ type: "comment", text: "visible content" }] },
  ],
};

test("both exports omit hidden scenes and retain visible and legacy scenes in order", () => {
  const before = structuredClone(project);
  const data = gameExportData(project, cfg, findChar);
  assert.equal(JSON.stringify(data.scenes.map((s) => s.id)), '["a","c"]');
  assert.equal(data.anonymousLabel, undefined);
  assert.equal(JSON.stringify(data).includes("hidden content"), false);
  const script = buildScriptText(project, findChar, t);
  assert.match(script, /Legacy[\s\S]*legacy content[\s\S]*Visible[\s\S]*visible content/);
  assert.doesNotMatch(script, /Hidden|hidden content/);
  assert.deepEqual(project, before);
});

test("all scenes may be hidden and showing a scene restores it to both exports", () => {
  const p = structuredClone(project);
  p.scenes.forEach((s) => { s.hidden = true; });
  assert.equal(gameExportData(p, cfg, findChar).scenes.length, 0);
  assert.doesNotMatch(buildScriptText(p, findChar, t), /content|Legacy|Hidden|Visible/);
  p.scenes[1].hidden = false;
  assert.equal(gameExportData(p, cfg, findChar).scenes[0].id, "b");
  assert.match(buildScriptText(p, findChar, t), /hidden content/);
});
