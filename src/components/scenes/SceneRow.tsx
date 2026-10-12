import { useState, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../common/Icon";
import { RenameInput } from "../common/RenameInput";
import { ContextMenu } from "../common/ContextMenu";
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
  onDuplicate: () => void;
  onToggleHidden: () => void;
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
  onDuplicate,
  onToggleHidden,
  onDelete,
}: Props) {
  const { t } = useTranslation();
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  if (renaming) {
    return (
      <div className={`scene-item flex items-center gap-1.5 px-2 py-1 my-0.5 rounded-md${indented ? " grouped ml-4" : ""}`}>
        <RenameInput initial={scene.name} onCommit={onCommitRename} onCancel={onCancelRename} />
      </div>
    );
  }

  const handleClick = (e: MouseEvent) => {
    const act = (e.target as HTMLElement).closest("[data-act]")?.getAttribute("data-act");
    if (act === "visibility") {
      onToggleHidden();
      return;
    }
    if (act === "menu") {
      return;
    }
    onSelect(e.shiftKey);
  };

  return (
    <>
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
      <button
        className="mini-btn"
        data-act="visibility"
        title={t(scene.hidden ? "scene.show" : "scene.hide")}
        aria-label={t("scene.hidden")}
        aria-pressed={!!scene.hidden}
      >
        <Icon name={scene.hidden ? "eye-off" : "eye"} />
      </button>
      <span className={`s-name flex-1 overflow-hidden text-ellipsis whitespace-nowrap${scene.hidden ? " text-text-dim" : ""}`}>{scene.name}</span>
      {hasAlert && (
        <span className="text-danger inline-flex shrink-0" title={t("scene.brokenRefWarning")}>
          <Icon name="triangle-alert" />
        </span>
      )}
      <span className="text-text-dim text-[11px]">{scene.commands.length}</span>
      <button
        className="mini-btn"
        data-act="menu"
        title={t("common.moreMenu")}
        aria-label={t("common.moreMenu")}
        aria-expanded={menu !== null}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setMenu(menu ? null : { x: rect.left, y: rect.bottom });
        }}
      >
        <Icon name="ellipsis" />
      </button>
    </div>
    {menu && (
      <ContextMenu
        x={menu.x}
        y={menu.y}
        onClose={() => setMenu(null)}
        items={[
          { label: t("scene.rename"), onClick: onStartRename },
          { label: t("scene.duplicate"), onClick: onDuplicate },
          { label: t(memoOpen ? "scene.hideSynopsis" : "scene.showSynopsis"), onClick: onToggleMemo },
          { label: t("common.delete"), icon: "trash-2", danger: true, onClick: onDelete },
        ]}
      />
    )}
    </>
  );
}
