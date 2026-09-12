import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../common/Icon";
import { RenameInput } from "../common/RenameInput";
import type { Scene } from "../../types/project";

interface Props {
  scene: Scene;
  indented: boolean;
  active: boolean;
  multiSelected: boolean;
  hasAlert: boolean;
  memoOpen: boolean;
  renaming: boolean;
  onSelect: (shiftKey: boolean) => void;
  onContextMenu: (x: number, y: number) => void;
  onToggleMemo: () => void;
  onStartRename: () => void;
  onCommitRename: (name: string) => void;
  onCancelRename: () => void;
  onDelete: () => void;
}

export function SceneRow({
  scene,
  indented,
  active,
  multiSelected,
  hasAlert,
  memoOpen,
  renaming,
  onSelect,
  onContextMenu,
  onToggleMemo,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onDelete,
}: Props) {
  const { t } = useTranslation();
  if (renaming) {
    return (
      <div className={`scene-item flex items-center gap-1.5 px-2 py-1 my-0.5 rounded-md${indented ? " grouped ml-4" : ""}`}>
        <RenameInput initial={scene.name} onCommit={onCommitRename} onCancel={onCancelRename} />
      </div>
    );
  }

  const handleClick = (e: MouseEvent) => {
    const act = (e.target as HTMLElement).closest("[data-act]")?.getAttribute("data-act");
    if (act === "del") {
      onDelete();
      return;
    }
    if (act === "ren") {
      onStartRename();
      return;
    }
    if (act === "memo") {
      onToggleMemo();
      return;
    }
    onSelect(e.shiftKey);
  };

  return (
    <div
      className={`scene-item group flex items-center gap-1.5 px-2 py-1 my-0.5 rounded-md cursor-pointer border relative${
        indented ? " grouped ml-4" : ""
      }${active ? " bg-accent-dim border-accent" : " border-transparent hover:bg-bg-3"}${multiSelected ? " outline-1 outline-dashed outline-accent -outline-offset-1" : ""}`}
      style={multiSelected ? { background: "color-mix(in srgb, var(--accent) 13%, transparent)" } : undefined}
      data-scene-id={scene.id}
      onClick={handleClick}
      onDoubleClick={(e) => {
        if (!(e.target as HTMLElement).closest("[data-act]")) onStartRename();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(e.clientX, e.clientY);
      }}
    >
      <span className="drag-handle invisible group-hover:visible" title={t("common.dragToReorder")}>
        <Icon name="grip-vertical" />
      </span>
      <span className="s-name flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{scene.name}</span>
      {hasAlert && (
        <span className="text-danger inline-flex shrink-0" title={t("scene.brokenRefWarning")}>
          <Icon name="triangle-alert" />
        </span>
      )}
      <span className="text-text-dim text-[11px]">{scene.commands.length}</span>
      <button className="mini-btn" data-act="memo" title={t("scene.toggleSynopsis")}>
        <Icon name={memoOpen ? "chevron-down" : "chevron-right"} />
      </button>
      <span className="hidden group-hover:flex gap-0.5">
        <button className="mini-btn" data-act="ren" title={t("scene.rename")}>
          <Icon name="pencil" />
        </button>
        <button className="mini-btn" data-act="del" title={t("common.delete")}>
          <Icon name="trash-2" />
        </button>
      </span>
    </div>
  );
}
