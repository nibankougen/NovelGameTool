"use strict";
/* =========================================================
   ノベルゲーム シナリオエディタ
   データはlocalStorageに自動保存。JSON入出力対応。
========================================================= */

const LS_KEY = "novelGameTool.project.v1";
const EXPR_TMPL_LS_KEY = "novelGameTool.exprTemplateCarryOver.v1";   // プロジェクトを跨いだ表情テンプレート引き継ぎ設定
const THUMB_SIZE_LS_KEY = "novelGameTool.thumbSizeStep.v1";   // 行サムネイルの拡大段階（0〜3 = 1〜4倍）
const PALETTE = ["#ff7a7a","#ffb35c","#ffe066","#8ce99a","#66d9e8","#74a8ff","#b197fc","#faa2c1","#c0a98a","#9aa5b1"];
const EXPORT_DEFAULTS = { face: true, sceneName: true, color: true, comment: false, pretty: true };
const HONOR_VOCAB_DEFAULTS = {
  self: ["私","わたし","わたくし","僕","ぼく","ボク","俺","おれ","オレ","自分","うち","あたし","あたい"],
  second: ["キミ","君","あなた","あんた","お前","おまえ","貴様","きさま","てめえ","そなた"],
  suffix: ["さん","くん","君","ちゃん","様","殿","氏","先輩","先生"],
};
const HONOR_SECOND = "__second__";   // 人称チェックの「相手（二人称、名前を伴わない）」を表す targetId の特別値

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

