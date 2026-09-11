import type { Project } from "../types/project";

export interface AssetNames {
  bg: string[];
  bgm: string[];
  se: string[];
}

/** プロジェクト内で使われている背景/BGM/効果音の名前を重複なく収集する（登場順） */
export function collectAssetNames(project: Project): AssetNames {
  const bg: string[] = [];
  const bgm: string[] = [];
  const se: string[] = [];
  const push = (arr: string[], v: string) => {
    if (v && !arr.includes(v)) arr.push(v);
  };
  for (const s of project.scenes) {
    for (const c of s.commands) {
      if (c.type === "bg") push(bg, c.value);
      else if (c.type === "bgm") push(bgm, c.value);
      else if (c.type === "se") push(se, c.value);
    }
  }
  return { bg, bgm, se };
}
