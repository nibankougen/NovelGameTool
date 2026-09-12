import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useProjectStore } from "../../state/ProjectProvider";
import { useToast } from "../common/ToastProvider";
import { Icon } from "../common/Icon";
import { fsAccessSupported } from "../../lib/projectFs";
import { listRecentProjects, removeRecentProject, type RecentProjectEntry } from "../../lib/recentProjects";

export function ProjectLauncher() {
  const { t, i18n } = useTranslation();
  const formatDate = (ts: number): string => new Date(ts).toLocaleString(i18n.language);
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
      if (result === "exists") toast(t("editor.projectAlreadyExists"), true);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = async () => {
    setLoading(true);
    try {
      const result = await openProjectInDir();
      if (result === "invalid") toast(t("editor.invalidProjectFolder"), true);
      else if (result === "ok") refresh();
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRecent = async (entry: RecentProjectEntry) => {
    setLoading(true);
    try {
      const result = await openRecentProject(entry);
      if (result === "denied") toast(t("launcher.accessDenied"), true);
      else if (result === "invalid") {
        toast(t("launcher.projectNotFound"), true);
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
          {t("launcher.unsupportedBrowser")}
        </p>
      )}

      <div className="flex gap-3">
        <button className="btn-primary" disabled={!supported || loading} onClick={handleNew}>
          <Icon name="file-plus" /> {t("launcher.newProject")}
        </button>
        <button disabled={!supported || loading} onClick={handleOpen}>
          <Icon name="folder-open" /> {t("launcher.openProject")}
        </button>
      </div>

      {recents.length > 0 && (
        <div className="w-full max-w-md bg-panel border border-border rounded-[10px] p-2">
          <h3 className="text-text-dim text-xs font-semibold px-2 py-1">{t("launcher.recentProjects")}</h3>
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
                  title={t("launcher.removeFromList")}
                  onClick={() => handleRemoveRecent(r.id)}
                >
                  <Icon name="trash-2" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
