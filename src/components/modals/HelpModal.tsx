import type { ReactNode } from "react";
import { Modal, ModalFoot, ModalTitle } from "./Modal";
import { Icon } from "../common/Icon";

function Row({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <tr>
      <td className="px-2.5 py-1 border-b border-border align-top whitespace-nowrap w-[220px]">{k}</td>
      <td className="px-2.5 py-1 border-b border-border align-top">{v}</td>
    </tr>
  );
}
function Code({ children }: { children: ReactNode }) {
  return <code className="bg-bg-3 border border-border rounded px-1.5 font-mono text-xs">{children}</code>;
}
function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="bg-bg-3 border border-border rounded px-1.5 font-mono text-xs">{children}</kbd>;
}

export function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onRequestClose={onClose} className="min-w-[560px]">
      <ModalTitle>ヘルプ — 入力方法とショートカット</ModalTitle>
      <h4 className="mt-3.5 mb-1 text-accent font-semibold">セリフ入力</h4>
      <table className="w-full border-collapse mb-4">
        <tbody>
          <Row k={<Code>こんにちは</Code>} v="現在の話者のセリフとして追加（Enter）" />
          <Row k={<Code>@あかね こんにちは</Code>} v="話者を「あかね」に切り替えてセリフ追加。未登録の名前は自動でキャラ登録" />
          <Row k={<Code>@あかね</Code>} v="話者の切り替えのみ" />
          <Row
            k={<Code>@あかね(笑顔) こんにちは</Code>}
            v={
              <>
                表情付きセリフ。表情の候補はキャラクター編集で設定（未登録の表情は自動追加）。<Code>（　）</Code>全角も可。話者チップ横の「表情」ボタンからもクリックで選べ、選んだ表情は話者を切り替えるまで続きます
              </>
            }
          />
          <Row k={<Code>@ 教室に入った。</Code>} v="地の文（ナレーション）に切り替え" />
          <Row k={<Code>//メモ</Code>} v="コメント行（ゲームには出力しないメモ）" />
        </tbody>
      </table>

      <h4 className="mt-3.5 mb-1 text-accent font-semibold">
        スラッシュコマンド（<Code>/</Code>を入力すると候補が出ます）
      </h4>
      <table className="w-full border-collapse mb-4">
        <tbody>
          <Row k={<Code>/bg 教室</Code>} v="背景変更" />
          <Row k={<Code>/bgm 日常テーマ</Code>} v={<><Code>/bgm</Code> のみで停止</>} />
          <Row k={<Code>/se ドア開閉</Code>} v="効果音" />
          <Row k={<Code>/wait 1000</Code>} v="ウェイト（ミリ秒）" />
          <Row k={<Code>/jump シーン名</Code>} v="シーンへジャンプ。存在しないシーン名なら自動作成" />
          <Row
            k={<Code>/choice はい&gt;ルートA | いいえ&gt;ルートB</Code>}
            v={
              <>
                選択肢。<Code>選択肢文&gt;飛び先シーン</Code> を <Code>|</Code> 区切りで。<Code>/choice</Code> のみで編集画面を開く
              </>
            }
          />
        </tbody>
      </table>

      <h4 className="mt-3.5 mb-1 text-accent font-semibold">キーボードショートカット</h4>
      <table className="w-full border-collapse mb-4">
        <tbody>
          <Row k={<Kbd>Enter</Kbd>} v="行を追加／行選択中（入力欄が空）は選択行を編集" />
          <Row k={<>{"↑↓"}（入力欄が空のとき）</>} v="行選択の移動。新しい行は選択行の直後に挿入されます" />
          <Row k={<Kbd>Esc</Kbd>} v="行選択解除（挿入位置を末尾に戻す）／編集キャンセル" />
          <Row k={<>Ctrl+{"↑/↓"}</>} v="選択行を上下に移動" />
          <Row k={<>Ctrl+D</>} v="選択行を複製" />
          <Row k={<Kbd>Delete</Kbd>} v="（入力欄が空のとき）選択行を削除" />
          <Row k="Ctrl+1〜9" v="話者をキャラクター1〜9番に切替" />
          <Row k="Ctrl+0" v="話者を地の文に切替" />
          <Row k="Alt+1〜9" v="セリフ本文のカーソル位置へキャラクター1〜9番の名前を挿入。名前を変更すると本文中の表記も自動で追従します" />
          <Row k="Ctrl+Z / Ctrl+Y" v="元に戻す／やり直し" />
          <Row k="Ctrl+S" v="JSONファイルとして保存" />
          <Row k="Ctrl+P" v="テストプレイ" />
          <Row k="Ctrl+B" v="サイドバーの表示／非表示" />
          <Row k="Ctrl+F" v="プロジェクト全体を全文検索" />
        </tbody>
      </table>

      <h4 className="mt-3.5 mb-1 text-accent font-semibold">その他</h4>
      <table className="w-full border-collapse mb-4">
        <tbody>
          <Row k="複数行の貼り付け" v="テキストエディタで書いた台本を入力欄に貼り付けると、1行ずつまとめて追加できます" />
          <Row k="自動保存" v="編集内容はブラウザ内に自動保存されます。バックアップや共有には「JSON保存」を使ってください" />
          <Row
            k="行の編集"
            v="行をクリックすると即編集モードになります。セリフ行では話者・表情がチップになり、クリックで切替できます。文頭でBackspaceでチップごと削除（地の文に）"
          />
          <Row k="並べ替え" v="行・シーン・キャラクターの左端のハンドル（⋮⋮）をドラッグして順番を変えられます" />
          <Row
            k="シーンのグループ分け"
            v="シーン一覧の「＋章」ボタンでグループを作成できます。シーンをドラッグしてグループやシーン行にドロップすると割り当てられます。複数シーンをShift+クリックで選択し右クリックで結合、行を複数選択して右クリックで新しいシーンに分離できます"
          />
          <Row
            k="キャラクター設定"
            v="キャラ一覧の鉛筆アイコンから名前・色・デフォルトイラスト・表情候補・設定メモを編集できます"
          />
          <Row k="翻訳" v={<><Icon name="languages" className="inline" /> で翻訳画面を開き、言語を追加してセリフ・選択肢・キャラ名を翻訳できます</>} />
          <Row k="人称チェック" v={<><Icon name="users" className="inline" /> で設定画面を開き、キャラごとの一人称・二人称・呼び方を登録すると表記ゆれを検出します</>} />
          <Row k="テストプレイ" v="背景・BGM・効果音は「素材」画面で登録した画像・音声があれば実際に描画・再生されます" />
          <Row k="ゲーム出力" v="「ゲーム出力」ボタンで、ゲーム実装用JSONを書き出せます" />
        </tbody>
      </table>
      <ModalFoot>
        <button className="btn-primary" onClick={onClose}>
          閉じる
        </button>
      </ModalFoot>
    </Modal>
  );
}
