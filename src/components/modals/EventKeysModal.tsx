import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useProjectStore } from "../../state/ProjectProvider";
import { useToast } from "../common/ToastProvider";
import { useDragReorder } from "../../hooks/useDragReorder";
import { eventKeyUsageCounts } from "../../lib/sceneUtils";
import { uid } from "../../lib/id";
import { Modal, ModalHeader } from "./Modal";
import { Icon } from "../common/Icon";
import type { EventKeyValueType } from "../../types/project";

const VALUE_TYPES: EventKeyValueType[] = ["none", "number", "string"];

export function EventKeysModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
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
    if (rejected) toast(t("eventKeys.duplicateSkipped"), true);
    setInputText("");
  };

  const renameKey = (id: string, name: string) => {
    if (project.eventKeys.some((k) => k.id !== id && k.name === name)) {
      toast(t("eventKeys.alreadyExists", { name }), true);
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
    if (count > 0 && !window.confirm(t("eventKeys.confirmDelete", { name, count }))) return;
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
        <Icon name="tag" /> {t("eventKeys.title")}
      </ModalHeader>
      <p className="text-text-dim text-xs mb-3 shrink-0">{t("eventKeys.intro")}</p>
      <div className="flex-1 overflow-y-auto min-h-0">
        {!project.eventKeys.length && <p className="text-text-dim text-xs mb-3">{t("eventKeys.empty")}</p>}
        <div ref={drag.containerRef} onMouseDown={drag.onMouseDown} className="flex flex-col gap-0.5">
          {project.eventKeys.map((k) => (
            <div key={k.id} className="event-key-row group flex items-center gap-2 py-1.5 px-1 border-b border-hairline">
              <span className="drag-handle invisible group-hover:visible" title={t("common.dragToReorder")}>
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
                {VALUE_TYPES.map((vt) => (
                  <option key={vt} value={vt}>
                    {t(`eventKeys.valueType.${vt}`)}
                  </option>
                ))}
              </select>
              <span className="text-text-dim text-[11px] w-16 shrink-0 text-right">
                {usageCounts.get(k.id) ? t("eventKeys.usedCount", { count: usageCounts.get(k.id) }) : t("eventKeys.unused")}
              </span>
              <button className="mini-btn" title={t("eventKeys.delete")} onClick={() => removeKey(k.id, k.name)}>
                <Icon name="trash-2" />
              </button>
            </div>
          ))}
        </div>
      </div>
      <input
        type="text"
        className="w-full mt-2.5 shrink-0"
        placeholder={t("eventKeys.addPlaceholder")}
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
