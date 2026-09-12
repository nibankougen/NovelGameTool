import { useState } from "react";
import { useProjectStore } from "../../state/ProjectProvider";
import { useToast } from "../common/ToastProvider";
import { useDragReorder } from "../../hooks/useDragReorder";
import { eventKeyUsageCounts } from "../../lib/sceneUtils";
import { uid } from "../../lib/id";
import { Modal, ModalHeader } from "./Modal";
import { Icon } from "../common/Icon";
import type { EventKeyValueType } from "../../types/project";

const VALUE_TYPE_LABELS: Record<EventKeyValueType, string> = {
  none: "なし",
  number: "数値",
  string: "文字列",
};

export function EventKeysModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { project, patch } = useProjectStore();
  const toast = useToast();
  const [inputText, setInputText] = useState("");

  const usageCounts = eventKeyUsageCounts(project.scenes);

  const drag = useDragReorder<HTMLDivElement>({
    itemSelector: ".event-key-row",
    onDrop: (from, to) => {
      if (from === to) return;
      patch((d) => {
        const [k] = d.eventKeys.splice(from, 1);
        d.eventKeys.splice(to, 0, k);
      });
    },
  });

  const addKeys = () => {
    const parts = inputText
      .split(/[,、，]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return;
    let rejected = false;
    patch((d) => {
      for (const name of parts) {
        if (d.eventKeys.some((k) => k.name === name)) {
          rejected = true;
          continue;
        }
        d.eventKeys.push({ id: uid(), name, valueType: "none" });
      }
    });
    if (rejected) toast("同じ名前のイベントキーはスキップしました", true);
    setInputText("");
  };

  const renameKey = (id: string, name: string) => {
    if (project.eventKeys.some((k) => k.id !== id && k.name === name)) {
      toast(`イベントキー「${name}」はすでに存在します`, true);
      return;
    }
    patch((d) => {
      const k = d.eventKeys.find((k) => k.id === id);
      if (k) k.name = name;
    });
  };

  const setValueType = (id: string, valueType: EventKeyValueType) => {
    patch((d) => {
      const k = d.eventKeys.find((k) => k.id === id);
      if (k) k.valueType = valueType;
      // 型が変わると既存の値と矛盾しうるので、このキーの付与値は全セリフから一旦クリアする
      for (const sc of d.scenes)
        for (const cmd of sc.commands)
          if (cmd.type === "serif" && cmd.events) for (const e of cmd.events) if (e.keyId === id) delete e.value;
    });
  };

  const removeKey = (id: string, name: string) => {
    const count = usageCounts.get(id) ?? 0;
    if (count > 0 && !window.confirm(`イベントキー「${name}」は${count}件のセリフで使用中です。削除するとそれらのセリフからも外れます。削除しますか？`)) return;
    patch((d) => {
      d.eventKeys = d.eventKeys.filter((k) => k.id !== id);
      for (const sc of d.scenes)
        for (const cmd of sc.commands)
          if (cmd.type === "serif" && cmd.events) {
            cmd.events = cmd.events.filter((e) => e.keyId !== id);
            if (!cmd.events.length) delete cmd.events;
          }
    });
  };

  return (
    <Modal open={open} onRequestClose={onClose} className="w-[92vw] max-w-[600px] h-[70vh] max-h-[70vh] flex flex-col">
      <ModalHeader onClose={onClose}>
        <Icon name="tag" /> イベントキー管理
      </ModalHeader>
      <p className="text-text-dim text-xs mb-3 shrink-0">
        セリフに付与できるカスタムイベントの種類を登録します。付与したセリフはゲーム用ファイルの書き出しに含まれます。値の種類を設定すると、セリフごとに数値または文字列を指定できます。
      </p>
      <div className="flex-1 overflow-y-auto min-h-0">
        {!project.eventKeys.length && <p className="text-text-dim text-xs mb-3">イベントキーが登録されていません</p>}
        <div ref={drag.containerRef} onMouseDown={drag.onMouseDown} className="flex flex-col gap-0.5">
          {project.eventKeys.map((k) => (
            <div key={k.id} className="event-key-row group flex items-center gap-2 py-1.5 px-1 border-b border-hairline">
              <span className="drag-handle invisible group-hover:visible" title="ドラッグで並べ替え">
                <Icon name="grip-vertical" />
              </span>
              <input
                type="text"
                defaultValue={k.name}
                className="flex-1 min-w-0 text-sm"
                onBlur={(e) => renameKey(k.id, e.target.value.trim() || k.name)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
              />
              <select
                value={k.valueType}
                className="text-xs w-24"
                onChange={(e) => setValueType(k.id, e.target.value as EventKeyValueType)}
              >
                {(Object.keys(VALUE_TYPE_LABELS) as EventKeyValueType[]).map((vt) => (
                  <option key={vt} value={vt}>
                    {VALUE_TYPE_LABELS[vt]}
                  </option>
                ))}
              </select>
              <span className="text-text-dim text-[11px] w-16 shrink-0 text-right">
                {usageCounts.get(k.id) ? `使用${usageCounts.get(k.id)}回` : "未使用"}
              </span>
              <button className="mini-btn" title="削除" onClick={() => removeKey(k.id, k.name)}>
                <Icon name="trash-2" />
              </button>
            </div>
          ))}
        </div>
      </div>
      <input
        type="text"
        className="w-full mt-2.5 shrink-0"
        placeholder="イベントキーを追加（カンマ区切りで複数可）"
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            addKeys();
          }
        }}
      />
    </Modal>
  );
}
