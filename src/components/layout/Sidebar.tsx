import { SceneList } from "../scenes/SceneList";
import { CharacterList } from "../characters/CharacterList";

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  return (
    <div
      className={
        "shrink-0 overflow-hidden border-r border-border transition-[width] duration-200 ease-in-out" +
        (collapsed ? " w-0 border-r-0" : " w-[230px]")
      }
    >
      <div
        className={
          "w-[230px] h-full flex flex-col bg-panel transition-transform duration-200 ease-in-out" +
          (collapsed ? " -translate-x-full" : " translate-x-0")
        }
      >
        <SceneList />
        <CharacterList />
      </div>
    </div>
  );
}
