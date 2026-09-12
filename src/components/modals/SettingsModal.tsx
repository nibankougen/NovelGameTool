import { useTranslation } from "react-i18next";
import { useAppActions, type ThemeChoice } from "../../state/AppActionsContext";
import { Modal, ModalHeader } from "./Modal";
import { Icon, type IconName } from "../common/Icon";
import { SUPPORTED_LANGUAGES, LANGUAGE_LABELS } from "../../lib/language";

const THEME_OPTIONS: { value: ThemeChoice; labelKey: string; icon: IconName }[] = [
  { value: null, labelKey: "settings.theme.followOs", icon: "settings" },
  { value: "light", labelKey: "settings.theme.light", icon: "sun" },
  { value: "dark", labelKey: "settings.theme.dark", icon: "moon" },
];

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const a = useAppActions();

  return (
    <Modal open={open} onRequestClose={onClose} className="min-w-[420px]">
      <ModalHeader>
        <Icon name="settings" /> {t("settings.title")}
      </ModalHeader>

      <div className="mb-5">
        <div className="text-text-dim text-xs mb-2">{t("settings.language.label")}</div>
        <div className="flex gap-1.5 flex-wrap" role="radiogroup" aria-label={t("settings.language.label")}>
          {SUPPORTED_LANGUAGES.map((code) => {
            const active = a.uiLanguage === code;
            return (
              <button
                key={code}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => a.setUiLanguage(code)}
                className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-lg border text-xs ${active ? "bg-accent-dim border-accent text-text" : "border-border text-text-dim hover:bg-bg-3"
                  }`}
              >
                {LANGUAGE_LABELS[code]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-5">
        <div className="text-text-dim text-xs mb-2">{t("settings.theme.label")}</div>
        <div className="flex gap-1.5" role="radiogroup" aria-label={t("settings.theme.ariaLabel")}>
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
                {t(opt.labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-5">
        <div className="text-text-dim text-xs mb-2">{t("settings.exprTemplate.label")}</div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={a.exprTemplateCarryOver}
            onChange={(e) => a.setExprTemplateCarryOver(e.target.checked)}
            className="accent-accent"
          />
          {t("settings.exprTemplate.carryOver")}
        </label>
        <p className="text-text-dim text-[11px] mt-2">{t("settings.exprTemplate.desc")}</p>
      </div>

      <div className="mb-1">
        <div className="text-text-dim text-xs mb-2">{t("settings.thumbSize.label")}</div>
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
          <span className="text-xs text-text-dim w-8 text-right">{t("settings.thumbSize.unit", { n: a.thumbSizeStep + 1 })}</span>
        </div>
        <p className="text-text-dim text-[11px] mt-2">{t("settings.thumbSize.desc")}</p>
      </div>
    </Modal>
  );
}
