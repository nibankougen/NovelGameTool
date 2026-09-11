import { createContext, useContext, type ReactNode } from "react";

export type ThemeChoice = "light" | "dark" | null;

export interface CharModalState {
  open: boolean;
  charId: string | null;
}
export interface ChoiceModalState {
  open: boolean;
  cmdIndex: number | null;
}

export interface AppActionsValue {
  openCharModal: (charId: string | null) => void;
  openChoiceModal: (cmdIndex: number | null) => void;
  openExportModal: () => void;
  openHelp: () => void;
  openOutline: () => void;
  openStats: () => void;
  openTranslation: () => void;
  openHonorific: () => void;
  openPlay: () => void;
  openAssets: () => void;
  openSettings: () => void;
  openSearch: () => void;
  closeSearch: () => void;
  searchOpen: boolean;
  toggleSidebar: () => void;
  sidebarCollapsed: boolean;
  thumbSizeStep: number;
  setThumbSizeStep: (step: number) => void;
  theme: ThemeChoice;
  setTheme: (t: ThemeChoice) => void;
  exprTemplateCarryOver: boolean;
  setExprTemplateCarryOver: (v: boolean) => void;
  exportJson: () => void;
  exportTxt: () => void;
  importJson: (file: File) => void;
  openImportPicker: () => void;
  newProject: () => void;
  focusMainInput: () => void;
}

const AppActionsContext = createContext<AppActionsValue | null>(null);

export function AppActionsProvider({ value, children }: { value: AppActionsValue; children: ReactNode }) {
  return <AppActionsContext.Provider value={value}>{children}</AppActionsContext.Provider>;
}

export function useAppActions(): AppActionsValue {
  const ctx = useContext(AppActionsContext);
  if (!ctx) throw new Error("useAppActions must be used within AppActionsProvider");
  return ctx;
}