/* ---------- アイコン: Lucide (https://lucide.dev / ISC License) ---------- */
const ICONS = {
  "book-open":    `<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h6z"/>`,
  "file-plus":    `<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M9 15h6"/><path d="M12 18v-6"/>`,
  "folder-open":  `<path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2"/>`,
  "save":         `<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>`,
  "file-text":    `<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>`,
  "gamepad-2":    `<line x1="6" x2="10" y1="11" y2="11"/><line x1="8" x2="8" y1="9" y2="13"/><line x1="15" x2="15.01" y1="12" y2="12"/><line x1="18" x2="18.01" y1="10" y2="10"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/>`,
  "play":         `<polygon points="6 3 20 12 6 21 6 3"/>`,
  "circle-help":  `<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>`,
  "plus":         `<path d="M5 12h14"/><path d="M12 5v14"/>`,
  "pencil":       `<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>`,
  "trash-2":      `<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>`,
  "x":            `<path d="M18 6 6 18"/><path d="m6 6 12 12"/>`,
  "copy":         `<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>`,
  "chevron-up":   `<path d="m18 15-6-6-6 6"/>`,
  "chevron-down": `<path d="m6 9 6 6 6-6"/>`,
  "chevron-right":`<path d="m9 18 6-6-6-6"/>`,
  "split":        `<path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3"/><path d="m15 9 6-6"/>`,
  "corner-down-right": `<polyline points="15 10 20 15 15 20"/><path d="M4 4v7a4 4 0 0 0 4 4h12"/>`,
  "image":        `<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>`,
  "triangle-alert": `<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 20h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>`,
  "search":       `<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>`,
  "grip-vertical": `<circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>`,
  "languages":    `<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>`,
  "circle-alert": `<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>`,
  "chart-column": `<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>`,
  "users": `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
};
const icon = name =>
  `<svg class="lucide" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
// 静的HTML中の <span data-icon="..."> にSVGを注入
document.querySelectorAll("[data-icon]").forEach(el => { el.innerHTML = icon(el.dataset.icon); });
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------- 状態 ---------- */
let project = null;
let currentSceneId = null;
let selIndex = null;        // 選択中の行 index（null=末尾に挿入）
let editIndex = null;       // インライン編集中の行 index
let pendingEditClick = null; // 編集開始直前のクリック位置情報（カーソル位置/チップ自動展開に使用）
let speakerId = null;       // 現在の話者（null=地の文）
let speakerFace = null;     // 現在の表情（話者に付随。話者切替でリセット）
let undoStack = [], redoStack = [];
let saveTimer = null;

function defaultProject(){
  return {
    title: "新規プロジェクト",
    characters: [],
    scenes: [{ id: uid(), name: "オープニング", commands: [], groupId: null, synopsis: "" }],
    sceneGroups: [],    // シーンのグループ（章など）: { id, name }
    exportSettings: { ...EXPORT_DEFAULTS },
    exprTemplate: [],   // 新規キャラクターに自動適用する表情テンプレート
    languages: [],      // 翻訳先の言語コード（例: ["en","zh-CN"]）。ベース言語は日本語
    overview: "",       // 大枠メモ（設定・プロット全体・伏線など）。ゲーム用出力には含まれません
    honorificRules: [],       // 人称チェックのルール: { id, speakerId, targetId(null=一人称), pattern, allowBare }
    honorificVocab: { ...HONOR_VOCAB_DEFAULTS },   // 一人称・敬称の候補語（チェック対象の語彙、編集可）
  };
}

/* プロジェクトを跨いで表情テンプレートを引き継ぐ設定（キャラ編集画面のチェックボックスで切替） */
function loadGlobalExprTemplate(){
  try{
    const raw = localStorage.getItem(EXPR_TMPL_LS_KEY);
    if(raw){
      const o = JSON.parse(raw);
      if(o && typeof o === "object")
        return { enabled: !!o.enabled, template: Array.isArray(o.template) ? o.template : [] };
    }
  }catch(e){}
  return { enabled: false, template: [] };
}
function saveGlobalExprTemplate(state){
  try{ localStorage.setItem(EXPR_TMPL_LS_KEY, JSON.stringify(state)); }catch(e){}
}

/* 行サムネイルの拡大段階（表情を見ながら編集したい場合のための表示倍率、全プロジェクト共通設定） */
function loadThumbSizeStep(){
  const n = parseInt(localStorage.getItem(THUMB_SIZE_LS_KEY), 10);
  return (Number.isInteger(n) && n >= 0 && n <= 3) ? n : 0;
}
function saveThumbSizeStep(step){
  try{ localStorage.setItem(THUMB_SIZE_LS_KEY, String(step)); }catch(e){}
}
function applyThumbSizeStep(step){
  document.documentElement.style.setProperty("--thumb-scale", String(step + 1));
  $("#thumbSizeSlider").value = String(step);
  $("#thumbSizeLabel").textContent = `${step + 1}倍`;
}
function createNewProject(){
  const p = defaultProject();
  const g = loadGlobalExprTemplate();
  if(g.enabled && g.template.length) p.exprTemplate = [...g.template];
  return p;
}

/* ---------- 参照ヘルパ ---------- */
const curScene = () => project.scenes.find(s => s.id === currentSceneId) || project.scenes[0];
const cmds     = () => curScene().commands;
const charById = id => project.characters.find(c => c.id === id) || null;
const sceneById = id => project.scenes.find(s => s.id === id) || null;

/* ---------- セリフ本文中のキャラ名参照（Alt+1〜9で挿入） ----------
   保存形式では id という不可視トークンで参照を持ち、名前を変更しても自動で追従する。
   編集欄では読みやすいよう《名前》の形で表示・入力し、確定時にトークンへ変換する。
   台本TXT・ゲーム出力など「書き出し」時だけは、その時点の名前を平文として埋め込む。 */
const MENTION_RE = /([^]*)/g;
const mentionToken = id => `${id}`;
function textToDisplay(text){
  return String(text ?? "").replace(MENTION_RE, (_, id) => `《${(charById(id) || {}).name || "？"}》`);
}
function textToStorage(text){
  return String(text ?? "").replace(/《([^《》]*)》/g, (whole, name) => {
    const c = project.characters.find(c => c.name === name);
    return c ? mentionToken(c.id) : whole;
  });
}
function textToResolved(text){
  return String(text ?? "").replace(MENTION_RE, (_, id) => (charById(id) || {}).name || "？");
}
function textToHtml(text){
  return esc(text).replace(MENTION_RE, (_, id) => {
    const c = charById(id);
    return c
      ? `<span class="text-mention" style="color:${esc(c.color)}">${esc(c.name)}</span>`
      : `<span class="broken-ref">${icon("triangle-alert")}（削除済キャラ）</span>`;
  });
}
// 解決済み表示（名前そのまま）上の文字位置を、編集欄の表示形式（《名前》）上の文字位置に変換
// クリック位置から編集開始時のカーソル位置を推定する際に使用
function resolvedOffsetToDisplayOffset(text, target){
  let dPos = 0, rPos = 0, sPos = 0, m;
  MENTION_RE.lastIndex = 0;
  while((m = MENTION_RE.exec(text))){
    const plainLen = m.index - sPos;
    if(target <= rPos + plainLen) return dPos + (target - rPos);
    rPos += plainLen; dPos += plainLen; sPos = m.index;
    const name = (charById(m[1]) || {}).name || "？";
    const dispLen = name.length + 2;   // 《名前》
    if(target <= rPos + name.length){
      const within = target - rPos;
      return within * 2 >= name.length ? dPos + dispLen : dPos;   // トークン内は前後どちらか近い方の境界へ
    }
    rPos += name.length; dPos += dispLen; sPos = m.index + m[0].length;
  }
  const remain = text.length - sPos;   // 最後のトークン以降はそのまま平文
  return dPos + Math.max(0, Math.min(target - rPos, remain));
}
// input要素のカーソル位置（選択範囲があれば置換）へキャラ名の参照表示を挿入する
function insertMentionAtCursor(inputEl, charIndex){
  const c = project.characters[charIndex];
  if(!c) return;
  const token = `《${c.name}》`;
  const start = inputEl.selectionStart ?? inputEl.value.length;
  const end = inputEl.selectionEnd ?? inputEl.value.length;
  const v = inputEl.value;
  inputEl.value = v.slice(0, start) + token + v.slice(end);
  const pos = start + token.length;
  inputEl.setSelectionRange(pos, pos);
  inputEl.dispatchEvent(new Event("input", { bubbles: true }));
}

function uniqueSceneName(base){
  base = (base || "シーン").trim() || "シーン";
  if(!project.scenes.some(s => s.name === base)) return base;
  let n = 2;
  while(project.scenes.some(s => s.name === `${base}${n}`)) n++;
  return `${base}${n}`;
}
function findOrCreateScene(name){
  name = name.trim();
  let s = project.scenes.find(s => s.name === name);
  if(!s){
    s = { id: uid(), name, commands: [], groupId: null, synopsis: "" };
    project.scenes.push(s);
    toast(`シーン「${name}」を作成しました`);
  }
  return s.id;
}
function findOrCreateChar(name){
  name = name.trim();
  let c = project.characters.find(c => c.name === name);
  if(!c){
    c = { id: uid(), name, color: PALETTE[project.characters.length % PALETTE.length],
          memo: "", thumb: null, expressions: [...project.exprTemplate], exprImages: {} };
    project.characters.push(c);
    toast(`キャラクター「${name}」を登録しました`);
  }
  return c;
}

// 旧データ・外部JSONに新フィールドを補う
function normalizeProject(p){
  if(!Array.isArray(p.characters)) p.characters = [];
  for(const c of p.characters){
    if(typeof c.memo !== "string") c.memo = "";
    if(c.thumb === undefined) c.thumb = null;
    if(!Array.isArray(c.expressions)) c.expressions = [];
    if(!c.exprImages || typeof c.exprImages !== "object" || Array.isArray(c.exprImages)) c.exprImages = {};
  }
  if(!Array.isArray(p.exprTemplate)) p.exprTemplate = [];
  if(!Array.isArray(p.languages)) p.languages = [];
  if(!Array.isArray(p.sceneGroups)) p.sceneGroups = [];
  if(!Array.isArray(p.scenes)) p.scenes = [];
  for(const s of p.scenes){
    if(s.groupId !== undefined && s.groupId !== null && !p.sceneGroups.some(g => g.id === s.groupId))
      s.groupId = null;   // 参照先グループが存在しない場合は未分類に戻す
    if(s.groupId === undefined) s.groupId = null;
    if(typeof s.synopsis !== "string") s.synopsis = "";
  }
  if(typeof p.overview !== "string") p.overview = "";
  p.exportSettings = Object.assign({}, EXPORT_DEFAULTS,
    (p.exportSettings && typeof p.exportSettings === "object") ? p.exportSettings : {});
  if(!Array.isArray(p.honorificRules)) p.honorificRules = [];
  p.honorificRules = p.honorificRules.filter(r => r && typeof r === "object" && r.speakerId)
    .map(r => ({ id: r.id || uid(), speakerId: r.speakerId, targetId: r.targetId || null,
                 pattern: typeof r.pattern === "string" ? r.pattern : "", allowBare: !!r.allowBare }));
  const hv = (p.honorificVocab && typeof p.honorificVocab === "object") ? p.honorificVocab : {};
  p.honorificVocab = {
    self: Array.isArray(hv.self) ? hv.self.filter(w => typeof w === "string" && w) : [...HONOR_VOCAB_DEFAULTS.self],
    second: Array.isArray(hv.second) ? hv.second.filter(w => typeof w === "string" && w) : [...HONOR_VOCAB_DEFAULTS.second],
    suffix: Array.isArray(hv.suffix) ? hv.suffix.filter(w => typeof w === "string" && w) : [...HONOR_VOCAB_DEFAULTS.suffix],
  };
  return p;
}

/* ---------- 保存 / 履歴 ---------- */
function pushUndo(){
  undoStack.push(JSON.stringify(project));
  if(undoStack.length > 200) undoStack.shift();
  redoStack = [];
}
function undo(){
  if(!undoStack.length) return;
  redoStack.push(JSON.stringify(project));
  project = JSON.parse(undoStack.pop());
  afterRestore();
}
function redo(){
  if(!redoStack.length) return;
  undoStack.push(JSON.stringify(project));
  project = JSON.parse(redoStack.pop());
  afterRestore();
}
function afterRestore(){
  if(!sceneById(currentSceneId)) currentSceneId = project.scenes[0].id;
  if(speakerId && !charById(speakerId)) speakerId = null;
  selIndex = null; editIndex = null;
  scheduleSave(); renderAll();
}
function scheduleSave(){
  clearTimeout(saveTimer);
  $("#saveStatus").textContent = "…";
  saveTimer = setTimeout(() => {
    try{
      localStorage.setItem(LS_KEY, JSON.stringify(project));
      $("#saveStatus").textContent = "自動保存済 " + new Date().toLocaleTimeString();
    }catch(e){
      $("#saveStatus").textContent = "自動保存失敗";
    }
  }, 250);
}
function loadLocal(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(raw){
      const p = JSON.parse(raw);
      if(p && Array.isArray(p.scenes) && p.scenes.length) return normalizeProject(p);
    }
  }catch(e){}
  return null;
}

