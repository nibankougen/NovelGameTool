import { useState } from "react";
import { useProjectStore } from "../../state/ProjectProvider";
import { useToast } from "../common/ToastProvider";
import { useDragReorder } from "../../hooks/useDragReorder";
import { Modal, ModalTitle } from "./Modal";
import { Icon } from "../common/Icon";
import { uid } from "../../lib/id";
import { HONOR_SECOND } from "../../types/project";

function parseVocabInput(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of raw.split(/[,，、\s]+/)) {
    const t = w.trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

function isValidRegex(pattern: string): boolean {
  if (!pattern) return true;
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

export function HonorificModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { project, patch } = useProjectStore();
  const toast = useToast();
  const [vocabDraft, setVocabDraft] = useState(() => ({
    self: project.honorificVocab.self.join("、"),
    second: project.honorificVocab.second.join("、"),
    suffix: project.honorificVocab.suffix.join("、"),
  }));

  const drag = useDragReorder<HTMLDivElement>({
    itemSelector: ".honor-row",
    onDrop: (from, to) => {
      if (from === to) return;
      patch((d) => {
        const [r] = d.honorificRules.splice(from, 1);
        d.honorificRules.splice(to, 0, r);
      });
    },
  });

  const addRule = () => {
    if (!project.characters.length) {
      toast("先にキャラクターを登録してください", true);
      return;
    }
    patch((d) => {
      d.honorificRules.push({ id: uid(), speakerId: project.characters[0].id, targetId: null, pattern: "", allowBare: false });
    });
  };

  return (
    <Modal open={open} onRequestClose={onClose} className="w-[92vw] max-w-[900px] h-[86vh] max-h-[86vh] flex flex-col">
      <div className="flex items-center gap-2.5 mb-3 flex-wrap">
        <ModalTitle>
          <span className="inline-flex items-center gap-1.5">
            <Icon name="users" /> 人称チェック設定
          </span>
        </ModalTitle>
        <button onClick={onClose} className="ml-auto">
          閉じる (Esc)
        </button>
      </div>
      <p className="text-text-dim text-xs leading-relaxed mb-3 shrink-0">
        キャラクターごとに「自分をどう呼ぶか（一人称）」「相手をどう呼ぶか（二人称・名前を伴わない呼びかけ）」「他のキャラをどう呼ぶか（名前＋敬称）」を登録しておくと、登録と異なる言い回しが本文に出てきた行に小さく
        <Icon name="circle-alert" className="inline text-warn align-[-2px]" /> が付きます。簡易チェックのため参考程度にご利用ください。
      </p>
      <div className="flex flex-wrap gap-4 mb-3.5 shrink-0">
        {(
          [
            ["self", "一人称の候補語（読点・カンマ区切り）", "私, わたし, わたくし, 僕, ぼく, 俺, おれ, 自分, うち, あたし"],
            ["second", "二人称の候補語（読点・カンマ区切り）", "キミ, 君, あなた, あんた, お前, おまえ, 貴様, てめえ"],
            ["suffix", "敬称・呼び方の候補語（読点・カンマ区切り）", "さん, くん, 君, ちゃん, 様, 殿, 氏, 先輩, 先生"],
          ] as const
        ).map(([key, label, placeholder]) => (
          <label key={key} className="flex-1 basis-[220px] flex flex-col gap-1 text-xs text-text-dim">
            {label}
            <input
              type="text"
              value={vocabDraft[key]}
              placeholder={placeholder}
              className="text-sm"
              onChange={(e) => {
                const raw = e.target.value;
                setVocabDraft((v) => ({ ...v, [key]: raw }));
                const words = parseVocabInput(raw);
                patch((d) => {
                  d.honorificVocab[key] = words;
                });
              }}
            />
          </label>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 text-sm">
        <div className="grid grid-cols-[20px_1fr_1fr_2fr_74px_30px] gap-1.5 items-center px-1.5 py-1 sticky top-0 bg-bg-2 text-text-dim text-[11px] border-b border-border z-[1]">
          <span></span>
          <span>話者</span>
          <span>相手</span>
          <span>許可パターン（正規表現）</span>
          <span>呼び捨てOK</span>
          <span></span>
        </div>
        <div ref={drag.containerRef} onMouseDown={drag.onMouseDown}>
          {!project.honorificRules.length && (
            <div className="py-8 px-2.5 text-text-dim text-sm text-center leading-loose">「行を追加」からルールを登録してください</div>
          )}
          {project.honorificRules.map((r) => (
            <div key={r.id} className="honor-row grid grid-cols-[20px_1fr_1fr_2fr_74px_30px] gap-1.5 items-center px-1.5 py-1 border-b border-hairline group">
              <span className="drag-handle invisible group-hover:visible" title="ドラッグで並べ替え">
                <Icon name="grip-vertical" />
              </span>
              <select
                value={r.speakerId}
                className="w-full text-xs"
                onChange={(e) => {
                  const v = e.target.value;
                  patch((d) => {
                    const rule = d.honorificRules.find((x) => x.id === r.id);
                    if (rule) rule.speakerId = v;
                  });
                }}
              >
                {project.characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                value={r.targetId ?? ""}
                className="w-full text-xs"
                onChange={(e) => {
                  const v = e.target.value || null;
                  patch((d) => {
                    const rule = d.honorificRules.find((x) => x.id === r.id);
                    if (rule) rule.targetId = v;
                  });
                }}
              >
                <option value="">（自分＝一人称）</option>
                <option value={HONOR_SECOND}>（相手＝二人称）</option>
                {project.characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={r.pattern}
                className={`w-full text-xs ${!isValidRegex(r.pattern) ? "border-danger" : ""}`}
                onChange={(e) => {
                  const v = e.target.value;
                  patch((d) => {
                    const rule = d.honorificRules.find((x) => x.id === r.id);
                    if (rule) rule.pattern = v;
                  });
                }}
              />
              <input
                type="checkbox"
                checked={r.allowBare}
                className="accent-accent justify-self-center"
                onChange={(e) => {
                  const v = e.target.checked;
                  patch((d) => {
                    const rule = d.honorificRules.find((x) => x.id === r.id);
                    if (rule) rule.allowBare = v;
                  });
                }}
              />
              <button
                className="mini-btn justify-self-center px-1.5"
                onClick={() =>
                  patch((d) => {
                    d.honorificRules = d.honorificRules.filter((x) => x.id !== r.id);
                  })
                }
              >
                <Icon name="trash-2" />
              </button>
            </div>
          ))}
        </div>
      </div>
      <button type="button" onClick={addRule} className="mt-2.5 shrink-0">
        <Icon name="plus" />
        行を追加
      </button>
    </Modal>
  );
}
