import { useTranslation } from "react-i18next";
import { useProjectStore } from "../../state/ProjectProvider";
import { useCharLookup } from "../../hooks/useCharLookup";
import { useToast } from "../common/ToastProvider";
import { Modal, ModalFoot, ModalHeader } from "./Modal";
import { download, safeName } from "../../lib/download";
import { gameExportData } from "../../lib/gameExport";
import type { ExportSettings } from "../../types/project";

function CheckRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-baseline gap-2 mb-2.5 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-accent shrink-0 relative top-0.5" />
      <span>{label}</span>
      <span className="text-text-dim text-xs flex-1">{desc}</span>
    </label>
  );
}

export function ExportGameModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { project, mutate } = useProjectStore();
  const findChar = useCharLookup();
  const toast = useToast();
  const cfg = project.exportSettings;

  const setCfg = (patch: Partial<ExportSettings>) =>
    mutate((d) => {
      Object.assign(d.exportSettings, patch);
    });

  const handleExport = () => {
    const data = gameExportData(project, cfg, findChar);
    download(`${safeName(project.title)}.game.json`, cfg.pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data), "application/json");
    onClose();
    toast(t("exportGame.exported"));
  };

  return (
    <Modal open={open} onRequestClose={onClose}>
      <ModalHeader>{t("exportGame.title")}</ModalHeader>
      <p className="text-text-dim text-xs mb-3.5">{t("exportGame.intro")}</p>
      <CheckRow label={t("exportGame.face.label")} desc={t("exportGame.face.desc")} checked={cfg.face} onChange={(v) => setCfg({ face: v })} />
      <CheckRow label={t("exportGame.sceneName.label")} desc={t("exportGame.sceneName.desc")} checked={cfg.sceneName} onChange={(v) => setCfg({ sceneName: v })} />
      <CheckRow label={t("exportGame.color.label")} desc={t("exportGame.color.desc")} checked={cfg.color} onChange={(v) => setCfg({ color: v })} />
      <CheckRow label={t("exportGame.comment.label")} desc={t("exportGame.comment.desc")} checked={cfg.comment} onChange={(v) => setCfg({ comment: v })} />
      <CheckRow label={t("exportGame.pretty.label")} desc={t("exportGame.pretty.desc")} checked={cfg.pretty} onChange={(v) => setCfg({ pretty: v })} />
      <ModalFoot>
        <button onClick={onClose}>{t("common.cancel")}</button>
        <button className="btn-primary" onClick={handleExport}>
          {t("exportGame.exportButton")}
        </button>
      </ModalFoot>
    </Modal>
  );
}
