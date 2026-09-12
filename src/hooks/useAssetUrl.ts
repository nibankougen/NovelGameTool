import { useEffect, useState } from "react";
import { useProjectStore } from "../state/ProjectProvider";
import { resolveAssetUrl } from "../lib/projectFs";

/** プロジェクトフォルダ内の相対パスをBlob URLに解決する（画像/音声のsrcに使う） */
export function useAssetUrl(relativePath: string | null): string | null {
  const { dirHandle } = useProjectStore();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!dirHandle || !relativePath) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    resolveAssetUrl(dirHandle, relativePath).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [dirHandle, relativePath]);

  return url;
}
