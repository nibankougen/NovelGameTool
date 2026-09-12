import type { CharLookup } from "./text";
import { textToResolved } from "./text";
import type { Character, Command, Scene, SceneGroup } from "../types/project";
import { findCharacter, findScene } from "./lookup";

export interface SceneGroupEntry {
  scene: Scene;
  groupName: string | null;
}

/** シーンをグループ（章）順・グループ内は配列順で並べ、未分類は最後にまとめて返す */
export function scenesInGroupOrder(scenes: Scene[], sceneGroups: SceneGroup[]): SceneGroupEntry[] {
  const out: SceneGroupEntry[] = [];
  for (const g of sceneGroups) {
    for (const s of scenes) if (s.groupId === g.id) out.push({ scene: s, groupName: g.name });
  }
  const groupIds = new Set(sceneGroups.map((g) => g.id));
  for (const s of scenes) if (!s.groupId || !groupIds.has(s.groupId)) out.push({ scene: s, groupName: null });
  return out;
}

export function cmdBroken(c: Command, characters: Character[], scenes: Scene[]): boolean {
  if (c.type === "serif") {
    if (!c.chara) return false;
    const ch = findCharacter(characters, c.chara);
    if (!ch) return true;
    if (c.face && !ch.expressions.includes(c.face)) return true;
    return false;
  }
  if (c.type === "jump") return !findScene(scenes, c.target);
  if (c.type === "choice") return c.options.some((o) => o.target && !findScene(scenes, o.target));
  return false;
}

export function sceneHasAlert(scene: Scene, characters: Character[], scenes: Scene[]): boolean {
  return scene.commands.some((c) => cmdBroken(c, characters, scenes));
}

export interface SceneStats {
  count: number;
  chars: number;
}

export function sceneStats(scene: Scene, findChar: CharLookup): SceneStats {
  let count = 0;
  let chars = 0;
  for (const c of scene.commands) {
    if (c.type === "serif") {
      count++;
      chars += textToResolved(c.text, findChar).length;
    }
  }
  return { count, chars };
}

/** シーン結合時、削除される予定のシーンidを参照していたjump/choiceの飛び先を新しいシーンidへ retarget する（下書きを直接書き換える） */
export function retargetSceneRefs(cmd: Command, removedIds: Set<string>, newTargetId: string): void {
  if (cmd.type === "jump") {
    if (removedIds.has(cmd.target)) cmd.target = newTargetId;
  } else if (cmd.type === "choice") {
    for (const o of cmd.options) {
      if (o.target && removedIds.has(o.target)) o.target = newTargetId;
    }
  }
}

/** キャラクターの表情ごとの使用回数（全シーン横断）。編集画面での「未使用」「使用中に削除しようとした」判定に使う */
export function faceUsageCounts(scenes: Scene[], charId: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of scenes) {
    for (const c of s.commands) {
      if (c.type === "serif" && c.chara === charId && c.face) {
        map.set(c.face, (map.get(c.face) ?? 0) + 1);
      }
    }
  }
  return map;
}

/** イベントキーごとの使用回数（全シーン横断）。イベントキー管理画面の「使用中に削除しようとした」判定に使う */
export function eventKeyUsageCounts(scenes: Scene[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of scenes) {
    for (const c of s.commands) {
      if (c.type === "serif" && c.events) {
        for (const e of c.events) map.set(e.keyId, (map.get(e.keyId) ?? 0) + 1);
      }
    }
  }
  return map;
}
