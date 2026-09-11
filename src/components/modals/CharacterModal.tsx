import { useMemo, useRef, useState } from "react";
import { useProjectStore } from "../../state/ProjectProvider";
import { useEditorUi } from "../../state/EditorUiContext";
import { useToast } from "../common/ToastProvider";
import { Modal, ModalFoot, ModalTitle } from "./Modal";
import { Icon } from "../common/Icon";
import { PALETTE } from "../../types/project";
import { uid } from "../../lib/id";
import { faceUsageCounts } from "../../lib/sceneUtils";
import { loadImageAsThumb, hasFileDrag, firstImageFile } from "../../lib/image";
import { loadGlobalExprTemplate, saveGlobalExprTemplate } from "../../state/projectReducer";
import { ExpressionTagEditor, type StagedExpr } from "./ExpressionTagEditor";

export function CharacterModal({ open, charId, onClose }: { open: boolean; charId: string | null; onClose: () => void }) {
  return open ? <CharacterModalInner key={charId ?? "new"} charId={charId} onClose={onClose} /> : null;
}

function CharacterModalInner({ charId, onClose }: { charId: string | null; onClose: () => void }) {
  const { project, mutate } = useProjectStore();
  const editorUi = useEditorUi();
  const toast = useToast();
  const existing = charId ? (project.characters.find((c) => c.id === charId) ?? null) : null;

  const [name, setName] = useState(existing?.name ?? "");
  const [color, setColor] = useState(existing?.color ?? PALETTE[project.characters.length % PALETTE.length]);
  const [thumb, setThumb] = useState<string | null>(existing?.thumb ?? null);
  const [memo, setMemo] = useState(existing?.memo ?? "");
  const [staged, setStaged] = useState<StagedExpr[]>(() =>
    existing
      ? existing.expressions.map((n) => ({ orig: n, name: n, img: existing.exprImages[n] ?? null }))
      : project.exprTemplate.map((n) => ({ orig: null, name: n, img: null })),
  );
  const [exprInputText, setExprInputText] = useState("");
  const [dragOverThumb, setDragOverThumb] = useState(false);
  const [globalTmpl, setGlobalTmpl] = useState(() => loadGlobalExprTemplate());
  const thumbFileRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const initialFocusRef = useRef(false);

  const usageCounts = useMemo(() => (existing ? faceUsageCounts(project.scenes, existing.id) : new Map<string, number>()), [project.scenes, existing]);

  const [initialSnapshot] = useState(() => JSON.stringify({ name, color, thumb, memo, staged }));
  const isDirty = () => JSON.stringify({ name, color, thumb, memo, staged }) !== initialSnapshot;

  const flushExprInput = () => {
    const t = exprInputText.trim();
    if (!t) return;
    const parts = t
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
      toast("名前を入力してください", true);
      return;
    }
    if (project.characters.some((c) => c.name === trimmed && c.id !== charId)) {
      toast("同じ名前のキャラクターが既に存在します", true);
      return;
    }
    flushExprInput();
    const expressions = staged.map((s) => s.name);
    const exprImages: Record<string, string> = {};
    for (const s of staged) if (s.img) exprImages[s.name] = s.img;
    const renamedPairs = staged.filter((s) => s.orig && s.orig !== s.name).map((s) => [s.orig as string, s.name] as const);

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
    if (!window.confirm(`キャラクター「${existing.name}」を削除しますか？（このキャラクターのセリフは地の文になります）`)) return;
    const targetId = existing.id;
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
    return window.confirm("編集内容が保存されていません。閉じてもよいですか？");
  };

  const saveExprTemplate = () => {
    flushExprInput();
    const names = staged.map((s) => s.name);
    mutate((d) => (d.exprTemplate = names));
    if (globalTmpl.enabled) {
      const next = { enabled: true, template: names };
      setGlobalTmpl(next);
      saveGlobalExprTemplate(next);
    }
    toast("表情テンプレートを保存しました");
  };

  const applyExprTemplate = () => {
    let added = 0;
    setStaged((prev) => {
      const next = [...prev];
      for (const n of project.exprTemplate) if (!next.some((s) => s.name === n)) { next.push({ orig: null, name: n, img: null }); added++; }
      return next;
    });
    toast(added ? `テンプレートから${added}件追加しました` : "テンプレートはすでに適用されています");
  };

  return (
    <Modal open={true} onRequestClose={onClose} canClose={canClose}>
      <ModalTitle>{existing ? "キャラクター編集" : "キャラクター追加"}</ModalTitle>
      <div className="flex gap-2 items-center mb-2.5">
        <label className="w-[70px] shrink-0 text-text-dim">名前</label>
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
        <label className="w-[70px] shrink-0 text-text-dim">色</label>
        <div className="flex gap-1.5 flex-wrap">
          {PALETTE.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setColor(p)}
              aria-pressed={color === p}
              title={p}
              className="w-[26px] h-[26px] rounded-md cursor-pointer"
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
        title="画像ファイルをドラッグ&ドロップでも設定できます"
        onDragOver={(e) => {
          if (!hasFileDrag(e)) return;
          e.preventDefault();
          setDragOverThumb(true);
        }}
        onDragLeave={() => setDragOverThumb(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOverThumb(false);
          const file = firstImageFile(e);
          if (!file) {
            toast("画像ファイルをドロップしてください", true);
            return;
          }
          loadImageAsThumb(file).then(setThumb);
        }}
      >
        <label className="w-[70px] shrink-0 text-text-dim leading-tight">
          デフォルト
          <br />
          イラスト
        </label>
        <img
          src={thumb ?? undefined}
          alt=""
          className="w-16 h-16 rounded-lg object-cover border border-border bg-bg-3"
          style={{ visibility: thumb ? "visible" : "hidden" }}
        />
        <button type="button" onClick={() => thumbFileRef.current?.click()} title="キャラの基本イラスト。表情画像を設定していない表情ではこの画像が使われます">
          <Icon name="image" />
          画像を選択…
        </button>
        {thumb && (
          <button type="button" onClick={() => setThumb(null)}>
            <Icon name="x" />
            画像を外す
          </button>
        )}
        <input
          ref={thumbFileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) loadImageAsThumb(file).then(setThumb);
          }}
        />
        <span className="text-text-dim text-[11px]">またはドラッグ&ドロップ</span>
      </div>
      <div className="flex gap-2 mb-2.5 items-start">
        <label className="w-[70px] shrink-0 pt-1.5 text-text-dim">表情</label>
        <div className="flex-1 min-w-0">
          <ExpressionTagEditor staged={staged} setStaged={setStaged} usageCounts={usageCounts} thumb={thumb} inputText={exprInputText} setInputText={setExprInputText} />
          <div className="flex gap-1.5 mt-1.5 items-center min-w-0">
            <button type="button" onClick={applyExprTemplate} className="text-[11px] text-text-dim px-2 py-0.5" title="保存済みテンプレートの表情をこのキャラクターに追加します">
              テンプレを適用
            </button>
            <button
              type="button"
              onClick={saveExprTemplate}
              className="text-[11px] text-text-dim px-2 py-0.5"
              title="現在の表情一覧をテンプレートとして保存します。以後の新規キャラクターに自動適用されます"
            >
              この表情をテンプレに保存
            </button>
            <label className="flex items-center gap-1 text-[11px] text-text-dim cursor-pointer shrink-0 whitespace-nowrap">
              <input
                type="checkbox"
                checked={globalTmpl.enabled}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  const next = { enabled, template: enabled ? staged.map((s) => s.name) : globalTmpl.template };
                  setGlobalTmpl(next);
                  saveGlobalExprTemplate(next);
                }}
                className="accent-accent"
              />
              新規プロジェクトにも引き継ぐ
            </label>
          </div>
        </div>
      </div>
      <div className="flex gap-2 mb-2.5 items-start">
        <label className="w-[70px] shrink-0 pt-1.5 text-text-dim">メモ</label>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="設定メモ（口調、外見、関係など）。ゲーム用出力には含まれません"
          className="flex-1 min-h-[70px] resize-y leading-relaxed"
        />
      </div>
      <ModalFoot>
        {existing && (
          <button className="btn-danger mr-auto" onClick={handleDelete}>
            <Icon name="trash-2" />
            削除
          </button>
        )}
        <button
          onClick={() => {
            if (canClose()) onClose();
          }}
        >
          キャンセル
        </button>
        <button className="btn-primary" onClick={handleSave}>
          保存
        </button>
      </ModalFoot>
    </Modal>
  );
}
