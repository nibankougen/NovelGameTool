---
name: verify
description: Serifu Dev Tool（React/Vite製SPA、File System Access API保存）の動作検証手順
---

# Serifu Dev Tool の検証手順

## 対象

pnpm + Vite + React + TypeScript + Tailwind CSS で実装された静的SPA（`src/` 配下）。単一HTMLファイルではない。ビルドは `tsc -b && vite build`。

**重要**: このリポジトリは2026-09にvanilla-JS単一HTML（`NovelGameTool.html`）からReact/Viteへ全面移行し、さらにその後プロジェクト保存方式を`localStorage`からFile System Access APIへ移行した。DOM構造・保存モデルとも旧実装とは別物なので、他ドキュメントや過去の記憶に`#exprImgInput`のような旧IDやbase64/localStorage前提の記述が出てきても信用しないこと。

## 起動・ビルド確認

```sh
pnpm install   # 初回のみ
pnpm dev       # http://localhost:5173 で開発サーバー起動
pnpm build     # tsc -b && vite build。型エラー・ビルド失敗の検知に使う
pnpm lint      # oxlint。warningは既存分も多いので、新規追加分のみ確認すれば十分
```

検証はビルド済み`dist/`ではなく`pnpm dev`のホットリロード環境に対して行う。ブラウザ操作は`claude-in-chrome`のツール群（`navigate`/`computer`/`find`/`javascript_tool`/`file_upload`/`read_console_messages`等）を使う。

## 保存モデル（File System Access API）

- プロジェクト本体はユーザーが選んだ**作業フォルダ**に保存される。`localStorage`にプロジェクトデータは一切残らない（`src/lib/storage.ts`にあるのはテーマ・サイドバー開閉・サムネイルサイズ・列幅・表情テンプレート引き継ぎ設定など、プロジェクトと無関係な小さいUI設定のみ）。
- フォルダ内レイアウト:
  ```
  <作業フォルダ>/
    project.json              # Project型データ。thumb/exprImages/assets.*の値はフォルダ内相対パス文字列
    assets/
      bg/<uuid>.<拡張子>
      bgm/<uuid>.<拡張子>
      se/<uuid>.<拡張子>
      characters/<uuid>.<拡張子>
  ```
  画像・音声はbase64化せずファイルのまま保存される（`src/lib/projectFs.ts`の`writeAssetFile`/`resolveAssetUrl`）。
- 直近開いたプロジェクトの一覧はIndexedDB（DB名`novelGameTool`、ストア`recentProjects`）に`FileSystemDirectoryHandle`を含めて保存される（`src/lib/recentProjects.ts`）。
- 自動保存は`ProjectProvider`（`src/state/ProjectProvider.tsx`）が300msデバウンスで`project.json`に書き込む。手動保存は`Ctrl+S`（`saveNow`、デバウンスを待たず即書き込み＋「保存しました」トースト）。

## 起動画面とフォルダ選択ダイアログの制約（重要）

作業フォルダが未選択の間は`ProjectLauncher`（`src/components/layout/ProjectLauncher.tsx`）が表示され、「新規プロジェクト」「プロジェクトを開く」ボタンと「最近開いたプロジェクト」一覧が並ぶ。作業フォルダが選ばれると`EditorScreen`に切り替わる（`src/App.tsx`の`dirHandle`分岐）。

**「新規プロジェクト」「プロジェクトを開く」、および最近開いたプロジェクトを開く際の許可再取得は、いずれもOSのネイティブなフォルダ選択・許可ダイアログを開く。これはブラウザ拡張の自動操作からは見えず、操作もできない。** クリックすると実際にユーザーの画面上にダイアログが表示されるので、素の`computer`クリックや`key`でのEscape送信では閉じられないことを確認済み（ダイアログが開いたままタブがハングしたように見える）。

### 検証用の回避策（動作確認済み）

