import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

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

function sceneDropSetup(target = null) {
  const source = readFileSync(new URL("../src/components/scenes/SceneList.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const project = {
    scenes: ["a", "b", "c"].map((id) => ({ id, groupId: "group", commands: [] })),
    sceneGroups: [{ id: "group" }], characters: [],
  };
  let mutations = 0;
  const drags = [];
  const modules = {
    react: {
      useState: (initial) => [initial, () => {}], useRef: (current) => ({ current }),
      useMemo: (fn) => fn(), useEffect: () => {},
    },
    "react/jsx-runtime": { jsx: () => null, jsxs: () => null },
    "react-i18next": { useTranslation: () => ({ t: (key) => key }) },
    "../../state/ProjectProvider": { useProjectStore: () => ({
      project, mutate: (fn) => { mutations++; fn(project); },
    }) },
    "../../state/EditorUiContext": { useEditorUi: () => ({}) },
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
  vm.runInNewContext(compiled, { exports, require: (name) => modules[name] ?? {} });
  exports.SceneList();
  return { project, drop: drags[0].onDrop, get mutations() { return mutations; } };
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
