import type { MouseEvent } from "react";
import { Icon } from "../common/Icon";
import { CommandLineContent } from "./CommandLineContent";
import type { ClickInfo } from "../../lib/editClickMapping";
import { computeClickInfo } from "../../lib/editClickMapping";
import type { Character, Command, Scene } from "../../types/project";
import type { CharLookup } from "../../lib/text";

interface Props {
  index: number;
  cmd: Command;
  broken: boolean;
  selected: boolean;
  multiSelected: boolean;
  honorIssues: string[];
  acked: boolean;
  characters: Character[];
  scenes: Scene[];
  findChar: CharLookup;
  onDelete: () => void;
  onDup: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEdit: (clickInfo: ClickInfo | null) => void;
  onGotoScene: (sceneId: string) => void;
  onToggleHonorAck: () => void;
  onShiftSelect: () => void;
  onContextMenu: (x: number, y: number) => void;
}

export function CommandRow({
  index,
  cmd,
  broken,
  selected,
  multiSelected,
  honorIssues,
  acked,
  characters,
  scenes,
  findChar,
  onDelete,
  onDup,
  onMoveUp,
  onMoveDown,
  onEdit,
  onGotoScene,
  onToggleHonorAck,
  onShiftSelect,
  onContextMenu,
}: Props) {
  const handleClick = (e: MouseEvent) => {
    const act = (e.target as HTMLElement).closest("[data-act]")?.getAttribute("data-act");
    if (act === "del") return onDelete();
    if (act === "dup") return onDup();
    if (act === "edit") return onEdit(null);
    if (act === "up") return onMoveUp();
    if (act === "down") return onMoveDown();
    if (act === "goto-scene" || act === "honor-ack") return; // これらは各要素側で処理・伝播停止済み
    if (e.shiftKey) return onShiftSelect();
    onEdit(computeClickInfo(e, cmd, characters, scenes, findChar));
  };

  return (
    <div
      className={`cmd-row group flex items-start gap-2 px-2 py-1 my-px rounded-md relative border leading-relaxed cursor-pointer${
        broken ? " alert bg-danger-bg" : ""
      }${selected ? " selected bg-bg-3 border-accent" : " border-transparent hover:bg-bg-2"}${multiSelected ? "" : ""}`}
      style={multiSelected ? { background: "color-mix(in srgb, var(--accent) 13%, transparent)", outline: "1px dashed var(--accent)", outlineOffset: "-2px" } : undefined}
      data-idx={index}
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(e.clientX, e.clientY);
      }}
    >
      <span className="drag-handle invisible group-hover:visible pt-1" title="ドラッグで並べ替え">
        <Icon name="grip-vertical" />
      </span>
      <span className="row-num w-8 shrink-0 text-right text-[#565d6e] text-[11px] pt-0.5 select-none">{index + 1}</span>
      <div className="row-body flex-1 min-w-0 break-words whitespace-pre-wrap">
        <CommandLineContent
          cmd={cmd}
          findChar={findChar}
          scenes={scenes}
          honorIssues={honorIssues}
          acked={acked}
          onToggleHonorAck={onToggleHonorAck}
          onGotoScene={onGotoScene}
        />
      </div>
      <span className="row-actions hidden group-hover:flex absolute right-1.5 top-0.5 gap-0.5 bg-bg-3 rounded px-0.5 py-px">
        <button data-act="up" title="上へ移動 (Ctrl+↑)" className="mini-btn">
          <Icon name="chevron-up" />
        </button>
        <button data-act="down" title="下へ移動 (Ctrl+↓)" className="mini-btn">
          <Icon name="chevron-down" />
        </button>
        <button data-act="dup" title="複製 (Ctrl+D)" className="mini-btn">
          <Icon name="copy" />
        </button>
        <button data-act="edit" title="編集 (Enter)" className="mini-btn">
          <Icon name="pencil" />
        </button>
        <button data-act="del" title="削除 (Del)" className="mini-btn">
          <Icon name="trash-2" />
        </button>
      </span>
    </div>
  );
}
