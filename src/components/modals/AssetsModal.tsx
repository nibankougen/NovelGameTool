import { useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useProjectStore } from "../../state/ProjectProvider";
import { useToast } from "../common/ToastProvider";
import { useAssetUrl } from "../../hooks/useAssetUrl";
import { Modal, ModalHeader } from "./Modal";
import { Icon } from "../common/Icon";
import { collectAssetNames } from "../../lib/assetUsage";
import { hasFileDrag, firstFile } from "../../lib/image";
import { deleteAssetFile, writeAssetFile } from "../../lib/projectFs";
import type { ProjectAssets } from "../../types/project";

function ImageAssetRow({ name, path, onPick, onRemove }: { name: string; path: string | undefined; onPick: (file: File) => void; onRemove: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const src = useAssetUrl(path ?? null);
  return (
    <div
      className="flex items-center gap-2.5 py-1.5 px-1 border-b border-hairline"
      onDragOver={(e) => {
        if (hasFileDrag(e)) e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        const file = firstFile(e);
        if (!file || !file.type.startsWith("image/")) {
          toast(t("assets.dropImageFile"), true);
          return;
        }
        onPick(file);
      }}
    >
      {src ? (
        <img src={src} alt="" className="w-12 h-8 rounded object-cover border border-border bg-bg-3 shrink-0" />
      ) : (
        <span className="w-12 h-8 rounded border border-dashed border-border shrink-0 flex items-center justify-center text-text-dim">
          <Icon name="image" />
        </span>
      )}
      <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm">{name}</span>
      <button onClick={() => fileRef.current?.click()}>{t("assets.choose")}</button>
      {path && (
        <button onClick={onRemove} title={t("common.delete")}>
          <Icon name="trash-2" />
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onPick(file);
        }}
      />
    </div>
  );
}

function AudioAssetRow({ name, path, onPick, onRemove }: { name: string; path: string | undefined; onPick: (file: File) => void; onRemove: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const src = useAssetUrl(path ?? null);
  return (
    <div
      className="flex items-center gap-2.5 py-1.5 px-1 border-b border-hairline"
      onDragOver={(e) => {
        if (hasFileDrag(e)) e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        const file = firstFile(e);
        if (!file || !file.type.startsWith("audio/")) {
          toast(t("assets.dropAudioFile"), true);
          return;
        }
        onPick(file);
      }}
    >
      <span className="w-8 shrink-0 flex items-center justify-center text-text-dim">
        <Icon name="music" />
      </span>
      <span className="w-32 shrink-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm">{name}</span>
      {src && <audio controls src={src} className="h-8 flex-1 min-w-0" />}
      {!src && <span className="flex-1 text-text-dim text-xs">{t("assets.unregistered")}</span>}
      <button onClick={() => fileRef.current?.click()}>{t("assets.choose")}</button>
      {path && (
        <button onClick={onRemove} title={t("common.delete")}>
          <Icon name="trash-2" />
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onPick(file);
        }}
      />
    </div>
  );
}

export function AssetsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { project, mutate, dirHandle } = useProjectStore();
  const toast = useToast();

  const names = useMemo(() => collectAssetNames(project), [project.scenes]);

  const pickAsset = async (kind: keyof ProjectAssets, name: string, file: File) => {
    if (!dirHandle) return;
    try {
      const newPath = await writeAssetFile(dirHandle, kind, file);
      const oldPath = project.assets[kind][name];
      if (oldPath) await deleteAssetFile(dirHandle, oldPath);
      mutate((d) => {
        d.assets[kind][name] = newPath;
      });
    } catch {
      toast(t("assets.saveFailed"), true);
    }
  };

  const removeAsset = async (kind: keyof ProjectAssets, name: string) => {
    const oldPath = project.assets[kind][name];
    if (dirHandle && oldPath) await deleteAssetFile(dirHandle, oldPath);
    mutate((d) => {
      delete d.assets[kind][name];
    });
  };

  return (
    <Modal open={open} onRequestClose={onClose} className="w-[92vw] max-w-[700px] h-[80vh] max-h-[80vh] flex flex-col">
      <ModalHeader onClose={onClose}>
        <Icon name="music" /> {t("assets.title")}
      </ModalHeader>
      <p className="text-text-dim text-xs mb-3 shrink-0">{t("assets.intro")}</p>
      <div className="flex-1 overflow-y-auto min-h-0">
        <h4 className="text-accent font-semibold text-sm mb-1.5 mt-2">{t("assets.bgHeading")}</h4>
        {!names.bg.length && <p className="text-text-dim text-xs mb-3">{t("assets.bgEmpty")}</p>}
        {names.bg.map((n) => (
          <ImageAssetRow key={n} name={n} path={project.assets.bg[n]} onPick={(f) => pickAsset("bg", n, f)} onRemove={() => removeAsset("bg", n)} />
        ))}
        <h4 className="text-accent font-semibold text-sm mb-1.5 mt-4">{t("assets.bgmHeading")}</h4>
        {!names.bgm.length && <p className="text-text-dim text-xs mb-3">{t("assets.bgmEmpty")}</p>}
        {names.bgm.map((n) => (
          <AudioAssetRow key={n} name={n} path={project.assets.bgm[n]} onPick={(f) => pickAsset("bgm", n, f)} onRemove={() => removeAsset("bgm", n)} />
        ))}
        <h4 className="text-accent font-semibold text-sm mb-1.5 mt-4">{t("assets.seHeading")}</h4>
        {!names.se.length && <p className="text-text-dim text-xs mb-3">{t("assets.seEmpty")}</p>}
        {names.se.map((n) => (
          <AudioAssetRow key={n} name={n} path={project.assets.se[n]} onPick={(f) => pickAsset("se", n, f)} onRemove={() => removeAsset("se", n)} />
        ))}
      </div>
    </Modal>
  );
}
