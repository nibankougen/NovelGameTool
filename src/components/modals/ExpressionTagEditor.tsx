import { useRef, useState } from "react";
import { Icon } from "../common/Icon";
import { loadImageAsThumb, hasFileDrag, firstImageFile } from "../../lib/image";
import { useToast } from "../common/ToastProvider";

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
  const fileTargetRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      <div className="flex flex-wrap gap-1.5 mb-1.5 text-xs leading-relaxed" title="各表情のタグに画像ファイルをドラッグ&ドロップでも設定できます">
        {staged.map((s, i) => {
          const count = usageCounts.get(s.name) ?? 0;
          const img = s.img || (thumb ? thumb : null);
          const isDefaultPreview = !s.img && !!thumb;
          return (
            <span
              key={i}
              className={`expr-tag inline-flex items-center gap-1.5 py-0.5 px-2.5 rounded-full border border-border ${count === 0 ? "text-text-dim border-dashed bg-transparent" : "bg-bg-3"} ${dragHoverIndex === i ? "outline outline-2 outline-dashed outline-accent -outline-offset-1" : ""}`}
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
              {img && (
                <img
                  className={`et-img w-[22px] h-[22px] rounded object-cover shrink-0 cursor-pointer bg-bg-2 ${isDefaultPreview ? "opacity-35" : ""}`}
                  src={img}
                  alt=""
                  onClick={() => {
                    if (s.img) {
                      setStaged((prev) => prev.map((x, xi) => (xi === i ? { ...x, img: null } : x)));
                    } else {
                      fileTargetRef.current = i;
                      fileInputRef.current?.click();
                    }
                  }}
                />
              )}
              {!img && (
                <button
                  type="button"
                  className="et-btn border-none bg-transparent p-0 min-h-0 text-text-dim"
                  title="表情画像を設定"
                  onClick={() => {
                    fileTargetRef.current = i;
                    fileInputRef.current?.click();
                  }}
                >
                  <Icon name="image" />
                </button>
              )}
              {renamingIndex === i ? (
                <input
                  autoFocus
                  type="text"
                  defaultValue={s.name}
                  className="et-input text-xs py-0.5 px-1.5 w-[110px]"
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
                <span className="cursor-pointer" onClick={() => setRenamingIndex(i)}>
                  {s.name}
                </span>
              )}
              <span className="expr-n text-text-dim text-[11px]">{count > 0 ? `${count}回` : "未使用"}</span>
              <button
                type="button"
                className="et-btn border-none bg-transparent p-0 min-h-0 text-text-dim"
                title="名前変更"
                onClick={() => setRenamingIndex(i)}
              >
                <Icon name="pencil" />
              </button>
              <button
                type="button"
                className="et-btn border-none bg-transparent p-0 min-h-0 text-text-dim"
                title="削除"
                onClick={() => {
                  if (count > 0 && !window.confirm(`表情「${s.name}」は${count}箇所で使用中です。削除すると使用箇所は警告表示になります。削除しますか？`)) return;
                  setStaged((prev) => prev.filter((_, xi) => xi !== i));
                }}
              >
                <Icon name="x" />
              </button>
            </span>
          );
        })}
        {usedButMissing.map((name) => (
          <span
            key={`missing-${name}`}
            className="expr-tag missing inline-flex items-center gap-1.5 py-0.5 px-2.5 rounded-full border border-danger text-danger cursor-pointer"
            title="使用中だが候補から外れています。クリックで候補に戻す"
            onClick={() => addNames(name)}
          >
            <Icon name="triangle-alert" />
            <span className="expr-n text-danger text-[11px]">{name}</span>
          </span>
        ))}
        {!staged.length && !usedButMissing.length && <span className="expr-none text-text-dim">表情が登録されていません</span>}
      </div>
      <input
        type="text"
        className="w-full"
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
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          const i = fileTargetRef.current;
          if (!file || i === null) return;
          loadImageAsThumb(file).then((dataUrl) => {
            setStaged((prev) => prev.map((x, xi) => (xi === i ? { ...x, img: dataUrl } : x)));
          });
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
