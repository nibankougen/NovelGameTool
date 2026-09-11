import { useRef, useState } from "react";
import { useProjectStore } from "../../../state/ProjectProvider";
import { useEditorUi } from "../../../state/EditorUiContext";
import { useAppActions } from "../../../state/AppActionsContext";
import { useCharLookup } from "../../../hooks/useCharLookup";
import { useToast } from "../../common/ToastProvider";
import { Icon } from "../../common/Icon";
import { cmdToInputText } from "../../../lib/commandSerialize";
import { parseInput } from "../../../lib/parseInput";
import { parseInputDry, makeDraftParseEnv } from "../../../lib/parseEnvDraft";
import { carryTr } from "../../../lib/carryTr";
import type { Command, Scene } from "../../../types/project";

export function PlainEditRow({ index, cmd, scene }: { index: number; cmd: Command; scene: Scene }) {
  const { project, mutate } = useProjectStore();
  const editorUi = useEditorUi();
  const appActions = useAppActions();
  const findChar = useCharLookup();
  const toast = useToast();

  const initialValue = cmdToInputText(cmd, project.scenes, findChar) ?? "";
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const doneRef = useRef(false);
  const startedRef = useRef(false);

  // pendingEditClickの消費はrender中ではなくref attach時（コミット後・一度だけ実行が保証される）に行う。
  // StrictModeの開発時二重呼び出しでは、useStateの遅延初期化関数はrender中に2回評価されるため、
  // ここでconsumePendingEditClick()（副作用で消費済みにする）を呼ぶと1回目の結果が2回目で失われる。
  const inputRefCallback = (el: HTMLInputElement | null) => {
    inputRef.current = el;
    if (el && !startedRef.current) {
      startedRef.current = true;
      el.focus();
      const info = editorUi.consumePendingEditClick();
      const pos = info?.zone === "text" ? info.offset : el.value.length;
      el.setSelectionRange(pos, pos);
    }
  };

  const finish = (commit: boolean) => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (commit) {
      const speaker = { id: editorUi.speakerId, face: editorUi.speakerFace };
      const err = parseInputDry(value, project, speaker, { sticky: false });
      if (err) {
        toast(err, true);
        doneRef.current = false;
        inputRef.current?.focus();
        return;
      }
      const sceneId = scene.id;
      editorUi.stopEdit();
      mutate((d) => {
        const env = makeDraftParseEnv(d, { toast });
        const r = parseInput(value, env, speaker, { sticky: false });
        if (r.kind !== "command") return;
        const sc = d.scenes.find((s) => s.id === sceneId);
        if (!sc) return;
        sc.commands[index] = carryTr(sc.commands[index], r.cmd);
      });
    } else {
      editorUi.stopEdit();
    }
    appActions.focusMainInput();
  };

  return (
    <div className="cmd-row flex items-start gap-2 px-2 py-1 my-px">
      <span className="drag-handle invisible pt-1">
        <Icon name="grip-vertical" />
      </span>
      <span className="w-8 shrink-0" />
      <div className="row-body flex-1 min-w-0">
        <input
          ref={inputRefCallback}
          type="text"
          className="plain-edit-text w-full text-sm px-0.5 py-px bg-transparent border-none rounded"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing || e.keyCode === 229) return;
            if (e.key === "Enter") {
              e.preventDefault();
              finish(true);
            } else if (e.key === "Escape") {
              e.preventDefault();
              finish(false);
            }
            e.stopPropagation();
          }}
          onBlur={() => finish(true)}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
}
