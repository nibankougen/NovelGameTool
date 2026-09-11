import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from "react";

interface ModalRegistryValue {
  register: (requestClose: () => void) => () => void;
  closeAll: () => void;
  hasOpen: () => boolean;
}

const ModalRegistryContext = createContext<ModalRegistryValue | null>(null);

/** 現在開いているモーダルの「ガード付きクローズ関数」を集約する。
 * グローバルのEscapeハンドラはここに登録された全モーダルへ一斉にクローズ要求を送る
 * （各モーダルは自身の requestClose 内で、閉じてよいか自分で判断する＝キャラ編集の未保存確認など）。 */
export function ModalRegistryProvider({ children }: { children: ReactNode }) {
  const fnsRef = useRef<Set<() => void>>(new Set());

  const register = useCallback((fn: () => void) => {
    fnsRef.current.add(fn);
    return () => {
      fnsRef.current.delete(fn);
    };
  }, []);
  const closeAll = useCallback(() => {
    for (const fn of Array.from(fnsRef.current)) fn();
  }, []);
  const hasOpen = useCallback(() => fnsRef.current.size > 0, []);

  const value = useMemo<ModalRegistryValue>(() => ({ register, closeAll, hasOpen }), [register, closeAll, hasOpen]);
  return <ModalRegistryContext.Provider value={value}>{children}</ModalRegistryContext.Provider>;
}

export function useModalRegistry(): ModalRegistryValue {
  const ctx = useContext(ModalRegistryContext);
  if (!ctx) throw new Error("useModalRegistry must be used within ModalRegistryProvider");
  return ctx;
}
