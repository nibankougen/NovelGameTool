import { useEffect, useRef, useState, type MouseEvent, type RefObject } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useProjectStore } from "../../state/ProjectProvider";
import { useEditorUi } from "../../state/EditorUiContext";
import { useAppActions } from "../../state/AppActionsContext";
import type { ClickInfo } from "../../lib/editClickMapping";
import { useCharLookup } from "../../hooks/useCharLookup";
import { useDragReorder } from "../../hooks/useDragReorder";
import { cmdBroken } from "../../lib/sceneUtils";
import { honorificIssues } from "../../lib/honorific";
import { CommandRow } from "./CommandRow";
import { InlineEditRow } from "./edit/InlineEditRow";
import { ContextMenu } from "../common/ContextMenu";
import { uid } from "../../lib/id";

export function CommandList({ scrollWrapRef }: { scrollWrapRef: RefObject<HTMLDivElement | null> }) {
  const { t } = useTranslation();
  const { project, mutate, patch, mutateVersion } = useProjectStore();
  const editorUi = useEditorUi();
  const appActions = useAppActions();
  const findChar = useCharLookup();
  const scene = project.scenes.find((s) => s.id === editorUi.currentSceneId) ?? project.scenes[0];
  const cmds = scene.commands;

  const [selectedIdx, setSelectedIdx] = useState<Set<number>>(new Set());
  const anchorRef = useRef<number | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setSelectedIdx(new Set());
    anchorRef.current = null;
  }, [mutateVersion, scene.id]);

  // 選択行の変化・行の追加時にスクロール位置を追従させる（scrollToInsertPoint相当）
  useEffect(() => {
    const wrap = scrollWrapRef.current;
    if (!wrap) return;
    if (editorUi.selIndex === null) {
      wrap.scrollTop = wrap.scrollHeight;
    } else {
      const row = wrap.querySelector(`[data-idx="${editorUi.selIndex}"]`);
      row?.scrollIntoView({ block: "nearest" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorUi.selIndex, cmds.length, scene.id]);

  const drag = useDragReorder<HTMLDivElement>({
    itemSelector: ".cmd-row",
    scrollerRef: scrollWrapRef,
    onDrop: (from, to) => {
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
    if (e.target !== e.currentTarget) return;
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
            broken={cmdBroken(cmd, project.characters, project.scenes)}
            selected={editorUi.selIndex === i}
            multiSelected={selectedIdx.has(i)}
            honorIssues={cmd.type === "serif" ? honorificIssues(cmd, project.honorificRules, project.honorificVocab, findChar, t) : []}
            acked={cmd.type === "serif" && !!cmd.honorAckText && cmd.honorAckText === cmd.text}
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
