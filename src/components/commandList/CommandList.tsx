import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type RefObject } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useProjectStore } from "../../state/ProjectProvider";
import { useEditorUi } from "../../state/EditorUiContext";
import { useAppActions } from "../../state/AppActionsContext";
import type { ClickInfo } from "../../lib/editClickMapping";
import { useCharLookup } from "../../hooks/useCharLookup";
import { useDragReorder } from "../../hooks/useDragReorder";
import { cmdBroken } from "../../lib/sceneUtils";
import { honorificIssues } from "../../lib/honorific";
import { anonymousLabelFor } from "../../lib/anonymize";
import { CommandRow } from "./CommandRow";
import { InlineEditRow } from "./edit/InlineEditRow";
import { ContextMenu } from "../common/ContextMenu";
import { uid } from "../../lib/id";
import { characterCounters } from "../../lib/characterCounter";

export function CommandList({ scrollWrapRef }: { scrollWrapRef: RefObject<HTMLDivElement | null> }) {
  const { t } = useTranslation();
  const { project, mutate, patch, mutateVersion } = useProjectStore();
  const editorUi = useEditorUi();
  const appActions = useAppActions();
  const findChar = useCharLookup();
  const scene = project.scenes.find((s) => s.id === editorUi.currentSceneId) ?? project.scenes[0];
  const cmds = scene.commands;
  const counters = characterCounters(cmds, findChar);
  const anonymousLabel = anonymousLabelFor(project, project.baseLanguage);

  const [selectedIdx, setSelectedIdx] = useState<Set<number>>(new Set());
  const anchorRef = useRef<number | null>(null);
  const backgroundMouseDownRef = useRef(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const reorderScrollRef = useRef<{ sceneId: string; top: number } | null>(null);
  const previousScrollTargetRef = useRef<{ sceneId: string; index: number | null; length: number } | null>(null);

  useEffect(() => {
    setSelectedIdx(new Set());
    anchorRef.current = null;
  }, [mutateVersion, scene.id]);

  // 並べ替え後は描画前に位置を復元し、選択行への自動追従を抑止する。
  // 毎コミットで確認することで、選択番号が変わらないドロップも処理する。
  useLayoutEffect(() => {
    const wrap = scrollWrapRef.current;
    if (!wrap) return;
    const previous = previousScrollTargetRef.current;
    previousScrollTargetRef.current = { sceneId: scene.id, index: editorUi.selIndex, length: cmds.length };
    const preserved = reorderScrollRef.current;
    reorderScrollRef.current = null;
    if (preserved?.sceneId === scene.id) {
      wrap.scrollTop = preserved.top;
      return;
    }
    if (previous?.sceneId === scene.id && previous.index === editorUi.selIndex && previous.length === cmds.length) return;
    if (editorUi.selIndex === null) {
      wrap.scrollTop = wrap.scrollHeight;
    } else {
      const row = wrap.querySelector(`[data-idx="${editorUi.selIndex}"]`);
      row?.scrollIntoView({ block: "nearest" });
    }
  });

  const drag = useDragReorder<HTMLDivElement>({
    itemSelector: ".cmd-row",
    scrollerRef: scrollWrapRef,
    onDrop: (from, to) => {
      const wrap = scrollWrapRef.current;
      if (wrap && (from !== to || editorUi.editIndex !== null || editorUi.selIndex !== to)) {
        reorderScrollRef.current = { sceneId: scene.id, top: wrap.scrollTop };
      }
      if (from !== to) {
        const sceneId = scene.id;
        mutate((d) => {
          const sc = d.scenes.find((s) => s.id === sceneId);
          if (!sc) return;
          const [c] = sc.commands.splice(from, 1);
          sc.commands.splice(to, 0, c);
        });
      }
      editorUi.stopEdit();
      editorUi.setSelIndex(to);
    },
  });

  const selectRange = (clickedIdx: number) => {
    const len = cmds.length;
    const anchor = anchorRef.current !== null && anchorRef.current < len ? anchorRef.current : (editorUi.selIndex ?? clickedIdx);
    const lo = Math.min(anchor, clickedIdx);
    const hi = Math.max(anchor, clickedIdx);
    const next = new Set<number>();
    for (let k = lo; k <= hi; k++) next.add(k);
    setSelectedIdx(next);
    editorUi.setSelIndex(clickedIdx);
  };

  const handleEdit = (i: number, clickInfo: ClickInfo | null) => {
    const c = cmds[i];
    editorUi.setSelIndex(i);
    if (c.type === "choice") {
      appActions.openChoiceModal(i);
      return;
    }
    editorUi.startEdit(i, clickInfo);
  };

  const splitSelectedToScene = () => {
    const idxs = [...selectedIdx].sort((a, b) => a - b);
    if (!idxs.length) return;
    if (!window.confirm(t("commandList.confirmSplitToScene", { count: idxs.length }))) return;
    const removedSet = new Set(idxs);
    const sceneId = scene.id;
    const newSceneId = uid();
    const newSceneName = t("commandList.splitSceneName", { name: scene.name });
    mutate((d) => {
      const sc = d.scenes.find((s) => s.id === sceneId)!;
      const moved = sc.commands.filter((_, i) => removedSet.has(i));
      sc.commands = sc.commands.filter((_, i) => !removedSet.has(i));
      const newScene = { id: newSceneId, name: newSceneName, commands: moved, groupId: sc.groupId, synopsis: "" };
      const pos = d.scenes.findIndex((x) => x.id === sc.id);
      d.scenes.splice(pos + 1, 0, newScene);
    });
    editorUi.setSelIndex(null);
    editorUi.stopEdit();
    setSelectedIdx(new Set());
  };

  const handleContainerClick = (e: MouseEvent<HTMLDivElement>) => {
    // 入力欄から外へ選択ドラッグすると、共通祖先のリストにclickが発生する。
    // 余白から押し始めたクリックだけで選択解除する。
    const startedOnBackground = backgroundMouseDownRef.current;
    backgroundMouseDownRef.current = false;
    if (!startedOnBackground || e.target !== e.currentTarget) return;
    editorUi.stopEdit();
    editorUi.setSelIndex(null);
    setSelectedIdx(new Set());
    anchorRef.current = null;
  };

  if (!cmds.length) {
    return (
      <div id="emptyHint" className="text-text-dim text-center py-15 px-5 leading-loose">
        <Trans i18nKey="commandList.emptyHint.line1" components={[<kbd key="0" className="bg-bg-3 border border-border rounded px-1.5 text-xs" />]} />
        <br />
        <Trans
          i18nKey="commandList.emptyHint.line2"
          components={[
            <kbd key="0" className="bg-bg-3 border border-border rounded px-1.5 text-xs" />,
            <kbd key="1" className="bg-bg-3 border border-border rounded px-1.5 text-xs" />,
            <kbd key="2" className="bg-bg-3 border border-border rounded px-1.5 text-xs" />,
          ]}
        />
      </div>
    );
  }

  return (
    <div
      ref={drag.containerRef}
      onMouseDownCapture={(e) => {
        backgroundMouseDownRef.current = e.button === 0 && e.target === e.currentTarget;
      }}
      onMouseDown={drag.onMouseDown}
      onClick={handleContainerClick}
      id="cmdList"
      className="max-w-[860px] mx-auto min-h-full"
    >
      {cmds.map((cmd, i) =>
        editorUi.editIndex === i ? (
          <InlineEditRow key={i} index={i} cmd={cmd} scene={scene} />
        ) : (
          <CommandRow
            key={i}
            index={i}
            cmd={cmd}
            counter={counters.get(i)}
            broken={cmdBroken(cmd, project.characters, project.scenes)}
            selected={editorUi.selIndex === i}
            multiSelected={selectedIdx.has(i)}
            honorIssues={cmd.type === "serif" ? honorificIssues(cmd, project.honorificRules, project.honorificVocab, findChar, t) : []}
            acked={cmd.type === "serif" && !!cmd.honorAckText && cmd.honorAckText === cmd.text}
            anonymousLabel={anonymousLabel}
            characters={project.characters}
            scenes={project.scenes}
            eventKeys={project.eventKeys}
            findChar={findChar}
            onDelete={() => {
              const sceneId = scene.id;
              let newSel = editorUi.selIndex;
              if (newSel !== null) {
                if (newSel === i) newSel = i > 0 ? i - 1 : cmds.length > 1 ? 0 : null;
                else if (newSel > i) newSel--;
              }
              mutate((d) => {
                const sc = d.scenes.find((s) => s.id === sceneId)!;
                sc.commands.splice(i, 1);
              });
              editorUi.setSelIndex(newSel);
            }}
            onDup={() => {
              const sceneId = scene.id;
              mutate((d) => {
                const sc = d.scenes.find((s) => s.id === sceneId)!;
                sc.commands.splice(i + 1, 0, JSON.parse(JSON.stringify(sc.commands[i])));
              });
              editorUi.setSelIndex(i + 1);
            }}
            onMoveUp={() => {
              const j = i - 1;
              if (j < 0) return;
              const sceneId = scene.id;
              mutate((d) => {
                const sc = d.scenes.find((s) => s.id === sceneId)!;
                const [c] = sc.commands.splice(i, 1);
                sc.commands.splice(j, 0, c);
              });
              if (editorUi.selIndex === i) editorUi.setSelIndex(j);
            }}
            onMoveDown={() => {
              const j = i + 1;
              if (j >= cmds.length) return;
              const sceneId = scene.id;
              mutate((d) => {
                const sc = d.scenes.find((s) => s.id === sceneId)!;
                const [c] = sc.commands.splice(i, 1);
                sc.commands.splice(j, 0, c);
              });
              if (editorUi.selIndex === i) editorUi.setSelIndex(j);
            }}
            onEdit={(clickInfo) => handleEdit(i, clickInfo)}
            onGotoScene={(sceneId) => editorUi.gotoScene(sceneId)}
            onToggleHonorAck={() => {
              const sceneId = scene.id;
              patch((d) => {
                const sc = d.scenes.find((s) => s.id === sceneId)!;
                const c = sc.commands[i];
                if (c.type !== "serif") return;
                if (c.honorAckText === c.text) delete c.honorAckText;
                else c.honorAckText = c.text;
              });
            }}
            onToggleAnonymous={() => {
              const sceneId = scene.id;
              patch((d) => {
                const sc = d.scenes.find((s) => s.id === sceneId)!;
                const c = sc.commands[i];
                if (c.type !== "serif") return;
                if (c.anonymous) delete c.anonymous;
                else c.anonymous = true;
              });
            }}
            onShiftSelect={() => {
              editorUi.stopEdit();
              selectRange(i);
            }}
            onContextMenu={(x, y) => {
              if (!selectedIdx.has(i)) {
                setSelectedIdx(new Set([i]));
                anchorRef.current = i;
              }
              setCtxMenu({ x, y });
            }}
          />
        ),
      )}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          items={[
            {
              label:
                selectedIdx.size >= 1
                  ? t("commandList.splitSelected", { count: selectedIdx.size })
                  : t("commandList.selectRowsToSplit"),
              disabled: selectedIdx.size < 1,
              onClick: splitSelectedToScene,
            },
          ]}
        />
      )}
    </div>
  );
}
