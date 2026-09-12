import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "./Icon";

interface Props {
  /** 表示する画像（自前の画像、または継承したプレビュー画像） */
  img: string | null;
  /** trueなら自前の画像が設定済み＝クリックで削除。falseなら未設定＝クリックで選択 */
  own: boolean;
  /** 継承プレビューなど、薄く表示したい場合 */
  dimmed?: boolean;
  onPick: (file: File) => void;
  onRemove: () => void;
  title?: string;
  className?: string;
}

/** 表情画像・デフォルトイラスト共通の画像設定ボタン。画像がある間はホバーで削除アイコンをオーバーレイする */
export function ImageThumbButton({ img, own, dimmed, onPick, onRemove, title, className }: Props) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (own) onRemove();
    else fileInputRef.current?.click();
  };

  return (
    <>
      {img ? (
        <div
          className={`group/thumb relative w-16 h-16 rounded-lg shrink-0 cursor-pointer overflow-hidden bg-bg-2 ${className ?? ""}`}
          title={title ?? (own ? t("imageThumb.clickToRemove") : t("imageThumb.clickToSet"))}
          onClick={handleClick}
        >
          <img src={img} alt="" className={`w-full h-full object-cover ${dimmed ? "opacity-35" : ""}`} />
          {own && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-white opacity-0 group-hover/thumb:opacity-100 transition-opacity">
              <Icon name="trash-2" />
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          className={`w-16 h-16 min-h-0 rounded-lg border border-dashed border-border shrink-0 text-text-dim bg-transparent ${className ?? ""}`}
          title={title ?? t("imageThumb.setImage")}
          onClick={handleClick}
        >
          <Icon name="image" />
        </button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onPick(file);
        }}
      />
    </>
  );
}
