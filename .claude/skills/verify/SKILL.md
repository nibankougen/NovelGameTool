---
name: verify
description: NovelGameTool.html（単一ファイルのブラウザアプリ）の動作検証手順
---

# NovelGameTool の検証手順

## 対象

`NovelGameTool.html` — 依存なしの単一HTMLファイル。ビルド工程なし。ブラウザで `file://` 直接開き。

## 構文チェック

```bash
node -e "const fs=require('fs');const m=fs.readFileSync('NovelGameTool.html','utf8').match(/<script>([\s\S]*)<\/script>/);fs.writeFileSync(process.env.TEMP+'/nge.js',m[1]);" && node --check "$TEMP/nge.js"
```

## 実機駆動（headless Edge + puppeteer-core）

Edge の実体: `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`（Chromeは未インストール）。
スクラッチディレクトリで `npm i puppeteer-core` して、`file:///D:/Documents/Programs/NovelGameTool/NovelGameTool.html` を開いて操作する。

注意点:
- 初回に `localStorage.clear()` → reload しないと前回の自動保存データが載る
- `confirm()`/`prompt()` が出る操作（貼り付け一括追加・削除系）は `page.on("dialog", d => d.accept())` を仕込む
- 行追加は `#mainInput` に type して Enter。IMEなし入力なのでそのまま通る
- 検証済みフロー: セリフ追加 / `@名前` 話者自動登録 / `@ ` 地の文 / `/bg` 等コマンド / `/choice a>X | b>Y`（シーン自動作成）/ ↑↓行選択 / Enter編集 / Ctrl+↑行移動 / Ctrl+Z / Ctrl+1話者切替 / Ctrl+Pテストプレイ（選択肢クリック→ジャンプ）/ リロード後の自動保存復元 / 複数行貼り付け / 不正入力のエラートースト / `@名前(表情)` 表情自動登録 / キャラ編集モーダル（メモ・表情候補・サムネイルuploadFile）/ ゲーム出力（`window.download` を差し替えて中身検証）/ 旧形式データの読込互換（normalizeProject）
- キャラモーダルの画像選択は `page.$("#charThumbInput")` → `uploadFile(png)` で通る（縮小完了まで ~600ms 待つ）
- セリフ行の編集はチップ式: `.edit-chip`（話者/表情ボタン）+ `.edit-text`（本文のみ）。チップメニューは `.edit-menu .em-item` を click。文頭Backspaceでチップ丸ごと削除。非セリフ行は従来のテキスト編集
- 入力欄右の `#btnChoiceCmd`（選択肢モーダル）/ `#btnJumpCmd`（`#jumpPopup` シーン一覧、mousedownで挿入）も検証済み
- 話者チップ横 `#faceChip` → `#facePopup .popup-item[data-face=…]` で表情選択（スティッキー: 話者切替でリセット、`@名前(表情)` でも更新）
- キャラ一覧 `.c-caret` クリックで `.char-memo-panel`（メモtextarea、inputで即保存）開閉
- ゲーム出力は `#btnExportGame` → `#exportModal`（チェックボックス `#expFace` 等）→ `#btnExportGameGo`。設定は `project.exportSettings` に保存
- 整合性アラート: 削除済みシーン/キャラを参照する行は `.cmd-row.alert`（行内の壊れた参照は `.broken-ref` に triangle-alert アイコン）、該当シーンはシーン一覧で `.s-alert`。キャラ削除はセリフを地の文に変換するのでアラートにならない（削除済キャラ参照はJSON読込時のみ発生）
- アイコンは全て Lucide SVG（`ICONS`/`icon()`/`data-icon` 方式、`svg.lucide` は pointer-events:none なのでボタンのSVG部分を実クリックしてもハンドラに届く）
- 全文検索: Ctrl+F または `#btnSearch` で `#searchPanel.show`。`#searchInput` に入力で即時 `#searchResults .sr-item`（`.sr-scene`/`.sr-line`/`.sr-text mark`）。↑↓で `.active` 移動、Enter/クリックで該当シーン+行選択ジャンプ（パネルは開いたまま）、Esc で閉じて `#mainInput` へ。mutate→renderAll で結果は自動追従。ヒット0件は `.sr-empty`、上限200件
