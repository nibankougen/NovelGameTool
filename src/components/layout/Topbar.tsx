import { useEffect, useRef, useState } from "react";
import { useProjectStore } from "../../state/ProjectProvider";
import { useAppActions } from "../../state/AppActionsContext";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useClickOutside } from "../../hooks/useClickOutside";
import { Icon, type IconName } from "../common/Icon";

function ToolbarButtons({ showLabels }: { showLabels: boolean }) {
  const a = useAppActions();
  const Lbl = ({ children }: { children: string }) =>
    showLabels ? <span className="lbl">{children}</span> : null;

  const fileItems: DropdownMenuItem[] = [
    { label: "新規プロジェクト", icon: "file-plus", onClick: a.newProject },
    { label: "バックアップから開く", icon: "folder-open", title: "JSONファイルを読み込み", onClick: a.openImportPicker },
    { label: "バックアップをダウンロード", icon: "save", title: "JSONファイルとして保存 (Ctrl+S)", onClick: a.exportJson },
    { label: "台本ファイルとして書き出し", icon: "file-text", title: "読みやすいテキスト台本として書き出し", onClick: a.exportTxt },
    { label: "ゲーム用ファイルとして書き出し", icon: "gamepad-2", title: "メモ・サムネイル・コメント行を除いたゲーム用データを書き出し", onClick: a.openExportModal },
  ];

  const toolItems: DropdownMenuItem[] = [
    { label: "あらすじ", icon: "book-open", title: "あらすじビュー — 全体の流れ・大枠メモ・シーンごとのあらすじ", onClick: a.openOutline },
    { label: "統計", icon: "chart-column", title: "統計 — シーン・章・全体のセリフ数と文字数", onClick: a.openStats },
    { label: "翻訳", icon: "languages", title: "翻訳画面 — セリフ・選択肢・キャラ名を他言語に翻訳", onClick: a.openTranslation },
    { label: "人称チェック", icon: "users", title: "人称チェック設定 — キャラごとの一人称・呼び方を登録して表記ゆれを検出", onClick: a.openHonorific },
    { label: "素材", icon: "music", title: "素材管理 — テストプレイで使う背景画像・BGM・効果音を登録", onClick: a.openAssets },
  ];

  return (
    <>
      <DropdownMenuButton label="ファイル" icon="files" showLabels={showLabels} items={fileItems} />
      <span className="w-px self-stretch bg-border mx-0.5" />
      <button onClick={a.openPlay} title="テストプレイ (Ctrl+P)">
        <Icon name="play" />
        <Lbl>テストプレイ</Lbl>
      </button>
      <DropdownMenuButton label="ツール" icon="wrench" showLabels={showLabels} items={toolItems} />
      <button onClick={a.openSearch} title="プロジェクト全体を全文検索 (Ctrl+F)">
        <Icon name="search" />
        <Lbl>検索</Lbl>
      </button>
      <button onClick={a.openHelp} title="ヘルプ (F1)">
        <Icon name="circle-help" />
        <Lbl>ヘルプ</Lbl>
      </button>
      <button onClick={a.openSettings} title="設定 — テーマ・サムネイルサイズなど">
        <Icon name="settings" />
        <Lbl>設定</Lbl>
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
          <div className="flex flex-col gap-0.5 [&_button]:justify-start [&_button]:w-full [&_button]:bg-transparent [&_button]:border-transparent">
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
    const t = title.trim() || "無題";
    if (t !== project.title)
      mutate((d) => {
        d.title = t;
      });
    setTitle(t);
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-panel border-b border-border shrink-0 flex-wrap relative">
      <button onClick={a.toggleSidebar} title="サイドバーの表示/非表示 (Ctrl+B)" aria-label="サイドバーの表示切替">
        <Icon name="panel-left" />
      </button>
      {showLogo && (
        <span className="font-bold text-accent mr-1 text-[15px] flex items-center gap-1">
          <Icon name="book-open" /> Serifu Dev Tool
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
        placeholder="プロジェクト名"
        className={narrow ? "flex-1 min-w-[80px] font-semibold" : showLogo ? "w-[220px] font-semibold" : "w-[120px] font-semibold"}
      />

      {!narrow && (
        <div className="contents">
          <ToolbarButtons showLabels={showLabels} />
        </div>
      )}
      {!narrow && <span className="text-text-dim text-xs ml-auto mr-2">{saveStatus}</span>}

      {narrow && (
        <button ref={moreBtnRef} onClick={() => setMoreOpen((v) => !v)} title="その他のメニュー" aria-label="その他のメニュー" className="ml-auto">
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
