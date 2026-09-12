import { useEffect, useState } from "react";
import { useProjectStore } from "../../state/ProjectProvider";
import { useToast } from "../common/ToastProvider";
import { Icon } from "../common/Icon";
import { fsAccessSupported } from "../../lib/projectFs";
import { listRecentProjects, removeRecentProject, type RecentProjectEntry } from "../../lib/recentProjects";

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString();
}

export function ProjectLauncher() {
  const { createProjectInDir, openProjectInDir, openRecentProject } = useProjectStore();
  const toast = useToast();
  const supported = fsAccessSupported();
  const [recents, setRecents] = useState<RecentProjectEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = () => {
    listRecentProjects().then(setRecents).catch(() => setRecents([]));
  };

  useEffect(refresh, []);

  const handleNew = async () => {
    setLoading(true);
    try {
      const result = await createProjectInDir();
      if (result === "exists") toast("選択したフォルダには既にプロジェクトがあります。「プロジェクトを開く」を使ってください", true);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = async () => {
    setLoading(true);
    try {
      const result = await openProjectInDir();
      if (result === "invalid") toast("有効なプロジェクトフォルダではありません", true);
      else if (result === "ok") refresh();
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRecent = async (entry: RecentProjectEntry) => {
    setLoading(true);
    try {
      const result = await openRecentProject(entry);
      if (result === "denied") toast("フォルダへのアクセス許可が得られませんでした", true);
      else if (result === "invalid") {
        toast("プロジェクトフォルダが見つかりませんでした。一覧から削除します", true);
        await removeRecentProject(entry.id);
        refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveRecent = async (id: string) => {
    await removeRecentProject(id);
    refresh();
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-bg text-text gap-6 px-4">
      <div className="flex items-center gap-2 text-2xl font-bold text-accent">
        <Icon name="book-user" /> Serifu Dev Tool
      </div>

      {!supported && (
        <p className="text-danger text-sm max-w-md text-center">
          このブラウザはFile System Access APIに対応していません。Google ChromeまたはMicrosoft Edgeでお使いください。
        </p>
      )}

      <div className="flex gap-3">
        <button className="btn-primary" disabled={!supported || loading} onClick={handleNew}>
          <Icon name="file-plus" /> 新規プロジェクト
        </button>
        <button disabled={!supported || loading} onClick={handleOpen}>
          <Icon name="folder-open" /> プロジェクトを開く
        </button>
      </div>

      {recents.length > 0 && (
        <div className="w-full max-w-md bg-panel border border-border rounded-[10px] p-2">
          <h3 className="text-text-dim text-xs font-semibold px-2 py-1">最近開いたプロジェクト</h3>
          <div className="flex flex-col gap-0.5">
            {recents.map((r) => (
              <div key={r.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent-dim">
                <button
                  className="flex-1 min-w-0 justify-start bg-transparent border-transparent text-left"
                  disabled={!supported || loading}
                  onClick={() => handleOpenRecent(r)}
                >
                  <span className="block truncate font-medium">{r.title}</span>
                </button>
                <span className="text-text-dim text-[11px] shrink-0">{formatDate(r.lastOpenedAt)}</span>
                <button
                  className="mini-btn shrink-0"
                  title="一覧から削除"
                  onClick={() => handleRemoveRecent(r.id)}
                >
                  <Icon name="x" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
