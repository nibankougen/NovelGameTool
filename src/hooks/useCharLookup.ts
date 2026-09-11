import { useCallback } from "react";
import { useProject } from "../state/ProjectProvider";
import { findCharacter } from "../lib/lookup";
import type { CharLookup } from "../lib/text";

export function useCharLookup(): CharLookup {
  const { characters } = useProject();
  return useCallback((id: string) => findCharacter(characters, id), [characters]);
}
