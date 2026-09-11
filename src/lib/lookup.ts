import type { Character, Scene } from "../types/project";

export function findCharacter(characters: Character[], id: string | null | undefined): Character | null {
  if (!id) return null;
  return characters.find((c) => c.id === id) ?? null;
}

export function findScene(scenes: Scene[], id: string | null | undefined): Scene | null {
  if (!id) return null;
  return scenes.find((s) => s.id === id) ?? null;
}