/* ---------- 変更操作 ---------- */
function mutate(fn){          // pushUndo → 変更 → 保存 → 再描画
  pushUndo();
  fn();
  // 行の増減・並べ替えでインデックスがずれるため、行の複数選択（Shift+クリック）は都度クリア
  selectedCmdIndices = new Set(); cmdSelectAnchor = null;
  scheduleSave();
  renderAll();
}
function insertCmd(cmd){
  mutate(() => {
    const at = selIndex === null ? cmds().length : selIndex + 1;
    cmds().splice(at, 0, cmd);
    if(selIndex !== null) selIndex = at;   // 挿入位置を追従
  });
  scrollToInsertPoint();
}
function deleteCmd(i){
  mutate(() => {
    cmds().splice(i, 1);
    if(selIndex !== null){
      if(selIndex === i) selIndex = i > 0 ? i - 1 : (cmds().length ? 0 : null);
      else if(selIndex > i) selIndex--;
    }
  });
}
function moveCmd(i, dir){
  const j = i + dir;
  if(j < 0 || j >= cmds().length) return;
  mutate(() => {
    const [c] = cmds().splice(i, 1);
    cmds().splice(j, 0, c);
    if(selIndex === i) selIndex = j;
  });
}
function dupCmd(i){
  mutate(() => {
    cmds().splice(i + 1, 0, JSON.parse(JSON.stringify(cmds()[i])));
    if(selIndex === i) selIndex = i + 1;
  });
}

