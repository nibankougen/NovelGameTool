import { produce, type Draft } from "immer";
import { uid } from "../lib/id";
import {
  EXPORT_DEFAULTS,
  HONOR_VOCAB_DEFAULTS,
  type Character,
  type Project,
  type Scene,
} from "../types/project";
import { EXPR_TMPL_LS_KEY, readLocalStorage, writeLocalStorage } from "../lib/storage";

const HISTORY_LIMIT = 200;

export interface GlobalExprTemplateState {
  enabled: boolean;
  template: string[];
}

export function loadGlobalExprTemplate(): GlobalExprTemplateState {
  const raw = readLocalStorage<Partial<GlobalExprTemplateState>>(EXPR_TMPL_LS_KEY);
  return {
    enabled: !!raw?.enabled,
    template: Array.isArray(raw?.template) ? raw.template : [],
  };
}

export function saveGlobalExprTemplate(state: GlobalExprTemplateState): void {
  writeLocalStorage(EXPR_TMPL_LS_KEY, state);
}

export function defaultProject(): Project {
  return {
    title: "新規プロジェクト",
    characters: [],
    scenes: [{ id: uid(), name: "オープニング", commands: [], groupId: null, synopsis: "" }],
    sceneGroups: [],
    exportSettings: { ...EXPORT_DEFAULTS },
    exprTemplate: [],
    languages: [],
    overview: "",
    honorificRules: [],
    honorificVocab: { ...HONOR_VOCAB_DEFAULTS },
    assets: { bg: {}, bgm: {}, se: {} },
  };
}

export function createNewProject(): Project {
  const p = defaultProject();
  const g = loadGlobalExprTemplate();
  if (g.enabled && g.template.length) p.exprTemplate = [...g.template];
  return p;
}

/** 旧データ・外部JSONに新フィールドを補う */
export function normalizeProject(raw: unknown): Project {
  const p = (raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {}) as Record<string, unknown>;

  const characters: Character[] = Array.isArray(p.characters) ? (p.characters as Character[]) : [];
  for (const c of characters) {
    if (typeof c.memo !== "string") c.memo = "";
    if (c.thumb === undefined) c.thumb = null;
    if (!Array.isArray(c.expressions)) c.expressions = [];
    if (!c.exprImages || typeof c.exprImages !== "object" || Array.isArray(c.exprImages)) c.exprImages = {};
  }

  const sceneGroups = Array.isArray(p.sceneGroups) ? (p.sceneGroups as { id: string; name: string }[]) : [];
  const groupIds = new Set(sceneGroups.map((g) => g.id));
  const scenes: Scene[] = Array.isArray(p.scenes) ? (p.scenes as Scene[]) : [];
  for (const s of scenes) {
    if (s.groupId !== undefined && s.groupId !== null && !groupIds.has(s.groupId)) s.groupId = null;
    if (s.groupId === undefined) s.groupId = null;
    if (typeof s.synopsis !== "string") s.synopsis = "";
    if (!Array.isArray(s.commands)) s.commands = [];
  }
  if (!scenes.length) scenes.push({ id: uid(), name: "シーン1", commands: [], groupId: null, synopsis: "" });

  const exportSettings = { ...EXPORT_DEFAULTS, ...(p.exportSettings && typeof p.exportSettings === "object" ? p.exportSettings : {}) };

  const rawRules = Array.isArray(p.honorificRules) ? p.honorificRules : [];
  const honorificRules = rawRules
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object" && !!(r as Record<string, unknown>).speakerId)
    .map((r) => ({
      id: typeof r.id === "string" ? r.id : uid(),
      speakerId: r.speakerId as string,
      targetId: (r.targetId as string | null) ?? null,
      pattern: typeof r.pattern === "string" ? r.pattern : "",
      allowBare: !!r.allowBare,
    }));

  const hv = (p.honorificVocab && typeof p.honorificVocab === "object" ? p.honorificVocab : {}) as Record<string, unknown>;
  const honorificVocab = {
    self: Array.isArray(hv.self) ? hv.self.filter((w): w is string => typeof w === "string" && !!w) : [...HONOR_VOCAB_DEFAULTS.self],
    second: Array.isArray(hv.second)
      ? hv.second.filter((w): w is string => typeof w === "string" && !!w)
      : [...HONOR_VOCAB_DEFAULTS.second],
    suffix: Array.isArray(hv.suffix)
      ? hv.suffix.filter((w): w is string => typeof w === "string" && !!w)
      : [...HONOR_VOCAB_DEFAULTS.suffix],
  };

  const rawAssets = (p.assets && typeof p.assets === "object" ? p.assets : {}) as Record<string, unknown>;
  const assets = {
    bg: (rawAssets.bg && typeof rawAssets.bg === "object" ? rawAssets.bg : {}) as Record<string, string>,
    bgm: (rawAssets.bgm && typeof rawAssets.bgm === "object" ? rawAssets.bgm : {}) as Record<string, string>,
    se: (rawAssets.se && typeof rawAssets.se === "object" ? rawAssets.se : {}) as Record<string, string>,
  };

  return {
    title: typeof p.title === "string" && p.title ? p.title : "無題",
    titleTr: p.titleTr && typeof p.titleTr === "object" ? (p.titleTr as Record<string, string>) : undefined,
    characters,
    scenes,
    sceneGroups,
    exportSettings,
    exprTemplate: Array.isArray(p.exprTemplate) ? (p.exprTemplate as string[]) : [],
    languages: Array.isArray(p.languages) ? (p.languages as string[]) : [],
    overview: typeof p.overview === "string" ? p.overview : "",
    honorificRules,
    honorificVocab,
    assets,
  };
}

