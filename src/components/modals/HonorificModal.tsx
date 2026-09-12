import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useProjectStore } from "../../state/ProjectProvider";
import { useToast } from "../common/ToastProvider";
import { useDragReorder } from "../../hooks/useDragReorder";
import { Modal, ModalHeader } from "./Modal";
import { Icon } from "../common/Icon";
import { uid } from "../../lib/id";
import { HONOR_SECOND } from "../../types/project";

const TARGET_FILTER_ALL = "__all__";

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
  const { t } = useTranslation();
  const { project, patch } = useProjectStore();
  const toast = useToast();
  const [vocabDraft, setVocabDraft] = useState(() => ({
    self: project.honorificVocab.self.join("、"),
    second: project.honorificVocab.second.join("、"),
    suffix: project.honorificVocab.suffix.join("、"),
  }));

  // フィルター: 話者は ""=すべて、相手は TARGET_FILTER_ALL=すべて／""=自分(一人称)／HONOR_SECOND=相手(二人称)／それ以外=キャラid
  const [speakerFilter, setSpeakerFilter] = useState("");
  const [targetFilter, setTargetFilter] = useState(TARGET_FILTER_ALL);

  useEffect(() => {
    if (speakerFilter && !project.characters.some((c) => c.id === speakerFilter)) setSpeakerFilter("");
    if (
      targetFilter !== TARGET_FILTER_ALL &&
      targetFilter !== "" &&
      targetFilter !== HONOR_SECOND &&
      !project.characters.some((c) => c.id === targetFilter)
    ) {
      setTargetFilter(TARGET_FILTER_ALL);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.characters]);

  const filtersActive = speakerFilter !== "" || targetFilter !== TARGET_FILTER_ALL;

  const visibleRules = useMemo(
    () =>
      project.honorificRules.filter((r) => {
        if (speakerFilter && r.speakerId !== speakerFilter) return false;
        if (targetFilter !== TARGET_FILTER_ALL && (r.targetId ?? "") !== targetFilter) return false;
        return true;
      }),
    [project.honorificRules, speakerFilter, targetFilter],
  );

  const drag = useDragReorder<HTMLDivElement>({
    itemSelector: ".honor-row",
    onDrop: (from, to) => {
      if (from === to || filtersActive) return;
      patch((d) => {
        const [r] = d.honorificRules.splice(from, 1);
        d.honorificRules.splice(to, 0, r);
      });
    },
  });

  const addRule = () => {
    if (!project.characters.length) {
      toast(t("honorific.registerCharacterFirst"), true);
      return;
    }
    const speakerId = (speakerFilter && project.characters.some((c) => c.id === speakerFilter) ? speakerFilter : null) ?? project.characters[0].id;
    const targetId = targetFilter === TARGET_FILTER_ALL ? null : targetFilter || null;
    patch((d) => {
      d.honorificRules.push({ id: uid(), speakerId, targetId, pattern: "", allowBare: false });
    });
  };

  const resetFilters = () => {
    setSpeakerFilter("");
    setTargetFilter(TARGET_FILTER_ALL);
  };

  return (
    <Modal open={open} onRequestClose={onClose} className="w-[92vw] max-w-[900px] h-[86vh] max-h-[86vh] flex flex-col">
      <ModalHeader onClose={onClose}>
        <Icon name="users" /> {t("honorific.title")}
      </ModalHeader>
      <p className="text-text-dim text-xs leading-relaxed mb-3 shrink-0">
        {t("honorific.intro1")}
        <Icon name="circle-alert" className="inline text-warn align-[-2px]" /> {t("honorific.intro2")}
      </p>
      <div className="flex flex-wrap gap-4 mb-3.5 shrink-0">
        {(
          [
            ["self", t("honorific.vocab.self"), t("honorific.vocab.selfPlaceholder")],
            ["second", t("honorific.vocab.second"), t("honorific.vocab.secondPlaceholder")],
            ["suffix", t("honorific.vocab.suffix"), t("honorific.vocab.suffixPlaceholder")],
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

      <div className="flex flex-wrap items-center gap-2 mb-2.5 shrink-0 text-xs">
        <span className="text-text-dim inline-flex items-center" title={t("honorific.filterTitle")}>
          <Icon name="filter" />
        </span>
        <span className="text-text-dim">{t("honorific.speaker")}</span>
        <select value={speakerFilter} onChange={(e) => setSpeakerFilter(e.target.value)} className="text-xs w-32">
          <option value="">{t("honorific.all")}</option>
          {project.characters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <span className="text-text-dim">{t("honorific.target")}</span>
        <select value={targetFilter} onChange={(e) => setTargetFilter(e.target.value)} className="text-xs w-32">
          <option value={TARGET_FILTER_ALL}>{t("honorific.all")}</option>
          <option value="">{t("honorific.selfOption")}</option>
          <option value={HONOR_SECOND}>{t("honorific.secondOption")}</option>
          {project.characters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {filtersActive && (
          <>
            <span className="text-text-dim">
              {t("honorific.countOf", { shown: visibleRules.length, total: project.honorificRules.length })}
            </span>
            <button type="button" onClick={resetFilters} className="text-xs px-2 py-1">
              <Icon name="x" />
              {t("honorific.clearFilter")}
            </button>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 text-sm">
        <div className="grid grid-cols-[20px_1fr_1fr_2fr_74px_30px] gap-1.5 items-center px-1.5 py-1 sticky top-0 bg-bg-2 text-text-dim text-[11px] border-b border-border z-[1]">
          <span></span>
          <span>{t("honorific.header.speaker")}</span>
          <span>{t("honorific.header.target")}</span>
          <span>{t("honorific.header.pattern")}</span>
          <span>{t("honorific.header.allowBare")}</span>
          <span></span>
        </div>
        <div ref={drag.containerRef} onMouseDown={drag.onMouseDown}>
          {!project.honorificRules.length && (
            <div className="py-8 px-2.5 text-text-dim text-sm text-center leading-loose">{t("honorific.emptyRegisterFirst")}</div>
          )}
          {project.honorificRules.length > 0 && !visibleRules.length && (
            <div className="py-8 px-2.5 text-text-dim text-sm text-center leading-loose">
              {t("honorific.emptyNoMatch")}
              <br />
              <button type="button" onClick={resetFilters} className="mt-2 text-xs px-2 py-1">
                {t("honorific.clearFilter")}
              </button>
            </div>
          )}
          {visibleRules.map((r) => (
            <div key={r.id} className="honor-row grid grid-cols-[20px_1fr_1fr_2fr_74px_30px] gap-1.5 items-center px-1.5 py-1 border-b border-hairline group">
              {filtersActive ? (
                <span title={t("honorific.cannotReorderWhileFiltering")} />
              ) : (
                <span className="drag-handle invisible group-hover:visible" title={t("common.dragToReorder")}>
                  <Icon name="grip-vertical" />
                </span>
              )}
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
                <option value="">{t("honorific.selfOption")}</option>
                <option value={HONOR_SECOND}>{t("honorific.secondOption")}</option>
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
        {t("honorific.addRule")}
      </button>
    </Modal>
  );
}
