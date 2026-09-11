import { useCallback } from "react";
import { useProjectStore } from "../state/ProjectProvider";
import { useEditorUi } from "../state/EditorUiContext";
import type { Command } from "../types/project";

/** 現在のシーンの挿入位置（選択行の直後、なければ末尾）へコマンドを追加する */
export function useInsertCommand() {
  const { project, mutate } = useProjectStore();
  const editorUi = useEditorUi();
  return useCallback(
    (cmd: Command) => {
      const scene = project.scenes.find((s) => s.id === editorUi.currentSceneId);
      if (!scene) return;
      const at = editorUi.selIndex === null ? scene.commands.length : editorUi.selIndex + 1;
      const sceneId = scene.id;
      mutate((d) => {
        const sc = d.scenes.find((s) => s.id === sceneId);
        if (!sc) return;
        sc.commands.splice(at, 0, cmd);
      });
      if (editorUi.selIndex !== null) editorUi.setSelIndex(at);
    },
    [project, mutate, editorUi],
  );
}