/* ---------- 入力パース ---------- */
const SLASH_CMDS = [
  { cmd: "/bg",     desc: "背景を変更　例: /bg 教室" },
  { cmd: "/bgm",    desc: "BGMを変更（引数なしで停止）　例: /bgm 日常テーマ" },
  { cmd: "/se",     desc: "効果音を再生　例: /se ドア開閉" },
  { cmd: "/wait",   desc: "ウェイト（ミリ秒）　例: /wait 1000" },
  { cmd: "/jump",   desc: "シーンへジャンプ（未作成なら自動作成）　例: /jump ルートA" },
  { cmd: "/choice", desc: "選択肢　例: /choice はい>ルートA | いいえ>ルートB（引数なしで編集画面）" },
  { cmd: "/memo",   desc: "コメント行（// でも可）" },
];

// 戻り値: {cmd} | {error} | {handled} | null
function parseInput(raw, { sticky = true } = {}){
  const text = raw.replace(/[\s　]+$/, "");
  if(!text.trim()) return null;

  if(text.startsWith("//"))
    return { cmd: { type: "comment", text: text.slice(2).trim() } };

  if(text.startsWith("/")){
    const m = text.match(/^\/(\S*)[\s　]*([\s\S]*)$/);
    const name = m[1].toLowerCase(), arg = m[2].trim();
    switch(name){
      case "bg": case "bgm": case "se":
        if(name !== "bgm" && !arg) return { error: `/${name} には名前を指定してください` };
        return { cmd: { type: name, value: arg } };
      case "wait": {
        const n = parseInt(arg, 10);
        if(isNaN(n) || n < 0) return { error: "/wait にはミリ秒数を指定してください　例: /wait 1000" };
        return { cmd: { type: "wait", value: n } };
      }
      case "jump": {
        if(!arg) return { error: "/jump ジャンプ先シーン名" };
        return { cmd: { type: "jump", target: findOrCreateScene(arg) } };
      }
      case "choice": {
        if(!arg){ openChoiceModal(null); return { handled: true }; }
        const options = arg.split(/[|｜]/).map(part => {
          const [label, target] = part.split(/[>＞]/).map(s => s.trim());
          if(!label) return null;
          return { text: label, target: target ? findOrCreateScene(target) : null };
        }).filter(Boolean);
        if(!options.length) return { error: "選択肢がありません　例: /choice はい>ルートA | いいえ>ルートB" };
        return { cmd: { type: "choice", options } };
      }
      case "memo": case "comment":
        return { cmd: { type: "comment", text: arg } };
      default:
        return { error: `不明なコマンド: /${name}（F1でヘルプ）` };
    }
  }

  // @話者
  if(text.startsWith("@") || text.startsWith("＠")){
    const m = text.match(/^[@＠]([^\s　]*)(?:[\s　]+([\s\S]+))?$/);
    if(m){
      let name = m[1], face = null;
      const body = m[2];
      // 名前末尾の (表情) / （表情） を分離
      const fm = name.match(/^(.+?)[（(]([^（）()]*)[）)]$/);
      if(fm){ name = fm[1]; face = fm[2].trim() || null; }
      let chara = null;
      if(name === ""){                      // "@" → 地の文
        chara = null;
        if(sticky) setSpeaker(null);
      }else{
        const c = findOrCreateChar(name);
        chara = c.id;
        if(face && !c.expressions.includes(face)){
          c.expressions.push(face);
          toast(`「${c.name}」に表情「${face}」を追加しました`);
        }
        if(sticky) setSpeaker(c.id, face);   // 表情もスティッキーに（なしなら解除）
      }
      if(body === undefined) return { handled: true };  // 切替のみ
      return { cmd: { type: "serif", chara, face: chara ? face : null, text: textToStorage(body) } };
    }
  }

  return { cmd: { type: "serif", chara: speakerId, face: speakerId ? speakerFace : null, text: textToStorage(text) } };
}

/* ---------- 話者 ---------- */
function setSpeaker(id, face){
  if(id !== speakerId) speakerFace = null;   // 話者が変わったら表情はリセット
  speakerId = id;
  if(face !== undefined) speakerFace = id ? face : null;
  renderSpeakerChip();
}
function renderSpeakerChip(){
  const chip = $("#speakerChip");
  const fchip = $("#faceChip");
  const c = charById(speakerId);
  if(c){
    chip.innerHTML = `<span class="char-chip" style="background:${esc(c.color)}"></span>${esc(c.name)}`;
    chip.style.color = c.color;
    fchip.style.display = "";
    fchip.textContent = speakerFace ? `（${speakerFace}）` : "表情";
    fchip.style.color = speakerFace ? "var(--text)" : "var(--text-dim)";
  }else{
    chip.textContent = "地の文";
    chip.style.color = "var(--narration)";
    fchip.style.display = "none";
  }
}
