import { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import type { Draft } from "immer";
import type { Project } from "../types/project";
import { LS_KEY, readLocalStorage, writeLocalStorage } from "../lib/storage";
import { createNewProject, normalizeProject, projectHistoryReducer, type ProjectHistoryState } from "./projectReducer";

function loadInitialProject(): Project {
  const raw = readLocalStorage<{ scenes?: unknown[] }>(LS_KEY);
  if (raw && Array.isArray(raw.scenes) && raw.scenes.length) return normalizeProject(raw);
  return createNewProject();
}

interface ProjectContextValue {
  project: Project;
  saveStatus: string;
  canUndo: boolean;
  canRedo: boolean;
  mutateVersion: number;
  mutate: (recipe: (draft: Draft<Project>) => void) => void;
  patch: (recipe: (draft: Draft<Project>) => void) => void;
  beginSession: () => void;
  undo: () => void;
  redo: () => void;
  loadProject: (project: Project) => void;
  newProject: () => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(
    projectHistoryReducer,
    undefined,
    (): ProjectHistoryState => ({ past: [], present: loadInitialProject(), future: [], mutateVersion: 0 }),
  );
  const [saveStatus, setSaveStatus] = useState("");
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    setSaveStatus("…");
    const t = setTimeout(() => {
      const ok = writeLocalStorage(LS_KEY, state.present);
      setSaveStatus(ok ? `自動保存済 ${new Date().toLocaleTimeString()}` : "自動保存失敗");
    }, 250);
    return () => clearTimeout(t);
  }, [state.present]);

  const mutate = useCallback((recipe: (draft: Draft<Project>) => void) => dispatch({ type: "MUTATE", recipe }), []);
  const patch = useCallback((recipe: (draft: Draft<Project>) => void) => dispatch({ type: "PATCH", recipe }), []);
  const beginSession = useCallback(() => dispatch({ type: "BEGIN_SESSION" }), []);
  const undo = useCallback(() => dispatch({ type: "UNDO" }), []);
  const redo = useCallback(() => dispatch({ type: "REDO" }), []);
  const loadProject = useCallback((project: Project) => dispatch({ type: "LOAD", project }), []);
  const newProject = useCallback(() => dispatch({ type: "NEW" }), []);

  const value: ProjectContextValue = {
    project: state.present,
    saveStatus,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    mutateVersion: state.mutateVersion,
    mutate,
    patch,
    beginSession,
    undo,
    redo,
    loadProject,
    newProject,
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
