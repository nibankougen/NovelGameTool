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
    toast("ゲーム用データを書き出しました");
  };

  return (
    <Modal open={open} onRequestClose={onClose}>
      <ModalHeader>ゲーム用ファイル書き出しの設定</ModalHeader>
      <p className="text-text-dim text-xs mb-3.5">設定メモ・デフォルトイラスト・表情画像は常に出力されません。この設定はプロジェクトに保存されます。</p>
      <CheckRow label="表情を出力" desc="キャラの表情候補（expressions）とセリフの face" checked={cfg.face} onChange={(v) => setCfg({ face: v })} />
      <CheckRow label="シーン名を出力" desc="scenes[].name（ID参照のみなら不要）" checked={cfg.sceneName} onChange={(v) => setCfg({ sceneName: v })} />
      <CheckRow label="キャラクターの色を出力" desc="名前表示色（color）" checked={cfg.color} onChange={(v) => setCfg({ color: v })} />
      <CheckRow label="コメント行を出力" desc={'// のメモ行（type: "comment"）'} checked={cfg.comment} onChange={(v) => setCfg({ comment: v })} />
      <CheckRow label="整形して出力" desc="インデント付きJSON（オフで圧縮出力）" checked={cfg.pretty} onChange={(v) => setCfg({ pretty: v })} />
      <ModalFoot>
        <button onClick={onClose}>キャンセル</button>
        <button className="btn-primary" onClick={handleExport}>
          書き出し
        </button>
      </ModalFoot>
    </Modal>
  );
}
