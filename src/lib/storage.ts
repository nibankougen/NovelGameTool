export const LS_KEY = "novelGameTool.project.v2";
export const EXPR_TMPL_LS_KEY = "novelGameTool.exprTemplateCarryOver.v1";
export const THUMB_SIZE_LS_KEY = "novelGameTool.thumbSizeStep.v1";
export const SIDEBAR_LS_KEY = "novelGameTool.sidebarCollapsed.v1";
export const THEME_LS_KEY = "novelGameTool.theme.v1";
export const SPEAKER_COL_W_LS_KEY = "novelGameTool.speakerColWidth.v1";
export const FACE_COL_W_LS_KEY = "novelGameTool.faceColWidth.v1";

export function readLocalStorage<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeLocalStorage(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
