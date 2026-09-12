import { useEffect, type MouseEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useModalRegistry } from "./ModalRegistry";
import { Icon } from "../common/Icon";

export interface ModalProps {
  open: boolean;
  onRequestClose: () => void;
  /** falseを返すとクローズを拒否する（キャラ編集画面の未保存確認など） */
  canClose?: () => boolean;
  className?: string;
  children: ReactNode;
  /** trueの場合、既定のカード用クラス（背景・枠・パディング等）を付けずchildrenをそのまま描画する（テストプレイの舞台など専用レイアウト向け） */
  bare?: boolean;
}

export function Modal({ open, onRequestClose, canClose, className, children, bare }: ModalProps) {
  const { register } = useModalRegistry();

  useEffect(() => {
    if (!open) return;
    return register(() => {
      if (!canClose || canClose()) onRequestClose();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, register]);

  if (!open) return null;

  const handleBackdropMouseDown = (e: MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    if (!canClose || canClose()) onRequestClose();
  };

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/60"
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        className={
          bare
            ? className
            : `bg-bg-2 border border-border rounded-xl p-5 min-w-[420px] max-w-[640px] max-h-[85vh] overflow-y-auto shadow-2xl ${className ?? ""}`
        }
      >
        {children}
      </div>
    </div>
  );
}

export function ModalTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-base font-semibold flex items-center gap-1.5">{children}</h3>;
}

export function ModalFoot({ children }: { children: ReactNode }) {
  return <div className="flex gap-2 justify-end mt-4">{children}</div>;
}

export function ModalCloseButton({ onClick, className }: { onClick: () => void; className?: string }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={`mini-btn${className ? ` ${className}` : ""}`}
      onClick={onClick}
      title={t("common.closeWithEsc")}
      aria-label={t("common.close")}
    >
      <Icon name="x" />
    </button>
  );
}

/**
 * モーダル見出し行。タイトルと（あれば）右上の閉じるボタンを同じ行に並べる。
 * 余白はこの行自身に持たせ、ModalTitle 側には持たせない
 * （タイトルだけに margin-bottom を付けると、閉じるボタンとの flex 縦中央揃えが
 * マージンの分だけずれてしまうため）。
 */
export function ModalHeader({ children, onClose, className }: { children: ReactNode; onClose?: () => void; className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 mb-3.5${className ? ` ${className}` : ""}`}>
      <ModalTitle>{children}</ModalTitle>
      {onClose && <ModalCloseButton onClick={onClose} className="ml-auto" />}
    </div>
  );
}
