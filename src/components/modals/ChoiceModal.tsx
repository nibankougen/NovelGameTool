import { useRef, useState } from "react";
import { useProjectStore } from "../../state/ProjectProvider";
import { useEditorUi } from "../../state/EditorUiContext";
import { useToast } from "../common/ToastProvider";
import { Modal, ModalFoot, ModalTitle } from "./Modal";
import { Icon } from "../common/Icon";
import { carryTr } from "../../lib/carryTr";
import { parseInput } from "../../lib/parseInput";
import { makeDraftParseEnv, parseInputDry } from "../../lib/parseEnvDraft";
import { uid } from "../../lib/id";
import type { ChoiceCommand } from "../../types/project";

interface OptRow {
  key: string;
  text: string;
  target: string | null;
  branch: string;
}

export function ChoiceModal({ open, cmdIndex, onClose }: { open: boolean; cmdIndex: number | null; onClose: () => void }) {
  return open ? <ChoiceModalInner key={cmdIndex ?? "new"} cmdIndex={cmdIndex} onClose={onClose} /> : null;
}

function ChoiceModalInner({ cmdIndex, onClose }: { cmdIndex: number | null; onClose: () => void }) {
  const { project, mutate } = useProjectStore();
  const editorUi = useEditorUi();
  const toast = useToast();
  const scene = project.scenes.find((s) => s.id === editorUi.currentSceneId)!;
  const existingCmd = cmdIndex !== null ? (scene.commands[cmdIndex] as ChoiceCommand) : null;
  const currentSpeaker = { id: editorUi.speakerId, face: editorUi.speakerFace };

  const [rows, setRows] = useState<OptRow[]>(() =>
    existingCmd
      ? existingCmd.options.map((o) => ({ key: uid(), text: o.text, target: o.target, branch: "" }))
      : [
          { key: uid(), text: "", target: null, branch: "" },
          { key: uid(), text: "", target: null, branch: "" },
        ],
  );
  const firstInputRef = useRef<HTMLInputElement>(null);

  const updateRow = (key: string, patch: Partial<OptRow>) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const handleSelectChange = (key: string, value: string) => {
    if (value === "__new__") {
      const name = window.prompt("新規シーン名:");
      if (name && name.trim()) {
        const trimmed = name.trim();
        let newId = "";
        mutate((d) => {
          const env = makeDraftParseEnv(d, { toast });
          newId = env.ensureScene(trimmed);
        });
        updateRow(key, { target: newId, branch: "" });
      }
      return;
    }
    if (value) updateRow(key, { target: value, branch: "" });
    else updateRow(key, { target: null });
  };

  const addRow = () => setRows((prev) => [...prev, { key: uid(), text: "", target: null, branch: "" }]);
  const removeRow = (key: string) => setRows((prev) => prev.filter((r) => r.key !== key));

  const handleSave = () => {
    const parsed = rows
      .map((r) => ({ text: r.text.trim(), target: r.target, branch: r.target ? "" : r.branch.trim() }))
      .filter((o) => o.text);
    if (!parsed.length) {
      toast("選択肢を1つ以上入力してください", true);
      return;
    }

    let branchError: string | null = null;
    for (const o of parsed) {
      if (o.target || !o.branch) continue;
      const err = parseInputDry(o.branch, project, currentSpeaker, { sticky: false });
      if (err) {
        branchError = `「${o.text}」の返答: ${err}`;
        break;
      }
    }
    if (branchError) {
      toast(branchError, true);
      return;
    }

    const sceneId = scene.id;
    const editingIndex = cmdIndex;
    const selIndexAtSave = editorUi.selIndex;
    let newSelIndex = selIndexAtSave;

    mutate((d) => {
      const sc = d.scenes.find((s) => s.id === sceneId)!;
      const env = makeDraftParseEnv(d, { toast });
      const cmd: ChoiceCommand = { type: "choice", options: parsed.map((o) => ({ text: o.text, target: o.target })) };
      let ci: number;
      if (editingIndex !== null) {
        ci = editingIndex;
        sc.commands[ci] = carryTr(sc.commands[ci], cmd);
      } else {
        ci = selIndexAtSave === null ? sc.commands.length : selIndexAtSave + 1;
        sc.commands.splice(ci, 0, cmd);
        if (selIndexAtSave !== null) newSelIndex = ci;
      }

      const branchCmdList = parsed.map((o) => {
        if (o.target || !o.branch) return null;
        const r = parseInput(o.branch, env, currentSpeaker, { sticky: false });
        return r.kind === "command" ? r.cmd : null;
      });
      const needsSplit = branchCmdList.some(Boolean);

      if (needsSplit) {
        const tail = sc.commands.splice(ci + 1);
        let mergeId: string | null = null;
        if (tail.length) {
          let n = 2;
          let mergeName = sc.name + "の続き";
          while (d.scenes.some((s) => s.name === mergeName)) mergeName = sc.name + "の続き" + n++;
          const mergeScene = { id: uid(), name: mergeName, commands: tail, groupId: sc.groupId, synopsis: "" };
          d.scenes.push(mergeScene);
          mergeId = mergeScene.id;
        }
        parsed.forEach((o, idx) => {
          if (o.target) return;
          const branchCmd = branchCmdList[idx];
          if (branchCmd) {
            const branchCmds = [branchCmd];
            if (mergeId) branchCmds.push({ type: "jump", target: mergeId });
            let n = 2;
            let branchName = o.text || "分岐";
            while (d.scenes.some((s) => s.name === branchName)) branchName = (o.text || "分岐") + n++;
            const branchScene = { id: uid(), name: branchName, commands: branchCmds, groupId: sc.groupId, synopsis: "" };
            d.scenes.push(branchScene);
            cmd.options[idx].target = branchScene.id;
          } else if (mergeId) {
            cmd.options[idx].target = mergeId;
          }
        });
      }
    });

    if (selIndexAtSave !== null) editorUi.setSelIndex(newSelIndex);
    onClose();
  };

  const grouped = project.sceneGroups.length > 0;

  return (
    <Modal open={true} onRequestClose={onClose}>
      <ModalTitle>選択肢の編集</ModalTitle>
      <div id="choiceOptList">
        {rows.map((r, i) => (
          <div key={r.key} className="opt-item mb-2">
            <div className="opt-row flex gap-2 items-center">
              <input
                ref={i === 0 ? firstInputRef : undefined}
                type="text"
                placeholder="選択肢の文"
                value={r.text}
                onChange={(e) => updateRow(r.key, { text: e.target.value })}
                className="flex-1"
              />
              <select value={r.target ?? ""} onChange={(e) => handleSelectChange(r.key, e.target.value)} className="w-[170px] shrink-0">
                <option value="">（続行 — 飛ばない）</option>
                {grouped
                  ? project.sceneGroups.map((g) => (
                      <optgroup key={g.id} label={g.name}>
                        {project.scenes.filter((s) => s.groupId === g.id).map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </optgroup>
                    ))
                  : project.scenes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                {grouped && project.scenes.some((s) => !s.groupId) && (
                  <optgroup label="未分類">
                    {project.scenes.filter((s) => !s.groupId).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                <option value="__new__">＋ 新規シーン作成…</option>
              </select>
              <button className="mini-btn" title="削除" onClick={() => removeRow(r.key)}>
                <Icon name="trash-2" />
              </button>
            </div>
            <div className={`opt-branch-row flex gap-1.5 items-center mt-1 ml-5 ${r.target ? "hidden" : ""}`}>
              <span className="text-text-dim text-xs shrink-0">└</span>
              <input
                type="text"
                placeholder="この選択肢だけの短い返答（任意・自動で合流先へつながります）"
                value={r.branch}
                onChange={(e) => updateRow(r.key, { branch: e.target.value })}
                className="flex-1 text-sm"
              />
            </div>
          </div>
        ))}
      </div>
      <button onClick={addRow}>
        <Icon name="plus" />
        選択肢を追加
      </button>
      <ModalFoot>
        <button onClick={onClose}>キャンセル</button>
        <button className="btn-primary" onClick={handleSave}>
          保存
        </button>
      </ModalFoot>
    </Modal>
  );
}
