import { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { Draft } from "immer";
import type { Project } from "../types/project";
import { clearAssetUrlCache, pickDirectory, projectFileExists, readProjectJson, writeProjectJson } from "../lib/projectFs";
import { listRecentProjects, touchRecentProject, type RecentProjectEntry } from "../lib/recentProjects";
import { createNewProject, projectHistoryReducer, type ProjectHistoryState } from "./projectReducer";

interface ProjectContextValue {
  project: Project;
  dirHandle: FileSystemDirectoryHandle | null;
  /** 起動直後、直前に開いていたプロジェクトフォルダへの再接続を試みている間だけtrue */
  restoring: boolean;
  saveStatus: string;
  canUndo: boolean;
  canRedo: boolean;
  mutateVersion: number;
  mutate: (recipe: (draft: Draft<Project>) => void) => void;
  patch: (recipe: (draft: Draft<Project>) => void) => void;
  beginSession: () => void;
  undo: () => void;
  redo: () => void;
  createProjectInDir: () => Promise<"ok" | "cancelled" | "exists">;
  openProjectInDir: () => Promise<"ok" | "cancelled" | "invalid">;
  openRecentProject: (entry: RecentProjectEntry) => Promise<"ok" | "denied" | "invalid">;
  saveNow: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [state, dispatch] = useReducer(
    projectHistoryReducer,
    undefined,
    (): ProjectHistoryState => ({ past: [], present: createNewProject(), future: [], mutateVersion: 0 }),
  );
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [saveStatus, setSaveStatus] = useState("");
  const skipNextAutosave = useRef(false);
  const debounceTimer = useRef<number | undefined>(undefined);
  const dirHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  dirHandleRef.current = dirHandle;

  const writeToDisk = useCallback(async (project: Project) => {
    const dir = dirHandleRef.current;
    if (!dir) return;
    try {
      await writeProjectJson(dir, project);
      setSaveStatus(t("editor.autosaved", { time: new Date().toLocaleTimeString() }));
    } catch {
      setSaveStatus(t("editor.autosaveFailed"));
    }
  }, [t]);

  const finishLoad = useCallback((dir: FileSystemDirectoryHandle, project: Project) => {
    clearAssetUrlCache();
    skipNextAutosave.current = true;
    setDirHandle(dir);
    dispatch({ type: "LOAD", project });
    void touchRecentProject(dir, project.title);
  }, []);

  // スリープ復帰などでタブがブラウザに破棄され再読み込みされると、メモリ上のdirHandleは失われ
  // 起動画面に戻ってしまう。直前に開いていたフォルダへの許可がまだ生きていれば
  // （ユーザー操作なしで確認できるqueryPermissionのみ使用）、確認なしで自動的に再度開く。
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [entry] = await listRecentProjects();
        if (!entry) return;
        const perm = await entry.handle.queryPermission({ mode: "readwrite" });
        if (perm !== "granted") return;
        const project = await readProjectJson(entry.handle);
        if (cancelled) return;
        finishLoad(entry.handle, project);
      } catch {
        // 権限確認・読み込みに失敗した場合は通常通り起動画面を表示する
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mutate = useCallback((recipe: (draft: Draft<Project>) => void) => dispatch({ type: "MUTATE", recipe }), []);
  const patch = useCallback((recipe: (draft: Draft<Project>) => void) => dispatch({ type: "PATCH", recipe }), []);
  const beginSession = useCallback(() => dispatch({ type: "BEGIN_SESSION" }), []);
  const undo = useCallback(() => dispatch({ type: "UNDO" }), []);
  const redo = useCallback(() => dispatch({ type: "REDO" }), []);

  useEffect(() => {
    if (skipNextAutosave.current) {
      skipNextAutosave.current = false;
      return;
    }
    if (!dirHandle) return;
    setSaveStatus("…");
    const t = window.setTimeout(() => {
      void writeToDisk(state.present);
    }, 300);
    debounceTimer.current = t;
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.present, dirHandle]);

  const createProjectInDir = useCallback(async (): Promise<"ok" | "cancelled" | "exists"> => {
    const dir = await pickDirectory();
    if (!dir) return "cancelled";
    if (await projectFileExists(dir)) return "exists";
    const project = createNewProject();
    await writeProjectJson(dir, project);
    finishLoad(dir, project);
    return "ok";
  }, [finishLoad]);

  const openProjectInDir = useCallback(async (): Promise<"ok" | "cancelled" | "invalid"> => {
    const dir = await pickDirectory();
    if (!dir) return "cancelled";
    let project: Project;
    try {
      project = await readProjectJson(dir);
    } catch {
      return "invalid";
    }
    finishLoad(dir, project);
    return "ok";
  }, [finishLoad]);

  const openRecentProject = useCallback(async (entry: RecentProjectEntry): Promise<"ok" | "denied" | "invalid"> => {
    const dir = entry.handle;
    let perm = await dir.queryPermission({ mode: "readwrite" });
    if (perm !== "granted") perm = await dir.requestPermission({ mode: "readwrite" });
    if (perm !== "granted") return "denied";
    let project: Project;
    try {
      project = await readProjectJson(dir);
    } catch {
      return "invalid";
    }
    finishLoad(dir, project);
    return "ok";
  }, [finishLoad]);

  const saveNow = useCallback(async () => {
    if (debounceTimer.current !== undefined) {
      window.clearTimeout(debounceTimer.current);
      debounceTimer.current = undefined;
    }
    await writeToDisk(state.present);
  }, [state.present, writeToDisk]);

  const value: ProjectContextValue = {
    project: state.present,
    dirHandle,
    restoring,
    saveStatus,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    mutateVersion: state.mutateVersion,
    mutate,
    patch,
    beginSession,
    undo,
    redo,
    createProjectInDir,
    openProjectInDir,
    openRecentProject,
    saveNow,
  };

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProjectStore(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProjectStore must be used within ProjectProvider");
  return ctx;
}

export function useProject(): Project {
  return useProjectStore().project;
}
