import { useState } from "react";
import { Icon } from "../common/Icon";
import { ImageThumbButton } from "../common/ImageThumbButton";
import { loadImageAsThumb, hasFileDrag, firstImageFile } from "../../lib/image";
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

export function ExpressionTagEditor({ staged, setStaged, usageCounts, thumb, inputText, setInputText }: Props) {
  const toast = useToast();
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
          toast(`表情「${name}」はすでに追加されています`, true);
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
        title="各表情に画像ファイルをドラッグ&ドロップでも設定できます。左端のハンドルをドラッグで並べ替え"
      >
        {staged.map((s, i) => {
          const count = usageCounts.get(s.name) ?? 0;
          const img = s.img || (thumb ? thumb : null);
          const isDefaultPreview = !s.img && !!thumb;
          return (
            <div
              key={i}
              className={`expr-row group flex items-center gap-2.5 py-1.5 px-2 rounded-lg border ${count === 0 ? "text-text-dim border-dashed border-border bg-transparent" : "border-border bg-accent-dim/25"} ${dragHoverIndex === i ? "outline outline-2 outline-dashed outline-accent -outline-offset-1" : ""}`}
              onDragOver={(e) => {
                if (!hasFileDrag(e)) return;
                e.preventDefault();
                setDragHoverIndex(i);
              }}
              onDragLeave={() => setDragHoverIndex((v) => (v === i ? null : v))}
              onDrop={(e) => {
                e.preventDefault();
                setDragHoverIndex(null);
                const file = firstImageFile(e);
                if (!file) {
                  toast("画像ファイルをドロップしてください", true);
                  return;
                }
                loadImageAsThumb(file).then((dataUrl) => {
                  setStaged((prev) => prev.map((x, xi) => (xi === i ? { ...x, img: dataUrl } : x)));
                });
              }}
            >
              <span className="drag-handle invisible group-hover:visible" title="ドラッグで並べ替え">
                <Icon name="grip-vertical" />
              </span>
              <ImageThumbButton
                img={img}
                own={!!s.img}
                dimmed={isDefaultPreview}
                title={s.img ? "クリックで画像を外す" : "デフォルトイラストを使用中（クリックで個別に設定）"}
                onPick={(file) =>
                  loadImageAsThumb(file).then((dataUrl) => {
                    setStaged((prev) => prev.map((x, xi) => (xi === i ? { ...x, img: dataUrl } : x)));
                  })
                }
                onRemove={() => setStaged((prev) => prev.map((x, xi) => (xi === i ? { ...x, img: null } : x)))}
              />
              <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                {renamingIndex === i ? (
                  <input
                    autoFocus
                    type="text"
                    defaultValue={s.name}
                    className="text-sm py-1 px-2 w-full min-w-0"
                    onFocus={(e) => e.target.select()}
                    onBlur={(e) => commitRename(i, e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") commitRename(i, e.currentTarget.value);
                      if (e.key === "Escape") {
                        e.stopPropagation();
                        setRenamingIndex(null);
                      }
                    }}
                  />
                ) : (
                  <span className="cursor-pointer font-medium truncate" onClick={() => setRenamingIndex(i)}>
                    {s.name}
                  </span>
                )}
                <span className="text-text-dim text-[11px]">{count > 0 ? `使用回数: ${count}回` : "未使用"}</span>
              </div>
              <button
                type="button"
                className="border-none bg-transparent p-1 min-h-0 text-text-dim shrink-0"
                title="名前変更"
                onClick={() => setRenamingIndex(i)}
              >
                <Icon name="pencil" />
              </button>
              <button
                type="button"
                className="border-none bg-transparent p-1 min-h-0 text-text-dim shrink-0"
                title="削除"
                onClick={() => {
                  if (count > 0 && !window.confirm(`表情「${s.name}」は${count}箇所で使用中です。削除すると使用箇所は警告表示になります。削除しますか？`)) return;
                  setStaged((prev) => prev.filter((_, xi) => xi !== i));
                }}
              >
                <Icon name="x" />
              </button>
            </div>
          );
        })}
        {usedButMissing.map((name) => (
          <div
            key={`missing-${name}`}
            className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg border border-danger text-danger cursor-pointer"
            title="使用中の表情が候補から外れています。クリックで候補に戻す"
            onClick={() => addNames(name)}
          >
            <Icon name="triangle-alert" />
            <span className="text-[11px]">{name}</span>
          </div>
        ))}
        {!staged.length && !usedButMissing.length && <div className="text-text-dim">表情が登録されていません</div>}
      </div>
      <input
        type="text"
        className="w-full"
        placeholder="表情を追加"
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
      toast(`表情「${v}」はすでに存在します`, true);
      return;
    }
    setStaged((prev) => prev.map((x, xi) => (xi === i ? { ...x, name: v } : x)));
  }
}
