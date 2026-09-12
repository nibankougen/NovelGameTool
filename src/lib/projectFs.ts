import { uid } from "./id";
import { normalizeProject } from "../state/projectReducer";
import type { Project } from "../types/project";

export const PROJECT_FILE = "project.json";

export type AssetKind = "bg" | "bgm" | "se" | "characters";

const ASSET_SUBFOLDERS: Record<AssetKind, string> = {
  bg: "assets/bg",
  bgm: "assets/bgm",
  se: "assets/se",
  characters: "assets/characters",
};

export function fsAccessSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

/** フォルダ選択ダイアログを開く。ユーザーがキャンセルした場合はnullを返す */
export async function pickDirectory(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await window.showDirectoryPicker({ mode: "readwrite" });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return null;
    throw e;
  }
}

export async function projectFileExists(dir: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    await dir.getFileHandle(PROJECT_FILE);
    return true;
  } catch {
    return false;
  }
}

export async function readProjectJson(dir: FileSystemDirectoryHandle): Promise<Project> {
  const fh = await dir.getFileHandle(PROJECT_FILE);
  const file = await fh.getFile();
  const text = await file.text();
  return normalizeProject(JSON.parse(text));
}

export async function writeProjectJson(dir: FileSystemDirectoryHandle, project: Project): Promise<void> {
  const fh = await dir.getFileHandle(PROJECT_FILE, { create: true });
  const w = await fh.createWritable();
  await w.write(JSON.stringify(project, null, 2));
  await w.close();
}

async function walkDir(dir: FileSystemDirectoryHandle, relFolder: string, create: boolean): Promise<FileSystemDirectoryHandle> {
  let cur = dir;
  for (const seg of relFolder.split("/").filter(Boolean)) {
    cur = await cur.getDirectoryHandle(seg, { create });
  }
  return cur;
}

/** ファイルをリサイズ・再エンコードせずそのままプロジェクトフォルダ内に書き込み、相対パスを返す */
export async function writeAssetFile(dir: FileSystemDirectoryHandle, kind: AssetKind, file: File): Promise<string> {
  const sub = await walkDir(dir, ASSET_SUBFOLDERS[kind], true);
  const dot = file.name.lastIndexOf(".");
  const ext = dot >= 0 ? file.name.slice(dot) : "";
  const filename = `${uid()}${ext}`;
  const fh = await sub.getFileHandle(filename, { create: true });
  const w = await fh.createWritable();
  await w.write(file);
  await w.close();
  return `${ASSET_SUBFOLDERS[kind]}/${filename}`;
}

/** best-effort削除。存在しない/失敗しても無視する */
export async function deleteAssetFile(dir: FileSystemDirectoryHandle, relativePath: string): Promise<void> {
  try {
    const parts = relativePath.split("/").filter(Boolean);
    const filename = parts.pop();
    if (!filename) return;
    const sub = await walkDir(dir, parts.join("/"), false);
    await sub.removeEntry(filename);
  } catch {
    // 見つからない/権限エラーなどは無視
  }
}

let dirIdSeq = 0;
const dirIds = new WeakMap<FileSystemDirectoryHandle, number>();
function idFor(dir: FileSystemDirectoryHandle): number {
  let id = dirIds.get(dir);
  if (id === undefined) {
    id = ++dirIdSeq;
    dirIds.set(dir, id);
  }
  return id;
}

const blobUrlCache = new Map<string, Promise<string | null>>();

/** 相対パスをたどってファイルを取得し、Blob URLに変換する（同一パスは使い回す） */
export function resolveAssetUrl(dir: FileSystemDirectoryHandle, relativePath: string | null): Promise<string | null> {
  if (!relativePath) return Promise.resolve(null);
  const key = `${idFor(dir)}:${relativePath}`;
  let p = blobUrlCache.get(key);
  if (!p) {
    p = (async () => {
      try {
        const parts = relativePath.split("/").filter(Boolean);
        const filename = parts.pop();
        if (!filename) return null;
        const sub = await walkDir(dir, parts.join("/"), false);
        const fh = await sub.getFileHandle(filename);
        const file = await fh.getFile();
        return URL.createObjectURL(file);
      } catch {
        return null;
      }
    })();
    blobUrlCache.set(key, p);
  }
  return p;
}

/** プロジェクト切替時に、キャッシュ済みBlob URLを全て破棄する */
export function clearAssetUrlCache(): void {
  for (const p of blobUrlCache.values()) {
    p.then((url) => {
      if (url) URL.revokeObjectURL(url);
    }).catch(() => {});
  }
  blobUrlCache.clear();
}
