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
import { normalizeProject } from "../../state/projectReducer";
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

function applyThemeAttribute(theme: ThemeChoice) {
  if (theme) document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

export function EditorScreen() {
  const { project, undo, redo, loadProject, newProject: resetProject } = useProjectStore();
  const editorUi = useEditorUi();
  const toast = useToast();
  const findChar = useCharLookup();
  const mainInputRef = useRef<HTMLInputElement>(null);
  const { hasOpen, closeAll } = useModalRegistry();

  const [sidebarCollapsed, setSidebarCollapsed] = usePersistentState(SIDEBAR_LS_KEY, false);
  const [thumbSizeStep, setThumbSizeStep] = usePersistentState(THUMB_SIZE_LS_KEY, 0);
  const [theme, setThemeState] = usePersistentState<ThemeChoice>(THEME_LS_KEY, null);

  useEffect(() => applyThemeAttribute(theme), [theme]);

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
  const [searchOpen, setSearchOpen] = useState(false);

  const exportJson = useCallback(() => {
    download(`${safeName(project.title)}.json`, JSON.stringify(project, null, 2));
    toast("JSONファイルとして保存しました");
  }, [project, toast]);

  const exportTxt = useCallback(() => {
    download(`${safeName(project.title)}.txt`, buildScriptText(project, findChar), "text/plain");
    toast("台本テキストを書き出しました");
  }, [project, findChar, toast]);

  const importJson = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          if (!parsed || !Array.isArray(parsed.scenes) || !Array.isArray(parsed.characters)) {
            throw new Error("形式が違います");
          }
          if (!window.confirm("現在の内容を読み込んだプロジェクトで置き換えます。よろしいですか？（Ctrl+Zで戻せます）")) return;
          loadProject(normalizeProject(parsed));
          toast("読み込みました");
        } catch {
          toast("読み込みに失敗しました（JSON形式を確認してください）", true);
        }
      };
      reader.readAsText(file);
    },
    [loadProject, toast],
  );

  const handleNewProject = useCallback(() => {
    if (!window.confirm("新規プロジェクトを作成します。現在の内容は失われます（Ctrl+Zで戻せます）。\n心配な場合は先にJSON保存してください。")) return;
    resetProject();
  }, [resetProject]);

  useGlobalHotkeys({
    mainInputRef,
    anyModalOpen: hasOpen,
    closeAllClosableModals: closeAll,
    undo,
    redo,
    exportJson,
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
    openSearch: () => setSearchOpen(true),
    closeSearch: () => setSearchOpen(false),
    searchOpen,
    toggleSidebar: () => setSidebarCollapsed((v) => !v),
    sidebarCollapsed,
    thumbSizeStep,
    setThumbSizeStep,
    theme,
    setTheme: setThemeState,
    exportJson,
    exportTxt,
    importJson,
    newProject: handleNewProject,
    focusMainInput: () => mainInputRef.current?.focus(),
  };

  return (
    <AppActionsProvider value={actions}>
      <div className="flex flex-col h-screen">
        <Topbar />
        <div className="flex flex-1 min-h-0">
          {!sidebarCollapsed && <Sidebar />}
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
    </AppActionsProvider>
  );
}