`window.showDirectoryPicker`を、権限プロンプト不要の**Origin Private File System**（`navigator.storage.getDirectory()`）にリダイレクトすることで、ダイアログなしに新規プロジェクト作成〜編集〜自動保存の確認まで一気通貫で自動化できる。ポイントは、`javascript_tool`で直接`window.showDirectoryPicker = ...`と代入するだけでは**アプリ本体のコードには反映されない**（実行コンテキストが分離されている）ため、実際に`<script>`要素を作ってDOMに挿入し、ページ本来のスクリプトと同じ世界で実行させる必要があること。

```js
// javascript_tool で実行する。挿入した<script>要素の中身がページ本体に効く。
const s = document.createElement('script');
s.textContent = `
  window.showDirectoryPicker = async () => {
    const root = await navigator.storage.getDirectory();
    return root.getDirectoryHandle('verify-test-' + Date.now(), { create: true });
  };
`;
document.documentElement.appendChild(s);
s.remove();
```

この直後に「新規プロジェクト」をクリックすれば、ダイアログなしにエディタ画面まで進む。書き込まれた内容は同じOPFSなので`javascript_tool`から直接読める（こちらはページの世界を介さないただのWeb APIなので、ラッパー`<script>`は不要）:

```js
const root = await navigator.storage.getDirectory();
const dir = await root.getDirectoryHandle('<上で使った名前>');
const file = await (await dir.getFileHandle('project.json')).getFile();
await file.text();
```

- フォルダ名は`Date.now()`などで毎回変えること。既存の`project.json`があるフォルダを「新規プロジェクト」で選ぶと「このフォルダには既にプロジェクトがあります」エラーになる仕様（`ProjectProvider.createProjectInDir`）。
- 「プロジェクトを開く」を検証したい場合は、上のオーバーライドで`{create:true}`を付けずに既存のOPFSフォルダ名を返すようにする。
- 「最近開いたプロジェクト」からの再オープン（`openRecentProject`、IndexedDBに保存済みのハンドルへの`queryPermission`/`requestPermission`）はこの方法の対象外で**未検証**。OPFSのハンドルが`queryPermission`/`requestPermission`を実装しているか不明なため、この経路の自動化可否は別途確認が必要。
- このオーバーライドは検証用のその場しのぎであり、実装（`src/lib/projectFs.ts`等）を変更する話ではない。

## アセット（画像・音声）ピッカーは通常どおり自動化できる

作業フォルダ選択とは別に、キャラのデフォルトイラスト・表情画像・素材管理（背景/BGM/効果音）の各ファイル選択は、いずれも隠し`<input type="file">`（`CharacterModal.tsx`, `ExpressionTagEditor.tsx`, `AssetsModal.tsx`）を使っており、`find`でinput要素を見つけて`file_upload`で直接ファイルを渡せば正常に動作する（ネイティブダイアログを経由しないため自動操作の対象内）。動作確認済み: キャラクター追加モーダルの「デフォルトイラスト」inputへの`file_upload`でサムネイルが即座に反映された。

## 危険: ブロッキングなネイティブダイアログを踏むとタブごとハングする

以下のような`window.confirm()`/`window.prompt()`を伴う操作は、ダイアログが出た瞬間に**そのタブのCDP操作（スクリーンショット・JS実行・クリック）が軒並みタイムアウトするようになる**ことを確認済み。`key`でのEnter/Escape送信では復帰しなかった。**唯一有効だったのはタブを閉じること**（`tabs_close_mcp`）。新しいタブを作り直して続行すること。

該当する主な操作（実装確認ベース、他にもある想定でクリック前に一呼吸置くこと）:
- `CharacterModal`: 内容を変更した状態で「キャンセル」やモーダル外クリック（`canClose()`が`window.confirm`）、キャラクター「削除」
- `ExpressionTagEditor`: 使用中の表情の削除
- 新しいキャラ・新しい表情の作成（`window.prompt`、`SerifEditRow.tsx`のチップメニュー「新規キャラ…」「新しい表情…」）
- 翻訳画面の言語削除、人称チェックのルール削除 など確認ダイアログを伴う削除系全般

**対策**: 自動検証では上記を極力踏まない導線を選ぶ（例: キャラ追加モーダルは値を変えたら必ず「保存」で閉じる。削除の確認自体を見たいときだけ踏み、踏んだら素直にタブを閉じて作り直す）。

