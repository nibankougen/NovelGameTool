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
- D&D並べ替え: 行・シーン・キャラの `.drag-handle`（ホバーで visibility 表示）を mousedown→mousemove→mouseup（独自実装、HTML5 DnD不使用）。キャラの並び替えは Ctrl+1〜9 の割り当て（`.c-key`）にも反映。`.drop-indicator` が挿入位置に出る。ドロップ後 150ms は click をキャプチャ抑止（`dndSuppressClick`）するので、puppeteer で直後にクリックする場合は 200ms 待つ。選択行は移動に追従、undo対象
- 話者チップ横 `#faceChip` → `#facePopup .popup-item[data-face=…]` で表情選択（スティッキー: 話者切替でリセット、`@名前(表情)` でも更新）
- キャラ一覧 `.c-caret` クリックで `.char-memo-panel`（メモtextarea、inputで即保存）開閉
- ゲーム出力は `#btnExportGame` → `#exportModal`（チェックボックス `#expFace` 等）→ `#btnExportGameGo`。設定は `project.exportSettings` に保存
- 整合性アラート: 削除済みシーン/キャラ、または表情候補にない face を参照する行は `.cmd-row.alert`（壊れた参照は `.broken-ref`／`.face-tag.broken-ref` に triangle-alert アイコン）、該当シーンはシーン一覧で `.s-alert`。キャラ削除はセリフを地の文に変換するのでアラートにならない（削除済キャラ参照はJSON読込時のみ発生）
- キャラ編集モーダルの表情はタグ編集式: `#charExprInput` に入力して Enter で `#charExprTags` に `.expr-tag` 追加（使用中=回数表示 / `.unused`=未使用 / `.missing`=使用中だが候補にない赤タグ・クリックで復帰）。タグ内 `[data-act="ren"]`（鉛筆）でインラインリネーム（`.et-input` に Enter）、`[data-act="del"]`（×）で削除（使用中の表情は `confirm()` を挟む。未使用は即削除）。編集は `exprStaged` にステージングされ**保存時のみ**実データへ反映（キャンセルで破棄）。リネームは orig→name を該当キャラの全セリフ face に一括反映、入力バーのスティッキー表情も追従。使用中表情を消して保存すると行/シーンにアラート。保存構造は従来どおり文字列（face=表情名）で互換維持
- 表情画像: `c.exprImages`（表情名→dataURL、256px縮小、ゲーム出力には含まれない）。タグの `[data-act="img"]` → `#exprImgInput`（puppeteerでは `waitForFileChooser` + `chooser.accept([path])`。`#charThumbInput` は直接 `uploadFile` 可）。リネームで画像は追従。`c.thumb` はUI上「デフォルトイラスト」（顔画像想定）: 表示優先は「表情画像 > デフォルトイラスト」で、テストプレイの `#playFace`（セリフボックス左の100px正方形。CSSに display:none を書かずJSインラインで表示制御 — CSS側に書くと style.display="" で再び隠れるバグになる）、セリフ一覧の `.row-face`（セリフ行の左端26px正方形、地の文/コマンド行にはなし）、セリフ編集の `.edit-thumb` に適用（両方なしは非表示）。表情画像ありのタグは `.et-img`（クリックで外す）、なしのタグはデフォルトイラストの薄いプレビュー `.et-img.et-def`（opacity .35、クリックで表情画像を設定）。デフォルトイラスト変更/削除で `.et-def` は追従（renderThumbPreview→renderExprTags）
- 表情テンプレート: `project.exprTemplate`（文字列配列、ゲーム出力には含まれない）。モーダルの `#exprTmplSave` で現在のタグ一覧を保存（scheduleSave、undo対象外）、`#exprTmplApply` で既存キャラに追記、`#exprTmplInfo` に内容表示。新規キャラは `openCharModal(null)` のプリセットと `findOrCreateChar`（@名前 自動登録）の両経路で自動適用
- 多言語: `project.languages`（翻訳先コード配列、ベースはja）。翻訳は `project.titleTr` / キャラ・セリフ・選択肢optionの `tr`（{lang: text}）。翻訳画面は `#btnTrans` → `#transModal`: `#transLang`選択、`#transAddLang`（prompt、英数字コードのみ・ja拒否・重複拒否）、`#transDelLang`（confirm、翻訳ごと削除）、`#transOnlyEmpty` 絞り込み、`#transProgress` 進捗。`.tr-row` の `.tr-input` は input で即保存（focus時にpushUndo）、Enterで次欄へ。行編集は `carryTr()` で tr を引き継ぐ（選択肢は同一テキストのみ）。ゲーム出力は languages/titleTr/tr を自動付与（未入力は省略、言語未設定なら従来と同一）。全文検索は訳文にもヒット
- `.toast` は pointer-events:none（モーダル下部ボタンに重なってもクリックを奪わない）。puppeteer でトースト表示直後にボタンを click する場合も対策不要
- アイコンは全て Lucide SVG（`ICONS`/`icon()`/`data-icon` 方式、`svg.lucide` は pointer-events:none なのでボタンのSVG部分を実クリックしてもハンドラに届く）
- 全文検索: Ctrl+F または `#btnSearch` で `#searchPanel.show`。`#searchInput` に入力で即時 `#searchResults .sr-item`（`.sr-scene`/`.sr-line`/`.sr-text mark`）。↑↓で `.active` 移動、Enter/クリックで該当シーン+行選択ジャンプ（パネルは開いたまま）、Esc で閉じて `#mainInput` へ。mutate→renderAll で結果は自動追従。ヒット0件は `.sr-empty`、上限200件
