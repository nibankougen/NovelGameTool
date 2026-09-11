import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useProjectStore } from "../../state/ProjectProvider";
import { useEditorUi } from "../../state/EditorUiContext";
import { useToast } from "../common/ToastProvider";
import { useAppActions } from "../../state/AppActionsContext";
import { useDragReorder } from "../../hooks/useDragReorder";
import { uid } from "../../lib/id";
import { sceneHasAlert } from "../../lib/sceneUtils";
import { buildSceneRowMap, sceneDropTarget, type SceneRowMapEntry } from "../../lib/sceneDrop";
import { Icon } from "../common/Icon";
import { ContextMenu } from "../common/ContextMenu";
import { SceneGroupHeader } from "./SceneGroupHeader";
import { SceneRow } from "./SceneRow";
import { SceneMemoPanel } from "./SceneMemoPanel";

type Renaming = { type: "scene" | "group"; id: string } | null;

export function SceneList() {
  const { project, mutate, mutateVersion } = useProjectStore();
  const editorUi = useEditorUi();
  const toast = useToast();
  const a = useAppActions();

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [expandedScenes, setExpandedScenes] = useState<Set<string>>(new Set());
  const [selectedSceneIds, setSelectedSceneIds] = useState<Set<string>>(new Set());
  const anchorRef = useRef<string | null>(null);
  const [renaming, setRenaming] = useState<Renaming>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setSelectedSceneIds(new Set());
    anchorRef.current = null;
  }, [mutateVersion]);

  const rowMap = useMemo(
    () => buildSceneRowMap(project.scenes, project.sceneGroups, collapsedGroups),
    [project.scenes, project.sceneGroups, collapsedGroups],
  );
  const rowMapRef = useRef<SceneRowMapEntry[]>(rowMap);
  rowMapRef.current = rowMap;

  const clearGroupHighlight = () => {
    const c = sceneDrag.containerRef.current;
    if (!c) return;
    c.querySelectorAll(".scene-group-head").forEach((h) => h.classList.remove("drop-target"));
    c.querySelectorAll(".scene-item").forEach((r) => r.classList.remove("drop-target-before", "drop-target-after"));
  };

  const sceneDrag = useDragReorder<HTMLDivElement>({
    itemSelector: ".scene-item",
    onDrop: (from, _to, rawTo, lastY) => {
      const moved = rowMapRef.current[from];
      if (!moved) return;
      let target = sceneDropTarget(sceneDrag.containerRef.current, lastY, moved.sceneId, rowMapRef.current);
      if (!target) {
        const afterEntry = rowMapRef.current[rawTo];
        const beforeEntry = rawTo > 0 ? rowMapRef.current[rawTo - 1] : null;
        target = afterEntry
          ? { groupId: afterEntry.groupId, beforeSceneId: afterEntry.sceneId }
          : beforeEntry
            ? { groupId: beforeEntry.groupId, afterSceneId: beforeEntry.sceneId }
            : { groupId: null };
      }
      const finalTarget = target;
      mutate((d) => {
        const idx = d.scenes.findIndex((x) => x.id === moved.sceneId);
        if (idx === -1) return;
        const [s] = d.scenes.splice(idx, 1);
        s.groupId = finalTarget.groupId || null;
        let insertAt: number;
        if (finalTarget.atGroupStart) insertAt = d.scenes.findIndex((x) => (x.groupId || null) === (finalTarget.groupId || null));
        else if (finalTarget.beforeSceneId) insertAt = d.scenes.findIndex((x) => x.id === finalTarget.beforeSceneId);
        else if (finalTarget.afterSceneId) insertAt = d.scenes.findIndex((x) => x.id === finalTarget.afterSceneId) + 1;
        else insertAt = d.scenes.length;
        if (insertAt === -1) insertAt = d.scenes.length;
        d.scenes.splice(insertAt, 0, s);
      });
    },
    onHover: (clientY) => {
      clearGroupHighlight();
      if (clientY == null) return;
      const container = sceneDrag.containerRef.current;
      const dragging = container?.querySelector<HTMLElement>(".scene-item.dragging");
      const target = sceneDropTarget(container ?? null, clientY, dragging?.dataset.sceneId ?? "", rowMapRef.current);
      if (!target || !container) return;
      if (target.atGroupStart) {
        const headers = Array.from(container.querySelectorAll<HTMLElement>(".scene-group-head"));
        const h = headers.find((h) => (h.classList.contains("ungrouped") ? null : h.dataset.groupId || null) === (target.groupId || null));
        h?.classList.add("drop-target");
      } else {
        const sceneId = target.beforeSceneId || target.afterSceneId;
        const row = container.querySelector<HTMLElement>(`.scene-item[data-scene-id="${sceneId}"]`);
        row?.classList.add(target.beforeSceneId ? "drop-target-before" : "drop-target-after");
      }
    },
  });

  const groupDrag = useDragReorder<HTMLDivElement>({
    itemSelector: ".scene-group-head:not(.ungrouped)",
    onDrop: (from, to) => {
      if (from === to) return;
      mutate((d) => {
        const [g] = d.sceneGroups.splice(from, 1);
        d.sceneGroups.splice(to, 0, g);
      });
    },
  });

  const setContainerRef = (el: HTMLDivElement | null) => {
    sceneDrag.containerRef.current = el;
    groupDrag.containerRef.current = el;
  };
  const handleMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    sceneDrag.onMouseDown(e);
    groupDrag.onMouseDown(e);
  };

  const createScene = (groupId: string | null) => {
    const curScene = project.scenes.find((s) => s.id === editorUi.currentSceneId);
    let effectiveGroupId = groupId || null;
    let insertAfterId: string | null = null;
    if (groupId == null) {
      if (curScene) {
        effectiveGroupId = curScene.groupId || null;
        insertAfterId = curScene.id;
      }
    } else if (curScene && (curScene.groupId || null) === groupId) {
      insertAfterId = curScene.id;
    }
    let n = project.scenes.length + 1;
    while (project.scenes.some((s) => s.name === "シーン" + n)) n++;
    const newId = uid();
    mutate((d) => {
      const newScene = { id: newId, name: "シーン" + n, commands: [], groupId: effectiveGroupId, synopsis: "" };
      if (insertAfterId) {
        const idx = d.scenes.findIndex((s) => s.id === insertAfterId);
        d.scenes.splice(idx + 1, 0, newScene);
      } else {
        d.scenes.push(newScene);
      }
    });
    editorUi.gotoScene(newId);
    setRenaming({ type: "scene", id: newId });
  };

  const addGroup = () => {
    let n = project.sceneGroups.length + 1;
    while (project.sceneGroups.some((g) => g.name === "グループ" + n)) n++;
    const newId = uid();
    mutate((d) => {
      d.sceneGroups.push({ id: newId, name: "グループ" + n });
    });
    setRenaming({ type: "group", id: newId });
  };

  const selectRange = (clickedId: string) => {
    const order = rowMap.map((x) => x.sceneId);
    const anchor = anchorRef.current && order.includes(anchorRef.current) ? anchorRef.current : editorUi.currentSceneId;
    const ai = order.indexOf(anchor);
    const ci = order.indexOf(clickedId);
    if (ai === -1 || ci === -1) setSelectedSceneIds(new Set([clickedId]));
    else {
      const lo = Math.min(ai, ci);
      const hi = Math.max(ai, ci);
      setSelectedSceneIds(new Set(order.slice(lo, hi + 1)));
    }
  };

  const mergeSelectedScenes = () => {
    const order = rowMap.map((x) => x.sceneId);
    const scenes = order.filter((id) => selectedSceneIds.has(id)).map((id) => project.scenes.find((s) => s.id === id)!).filter(Boolean);
    if (scenes.length < 2) return;
    const names = scenes.map((s) => s.name).join("」「");
    if (!window.confirm(`シーン「${names}」を1つに結合しますか？\n（先頭のシーンにセリフ等がまとめられ、残りのシーンは削除されます。ジャンプ・選択肢からの参照先は自動的に結合後のシーンへ付け替えられます）`))
      return;
    const targetId = scenes[0].id;
    const removedIds = new Set(scenes.slice(1).map((s) => s.id));
    setSelectedSceneIds(new Set());
    anchorRef.current = null;
    mutate((d) => {
      const target = d.scenes.find((s) => s.id === targetId)!;
      for (const src of d.scenes.filter((s) => removedIds.has(s.id))) {
        target.commands.push(...src.commands);
        if (src.synopsis && src.synopsis.trim()) target.synopsis = (target.synopsis ? target.synopsis + "\n\n" : "") + src.synopsis;
      }
      for (const sc of d.scenes)
        for (const cmd of sc.commands) {
          if (cmd.type === "jump" && removedIds.has(cmd.target)) cmd.target = targetId;
          else if (cmd.type === "choice") for (const o of cmd.options) if (o.target && removedIds.has(o.target)) o.target = targetId;
        }
      d.scenes = d.scenes.filter((s) => !removedIds.has(s.id));
      if (removedIds.has(editorUi.currentSceneId)) editorUi.gotoScene(targetId);
    });
    toast(`${scenes.length}件のシーンを「${scenes[0].name}」に結合しました`);
  };

  const renderScenesFor = (groupId: string | null, indented: boolean) =>
    project.scenes
      .filter((s) => (s.groupId || null) === groupId)
      .map((s) => (
        <div key={s.id}>
          <SceneRow
            scene={s}
            indented={indented}
            active={s.id === editorUi.currentSceneId}
            multiSelected={selectedSceneIds.has(s.id)}
            hasAlert={sceneHasAlert(s, project.characters, project.scenes)}
            memoOpen={expandedScenes.has(s.id)}
            renaming={renaming?.type === "scene" && renaming.id === s.id}
            onSelect={(shiftKey) => {
              if (shiftKey) {
                selectRange(s.id);
                return;
              }
              setSelectedSceneIds(new Set());
              anchorRef.current = s.id;
              if (editorUi.currentSceneId !== s.id) {
                editorUi.gotoScene(s.id);
                a.focusMainInput();
              }
            }}
            onContextMenu={(x, y) => {
              if (!selectedSceneIds.has(s.id)) {
                setSelectedSceneIds(new Set([s.id]));
                anchorRef.current = s.id;
              }
              setCtxMenu({ x, y });
            }}
            onToggleMemo={() =>
              setExpandedScenes((prev) => {
                const next = new Set(prev);
                next.has(s.id) ? next.delete(s.id) : next.add(s.id);
                return next;
              })
            }
            onStartRename={() => setRenaming({ type: "scene", id: s.id })}
            onCommitRename={(name) => {
              setRenaming(null);
              if (name !== s.name) mutate((d) => { const sc = d.scenes.find((x) => x.id === s.id); if (sc) sc.name = name; });
            }}
            onCancelRename={() => setRenaming(null)}
            onDelete={() => {
              if (project.scenes.length <= 1) {
                toast("最後のシーンは削除できません", true);
                return;
              }
              if (!window.confirm(`シーン「${s.name}」を削除しますか？`)) return;
              mutate((d) => {
                const idx = d.scenes.findIndex((x) => x.id === s.id);
                d.scenes.splice(idx, 1);
              });
            }}
          />
          {expandedScenes.has(s.id) && <SceneMemoPanel scene={s} indented={indented} />}
        </div>
      ));

  const ungroupedCount = project.scenes.filter((s) => !s.groupId).length;

  return (
    <>
      <div className="side-head flex items-center justify-between px-2.5 pt-2 pb-1 text-text-dim text-xs font-semibold">
        <span>シーン</span>
        <span className="flex gap-1">
          <button onClick={addGroup} title="グループ（章）を追加" className="text-sm px-2 py-0">
            <Icon name="plus" />章
          </button>
          <button onClick={() => createScene(null)} title="シーンを追加" className="text-sm px-2 py-0">
            <Icon name="plus" />
          </button>
        </span>
      </div>
      <div ref={setContainerRef} onMouseDown={handleMouseDown} className="flex-1 overflow-y-auto px-1.5 py-0.5">
        {!project.sceneGroups.length && renderScenesFor(null, false)}
        {project.sceneGroups.map((g) => (
          <div key={g.id}>
            <SceneGroupHeader
              group={g}
              count={project.scenes.filter((s) => s.groupId === g.id).length}
              collapsed={collapsedGroups.has(g.id)}
              renaming={renaming?.type === "group" && renaming.id === g.id}
              onToggleCollapse={() =>
                setCollapsedGroups((prev) => {
                  const next = new Set(prev);
                  next.has(g.id) ? next.delete(g.id) : next.add(g.id);
                  return next;
                })
              }
              onStartRename={() => setRenaming({ type: "group", id: g.id })}
              onCommitRename={(name) => {
                setRenaming(null);
                if (name !== g.name) mutate((d) => { const grp = d.sceneGroups.find((x) => x.id === g.id); if (grp) grp.name = name; });
              }}
              onCancelRename={() => setRenaming(null)}
              onDelete={() => {
                if (!window.confirm(`グループ「${g.name}」を削除しますか？\n（含まれるシーンは削除されず、未分類になります）`)) return;
                mutate((d) => {
                  const idx = d.sceneGroups.findIndex((x) => x.id === g.id);
                  d.sceneGroups.splice(idx, 1);
                  for (const s of d.scenes) if (s.groupId === g.id) s.groupId = null;
                });
              }}
              onAddScene={() => createScene(g.id)}
            />
            {!collapsedGroups.has(g.id) && renderScenesFor(g.id, true)}
          </div>
        ))}
        {project.sceneGroups.length > 0 && ungroupedCount > 0 && (
          <div>
            <SceneGroupHeader
              group={null}
              count={ungroupedCount}
              collapsed={collapsedGroups.has("__ungrouped__")}
              renaming={false}
              onToggleCollapse={() => {}}
              onStartRename={() => {}}
              onCommitRename={() => {}}
              onCancelRename={() => {}}
              onDelete={() => {}}
              onAddScene={() => {}}
            />
            {!collapsedGroups.has("__ungrouped__") && renderScenesFor(null, true)}
          </div>
        )}
      </div>
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          items={[
            {
              label: selectedSceneIds.size >= 1 ? `選択した${selectedSceneIds.size}件のシーンを結合` : "結合するシーンを選択してください（Shift+クリック）",
              disabled: selectedSceneIds.size < 2,
              onClick: mergeSelectedScenes,
            },
          ]}
        />
      )}
    </>
  );
}
