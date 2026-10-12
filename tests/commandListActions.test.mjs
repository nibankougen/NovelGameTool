import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { produce } from "immer";
import ts from "typescript";

const source = readFileSync(new URL("../src/components/commandList/CommandList.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

// Capture row callbacks while keeping project updates backed by real Immer drafts.
function setup(selected, selIndex = selected.at(-1) ?? null, commands = null, scrollWrap = null) {
  let project = { scenes: [{ id: "scene", commands: commands ?? ["a", "b", "c", "d"].map((text) => ({ type: "comment", text })) }] };
  const original = project;
  let mutations = 0;
  let selection = new Set(selected);
  let stateIndex = 0;
  let refIndex = 0;
  const refs = [];
  let layoutEffects = [];
  let stopped = false;
  const rows = [];
  const ui = {
    currentSceneId: "scene", selIndex, editIndex: null,
    setSelIndex: (index) => { ui.selIndex = index; },
    stopEdit: () => { stopped = true; },
  };
  const jsx = (_type, props) => {
    if (props?.onDup) rows.push(props);
    return null;
  };
  const modules = {
    react: {
      useState: (initial) => stateIndex++ === 0 ? [selection, (next) => { selection = next; }] : [initial, () => {}],
      useRef: (current) => refs[refIndex++] ??= { current },
      useEffect: () => {}, useLayoutEffect: (effect) => { layoutEffects.push(effect); },
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-i18next": { useTranslation: () => ({ t: (key) => key }) },
    "../../state/ProjectProvider": { useProjectStore: () => ({
      project, mutate: (fn) => { mutations++; project = produce(project, fn); },
    }) },
    "../../state/EditorUiContext": { useEditorUi: () => ui },
    "../../state/AppActionsContext": { useAppActions: () => ({}) },
    "../../hooks/useCharLookup": { useCharLookup: () => () => null },
    "../../hooks/useDragReorder": { useDragReorder: () => ({ containerRef: { current: null } }) },
    "../../lib/sceneUtils": { cmdBroken: () => false },
    "../../lib/honorific": { honorificIssues: () => [] },
    "../../lib/anonymize": { anonymousLabelFor: () => "???" },
    "../../lib/characterCounter": { characterCounters: () => new Map() },
  };
  const exports = {};
  vm.runInNewContext(compiled, { exports, structuredClone, require: (name) => modules[name] ?? {} });
  const render = () => {
    stateIndex = 0;
    refIndex = 0;
    rows.length = 0;
    layoutEffects = [];
    exports.CommandList({ scrollWrapRef: { current: scrollWrap } });
    layoutEffects.forEach((effect) => effect());
  };
  render();
  return {
    rows, ui, original, render,
    get commands() { return project.scenes[0].commands; },
    get mutations() { return mutations; },
    get selection() { return selection; },
    get stopped() { return stopped; },
  };
}

test("delete on any selected row removes the whole selection in one mutation", () => {
  for (const clicked of [1, 2]) {
    const s = setup([1, 2]);
    s.rows[clicked].onDelete();
    assert.deepEqual(s.commands.map((c) => c.text), ["a", "d"]);
    assert.equal(s.mutations, 1);
    assert.equal(s.ui.selIndex, 0);
    assert.equal(s.selection.size, 0);
    assert.equal(s.stopped, true);
    assert.equal(s.original.scenes[0].commands.length, 4);
  }
});

test("deleting all rows clears the active row; deleting the first rows selects the next", () => {
  const all = setup([0, 1, 2, 3]);
  all.rows[0].onDelete();
  assert.deepEqual(all.commands, []);
  assert.equal(all.ui.selIndex, null);
  const first = setup([0, 1]);
  first.rows[0].onDelete();
  assert.deepEqual(first.commands.map((c) => c.text), ["c", "d"]);
  assert.equal(first.ui.selIndex, 0);
});

test("copy inserts the selected rows in document order after the selection", () => {
  for (const clicked of [1, 2]) {
    const s = setup([2, 1]);
    s.rows[clicked].onDup();
    assert.deepEqual(s.commands.map((c) => c.text), ["a", "b", "c", "b", "c", "d"]);
    assert.equal(s.mutations, 1);
    assert.equal(s.ui.selIndex, 3);
    assert.equal(s.selection.size, 0);
    assert.equal(s.stopped, true);
  }
});

test("buttons outside the selection still act on only the clicked row", () => {
  const deletion = setup([1, 2]);
  deletion.rows[0].onDelete();
  assert.deepEqual(deletion.commands.map((c) => c.text), ["b", "c", "d"]);
  assert.equal(deletion.ui.selIndex, 1);
  const copy = setup([1, 2]);
  copy.rows[0].onDup();
  assert.deepEqual(copy.commands.map((c) => c.text), ["a", "a", "b", "c", "d"]);
});

test("copy keeps nested translations, choices and events independent", () => {
  const commands = [
    { type: "serif", text: "Hello", tr: { ja: "こんにちは" }, events: [{ keyId: "event", value: 1 }] },
    { type: "choice", options: [{ text: "Next", target: "scene", tr: { ja: "次へ" } }] },
  ];
  const s = setup([0, 1], 1, commands);
  s.rows[0].onDup();
  assert.deepEqual(s.commands.slice(2), commands);
  const edited = produce(s.commands, (draft) => {
    draft[2].tr.ja = "変更";
    draft[2].events[0].value = 2;
    draft[3].options[0].text = "Changed";
  });
  assert.deepEqual(edited.slice(0, 2), commands);
});

test("single-row operations retain their behavior without a range selection", () => {
  const deletion = setup([], 1);
  deletion.rows[1].onDelete();
  assert.deepEqual(deletion.commands.map((c) => c.text), ["a", "c", "d"]);
  assert.equal(deletion.ui.selIndex, 0);
  const copy = setup([]);
  copy.rows[3].onDup();
  assert.deepEqual(copy.commands.map((c) => c.text), ["a", "b", "c", "d", "d"]);
  assert.equal(copy.ui.selIndex, 4);
});

test("deletion preserves scroll position with no selection, an active row, or multiple selected rows", () => {
  for (const [selected, active, clicked] of [[[], null, 1], [[], 2, 2], [[1, 2], 2, 1]]) {
    let followedRow = 0;
    const wrap = {
      scrollTop: 0,
      scrollHeight: 2000,
      querySelector: () => ({ scrollIntoView: () => { followedRow++; } }),
    };
    const s = setup(selected, active, null, wrap);
    wrap.scrollTop = 400;
    followedRow = 0;
    s.rows[clicked].onDelete();
    s.render();
    assert.equal(wrap.scrollTop, 400);
    assert.equal(followedRow, 0);
    s.render();
    assert.equal(wrap.scrollTop, 400);
    assert.equal(followedRow, 0);
    // Subsequent explicit navigation should still follow the selected row.
    s.ui.selIndex = s.ui.selIndex === 0 ? 1 : 0;
    s.render();
    assert.equal(followedRow, 1);
  }
});
