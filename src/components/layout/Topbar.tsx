import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useProjectStore } from "../../state/ProjectProvider";
import { useAppActions } from "../../state/AppActionsContext";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useClickOutside } from "../../hooks/useClickOutside";
import { Icon, type IconName } from "../common/Icon";

function ToolbarButtons({ showLabels }: { showLabels: boolean }) {
  const { t } = useTranslation();
  const a = useAppActions();
  const Lbl = ({ children }: { children: string }) =>
    showLabels ? <span className="lbl">{children}</span> : null;

  const fileItems: DropdownMenuItem[] = [
    { label: t("topbar.fileMenu.openProject.label"), icon: "folder-open", title: t("topbar.fileMenu.openProject.title"), onClick: a.openProject },
    { label: t("topbar.fileMenu.newProject.label"), icon: "file-plus", title: t("topbar.fileMenu.newProject.title"), onClick: a.newProject },
    { label: t("topbar.fileMenu.exportTxt.label"), icon: "file-text", title: t("topbar.fileMenu.exportTxt.title"), onClick: a.exportTxt },
    { label: t("topbar.fileMenu.exportGame.label"), icon: "gamepad-2", title: t("topbar.fileMenu.exportGame.title"), onClick: a.openExportModal },
  ];

  const toolItems: DropdownMenuItem[] = [
    { label: t("topbar.toolsMenu.outline.label"), icon: "book-open", title: t("topbar.toolsMenu.outline.title"), onClick: a.openOutline },
    { label: t("topbar.toolsMenu.stats.label"), icon: "chart-column", title: t("topbar.toolsMenu.stats.title"), onClick: a.openStats },
    { label: t("topbar.toolsMenu.translation.label"), icon: "languages", title: t("topbar.toolsMenu.translation.title"), onClick: a.openTranslation },
    { label: t("topbar.toolsMenu.honorific.label"), icon: "users", title: t("topbar.toolsMenu.honorific.title"), onClick: a.openHonorific },
    { label: t("topbar.toolsMenu.assets.label"), icon: "music", title: t("topbar.toolsMenu.assets.title"), onClick: a.openAssets },
    { label: t("topbar.toolsMenu.eventKeys.label"), icon: "tag", title: t("topbar.toolsMenu.eventKeys.title"), onClick: a.openEventKeys },
  ];

  return (
    <>
      <DropdownMenuButton label={t("topbar.file")} icon="files" showLabels={showLabels} items={fileItems} />
      <span className="w-px self-stretch bg-border mx-0.5" />
      <button onClick={a.openPlay} title={t("topbar.playTitle")}>
        <Icon name="play" />
        <Lbl>{t("topbar.play")}</Lbl>
      </button>
      <DropdownMenuButton label={t("topbar.tools")} icon="wrench" showLabels={showLabels} items={toolItems} />
      <button onClick={a.openSearch} title={t("topbar.searchTitle")}>
        <Icon name="search" />
        <Lbl>{t("topbar.search")}</Lbl>
      </button>
      <button onClick={a.openHelp} title={t("topbar.helpTitle")}>
        <Icon name="circle-help" />
        <Lbl>{t("topbar.help")}</Lbl>
      </button>
      <button onClick={a.openSettings} title={t("topbar.settingsTitle")}>
        <Icon name="settings" />
        <Lbl>{t("topbar.settings")}</Lbl>
      </button>
    </>
  );
}

interface DropdownMenuItem {
  label: string;
  icon: IconName;
  title?: string;
  onClick: () => void;
}

