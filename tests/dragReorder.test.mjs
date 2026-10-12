import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { produce } from "immer";

const source = readFileSync(new URL("../src/hooks/useDragReorder.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

// Exercise the hook's mouse event lifecycle without a browser or React renderer.
function setup() {
  const listeners = new Map();
  const classList = () => {
    const values = new Set();
    return { add: (v) => values.add(v), remove: (v) => values.delete(v), contains: (v) => values.has(v) };
  };
  let indicatorBefore = null;
  let indicatorRemoved = false;
  const rows = [0, 1, 2].map((i) => ({
    classList: classList(),
    getBoundingClientRect: () => ({ top: 100 + i * 40, height: 40 }),
    before: () => { indicatorBefore = i; },
  }));
  const document = {
    body: { style: { cursor: "" }, classList: classList() },
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name) => listeners.delete(name),
    createElement: () => ({ remove: () => { indicatorRemoved = true; } }),
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, document,
    require: (name) => {
      assert.equal(name, "react");
      return { useRef: (current) => ({ current }), useEffect: (fn) => fn(), useCallback: (fn) => fn };
    },
  });
  const drops = [];
  const hovers = [];
  const hook = exports.useDragReorder({
    itemSelector: ".scene-item",
    onDrop: (...args) => drops.push(args),
    onHover: (y) => hovers.push(y),
  });
  const container = {
    querySelectorAll: () => rows,
    getBoundingClientRect: () => ({ top: 0, bottom: 400 }),
    scrollTop: 0,
    appendChild: () => { indicatorBefore = "end"; },
    // Grouped rows are nested: inserting them as a direct child must fail.
    insertBefore: () => { throw new Error("NotFoundError: row is not a direct child"); },
  };
  hook.containerRef.current = container;
  return {
    drops, hovers, document, rows, listeners, container,
    get indicatorBefore() { return indicatorBefore; },
    get indicatorRemoved() { return indicatorRemoved; },
    down: (y = 110, button = 0) => hook.onMouseDown({
      button, clientX: 20, clientY: y,
      target: { closest: () => ({ closest: () => rows[0] }) },
      preventDefault() {}, nativeEvent: { clientX: 20, clientY: y },
    }),
    move: (x, y) => listeners.get("mousemove")?.({ clientX: x, clientY: y }),
    up: () => listeners.get("mouseup")?.(),
  };
}

test("clicking either half of a scene handle does not start a drag or drop", () => {
  for (const y of [110, 130]) {
    const s = setup();
    s.down(y);
    s.up();
    assert.deepEqual(s.drops, []);
    assert.deepEqual(s.hovers, []);
    assert.equal(s.indicatorBefore, null);
    assert.equal(s.rows[0].classList.contains("dragging"), false);
    assert.equal(s.container.scrollTop, 0);
    assert.equal(s.listeners.has("mousemove"), false);
    assert.equal(s.listeners.has("mouseup"), false);
  }
});

test("small pointer jitter does not reorder or suppress the ordinary click", () => {
  const s = setup();
  s.down();
  s.move(22, 112);
  s.move(20, 110);
  s.up();
  assert.deepEqual(s.drops, []);
  s.listeners.get("click")({
    stopPropagation: () => assert.fail("click was suppressed"),
    preventDefault: () => assert.fail("click was prevented"),
  });
});

test("real dragging works with nested grouped rows and cleans up on release", () => {
  const s = setup();
  s.down();
  s.move(20, 190);
  assert.equal(s.indicatorBefore, 2);
  assert.equal(s.rows[0].classList.contains("dragging"), true);
  s.up();
  assert.deepEqual(s.drops, [[0, 1, 2, 190]]);
  assert.deepEqual(s.hovers, [190, null]);
  assert.equal(s.indicatorRemoved, true);
  assert.equal(s.rows[0].classList.contains("dragging"), false);
  assert.equal(s.document.body.style.cursor, "");
  assert.equal(s.document.body.classList.contains("dnd-dragging"), false);
});

test("dragging past the last row preserves the end insertion index", () => {
  const s = setup();
  s.down();
  s.move(20, 250);
  s.up();
  assert.equal(s.indicatorBefore, "end");
  assert.deepEqual(s.drops, [[0, 2, 3, 250]]);
});

test("non-primary mouse buttons do not initiate reordering", () => {
  const s = setup();
  s.down(110, 2);
  s.move(20, 190);
  s.up();
  assert.deepEqual(s.drops, []);
});

