import { useEffect, useRef, type RefObject } from "react";

/** ポップオーバー/コンテキストメニューの「外側クリックで閉じる」。開いた直後の同一クリックで
 * 即座に閉じてしまわないよう、リスナーの追加を1tick遅らせる。 */
export function useClickOutside<T extends HTMLElement>(
  active: boolean,
  onOutside: () => void,
  extraRef?: RefObject<HTMLElement | null>,
): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const onOutsideRef = useRef(onOutside);
  onOutsideRef.current = onOutside;

  useEffect(() => {
    if (!active) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if (extraRef?.current?.contains(target)) return;
      onOutsideRef.current();
    };
    const t = setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, extraRef]);

  return ref;
}