## 主要な操作フローのチェックリスト

入力文法・ショートカットはUI刷新後も同じ（`src/components/modals/HelpModal.tsx`参照）。以下は一通り触って確認する定番フロー:

- セリフ追加 / `@名前 セリフ`で話者自動登録 / `@ `で地の文 / `//`でコメント行
- `/bg` `/bgm` `/se` `/wait` `/jump`（未作成シーン名で自動作成）/ `/choice a>X | b>Y`
- ↑↓行選択 → Enterで編集 → Escapeでキャンセル / `Ctrl+↑↓`で行移動 / `Ctrl+D`複製 / `Delete`削除
- `Ctrl+Z` / `Ctrl+Y`（undo/redo、履歴上限200件、`src/state/projectReducer.ts`）
- `Ctrl+1`〜`9`話者切替 / `Ctrl+0`地の文 / `Alt+1`〜`9`本文へのキャラ名挿入
- `Ctrl+S`即時保存（トースト表示・ヘッダ右上のsaveStatus更新を確認）
- `Ctrl+P`テストプレイ（`PlayModal`。背景/顔画像/BGM/SEは`素材管理`で紐付けたファイルがあれば実際に描画・再生される。`usePlaySession.ts`が`dirHandle`経由でBlob URL解決するため、素材未登録なら無音・no-imageで正常）
- `Ctrl+F`全文検索（`#searchPanel`、`Esc`で閉じ`#mainInput`へ）
- 複数行貼り付けでの一括追加
- キャラ編集モーダル: 名前・色・デフォルトイラスト・表情タグ（追加/リネーム/削除/並べ替え）・設定メモ。表情画像・デフォルトイラストは**保存を押すまで実ファイルに書き込まれるだけでプロジェクトには未反映**、保存時に確定し、置き換えで不要になった旧ファイルはbest-effortで削除される（`CharacterModal.tsx`）
- 壊れた参照の表示: 削除済みシーン/キャラ・候補にない表情は`.broken-ref`（triangle-alertアイコン）。キャラ削除はセリフを地の文に変換するため単体では壊れた参照を作らない
- ドラッグ並べ替え（`useDragReorder`、以下のクラスがそれぞれの並べ替え対象。ホバーで見える`.drag-handle`をmousedownして動かす、HTML5 DnD不使用）:
  `.cmd-row`（コマンド一覧）/ `.char-item`（キャラ一覧）/ `.scene-item`・`.scene-group-head:not(.ungrouped)`（シーン一覧）/ `.expr-row`（表情タグ）/ `.honor-row`（人称チェックのルール）
- ゲーム用ファイル書き出し（`ExportGameModal`→`gameExport.ts`。メモ・デフォルトイラスト・表情画像・素材は含まれない。チェックボックス設定は`project.exportSettings`に保存）
- 台本ファイル書き出し（プレーンテキスト、`buildScriptText`）
- 素材管理（`AssetsModal`）: 背景/BGM/効果音の名前ごとにファイルを紐付け・削除。削除時は`assets/`内の実ファイルもbest-effortで削除
- 翻訳画面・人称チェック画面・統計・あらすじ・設定（テーマ切替はここに移動済み）は、いずれもTopbarの「ツール」メニューまたは対応ボタンから開く

## 自動化のためのセレクタ指針

Tailwindユーティリティクラスは見た目の調整で変わりうるため頼らない。代わりに:
- 残存しているID（`#mainInput`, `#inputBar`, `#speakerChip`, `#faceChip`, `#btnChoiceCmd`, `#btnJumpCmd`, `#cmdList`, `#cmdListWrap`, `#emptyHint`, `#choiceOptList`, `#searchPanel`, `#editor`, `#inputInner`）
- 上記の並べ替え用クラス（`.cmd-row`等）や`.edit-chip`/`.edit-text`/`.edit-menu .em-item`/`.drop-indicator`/`.broken-ref`など、挙動と結びついた意味的クラス
- それ以外はボタンのラベルテキストや`find`（自然言語検索）で要素を特定するのが確実
