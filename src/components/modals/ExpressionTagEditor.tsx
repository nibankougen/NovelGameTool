import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../common/Icon";
import { ImageThumbButton } from "../common/ImageThumbButton";
import { hasFileDrag, firstImageFile } from "../../lib/image";
import { writeAssetFile } from "../../lib/projectFs";
import { useAssetUrl } from "../../hooks/useAssetUrl";
import { useProjectStore } from "../../state/ProjectProvider";
import { useToast } from "../common/ToastProvider";
import { useDragReorder } from "../../hooks/useDragReorder";

export interface StagedExpr {
  orig: string | null;
  name: string;
  img: string | null;
}

interface Props {
  staged: StagedExpr[];
  setStaged: (updater: (prev: StagedExpr[]) => StagedExpr[]) => void;
  usageCounts: Map<string, number>;
  thumb: string | null;
  inputText: string;
  setInputText: (v: string) => void;
}

function ExprRow({
  s,
  i,
  count,
  thumbUrl,
  dirHandle,
  dragHover,
  onDragEnter,
  onDragLeaveRow,
  renaming,
  startRename,
  commitRename,
  cancelRename,
  onDelete,
  setStaged,
}: {
  s: StagedExpr;
  i: number;
  count: number;
  thumbUrl: string | null;
  dirHandle: FileSystemDirectoryHandle | null;
  dragHover: boolean;
  onDragEnter: () => void;
  onDragLeaveRow: () => void;
  renaming: boolean;
  startRename: () => void;
  commitRename: (v: string) => void;
  cancelRename: () => void;
  onDelete: () => void;
  setStaged: (updater: (prev: StagedExpr[]) => StagedExpr[]) => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const ownUrl = useAssetUrl(s.img);
  const img = ownUrl || (s.img ? null : thumbUrl);
  const isDefaultPreview = !s.img && !!thumbUrl;

  const setImg = (path: string | null) => setStaged((prev) => prev.map((x, xi) => (xi === i ? { ...x, img: path } : x)));

  return (
    <div
      className={`expr-row group flex items-center gap-2.5 py-1.5 px-2 rounded-lg border ${count === 0 ? "text-text-dim border-dashed border-border bg-transparent" : "border-border bg-accent-dim/25"} ${dragHover ? "outline outline-2 outline-dashed outline-accent -outline-offset-1" : ""}`}
      onDragOver={(e) => {
        if (!hasFileDrag(e)) return;
        e.preventDefault();
        onDragEnter();
      }}
      onDragLeave={onDragLeaveRow}
      onDrop={(e) => {
        e.preventDefault();
        onDragLeaveRow();
        if (!dirHandle) return;
        const file = firstImageFile(e);
        if (!file) {
          toast(t("expression.dropImageFile"), true);
          return;
        }
        writeAssetFile(dirHandle, "characters", file).then(setImg);
      }}
    >
      <span className="drag-handle invisible group-hover:visible" title={t("common.dragToReorder")}>
        <Icon name="grip-vertical" />
      </span>
      <ImageThumbButton
        img={img}
        own={!!s.img}
        dimmed={isDefaultPreview}
        title={s.img ? t("expression.removeImage") : t("expression.usingDefaultIllustration")}
        onPick={(file) => dirHandle && writeAssetFile(dirHandle, "characters", file).then(setImg)}
        onRemove={() => setImg(null)}
      />
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
        {renaming ? (
          <input
            autoFocus
            type="text"
            defaultValue={s.name}
            className="text-sm py-1 px-2 w-full min-w-0"
            onFocus={(e) => e.target.select()}
            onBlur={(e) => commitRename(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") commitRename(e.currentTarget.value);
              if (e.key === "Escape") {
                e.stopPropagation();
                cancelRename();
              }
            }}
          />
        ) : (
          <span className="cursor-pointer font-medium truncate" onClick={startRename}>
            {s.name}
          </span>
        )}
        <span className="text-text-dim text-[11px]">{count > 0 ? t("expression.usedCount", { count }) : t("expression.unused")}</span>
      </div>
      <button type="button" className="border-none bg-transparent p-1 min-h-0 text-text-dim shrink-0" title={t("expression.rename")} onClick={startRename}>
        <Icon name="pencil" />
      </button>
      <button type="button" className="border-none bg-transparent p-1 min-h-0 text-text-dim shrink-0" title={t("expression.delete")} onClick={onDelete}>
        <Icon name="trash-2" />
      </button>
    </div>
  );
}

export function ExpressionTagEditor({ staged, setStaged, usageCounts, thumb, inputText, setInputText }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const { dirHandle } = useProjectStore();
  const thumbUrl = useAssetUrl(thumb);
  const [renamingIndex, setRenamingIndex] = useState<number | null>(null);
  const [dragHoverIndex, setDragHoverIndex] = useState<number | null>(null);

  const drag = useDragReorder<HTMLDivElement>({
    itemSelector: ".expr-row",
    onDrop: (from, to) => {
      if (from === to) return;
      setStaged((prev) => {
        const next = [...prev];
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item);
        return next;
      });
    },
  });

  const addNames = (raw: string): number => {
    const parts = raw
      .split(/[,、，]/)
      .map((s) => s.trim())
      .filter(Boolean);
    let added = 0;
    setStaged((prev) => {
      const next = [...prev];
      for (const name of parts) {
        if (next.some((s) => s.name === name)) {
          toast(t("expression.alreadyAdded", { name }), true);
          continue;
        }
        next.push({ orig: usageCounts.has(name) ? name : null, name, img: null });
        added++;
      }
      return next;
    });
    return added;
  };

  const commitInput = () => {
    if (inputText.trim()) addNames(inputText);
    setInputText("");
  };

  const usedButMissing = staged.length
    ? [...usageCounts.keys()].filter((name) => !staged.some((s) => s.name === name))
    : [...usageCounts.keys()];

  return (
    <div className="flex-1 min-w-0">
      <div
        ref={drag.containerRef}
        onMouseDown={drag.onMouseDown}
        className="flex flex-col gap-1.5 mb-1.5 max-h-[360px] overflow-y-auto pr-1"
        title={t("expression.dragHint")}
      >
        {staged.map((s, i) => (
          <ExprRow
            key={i}
            s={s}
            i={i}
            count={usageCounts.get(s.name) ?? 0}
            thumbUrl={thumbUrl}
            dirHandle={dirHandle}
            dragHover={dragHoverIndex === i}
            onDragEnter={() => setDragHoverIndex(i)}
            onDragLeaveRow={() => setDragHoverIndex((cur) => (cur === i ? null : cur))}
            renaming={renamingIndex === i}
            startRename={() => setRenamingIndex(i)}
            commitRename={(v) => commitRename(i, v)}
            cancelRename={() => setRenamingIndex(null)}
            onDelete={() => {
              if (usageCounts.get(s.name) && !window.confirm(t("expression.confirmDelete", { name: s.name, count: usageCounts.get(s.name) }))) return;
              setStaged((prev) => prev.filter((_, xi) => xi !== i));
            }}
            setStaged={setStaged}
          />
        ))}
        {usedButMissing.map((name) => (
          <div
            key={`missing-${name}`}
            className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg border border-danger text-danger cursor-pointer"
            title={t("expression.missingHint")}
            onClick={() => addNames(name)}
          >
            <Icon name="triangle-alert" />
            <span className="text-[11px]">{name}</span>
          </div>
        ))}
        {!staged.length && !usedButMissing.length && <div className="text-text-dim">{t("expression.empty")}</div>}
      </div>
      <input
        type="text"
        className="w-full"
        placeholder={t("expression.addPlaceholder")}
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitInput();
          } else if (e.key === "Escape" && inputText) {
            e.stopPropagation();
            setInputText("");
          }
        }}
      />
    </div>
  );

  function commitRename(i: number, rawValue: string) {
    const v = rawValue.trim();
    setRenamingIndex(null);
    if (!v) return;
    if (staged.some((s, xi) => xi !== i && s.name === v)) {
      toast(t("expression.alreadyExists", { name: v }), true);
      return;
    }
    setStaged((prev) => prev.map((x, xi) => (xi === i ? { ...x, name: v } : x)));
  }
}
