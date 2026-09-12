import { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { Draft } from "immer";
import type { Project } from "../types/project";
import { clearAssetUrlCache, pickDirectory, projectFileExists, readProjectJson, writeProjectJson } from "../lib/projectFs";
import { touchRecentProject, type RecentProjectEntry } from "../lib/recentProjects";
import { createNewProject, projectHistoryReducer, type ProjectHistoryState } from "./projectReducer";

interface ProjectContextValue {
  project: Project;
  dirHandle: FileSystemDirectoryHandle | null;
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
    clearAssetUrlCache();
    skipNextAutosave.current = true;
    setDirHandle(dir);
    dispatch({ type: "LOAD", project });
    await touchRecentProject(dir, project.title);
    return "ok";
  }, []);

  const openProjectInDir = useCallback(async (): Promise<"ok" | "cancelled" | "invalid"> => {
    const dir = await pickDirectory();
    if (!dir) return "cancelled";
    let project: Project;
    try {
      project = await readProjectJson(dir);
    } catch {
      return "invalid";
    }
    clearAssetUrlCache();
    skipNextAutosave.current = true;
    setDirHandle(dir);
    dispatch({ type: "LOAD", project });
    await touchRecentProject(dir, project.title);
    return "ok";
  }, []);

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
    clearAssetUrlCache();
    skipNextAutosave.current = true;
    setDirHandle(dir);
    dispatch({ type: "LOAD", project });
    await touchRecentProject(dir, project.title);
    return "ok";
  }, []);

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
