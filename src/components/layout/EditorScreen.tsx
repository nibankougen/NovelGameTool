import { useCallback, useEffect, useRef, useState } from "react";
import { useProjectStore } from "../../state/ProjectProvider";
import { useEditorUi } from "../../state/EditorUiContext";
import { useModalRegistry } from "../modals/ModalRegistry";
import { useToast } from "../common/ToastProvider";
import { useCharLookup } from "../../hooks/useCharLookup";
import { useGlobalHotkeys } from "../../hooks/useGlobalHotkeys";
import { usePersistentState } from "../../state/usePersistentState";
import { SIDEBAR_LS_KEY, THEME_LS_KEY, THUMB_SIZE_LS_KEY } from "../../lib/storage";
import { download, safeName } from "../../lib/download";
import { buildScriptText } from "../../lib/gameExport";
import { loadGlobalExprTemplate, saveGlobalExprTemplate } from "../../state/projectReducer";
import { AppActionsProvider, type AppActionsValue, type ThemeChoice } from "../../state/AppActionsContext";
import { Topbar } from "./Topbar";
import { Sidebar } from "./Sidebar";
import { EditorPane } from "./EditorPane";
import { CharacterModal } from "../modals/CharacterModal";
import { ChoiceModal } from "../modals/ChoiceModal";
import { ExportGameModal } from "../modals/ExportGameModal";
import { HelpModal } from "../modals/HelpModal";
import { OutlineModal } from "../modals/OutlineModal";
import { StatsModal } from "../modals/StatsModal";
import { TranslationModal } from "../modals/TranslationModal";
import { HonorificModal } from "../modals/HonorificModal";
import { PlayModal } from "../modals/PlayModal";
import { AssetsModal } from "../modals/AssetsModal";
import { SettingsModal } from "../modals/SettingsModal";

function applyThemeAttribute(theme: ThemeChoice) {
  if (theme) document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

export function EditorScreen() {
  const { project, undo, redo, createProjectInDir, openProjectInDir, saveNow } = useProjectStore();
  const editorUi = useEditorUi();
  const toast = useToast();
  const findChar = useCharLookup();
  const mainInputRef = useRef<HTMLInputElement>(null);
  const { hasOpen, closeAll } = useModalRegistry();

  const [sidebarCollapsed, setSidebarCollapsed] = usePersistentState(SIDEBAR_LS_KEY, false);
  const [thumbSizeStep, setThumbSizeStep] = usePersistentState(THUMB_SIZE_LS_KEY, 0);
  const [theme, setThemeState] = usePersistentState<ThemeChoice>(THEME_LS_KEY, null);
  const [exprCarryOver, setExprCarryOverState] = useState(() => loadGlobalExprTemplate().enabled);

  useEffect(() => applyThemeAttribute(theme), [theme]);

  const setExprCarryOver = useCallback((v: boolean) => {
    setExprCarryOverState(v);
    saveGlobalExprTemplate({ ...loadGlobalExprTemplate(), enabled: v });
  }, []);

  const [charModal, setCharModal] = useState<{ open: boolean; charId: string | null }>({ open: false, charId: null });
  const [choiceModal, setChoiceModal] = useState<{ open: boolean; cmdIndex: number | null }>({
    open: false,
    cmdIndex: null,
  });
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [transOpen, setTransOpen] = useState(false);
  const [honorOpen, setHonorOpen] = useState(false);
  const [playOpen, setPlayOpen] = useState(false);
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const exportTxt = useCallback(() => {
    download(`${safeName(project.title)}.txt`, buildScriptText(project, findChar), "text/plain");
    toast("台本テキストを書き出しました");
  }, [project, findChar, toast]);

  const handleNewProject = useCallback(async () => {
    const result = await createProjectInDir();
    if (result === "exists") toast("選択したフォルダには既にプロジェクトがあります。「プロジェクトを開く」を使ってください", true);
  }, [createProjectInDir, toast]);

  const handleOpenProject = useCallback(async () => {
    const result = await openProjectInDir();
    if (result === "invalid") toast("有効なプロジェクトフォルダではありません", true);
  }, [openProjectInDir, toast]);

  const handleSaveNow = useCallback(async () => {
    await saveNow();
    toast("保存しました");
  }, [saveNow, toast]);

  useGlobalHotkeys({
    mainInputRef,
    anyModalOpen: hasOpen,
    closeAllClosableModals: closeAll,
    undo,
    redo,
    saveNow: handleSaveNow,
    toggleSidebar: () => setSidebarCollapsed((v) => !v),
    openPlay: () => setPlayOpen(true),
    openSearch: () => setSearchOpen(true),
    openHelp: () => setHelpOpen(true),
    setSpeaker: editorUi.setSpeaker,
    characters: project.characters,
  });

  const actions: AppActionsValue = {
    openCharModal: (charId) => setCharModal({ open: true, charId }),
    openChoiceModal: (cmdIndex) => setChoiceModal({ open: true, cmdIndex }),
    openExportModal: () => setExportModalOpen(true),
    openHelp: () => setHelpOpen(true),
    openOutline: () => setOutlineOpen(true),
    openStats: () => setStatsOpen(true),
    openTranslation: () => setTransOpen(true),
    openHonorific: () => setHonorOpen(true),
    openPlay: () => setPlayOpen(true),
    openAssets: () => setAssetsOpen(true),
    openSettings: () => setSettingsOpen(true),
    openSearch: () => setSearchOpen(true),
    closeSearch: () => setSearchOpen(false),
    searchOpen,
    toggleSidebar: () => setSidebarCollapsed((v) => !v),
    sidebarCollapsed,
    thumbSizeStep,
    setThumbSizeStep,
    theme,
    setTheme: setThemeState,
    exprTemplateCarryOver: exprCarryOver,
    setExprTemplateCarryOver: setExprCarryOver,
    exportTxt,
    newProject: handleNewProject,
    openProject: handleOpenProject,
    focusMainInput: () => mainInputRef.current?.focus(),
  };

  return (
    <AppActionsProvider value={actions}>
      <div className="flex flex-col h-screen">
        <Topbar />
        <div className="flex flex-1 min-h-0">
          <Sidebar collapsed={sidebarCollapsed} />
          <EditorPane mainInputRef={mainInputRef} />
        </div>
      </div>

      <CharacterModal open={charModal.open} charId={charModal.charId} onClose={() => setCharModal({ open: false, charId: null })} />
      <ChoiceModal
        open={choiceModal.open}
        cmdIndex={choiceModal.cmdIndex}
        onClose={() => setChoiceModal({ open: false, cmdIndex: null })}
      />
      <ExportGameModal open={exportModalOpen} onClose={() => setExportModalOpen(false)} />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <OutlineModal open={outlineOpen} onClose={() => setOutlineOpen(false)} />
      <StatsModal open={statsOpen} onClose={() => setStatsOpen(false)} />
      <TranslationModal open={transOpen} onClose={() => setTransOpen(false)} />
      <HonorificModal open={honorOpen} onClose={() => setHonorOpen(false)} />
      <PlayModal open={playOpen} onClose={() => setPlayOpen(false)} />
      <AssetsModal open={assetsOpen} onClose={() => setAssetsOpen(false)} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </AppActionsProvider>
  );
}
