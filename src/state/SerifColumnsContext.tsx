import { createContext, useContext, useMemo, type ReactNode } from "react";
import { usePersistentState } from "./usePersistentState";
import { SPEAKER_COL_W_LS_KEY, FACE_COL_W_LS_KEY } from "../lib/storage";

export const SPEAKER_COL_MIN = 32;
export const SPEAKER_COL_MAX = 240;
export const FACE_COL_MIN = 28;
export const FACE_COL_MAX = 200;

interface SerifColumnsValue {
  speakerColWidth: number;
  faceColWidth: number;
  setSpeakerColWidth: (px: number) => void;
  setFaceColWidth: (px: number) => void;
}

const SerifColumnsContext = createContext<SerifColumnsValue | null>(null);

/** セリフ行の「話者名」「表情」列の幅を全行で共有するコンテキスト。
 * 列境界のドラッグでここを更新すると、表示行・編集行の両方に即座に反映される。 */
export function SerifColumnsProvider({ children }: { children: ReactNode }) {
  const [speakerColWidth, setSpeakerColWidthRaw] = usePersistentState(SPEAKER_COL_W_LS_KEY, 76);
  const [faceColWidth, setFaceColWidthRaw] = usePersistentState(FACE_COL_W_LS_KEY, 64);

  const value = useMemo<SerifColumnsValue>(
    () => ({
      speakerColWidth,
      faceColWidth,
      setSpeakerColWidth: (px) => setSpeakerColWidthRaw(Math.round(Math.min(SPEAKER_COL_MAX, Math.max(SPEAKER_COL_MIN, px)))),
      setFaceColWidth: (px) => setFaceColWidthRaw(Math.round(Math.min(FACE_COL_MAX, Math.max(FACE_COL_MIN, px)))),
    }),
    [speakerColWidth, faceColWidth, setSpeakerColWidthRaw, setFaceColWidthRaw],
  );

  return <SerifColumnsContext.Provider value={value}>{children}</SerifColumnsContext.Provider>;
}

export function useSerifColumns(): SerifColumnsValue {
  const ctx = useContext(SerifColumnsContext);
  if (!ctx) throw new Error("useSerifColumns must be used within SerifColumnsProvider");
  return ctx;
}
