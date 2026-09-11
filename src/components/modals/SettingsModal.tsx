import { useAppActions, type ThemeChoice } from "../../state/AppActionsContext";
import { Modal, ModalHeader } from "./Modal";
import { Icon, type IconName } from "../common/Icon";

const THEME_OPTIONS: { value: ThemeChoice; label: string; icon: IconName }[] = [
  { value: null, label: "OS設定に従う", icon: "settings" },
  { value: "light", label: "ライト", icon: "sun" },
  { value: "dark", label: "ダーク", icon: "moon" },
];

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const a = useAppActions();

  return (
    <Modal open={open} onRequestClose={onClose} className="min-w-[420px]">
      <ModalHeader>
        <Icon name="settings" /> 設定
      </ModalHeader>

      <div className="mb-5">
        <div className="text-text-dim text-xs mb-2">テーマ</div>
        <div className="flex gap-1.5" role="radiogroup" aria-label="テーマ">
          {THEME_OPTIONS.map((opt) => {
            const active = a.theme === opt.value;
            return (
              <button
                key={String(opt.value)}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => a.setTheme(opt.value)}
                className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-lg border text-xs ${active ? "bg-accent-dim border-accent text-text" : "border-border text-text-dim hover:bg-bg-3"
                  }`}
              >
                <Icon name={opt.icon} />
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-5">
        <div className="text-text-dim text-xs mb-2">表情テンプレート</div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={a.exprTemplateCarryOver}
            onChange={(e) => a.setExprTemplateCarryOver(e.target.checked)}
            className="accent-accent"
          />
          新規プロジェクトにも引き継ぐ
        </label>
        <p className="text-text-dim text-[11px] mt-2">キャラクター編集で保存した表情テンプレートを、新規プロジェクト作成時のデフォルト表情候補として使うかどうかの設定です。</p>
      </div>

      <div className="mb-1">
        <div className="text-text-dim text-xs mb-2">行のサムネイル表示サイズ</div>
        <div className="flex items-center gap-3">
          <Icon name="image" className="text-text-dim" />
          <input
            type="range"
            min={0}
            max={3}
            step={1}
            value={a.thumbSizeStep}
            onChange={(e) => a.setThumbSizeStep(parseInt(e.target.value, 10))}
            className="flex-1 accent-accent cursor-pointer"
          />
          <span className="text-xs text-text-dim w-8 text-right">{a.thumbSizeStep + 1}倍</span>
        </div>
        <p className="text-text-dim text-[11px] mt-2">セリフ一覧・編集欄に表示するキャラクター画像の大きさです。</p>
      </div>
    </Modal>
  );
}