export interface ProjectHistoryState {
  past: Project[];
  present: Project;
  future: Project[];
  /** MUTATE（構造的な変更）のたびに増える。行/シーンの複数選択など、
   * セッション限りのUI状態をクリアするタイミングを検知するために使う。 */
  mutateVersion: number;
}

export type ProjectAction =
  | { type: "LOAD"; project: Project }
  | { type: "NEW" }
  | { type: "MUTATE"; recipe: (draft: Draft<Project>) => void }
  | { type: "PATCH"; recipe: (draft: Draft<Project>) => void }
  | { type: "BEGIN_SESSION" }
  | { type: "UNDO" }
  | { type: "REDO" };

export function projectHistoryReducer(state: ProjectHistoryState, action: ProjectAction): ProjectHistoryState {
  switch (action.type) {
    case "LOAD":
      return { past: [], present: action.project, future: [], mutateVersion: state.mutateVersion + 1 };
    case "NEW":
      return { past: [], present: createNewProject(), future: [], mutateVersion: state.mutateVersion + 1 };
    case "MUTATE": {
      const past = [...state.past, state.present];
      if (past.length > HISTORY_LIMIT) past.shift();
      return {
        past,
        present: produce(state.present, action.recipe),
        future: [],
        mutateVersion: state.mutateVersion + 1,
      };
    }
    case "PATCH":
      return { ...state, present: produce(state.present, action.recipe) };
    case "BEGIN_SESSION": {
      const past = [...state.past, state.present];
      if (past.length > HISTORY_LIMIT) past.shift();
      return { ...state, past, future: [] };
    }
    case "UNDO": {
      if (!state.past.length) return state;
      const past = state.past.slice(0, -1);
      const present = state.past[state.past.length - 1];
      return { past, present, future: [state.present, ...state.future], mutateVersion: state.mutateVersion + 1 };
    }
    case "REDO": {
      if (!state.future.length) return state;
      const [present, ...future] = state.future;
      return { past: [...state.past, state.present], present, future, mutateVersion: state.mutateVersion + 1 };
    }
    default:
      return state;
  }
}
