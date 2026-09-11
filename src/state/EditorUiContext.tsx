import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ClickInfo } from "../lib/editClickMapping";
import { useProjectStore } from "./ProjectProvider";

interface SpeakerState {
  speakerId: string | null;
  speakerFace: string | null;
}

interface EditorUiContextValue {
  currentSceneId: string;
  selIndex: number | null;
  editIndex: number | null;
  speakerId: string | null;
  speakerFace: string | null;
  gotoScene: (id: string) => void;
  setSelIndex: (i: number | null) => void;
  startEdit: (i: number, clickInfo?: ClickInfo | null) => void;
  stopEdit: () => void;
  consumePendingEditClick: () => ClickInfo | null;
  setSpeaker: (id: string | null, face?: string | null) => void;
}

const EditorUiContext = createContext<EditorUiContextValue | null>(null);

export function EditorUiProvider({ children }: { children: ReactNode }) {
  const { project } = useProjectStore();
  const [currentSceneId, setCurrentSceneId] = useState(() => project.scenes[0].id);
  const [selIndex, setSelIndex] = useState<number | null>(null);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [speaker, setSpeakerState] = useState<SpeakerState>({ speakerId: null, speakerFace: null });
  const pendingEditClick = useRef<ClickInfo | null>(null);

  // afterRestore 相当: undo/redo・インポート等でシーン/キャラが消えていた場合のフェイルセーフ
  useEffect(() => {
    if (!project.scenes.some((s) => s.id === currentSceneId)) {
      setCurrentSceneId(project.scenes[0].id);
      setSelIndex(null);
      setEditIndex(null);
    }
    if (speaker.speakerId && !project.characters.some((c) => c.id === speaker.speakerId)) {
      setSpeakerState({ speakerId: null, speakerFace: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  const value = useMemo<EditorUiContextValue>(
    () => ({
      currentSceneId,
      selIndex,
      editIndex,
      speakerId: speaker.speakerId,
      speakerFace: speaker.speakerFace,
      gotoScene: (id: string) => {
        setCurrentSceneId(id);
        setSelIndex(null);
        setEditIndex(null);
      },
      setSelIndex,
      startEdit: (i: number, clickInfo: ClickInfo | null = null) => {
        pendingEditClick.current = clickInfo;
        setEditIndex(i);
      },
      stopEdit: () => setEditIndex(null),
      consumePendingEditClick: () => {
        const v = pendingEditClick.current;
        pendingEditClick.current = null;
        return v;
      },
      setSpeaker: (id: string | null, face?: string | null) => {
        setSpeakerState((s) => {
          let speakerFace = s.speakerFace;
          if (id !== s.speakerId) speakerFace = null;
          if (face !== undefined) speakerFace = id ? face : null;
          return { speakerId: id, speakerFace };
        });
      },
    }),
    [currentSceneId, selIndex, editIndex, speaker],
  );

  return <EditorUiContext.Provider value={value}>{children}</EditorUiContext.Provider>;
}

export function useEditorUi(): EditorUiContextValue {
  const ctx = useContext(EditorUiContext);
  if (!ctx) throw new Error("useEditorUi must be used within EditorUiProvider");
  return ctx;
}
