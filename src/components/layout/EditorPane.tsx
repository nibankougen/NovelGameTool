import { useRef, type RefObject } from "react";
import { useAppActions } from "../../state/AppActionsContext";
import { CommandList } from "../commandList/CommandList";
import { SelectionJumpButton } from "../commandList/SelectionJumpButton";
import { InputBar } from "../inputBar/InputBar";
import { SearchPanel } from "../search/SearchPanel";

export function EditorPane({ mainInputRef }: { mainInputRef: RefObject<HTMLInputElement | null> }) {
  const a = useAppActions();
  const scrollWrapRef = useRef<HTMLDivElement>(null);

  return (
    <div id="editor" className="flex-1 flex flex-col min-w-0 relative">
      {a.searchOpen && <SearchPanel onClose={a.closeSearch} />}
      <div className="relative flex flex-1 min-h-0">
        <div id="cmdListWrap" ref={scrollWrapRef} className="flex-1 min-w-0 overflow-y-auto px-4 pt-2.5 pb-[30vh]">
          <CommandList scrollWrapRef={scrollWrapRef} />
        </div>
        <SelectionJumpButton scrollWrapRef={scrollWrapRef} />
      </div>
      <InputBar inputRef={mainInputRef} />
    </div>
  );
}
