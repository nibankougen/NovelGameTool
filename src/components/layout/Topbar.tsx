import { useEffect, useRef, useState } from "react";
import { useProjectStore } from "../../state/ProjectProvider";
import { useAppActions } from "../../state/AppActionsContext";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useClickOutside } from "../../hooks/useClickOutside";
import { Icon } from "../common/Icon";

function ToolbarButtons({ showLabels }: { showLabels: boolean }) {
  const a = useAppActions();
  const Lbl = ({ children }: { children: string }) =>
    showLabels ? <span className="lbl">{children}</span> : null;
  return (
    <>
      <button onClick={a.newProject} title="新規プロジェクト">
        <Icon name="file-plus" />
        <Lbl>新規</Lbl>
      </button>
      <ImportButton showLabels={showLabels} />
      <button className="btn-primary" onClick={a.exportJson} title="JSONファイルとして保存 (Ctrl+S)">
        <Icon name="save" />
        <Lbl>JSON保存</Lbl>
      </button>
      <button onClick={a.exportTxt} title="読みやすいテキスト台本として書き出し">
        <Icon name="file-text" />
        <Lbl>台本TXT</Lbl>
      </button>
      <button onClick={a.openExportModal} title="メモ・サムネイル・コメント行を除いたゲーム用データを書き出し">
        <Icon name="gamepad-2" />
        <Lbl>ゲーム出力</Lbl>
      </button>
      <span className="w-px self-stretch bg-border mx-0.5" />
      <button onClick={a.openPlay} title="テストプレイ (Ctrl+P)">
        <Icon name="play" />
        <Lbl>テストプレイ</Lbl>
      </button>
      <button onClick={a.openOutline} title="あらすじビュー — 全体の流れ・大枠メモ・シーンごとのあらすじ">
        <Icon name="book-open" />
        <Lbl>あらすじ</Lbl>
      </button>
      <button onClick={a.openStats} title="統計情報 — シーン・章・全体のセリフ数と文字数">
        <Icon name="chart-column" />
        <Lbl>統計情報</Lbl>
      </button>
      <button onClick={a.openTranslation} title="翻訳画面 — セリフ・選択肢・キャラ名を他言語に翻訳">
        <Icon name="languages" />
        <Lbl>翻訳</Lbl>
      </button>
      <button onClick={a.openHonorific} title="人称チェック設定 — キャラごとの一人称・呼び方を登録して表記ゆれを検出">
        <Icon name="users" />
        <Lbl>人称チェック</Lbl>
      </button>
      <button onClick={a.openAssets} title="素材管理 — テストプレイで使う背景画像・BGM・効果音を登録">
        <Icon name="music" />
        <Lbl>素材</Lbl>
      </button>
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

function ImportButton({ showLabels }: { showLabels: boolean }) {
  const a = useAppActions();
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button onClick={() => fileRef.current?.click()} title="JSONファイルを読み込み">
        <Icon name="folder-open" />
        {showLabels && <span className="lbl">読込</span>}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) a.importJson(file);
        }}
      />
    </>
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
          <Icon name="book-open" /> NovelEdit
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
