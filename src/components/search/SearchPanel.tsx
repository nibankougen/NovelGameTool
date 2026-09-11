import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useProject } from "../../state/ProjectProvider";
import { useEditorUi } from "../../state/EditorUiContext";
import { useCharLookup } from "../../hooks/useCharLookup";
import { Icon } from "../common/Icon";
import { buildSnippet, runSearch } from "../../lib/search";

export function SearchPanel({ onClose }: { onClose: () => void }) {
  const project = useProject();
  const editorUi = useEditorUi();
  const findChar = useCharLookup();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const { hits, total } = useMemo(() => runSearch(project, query, findChar), [project, query, findChar]);

  useEffect(() => setActive((a) => Math.min(a, Math.max(0, hits.length - 1))), [hits.length]);

  const gotoHit = (n: number) => {
    const hit = hits[n];
    if (!hit) return;
    if (!project.scenes.some((s) => s.id === hit.sceneId)) return;
    setActive(n);
    editorUi.gotoScene(hit.sceneId);
    editorUi.setSelIndex(hit.idx);
    if (hit.idx !== null) {
      requestAnimationFrame(() => {
        document.querySelector(`#cmdList [data-idx="${hit.idx}"]`)?.scrollIntoView({ block: "center" });
      });
    }
  };

  return (
    <div id="searchPanel" className="absolute top-2 right-4 z-40 w-[420px] max-w-[calc(100%-32px)] flex flex-col bg-panel border border-border rounded-xl shadow-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-2.5 py-2 border-b border-border">
        <span className="text-text-dim inline-flex">
          <Icon name="search" />
        </span>
        <input
          ref={inputRef}
          type="text"
          autoComplete="off"
          placeholder="プロジェクト全体を検索（↑↓で選択、Enterでジャンプ）"
          className="flex-1 min-w-0 text-sm px-2 py-1"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === "Escape") onClose();
            else if (e.key === "ArrowDown") {
              e.preventDefault();
              if (hits.length) setActive((a) => (a + 1) % hits.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              if (hits.length) setActive((a) => (a - 1 + hits.length) % hits.length);
            } else if (e.key === "Enter") {
              gotoHit(active);
            }
            e.stopPropagation();
          }}
        />
        <span className="text-text-dim text-[11px] whitespace-nowrap">{total ? `${total}件` : ""}</span>
        <button className="mini-btn" title="閉じる (Esc)" onClick={onClose}>
          <Icon name="x" />
        </button>
      </div>
      <div className="overflow-y-auto max-h-[50vh]">
        {total === 0 && query.trim() && <div className="px-3 py-2.5 text-text-dim text-xs">見つかりませんでした</div>}
        {hits.map((hit, n) => (
          <div
            key={n}
            className={`flex gap-2 items-baseline py-1.5 px-3 cursor-pointer text-sm border-t border-hairline ${n === active ? "bg-bg-3" : "hover:bg-bg-3"}`}
            onClick={() => gotoHit(n)}
          >
            <span className="text-sys text-[11px] whitespace-nowrap shrink-0 max-w-[110px] overflow-hidden text-ellipsis">{hit.sceneName}</span>
            <span className="text-text-dim text-[11px] shrink-0 min-w-[20px] text-right">{hit.lineLabel}</span>
            <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
              <Snippet text={hit.matchedText} query={query} />
            </span>
          </div>
        ))}
        {total > hits.length && <div className="px-3 py-2.5 text-text-dim text-xs">他 {total - hits.length} 件 — キーワードで絞り込んでください</div>}
      </div>
    </div>
  );
}

function Snippet({ text, query }: { text: string; query: string }) {
  const snippet = buildSnippet(text, query);
  const parts: ReactNode[] = [];
  let last = 0;
  snippet.ranges.forEach(([a, b], i) => {
    if (a > last) parts.push(snippet.text.slice(last, a));
    parts.push(
      <mark key={i} className="bg-accent/30 text-inherit rounded px-px">
        {snippet.text.slice(a, b)}
      </mark>,
    );
    last = b;
  });
  if (last < snippet.text.length) parts.push(snippet.text.slice(last));
  return <>{parts}</>;
}