function sceneDropSetup(target = null, sceneOverrides = {}) {
  const source = readFileSync(new URL("../src/components/scenes/SceneList.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  let project = {
    scenes: ["a", "b", "c"].map((id) => ({ id, name: id, groupId: "group", commands: [], synopsis: "", ...sceneOverrides })),
    sceneGroups: [{ id: "group" }], characters: [],
  };
  let mutations = 0;
  let selectedSceneId = null;
  let nextId = 0;
  const rows = [];
  const jsx = (_type, props) => {
    if (props?.onDuplicate) rows.push(props);
    return null;
  };
  const drags = [];
  const modules = {
    react: {
      useState: (initial) => [initial, () => {}], useRef: (current) => ({ current }),
      useMemo: (fn) => fn(), useEffect: () => {},
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-i18next": { useTranslation: () => ({ t: (key, options) => key === "scene.copyName" ? `${options.name} (copy)` : key }) },
    "../../lib/id": { uid: () => `copy-${++nextId}` },
    "../../state/ProjectProvider": { useProjectStore: () => ({
      project, mutate: (fn) => { mutations++; project = produce(project, fn); },
    }) },
    "../../state/EditorUiContext": { useEditorUi: () => ({ gotoScene: (id) => { selectedSceneId = id; } }) },
    "../common/ToastProvider": { useToast: () => () => {} },
    "../../state/AppActionsContext": { useAppActions: () => ({}) },
    "../../hooks/useDragReorder": { useDragReorder: (options) => {
      drags.push(options);
      return { containerRef: { current: null } };
    } },
    "../../lib/sceneDrop": {
      buildSceneRowMap: (scenes) => scenes.map((s) => ({ sceneId: s.id, groupId: s.groupId })),
      sceneDropTarget: () => target,
    },
    "../../lib/sceneUtils": { sceneHasAlert: () => false },
  };
  const exports = {};
  vm.runInNewContext(compiled, { exports, structuredClone, require: (name) => modules[name] ?? {} });
  exports.SceneList();
  return {
    get project() { return project; },
    get selectedSceneId() { return selectedSceneId; },
    rows,
    render: () => { rows.length = 0; exports.SceneList(); },
    drop: drags[0].onDrop, get mutations() { return mutations; },
  };
}

test("dropping on either half of the original scene keeps its order and avoids a mutation", () => {
  for (const rawTo of [1, 2]) {
    const s = sceneDropSetup();
    s.drop(1, 1, rawTo, 150);
    assert.deepEqual(s.project.scenes.map((scene) => scene.id), ["a", "b", "c"]);
    assert.equal(s.mutations, 0);
  }
});

test("dropping on a different group header still moves the scene at the same row index", () => {
  const s = sceneDropSetup({ groupId: "other", atGroupStart: true });
  s.drop(1, 1, 1, 150);
  assert.equal(s.project.scenes.find((scene) => scene.id === "b").groupId, "other");
  assert.equal(s.mutations, 1);
});

test("scene duplication preserves nested contents and references with independent data", () => {
  const s = sceneDropSetup(null, {
    hidden: true,
    synopsis: "Scene memo",
    commands: [
      { type: "serif", text: "Hello", chara: "speaker", face: "smile", anonymous: true,
        tr: { ja: "こんにちは" }, events: [{ keyId: "event", value: 3 }] },
      { type: "jump", target: "b" },
      { type: "choice", options: [{ text: "Continue", target: "c", tr: { ja: "続行" } }] },
    ],
  });
  const original = s.project;
  s.rows[1].onDuplicate();
  const copy = s.project.scenes[2];
  assert.deepEqual(s.project.scenes.map((scene) => scene.id), ["a", "b", copy.id, "c"]);
  assert.notEqual(copy.id, "b");
  assert.equal(copy.name, "b (copy)");
  assert.equal(copy.groupId, "group");
  assert.equal(copy.synopsis, "Scene memo");
  assert.equal(copy.hidden, true);
  assert.deepEqual(copy.commands, original.scenes[1].commands);
  assert.equal(s.selectedSceneId, copy.id);
  assert.equal(s.mutations, 1);
  const edited = produce(s.project, (d) => {
    d.scenes[2].commands[0].tr.ja = "変更";
    d.scenes[2].commands[0].events[0].value = 9;
    d.scenes[2].commands[2].options[0].text = "Changed";
  });
  assert.deepEqual(edited.scenes[1], original.scenes[1]);
  assert.equal(original.scenes.length, 3);
});

test("repeated duplication of an ungrouped empty scene uses unique names and IDs", () => {
  const s = sceneDropSetup(null, { groupId: null });
  s.rows[0].onDuplicate();
  s.render();
  s.rows[0].onDuplicate();
  const copies = s.project.scenes.slice(1, 3);
  assert.deepEqual(copies.map((scene) => scene.name), ["a (copy) 2", "a (copy)"]);
  assert.notEqual(copies[0].id, copies[1].id);
  assert.equal(copies[0].groupId, null);
  assert.deepEqual(copies[0].commands, []);
});

test("scene visibility toggles without changing scene selection or contents", () => {
  const s = sceneDropSetup();
  const original = structuredClone(s.project.scenes[1]);
  s.rows[1].onToggleHidden();
  assert.deepEqual(s.project.scenes[1], { ...original, hidden: true });
  assert.equal(s.selectedSceneId, null);
  s.render();
  s.rows[1].onToggleHidden();
  assert.deepEqual(s.project.scenes[1], { ...original, hidden: false });
  assert.equal(s.mutations, 2);
});
