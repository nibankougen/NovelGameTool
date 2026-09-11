import { useCallback, useState } from "react";
import { readLocalStorage, writeLocalStorage } from "../lib/storage";

export function usePersistentState<T>(key: string, defaultValue: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    const stored = readLocalStorage<T>(key);
    return stored === null ? defaultValue : stored;
  });
  const setAndStore = useCallback(
    (v: T | ((prev: T) => T)) => {
      setState((prev) => {
        const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
        writeLocalStorage(key, next);
        return next;
      });
    },
    [key],
  );
  return [state, setAndStore];
}
