import type { Scene, SceneGroup } from "../types/project";

export interface SceneRowMapEntry {
  sceneId: string;
  groupId: string | null;
}

/** renderScenes() 相当: 現在の折りたたみ状態で実際に表示される行の並びを、グループ順→未分類の順で作る */
export function buildSceneRowMap(scenes: Scene[], sceneGroups: SceneGroup[], collapsedGroups: Set<string>): SceneRowMapEntry[] {
  const map: SceneRowMapEntry[] = [];
  const appendSceneRows = (groupId: string | null) => {
    for (const s of scenes) if ((s.groupId || null) === groupId) map.push({ sceneId: s.id, groupId });
  };
  if (!sceneGroups.length) {
    appendSceneRows(null);
    return map;
  }
  for (const g of sceneGroups) if (!collapsedGroups.has(g.id)) appendSceneRows(g.id);
  const ungroupedCount = scenes.filter((s) => !s.groupId).length;
  if (ungroupedCount > 0 && !collapsedGroups.has("__ungrouped__")) appendSceneRows(null);
  return map;
}

export interface SceneDropTarget {
  groupId: string | null;
  atGroupStart?: boolean;
  beforeSceneId?: string | null;
  afterSceneId?: string | null;
}

/** ドロップ位置に何（グループ見出し／別のシーン行）が重なっているかを実座標で直接判定する */
export function sceneDropTarget(
  container: HTMLElement | null,
  lastY: number | null,
  excludeSceneId: string,
  rowMap: SceneRowMapEntry[],
): SceneDropTarget | null {
  if (lastY == null || !container) return null;
  const headers = Array.from(container.querySelectorAll<HTMLElement>(".scene-group-head"));
  const headerHit = headers.find((h) => {
    const r = h.getBoundingClientRect();
    return lastY >= r.top && lastY <= r.bottom;
  });
  if (headerHit) {
    const groupId = headerHit.classList.contains("ungrouped") ? null : headerHit.dataset.groupId || null;
    return { groupId, atGroupStart: true };
  }
  const rows = Array.from(container.querySelectorAll<HTMLElement>(".scene-item"));
  const rowHit = rows.find((r) => {
    if (r.dataset.sceneId === excludeSceneId) return false;
    const rect = r.getBoundingClientRect();
    return lastY >= rect.top && lastY <= rect.bottom;
  });
  if (rowHit) {
    const rect = rowHit.getBoundingClientRect();
    const before = lastY < rect.top + rect.height / 2;
    const entry = rowMap.find((e) => e.sceneId === rowHit.dataset.sceneId);
    return {
      groupId: entry ? entry.groupId : null,
      beforeSceneId: before ? (rowHit.dataset.sceneId ?? null) : null,
      afterSceneId: before ? null : (rowHit.dataset.sceneId ?? null),
    };
  }
  return null;
}
