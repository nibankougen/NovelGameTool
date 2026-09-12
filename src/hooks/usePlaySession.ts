import { useCallback, useEffect, useRef, useState } from "react";
import { textToResolved, type CharLookup } from "../lib/text";
import { findScene } from "../lib/lookup";
import { resolveAssetUrl } from "../lib/projectFs";
import type { Project } from "../types/project";

export interface PlayChoice {
  text: string;
  onPick: () => void;
}

export interface PlayState {
  sceneName: string;
  bgLabel: string;
  bgmLabel: string;
  bgImage: string | null;
  speakerName: string;
  speakerColor: string;
  faceImg: string | null;
  text: string;
  isEnd: boolean;
  waitingChoice: boolean;
  choices: PlayChoice[];
}

const MAX_STEPS = 5000;

interface Session {
  sceneId: string;
  idx: number;
  face: string | null;
  bgLabel: string;
  bgImage: string | null;
  bgmValue: string;
  bgmLabel: string;
}

function makeSession(startSceneId: string): Session {
  return { sceneId: startSceneId, idx: 0, face: null, bgLabel: "なし", bgImage: null, bgmValue: "", bgmLabel: "なし" };
}

function initialState(): PlayState {
  return {
    sceneName: "",
    bgLabel: "なし",
    bgmLabel: "なし",
    bgImage: null,
    speakerName: "",
    speakerColor: "var(--text)",
    faceImg: null,
    text: "",
    isEnd: false,
    waitingChoice: false,
    choices: [],
  };
}

export function usePlaySession(project: Project, dirHandle: FileSystemDirectoryHandle | null, startSceneId: string, findChar: CharLookup) {
  const [state, setState] = useState<PlayState>(initialState);
  const sessionRef = useRef<Session>(makeSession(startSceneId));
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);

  const applyBgm = useCallback(
    (value: string) => {
      const s = sessionRef.current;
      if (value === s.bgmValue) return;
      s.bgmValue = value;
      s.bgmLabel = value || "停止";
      bgmAudioRef.current?.pause();
      bgmAudioRef.current = null;
      const relPath = value ? project.assets.bgm[value] : null;
      if (relPath && dirHandle) {
        resolveAssetUrl(dirHandle, relPath).then((src) => {
          if (!src || sessionRef.current.bgmValue !== value) return;
          const audio = new Audio(src);
          audio.loop = true;
          audio.play().catch(() => {});
          bgmAudioRef.current = audio;
        });
      }
    },
    [project.assets.bgm, dirHandle],
  );

  const playSe = useCallback(
    (value: string) => {
      const relPath = project.assets.se[value];
      if (relPath && dirHandle) {
        resolveAssetUrl(dirHandle, relPath).then((src) => {
          if (src) new Audio(src).play().catch(() => {});
        });
      }
    },
    [project.assets.se, dirHandle],
  );

  const step = useCallback(() => {
    const s = sessionRef.current;
    let guard = 0;
    while (guard++ < MAX_STEPS) {
      const scene = findScene(project.scenes, s.sceneId);
      if (!scene) {
        setState((prev) => ({ ...prev, sceneName: "", speakerName: "", text: "", isEnd: true, waitingChoice: false }));
        return;
      }
      if (s.idx >= scene.commands.length) {
        setState((prev) => ({ ...prev, sceneName: scene.name, speakerName: "", text: "", isEnd: true, waitingChoice: false }));
        return;
      }
      const cmd = scene.commands[s.idx++];
      switch (cmd.type) {
        case "serif": {
          const ch = cmd.chara ? findChar(cmd.chara) : null;
          let faceImg: string | null;
          if (ch) {
            faceImg = (cmd.face && ch.exprImages[cmd.face]) || ch.thumb || null;
            s.face = faceImg;
          } else {
            faceImg = s.face; // 地の文では直前の顔画像を保持
          }
          setState((prev) => ({
            ...prev,
            sceneName: scene.name,
            bgLabel: s.bgLabel,
            bgmLabel: s.bgmLabel,
            bgImage: s.bgImage,
            speakerName: ch ? ch.name + (cmd.face ? `（${cmd.face}）` : "") : "",
            speakerColor: ch ? ch.color : "var(--text)",
            faceImg,
            text: textToResolved(cmd.text, findChar),
            isEnd: false,
            waitingChoice: false,
            choices: [],
          }));
          return;
        }
        case "bg": {
          s.bgLabel = cmd.value ? cmd.value : "なし";
          s.bgImage = cmd.value ? (project.assets.bg[cmd.value] ?? null) : null;
          continue;
        }
        case "bgm":
          applyBgm(cmd.value);
          continue;
        case "se":
          playSe(cmd.value);
          continue;
        case "wait":
        case "comment":
          continue;
        case "jump": {
          const target = findScene(project.scenes, cmd.target);
          if (!target) {
            setState((prev) => ({
              ...prev,
              sceneName: scene.name,
              speakerName: "",
              text: "⚠ ジャンプ先シーンが見つかりません",
              isEnd: true,
              waitingChoice: false,
            }));
            return;
          }
          s.sceneId = target.id;
          s.idx = 0;
          continue;
        }
        case "choice": {
          setState((prev) => ({
            ...prev,
            sceneName: scene.name,
            bgLabel: s.bgLabel,
            bgmLabel: s.bgmLabel,
            bgImage: s.bgImage,
            speakerName: "",
            text: "",
            isEnd: true,
            waitingChoice: true,
            choices: cmd.options.map((o) => ({
              text: o.text,
              onPick: () => {
                if (o.target) {
                  s.sceneId = o.target;
                  s.idx = 0;
                }
                step();
              },
            })),
          }));
          return;
        }
      }
    }
    setState((prev) => ({ ...prev, text: "⚠ ループが多すぎるため停止しました", isEnd: true, waitingChoice: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, findChar, applyBgm, playSe]);

  const restart = useCallback(() => {
    bgmAudioRef.current?.pause();
    bgmAudioRef.current = null;
    sessionRef.current = makeSession(startSceneId);
    setState(initialState());
    step();
  }, [startSceneId, step]);

  const startedRef = useRef(false);
  useEffect(() => {
    // StrictMode等でのマウント→クリーンアップ→再マウントの二重実行時に、ステップが
    // 二重に進んでしまわないようガードする（sessionRefはインスタンス間で維持される）
    if (!startedRef.current) {
      startedRef.current = true;
      step();
    }
    return () => {
      bgmAudioRef.current?.pause();
      bgmAudioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const advance = useCallback(() => {
    if (state.waitingChoice) return;
    step();
  }, [state.waitingChoice, step]);

  return { state, advance, restart };
}