/** ヘッダの「ファイル」「ツール」等で使うホバー開閉式のドロップダウンメニューボタン。 */
function DropdownMenuButton({
  label,
  icon,
  showLabels,
  items,
}: {
  label: string;
  icon: IconName;
  showLabels: boolean;
  items: DropdownMenuItem[];
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const menuRef = useClickOutside<HTMLDivElement>(open, () => setOpen(false), btnRef);

  const cancelClose = () => {
    if (closeTimer.current !== undefined) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = undefined;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 150);
  };

  return (
    <div className="relative" onMouseEnter={() => { cancelClose(); setOpen(true); }} onMouseLeave={scheduleClose}>
      <button ref={btnRef} onClick={() => setOpen(true)} title={label}>
        <Icon name={icon} />
        {showLabels && <span className="lbl">{label}</span>}
        <Icon name="chevron-down" />
      </button>
      {open && (
        <div
          ref={menuRef}
          className="absolute top-full left-0 mt-1 z-80 bg-bg-3 border border-border rounded-[10px] shadow-2xl p-1.5 min-w-[220px]"
        >
          <div className="flex flex-col gap-0.5 [&_button]:justify-start [&_button]:w-full [&_button]:bg-transparent [&_button]:border-transparent [&_button:hover]:bg-accent-dim">
            {items.map((it) => (
              <button
                key={it.label}
                title={it.title}
                onClick={() => {
                  setOpen(false);
                  it.onClick();
                }}
              >
                <Icon name={it.icon} />
                <span className="lbl">{it.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function Topbar() {
  const { t } = useTranslation();
  const { project, mutate, saveStatus } = useProjectStore();
  const a = useAppActions();
  const narrow = useMediaQuery("(max-width: 720px)");
  const showLabels = useMediaQuery("(min-width: 1181px)");
  const showLogo = useMediaQuery("(min-width: 1001px)");
  const [title, setTitle] = useState(project.title);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const moreMenuRef = useClickOutside<HTMLDivElement>(moreOpen, () => setMoreOpen(false), moreBtnRef);

  useEffect(() => setTitle(project.title), [project.title]);
  useEffect(() => {
    if (!narrow) setMoreOpen(false);
  }, [narrow]);

  const commitTitle = () => {
    const newTitle = title.trim() || t("translation.preview.untitled");
    if (newTitle !== project.title)
      mutate((d) => {
        d.title = newTitle;
      });
    setTitle(newTitle);
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-panel border-b border-border shrink-0 flex-wrap relative">
      <button onClick={a.toggleSidebar} title={t("topbar.sidebarToggleTitle")} aria-label={t("topbar.sidebarToggleAriaLabel")}>
        <Icon name="panel-left" />
      </button>
      {showLogo && (
        <span className="font-bold text-accent mr-1 text-[15px] flex items-center gap-1">
          <Icon name="book-user" /> {t("topbar.appName")}
        </span>
      )}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={commitTitle}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        placeholder={t("topbar.projectNamePlaceholder")}
        className={narrow ? "flex-1 min-w-[80px] font-semibold" : showLogo ? "w-[220px] font-semibold" : "w-[120px] font-semibold"}
      />

      {!narrow && (
        <div className="contents">
          <ToolbarButtons showLabels={showLabels} />
        </div>
      )}
      {!narrow && <span className="text-text-dim text-xs ml-auto mr-2">{saveStatus}</span>}

      {narrow && (
        <button ref={moreBtnRef} onClick={() => setMoreOpen((v) => !v)} title={t("topbar.moreMenu")} aria-label={t("topbar.moreMenu")} className="ml-auto">
          <Icon name="ellipsis" />
        </button>
      )}
      {narrow && moreOpen && (
        <div
          ref={moreMenuRef}
          className="absolute top-full right-2 mt-1 z-80 bg-bg-3 border border-border rounded-[10px] shadow-2xl p-1.5 min-w-[190px] max-h-[calc(100vh-60px)] overflow-y-auto"
        >
          <div className="flex flex-col gap-0.5 [&_button]:justify-start [&_button]:w-full [&_button]:bg-transparent [&_button]:border-transparent">
            <ToolbarButtons showLabels />
          </div>
        </div>
      )}
    </div>
  );
}
