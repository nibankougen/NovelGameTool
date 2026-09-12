import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../common/Icon";
import { useAssetUrl } from "../../hooks/useAssetUrl";
import type { Character } from "../../types/project";

interface Props {
  character: Character;
  hotkeyIndex: number | null;
  memoOpen: boolean;
  onEdit: () => void;
  onToggleMemo: () => void;
  onSelectSpeaker: () => void;
}

export function CharacterRow({ character: c, hotkeyIndex, memoOpen, onEdit, onToggleMemo, onSelectSpeaker }: Props) {
  const { t } = useTranslation();
  const thumbUrl = useAssetUrl(c.thumb);
  const handleClick = (e: MouseEvent) => {
    const act = (e.target as HTMLElement).closest("[data-act]")?.getAttribute("data-act");
    if (act === "edit") onEdit();
    else if (act === "memo") onToggleMemo();
    else onSelectSpeaker();
  };

  return (
    <div
      className="char-item group flex items-center gap-1.5 px-2 py-1 my-0.5 rounded-md cursor-pointer border border-transparent hover:bg-bg-3 relative"
      title={t("character.rowTitle")}
      data-char-id={c.id}
      onClick={handleClick}
    >
      <span className="drag-handle invisible group-hover:visible" title={t("common.dragToReorder")}>
        <Icon name="grip-vertical" />
      </span>
      {thumbUrl ? (
        <img className="w-5 h-5 rounded object-cover shrink-0 bg-bg-3" src={thumbUrl} alt="" />
      ) : (
        <span className="inline-block w-3 h-3 rounded shrink-0" style={{ background: c.color }} />
      )}
      <span className="c-name flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-medium" style={{ color: c.color }}>
        {c.name}
      </span>
      {hotkeyIndex !== null && <span className="text-text-dim text-[11px]">Ctrl+{hotkeyIndex + 1}</span>}
      <span className="hidden group-hover:flex gap-0.5">
        <button className="mini-btn" data-act="edit" title={t("character.edit")}>
          <Icon name="pencil" />
        </button>
      </span>
      <button className="mini-btn" data-act="memo" title={t("character.toggleMemo")}>
        <Icon name={memoOpen ? "chevron-down" : "chevron-right"} />
      </button>
    </div>
  );
}
