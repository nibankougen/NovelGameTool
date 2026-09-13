import { Trans, useTranslation } from "react-i18next";
import { useProjectStore } from "../../state/ProjectProvider";
import { Modal, ModalHeader } from "./Modal";
import { Icon } from "../common/Icon";
import { ANONYMOUS_LABEL_DEFAULT } from "../../types/project";
import { LANGUAGE_LABELS, isSupportedLanguage } from "../../lib/language";

function langLabel(code: string): string {
  return isSupportedLanguage(code) ? LANGUAGE_LABELS[code] : code;
}

export function AnonymityModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { project, patch } = useProjectStore();

  const setLabel = (code: string, value: string) => {
    patch((d) => {
      const v = value.trim();
      if (v) d.anonymousLabel[code] = v;
      else delete d.anonymousLabel[code];
    });
  };

  const codes = [project.baseLanguage, ...project.languages];

  return (
    <Modal open={open} onRequestClose={onClose} className="w-[92vw] max-w-[520px]">
      <ModalHeader onClose={onClose}>
        <Icon name="venetian-mask" /> {t("anonymity.title")}
      </ModalHeader>
      <p className="text-text-dim text-xs leading-relaxed mb-3.5">
        <Trans
          i18nKey="anonymity.intro"
          components={[<Icon key="0" name="ellipsis" className="inline" />, <Icon key="1" name="venetian-mask" className="inline" />]}
        />
      </p>
      <div className="flex flex-col gap-2">
        {codes.map((code, i) => (
          <label key={code} className="flex items-center gap-2.5 text-sm">
            <span className="w-28 shrink-0 text-text-dim text-xs">
              {langLabel(code)}
              {i === 0 && <span className="text-text-faint">（{t("anonymity.baseLanguageSuffix")}）</span>}
            </span>
            <input
              type="text"
              defaultValue={project.anonymousLabel[code] ?? ""}
              placeholder={ANONYMOUS_LABEL_DEFAULT}
              className="flex-1 min-w-0 text-sm"
              onBlur={(e) => setLabel(code, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
            />
          </label>
        ))}
      </div>
    </Modal>
  );
}
