import { SceneList } from "../scenes/SceneList";
import { CharacterList } from "../characters/CharacterList";

export function Sidebar() {
  return (
    <div className="w-[230px] shrink-0 flex flex-col bg-panel border-r border-border">
      <SceneList />
      <CharacterList />
    </div>
  );
}
