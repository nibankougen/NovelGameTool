import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useProjectStore } from "../../state/ProjectProvider";
import { useEditorUi } from "../../state/EditorUiContext";
import { useToast } from "../common/ToastProvider";
import { Modal, ModalFoot, ModalHeader } from "./Modal";
import { Icon } from "../common/Icon";
import { PALETTE } from "../../types/project";
import { uid } from "../../lib/id";
import { faceUsageCounts } from "../../lib/sceneUtils";
import { hasFileDrag, firstImageFile } from "../../lib/image";
import { deleteAssetFile, writeAssetFile } from "../../lib/projectFs";
import { useAssetUrl } from "../../hooks/useAssetUrl";
import { loadGlobalExprTemplate, saveGlobalExprTemplate } from "../../state/projectReducer";
import { ExpressionTagEditor, type StagedExpr } from "./ExpressionTagEditor";
import { ImageThumbButton } from "../common/ImageThumbButton";

export function CharacterModal({ open, charId, onClose }: { open: boolean; charId: string | null; onClose: () => void }) {
  return open ? <CharacterModalInner key={charId ?? "new"} charId={charId} onClose={onClose} /> : null;
}

function CharacterModalInner({ charId, onClose }: { charId: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { project, mutate, dirHandle } = useProjectStore();
  const editorUi = useEditorUi();
  const toast = useToast();
  const existing = charId ? (project.characters.find((c) => c.id === charId) ?? null) : null;

  const [name, setName] = useState(existing?.name ?? "");
  const [color, setColor] = useState(existing?.color ?? PALETTE[project.characters.length % PALETTE.length]);
  const [thumb, setThumb] = useState<string | null>(existing?.thumb ?? null);
  const thumbUrl = useAssetUrl(thumb);
  const [memo, setMemo] = useState(existing?.memo ?? "");
  const [staged, setStaged] = useState<StagedExpr[]>(() =>
    existing
      ? existing.expressions.map((n) => ({ orig: n, name: n, img: existing.exprImages[n] ?? null }))
      : project.exprTemplate.map((n) => ({ orig: null, name: n, img: null })),
  );
  const [exprInputText, setExprInputText] = useState("");
  const [dragOverThumb, setDragOverThumb] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const initialFocusRef = useRef(false);

  const usageCounts = useMemo(() => (existing ? faceUsageCounts(project.scenes, existing.id) : new Map<string, number>()), [project.scenes, existing]);

  const [initialSnapshot] = useState(() => JSON.stringify({ name, color, thumb, memo, staged }));
  const isDirty = () => JSON.stringify({ name, color, thumb, memo, staged }) !== initialSnapshot;

  const flushExprInput = () => {
    const trimmedInput = exprInputText.trim();
    if (!trimmedInput) return;
    const parts = trimmedInput
      .split(/[,、，]/)
      .map((s) => s.trim())
      .filter(Boolean);
    setStaged((prev) => {
      const next = [...prev];
      for (const n of parts) if (!next.some((s) => s.name === n)) next.push({ orig: usageCounts.has(n) ? n : null, name: n, img: null });
      return next;
    });
    setExprInputText("");
  };

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast(t("characterModal.nameRequired"), true);
      return;
    }
    if (project.characters.some((c) => c.name === trimmed && c.id !== charId)) {
      toast(t("characterModal.duplicateName"), true);
      return;
    }
    flushExprInput();
    const expressions = staged.map((s) => s.name);
    const exprImages: Record<string, string> = {};
    for (const s of staged) if (s.img) exprImages[s.name] = s.img;
    const renamedPairs = staged.filter((s) => s.orig && s.orig !== s.name).map((s) => [s.orig as string, s.name] as const);

    if (dirHandle && existing) {
      const stillUsed = new Set([thumb, ...Object.values(exprImages)].filter((v): v is string => !!v));
      const oldPaths = [existing.thumb, ...Object.values(existing.exprImages)].filter((v): v is string => !!v);
      for (const p of oldPaths) if (!stillUsed.has(p)) void deleteAssetFile(dirHandle, p);
    }

    if (existing) {
      const targetId = existing.id;
      mutate((d) => {
        const c = d.characters.find((c) => c.id === targetId);
        if (!c) return;
        c.name = trimmed;
        c.color = color;
        c.memo = memo;
        c.thumb = thumb;
        c.expressions = expressions;
        c.exprImages = exprImages;
        if (renamedPairs.length) {
          for (const sc of d.scenes)
            for (const cmd of sc.commands)
              if (cmd.type === "serif" && cmd.chara === targetId) {
                for (const [from, to] of renamedPairs) if (cmd.face === from) cmd.face = to;
              }
        }
      });
      if (editorUi.speakerId === targetId && editorUi.speakerFace) {
        const pair = renamedPairs.find(([from]) => from === editorUi.speakerFace);
        if (pair) editorUi.setSpeaker(targetId, pair[1]);
        else if (!expressions.includes(editorUi.speakerFace)) editorUi.setSpeaker(targetId, null);
      }
    } else {
      const newId = uid();
      mutate((d) => {
        d.characters.push({ id: newId, name: trimmed, color, memo, thumb, expressions, exprImages });
      });
      editorUi.setSpeaker(newId);
    }
    onClose();
  };

  const handleDelete = () => {
    if (!existing) return;
    if (!window.confirm(t("characterModal.confirmDelete", { name: existing.name }))) return;
    const targetId = existing.id;
    if (dirHandle) {
      const paths = [existing.thumb, ...Object.values(existing.exprImages)].filter((v): v is string => !!v);
      for (const p of paths) void deleteAssetFile(dirHandle, p);
    }
    mutate((d) => {
      for (const sc of d.scenes)
        for (const cmd of sc.commands) if (cmd.type === "serif" && cmd.chara === targetId) cmd.chara = null;
      d.characters = d.characters.filter((c) => c.id !== targetId);
      d.honorificRules = d.honorificRules.filter((r) => r.speakerId !== targetId && r.targetId !== targetId);
    });
    if (editorUi.speakerId === targetId) editorUi.setSpeaker(null);
    onClose();
  };

  const canClose = () => {
    if (!isDirty()) return true;
    return window.confirm(t("characterModal.confirmDiscard"));
  };

  const saveExprTemplate = () => {
    flushExprInput();
    const names = staged.map((s) => s.name);
    mutate((d) => {
      d.exprTemplate = names;
    });
    const g = loadGlobalExprTemplate();
    if (g.enabled) saveGlobalExprTemplate({ enabled: true, template: names });
    toast(t("characterModal.exprTemplateSaved"));
  };

  const applyExprTemplate = () => {
    let added = 0;
    setStaged((prev) => {
      const next = [...prev];
      for (const n of project.exprTemplate) if (!next.some((s) => s.name === n)) { next.push({ orig: null, name: n, img: null }); added++; }
      return next;
    });
    toast(added ? t("characterModal.exprTemplateAdded", { count: added }) : t("characterModal.exprTemplateAlreadyApplied"));
  };

  return (
    <Modal open={true} onRequestClose={onClose} canClose={canClose}>
      <ModalHeader>{existing ? t("characterModal.editTitle") : t("characterModal.addTitle")}</ModalHeader>
      <div className="flex gap-2 items-center mb-2.5">
        <label className="w-[70px] shrink-0 text-text-dim">{t("characterModal.nameLabel")}</label>
        <input
          ref={(el) => {
            nameRef.current = el;
            if (el && !initialFocusRef.current) {
              initialFocusRef.current = true;
              el.focus();
            }
          }}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
          }}
          className="flex-1"
        />
      </div>
      <div className="flex gap-2 items-center mb-2.5">
        <label className="w-[70px] shrink-0 text-text-dim">{t("characterModal.colorLabel")}</label>
        <div className="flex gap-1.5 flex-wrap">
          {PALETTE.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setColor(p)}
              aria-pressed={color === p}
              title={p}
              className="w-[26px] h-[26px] min-h-0 rounded-md cursor-pointer"
              style={{
                background: p,
                boxShadow: color === p ? "0 0 0 2px var(--bg-2), 0 0 0 4px var(--accent)" : "0 0 0 2px transparent",
              }}
            />
          ))}
        </div>
      </div>
      <div className="flex gap-2 items-center mb-2.5">
        <label className="w-[70px] shrink-0"></label>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-[60px] h-[30px] p-0.5" />
      </div>
      <div
        className={`flex gap-2 items-center mb-2.5 ${dragOverThumb ? "outline outline-2 outline-dashed outline-accent outline-offset-[3px] rounded-lg" : ""}`}
        title={t("characterModal.thumbDropHint")}
        onDragOver={(e) => {
          if (!hasFileDrag(e)) return;
          e.preventDefault();
          setDragOverThumb(true);
        }}
        onDragLeave={() => setDragOverThumb(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOverThumb(false);
          if (!dirHandle) return;
          const file = firstImageFile(e);
          if (!file) {
            toast(t("characterModal.dropImageFile"), true);
            return;
          }
          writeAssetFile(dirHandle, "characters", file).then(setThumb);
        }}
      >
        <label className="w-[70px] shrink-0 text-text-dim leading-tight">
          {t("characterModal.defaultIllustration")}
          <br />
          {t("characterModal.illustration")}
        </label>
        <ImageThumbButton
          img={thumbUrl}
          own={!!thumb}
          title={thumb ? t("characterModal.removeImage") : t("characterModal.setDefaultIllustration")}
          onPick={(file) => dirHandle && writeAssetFile(dirHandle, "characters", file).then(setThumb)}
          onRemove={() => setThumb(null)}
        />
      </div>
      <div className="flex gap-2 mb-2.5 items-start">
        <label className="w-[70px] shrink-0 pt-1.5 text-text-dim">{t("characterModal.expressionLabel")}</label>
        <div className="flex-1 min-w-0">
          <ExpressionTagEditor staged={staged} setStaged={setStaged} usageCounts={usageCounts} thumb={thumb} inputText={exprInputText} setInputText={setExprInputText} />
          <div className="flex gap-1.5 mt-1.5 items-center min-w-0">
            <button type="button" onClick={applyExprTemplate} className="text-[11px] text-text-dim px-2 py-0.5" title={t("characterModal.applyExprTemplateTitle")}>
              {t("characterModal.applyExprTemplate")}
            </button>
            <button
              type="button"
              onClick={saveExprTemplate}
              className="text-[11px] text-text-dim px-2 py-0.5"
              title={t("characterModal.saveExprTemplateTitle")}
            >
              {t("characterModal.saveExprTemplate")}
            </button>
          </div>
        </div>
      </div>
      <div className="flex gap-2 mb-2.5 items-start">
        <label className="w-[70px] shrink-0 pt-1.5 text-text-dim">{t("characterModal.memoLabel")}</label>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder={t("characterModal.memoPlaceholder")}
          className="flex-1 min-h-[70px] resize-y leading-relaxed"
        />
      </div>
      <ModalFoot>
        {existing && (
          <button className="btn-danger mr-auto" onClick={handleDelete}>
            <Icon name="trash-2" />
            {t("common.delete")}
          </button>
        )}
        <button
          onClick={() => {
            if (canClose()) onClose();
          }}
        >
          {t("common.cancel")}
        </button>
        <button className="btn-primary" onClick={handleSave}>
          {t("common.save")}
        </button>
      </ModalFoot>
    </Modal>
  );
}
