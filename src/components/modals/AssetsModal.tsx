import { useMemo, useRef } from "react";
import { useProjectStore } from "../../state/ProjectProvider";
import { useToast } from "../common/ToastProvider";
import { Modal, ModalHeader } from "./Modal";
import { Icon } from "../common/Icon";
import { collectAssetNames } from "../../lib/assetUsage";
import { loadImageAsThumb, fileToDataUrl, hasFileDrag, firstFile } from "../../lib/image";
import type { ProjectAssets } from "../../types/project";

function ImageAssetRow({ name, src, onSet, onRemove }: { name: string; src: string | undefined; onSet: (dataUrl: string) => void; onRemove: () => void }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
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
          toast("画像ファイルをドロップしてください", true);
          return;
        }
        loadImageAsThumb(file).then(onSet);
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
      <button onClick={() => fileRef.current?.click()}>選択…</button>
      {src && (
        <button onClick={onRemove}>
          <Icon name="x" />
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
          if (file) loadImageAsThumb(file).then(onSet);
        }}
      />
    </div>
  );
}

function AudioAssetRow({ name, src, onSet, onRemove }: { name: string; src: string | undefined; onSet: (dataUrl: string) => void; onRemove: () => void }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
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
          toast("音声ファイルをドロップしてください", true);
          return;
        }
        fileToDataUrl(file).then(onSet);
      }}
    >
      <span className="w-8 shrink-0 flex items-center justify-center text-text-dim">
        <Icon name="music" />
      </span>
      <span className="w-32 shrink-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm">{name}</span>
      {src && <audio controls src={src} className="h-8 flex-1 min-w-0" />}
      {!src && <span className="flex-1 text-text-dim text-xs">未登録</span>}
      <button onClick={() => fileRef.current?.click()}>選択…</button>
      {src && (
        <button onClick={onRemove}>
          <Icon name="x" />
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
          if (file) fileToDataUrl(file).then(onSet);
        }}
      />
    </div>
  );
}

export function AssetsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { project, mutate } = useProjectStore();

  const names = useMemo(() => collectAssetNames(project), [project.scenes]);

  const setAsset = (kind: keyof ProjectAssets, name: string, dataUrl: string) =>
    mutate((d) => {
      d.assets[kind][name] = dataUrl;
    });
  const removeAsset = (kind: keyof ProjectAssets, name: string) =>
    mutate((d) => {
      delete d.assets[kind][name];
    });

  return (
    <Modal open={open} onRequestClose={onClose} className="w-[92vw] max-w-[700px] h-[80vh] max-h-[80vh] flex flex-col">
      <ModalHeader onClose={onClose}>
        <Icon name="music" /> 素材管理
      </ModalHeader>
      <p className="text-text-dim text-xs mb-3 shrink-0">
        シナリオ中で使われている背景・BGM・効果音の名前に、テストプレイで実際に描画・再生する画像/音声ファイルを紐付けます。未登録のものはラベル表示のみになります（プロジェクトに保存されます）。
      </p>
      <div className="flex-1 overflow-y-auto min-h-0">
        <h4 className="text-accent font-semibold text-sm mb-1.5 mt-2">背景画像</h4>
        {!names.bg.length && <p className="text-text-dim text-xs mb-3">/bg で使われている名前はまだありません</p>}
        {names.bg.map((n) => (
          <ImageAssetRow key={n} name={n} src={project.assets.bg[n]} onSet={(v) => setAsset("bg", n, v)} onRemove={() => removeAsset("bg", n)} />
        ))}
        <h4 className="text-accent font-semibold text-sm mb-1.5 mt-4">BGM</h4>
        {!names.bgm.length && <p className="text-text-dim text-xs mb-3">/bgm で使われている名前はまだありません</p>}
        {names.bgm.map((n) => (
          <AudioAssetRow key={n} name={n} src={project.assets.bgm[n]} onSet={(v) => setAsset("bgm", n, v)} onRemove={() => removeAsset("bgm", n)} />
        ))}
        <h4 className="text-accent font-semibold text-sm mb-1.5 mt-4">効果音</h4>
        {!names.se.length && <p className="text-text-dim text-xs mb-3">/se で使われている名前はまだありません</p>}
        {names.se.map((n) => (
          <AudioAssetRow key={n} name={n} src={project.assets.se[n]} onSet={(v) => setAsset("se", n, v)} onRemove={() => removeAsset("se", n)} />
        ))}
      </div>
    </Modal>
  );
}
