import { Fragment, useMemo } from "react";
import { splitMentions, type CharLookup } from "../../lib/text";
import { Icon } from "./Icon";

/** 《名前》メンション参照を含むテキストをJSXとして描画する（削除済みキャラは破損参照バッジで表示） */
export function MentionText({ text, findChar }: { text: string; findChar: CharLookup }) {
  const segments = useMemo(() => splitMentions(text, findChar), [text, findChar]);
  return (
    <>
      {segments.map((seg, i) =>
        seg.kind === "text" ? (
          <Fragment key={i}>{seg.value}</Fragment>
        ) : seg.char ? (
          <span key={i} className="text-mention font-semibold" style={{ color: seg.char.color }}>
            {seg.char.name}
          </span>
        ) : (
          <span key={i} className="broken-ref text-danger inline-flex items-center gap-1">
            <Icon name="triangle-alert" />（削除済キャラ）
          </span>
        ),
      )}
    </>
  );
}
