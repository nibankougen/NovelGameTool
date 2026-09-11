import { useCallback, useRef } from "react";
import { useProjectStore } from "../state/ProjectProvider";

/** あらすじ/メモ/翻訳入力欄向け: 最初のfocusで1回だけundoスナップショットを積み、
 * 以降のキー入力はpatch（履歴に積まない）でまとめる。コンポーネントの再マウントで再びfocus起点に戻る。 */
export function useUndoableSession() {
  const { beginSession } = useProjectStore();
  const started = useRef(false);
  const onFocus = useCallback(() => {
    if (started.current) return;
    started.current = true;
    beginSession();
  }, [beginSession]);
  return onFocus;
}
