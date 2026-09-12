import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../common/Icon";
import { RenameInput } from "../common/RenameInput";
import type { SceneGroup } from "../../types/project";

interface Props {
  group: SceneGroup | null;
  count: number;
  collapsed: boolean;
  renaming: boolean;
  onToggleCollapse: () => void;
  onStartRename: () => void;
  onCommitRename: (name: string) => void;
  onCancelRename: () => void;
  onDelete: () => void;
  onAddScene: () => void;
}

export function SceneGroupHeader({
  group,
  count,
  collapsed,
  renaming,
  onToggleCollapse,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onDelete,
  onAddScene,
}: Props) {
  const { t } = useTranslation();
  const isUngrouped = !group;

  if (renaming && group) {
    return (
      <div className="scene-group-head flex items-center gap-1 px-1.5 py-1 mt-1.5">
        <RenameInput initial={group.name} onCommit={onCommitRename} onCancel={onCancelRename} />
      </div>
    );
  }

  const handleClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-act]")) return;
    if (!isUngrouped) onToggleCollapse();
  };
  const handleDoubleClick = () => {
    if (!isUngrouped) onStartRename();
  };

  return (
    <div
      className={`scene-group-head flex items-center gap-1 px-1.5 py-1 mt-1.5 rounded-md relative text-text-dim text-xs font-bold group${
        isUngrouped ? " ungrouped cursor-default" : " cursor-pointer hover:bg-bg-3 hover:text-text"
      }`}
      data-group-id={isUngrouped ? "" : group!.id}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {!isUngrouped && (
        <span className="drag-handle invisible group-hover:visible -ml-1" title={t("common.dragToReorder")}>
          <Icon name="grip-vertical" />
        </span>
      )}
      <span className="inline-flex shrink-0">
        <Icon name={collapsed ? "chevron-right" : "chevron-down"} />
      </span>
      <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{isUngrouped ? t("scene.ungrouped") : group!.name}</span>
      <span className="text-text-dim text-[11px]">{count}</span>
      {!isUngrouped && (
        <span className="hidden group-hover:flex gap-0.5">
          <button className="mini-btn" data-act="add" title={t("scene.addSceneToGroupTitle")} onClick={onAddScene}>
            <Icon name="plus" />
          </button>
          <button className="mini-btn" data-act="ren" title={t("scene.rename")} onClick={onStartRename}>
            <Icon name="pencil" />
          </button>
          <button className="mini-btn" data-act="del" title={t("scene.deleteGroupTitle")} onClick={onDelete}>
            <Icon name="trash-2" />
          </button>
        </span>
      )}
    </div>
  );
}
