"use strict";
/* ---------- メイン入力欄 ---------- */
const mainInput = $("#mainInput");

function submitInput(){
  const r = parseInput(mainInput.value);
  if(!r) return;
  if(r.error){ toast(r.error, true); return; }
  mainInput.value = "";
  hideSlashPopup();
  if(r.handled){ renderAll(); return; }
  insertCmd(r.cmd);
}

mainInput.addEventListener("keydown", e => {
  if(e.isComposing || e.keyCode === 229) return;   // IME変換中は無視

  // Alt+1〜9: カーソル位置へキャラクター1〜9番の名前を挿入
  if(e.altKey && /^[1-9]$/.test(e.key)){
    e.preventDefault();
    insertMentionAtCursor(mainInput, +e.key - 1);
    return;
  }

  // スラッシュ候補ポップアップの操作
  if(slashPopupVisible()){
    if(e.key === "ArrowDown"){ e.preventDefault(); moveSlashHl(1); return; }
    if(e.key === "ArrowUp"){ e.preventDefault(); moveSlashHl(-1); return; }
    if(e.key === "Tab"){ e.preventDefault(); applySlashHl(); return; }
    if(e.key === "Escape"){ e.preventDefault(); hideSlashPopup(); return; }
  }

  const empty = mainInput.value === "";

  if(e.key === "Enter"){
    e.preventDefault();
    if(empty && selIndex !== null){ startEdit(selIndex); return; }
    submitInput();
    return;
  }
  if(empty){
    const n = cmds().length;
    if(e.key === "ArrowUp" && !e.ctrlKey){
      e.preventDefault();
      if(!n) return;
      selIndex = selIndex === null ? n - 1 : Math.max(0, selIndex - 1);
      renderCmds(); scrollToInsertPoint();
      return;
    }
    if(e.key === "ArrowDown" && !e.ctrlKey){
      e.preventDefault();
      if(selIndex === null) return;
      selIndex = selIndex >= n - 1 ? null : selIndex + 1;
      renderCmds(); scrollToInsertPoint();
      return;
    }
    if(e.key === "Delete" && selIndex !== null){
      e.preventDefault(); deleteCmd(selIndex); return;
    }
  }
  if(e.ctrlKey && (e.key === "ArrowUp" || e.key === "ArrowDown") && selIndex !== null){
    e.preventDefault();
    moveCmd(selIndex, e.key === "ArrowUp" ? -1 : 1);
    scrollToInsertPoint();
    return;
  }
  if(e.ctrlKey && (e.key === "d" || e.key === "D") && selIndex !== null){
    e.preventDefault(); dupCmd(selIndex); return;
  }
  if(e.key === "Escape"){
    e.preventDefault();
    if(selIndex !== null){ selIndex = null; renderCmds(); }
    hideSpeakerPopup();
    hideJumpPopup();
    hideFacePopup();
    return;
  }
});

mainInput.addEventListener("input", () => updateSlashPopup());

// 複数行貼り付け → 一括追加
mainInput.addEventListener("paste", e => {
  const text = (e.clipboardData || window.clipboardData).getData("text");
  if(!text || !/\r?\n/.test(text.trim())) return;
  e.preventDefault();
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);
  if(!lines.length) return;
  if(!confirm(`${lines.length} 行をまとめて追加しますか？\n（@名前 や /コマンド の記法も解釈されます）`)) return;
  pushUndo();
  let added = 0, errors = 0;
  for(const line of lines){
    const r = parseInput(line);
    if(r && r.cmd){
      const at = selIndex === null ? cmds().length : selIndex + 1;
      cmds().splice(at, 0, r.cmd);
      if(selIndex !== null) selIndex = at;
      added++;
    }else if(r && r.error){ errors++; }
  }
  scheduleSave(); renderAll(); scrollToInsertPoint();
  toast(`${added} 行を追加しました` + (errors ? `（${errors} 行はエラーでスキップ）` : ""));
});

/* ---------- スラッシュ候補ポップアップ ---------- */
let slashHl = 0;
function slashPopupVisible(){ return $("#slashPopup").style.display === "block"; }
function updateSlashPopup(){
  const v = mainInput.value;
  if(!v.startsWith("/") || v.startsWith("//") || v.includes(" ")){ hideSlashPopup(); return; }
  const matches = SLASH_CMDS.filter(c => c.cmd.startsWith(v));
  if(!matches.length || (matches.length === 1 && matches[0].cmd === v)){ hideSlashPopup(); return; }
  slashHl = Math.min(slashHl, matches.length - 1);
  const inner = $("#slashPopupInner");
  inner.innerHTML = matches.map((c, i) =>
    `<div class="popup-item${i === slashHl ? " hl" : ""}" data-cmd="${c.cmd}">` +
    `<span class="p-cmd">${c.cmd}</span><span class="p-desc">${esc(c.desc)}</span></div>`
  ).join("");
  inner.querySelectorAll(".popup-item").forEach(el => {
    el.addEventListener("mousedown", e => {
      e.preventDefault();
      mainInput.value = el.dataset.cmd + " ";
      hideSlashPopup(); mainInput.focus();
    });
  });
  $("#slashPopup").style.display = "block";
}
function hideSlashPopup(){ $("#slashPopup").style.display = "none"; slashHl = 0; }
function moveSlashHl(d){
  const items = document.querySelectorAll("#slashPopupInner .popup-item");
  if(!items.length) return;
  slashHl = (slashHl + d + items.length) % items.length;
  items.forEach((el, i) => el.classList.toggle("hl", i === slashHl));
}
function applySlashHl(){
  const items = document.querySelectorAll("#slashPopupInner .popup-item");
  if(!items.length) return;
  mainInput.value = items[slashHl].dataset.cmd + " ";
  hideSlashPopup();
}

/* ---------- 話者ポップアップ ---------- */
function speakerPopupVisible(){ return $("#speakerPopup").style.display === "block"; }
function toggleSpeakerPopup(){
  if(speakerPopupVisible()){ hideSpeakerPopup(); return; }
  const inner = $("#speakerPopupInner");
  let h = `<div class="popup-item" data-id=""><span class="p-cmd" style="color:var(--narration)">地の文</span><span class="p-desc">Ctrl+0</span></div>`;
  project.characters.forEach((c, i) => {
    h += `<div class="popup-item" data-id="${c.id}">` +
      `<span class="p-cmd" style="color:${esc(c.color)}">${esc(c.name)}</span>` +
      `<span class="p-desc">${i < 9 ? "Ctrl+" + (i + 1) : ""}</span></div>`;
  });
  h += `<div class="popup-item" data-id="__new__"><span class="p-cmd">${icon("plus")} 新規キャラ</span><span class="p-desc">キャラクターを追加</span></div>`;
  inner.innerHTML = h;
  inner.querySelectorAll(".popup-item").forEach(el => {
    el.addEventListener("mousedown", e => {
      e.preventDefault();
      const id = el.dataset.id;
      hideSpeakerPopup();
      if(id === "__new__"){ openCharModal(null); return; }
      setSpeaker(id || null);
      mainInput.focus();
    });
  });
  $("#speakerPopup").style.display = "block";
}
function hideSpeakerPopup(){ $("#speakerPopup").style.display = "none"; }
$("#speakerChip").addEventListener("click", toggleSpeakerPopup);
document.addEventListener("click", e => {
  if(!e.target.closest("#speakerPopup") && !e.target.closest("#speakerChip")) hideSpeakerPopup();
});

/* ---------- 表情ポップアップ（入力バー） ---------- */
function facePopupVisible(){ return $("#facePopup").style.display === "block"; }
function hideFacePopup(){ $("#facePopup").style.display = "none"; }
function toggleFacePopup(){
  if(facePopupVisible()){ hideFacePopup(); return; }
  const c = charById(speakerId);
  if(!c) return;
  hideSpeakerPopup(); hideJumpPopup();
  const inner = $("#facePopupInner");
  let h = `<div class="popup-item" data-face=""><span class="p-cmd" style="color:var(--text-dim)">（表情なし）</span></div>`;
  for(const ex of c.expressions)
    h += `<div class="popup-item" data-face="${esc(ex)}"><span class="p-cmd">${esc(ex)}</span></div>`;
  h += `<div class="popup-item" data-face="__new__"><span class="p-cmd">${icon("plus")} 新しい表情…</span><span class="p-desc">表情候補に追加</span></div>`;
  inner.innerHTML = h;
  inner.querySelectorAll(".popup-item").forEach(el => {
    el.addEventListener("mousedown", e => {
      e.preventDefault();
      hideFacePopup();
      let f = el.dataset.face;
      if(f === "__new__"){
        const v = prompt("新しい表情名:");
        if(!v || !v.trim()) return;
        f = v.trim();
        if(!c.expressions.includes(f)){ c.expressions.push(f); scheduleSave(); }
      }
      speakerFace = f || null;
      renderSpeakerChip();
      mainInput.focus();
    });
  });
  $("#facePopup").style.display = "block";
}
$("#faceChip").addEventListener("click", toggleFacePopup);
document.addEventListener("click", e => {
  if(!e.target.closest("#facePopup") && !e.target.closest("#faceChip")) hideFacePopup();
});

/* ---------- 選択肢／ジャンプ挿入ボタン ---------- */
$("#btnChoiceCmd").addEventListener("click", () => openChoiceModal(null));

function jumpPopupVisible(){ return $("#jumpPopup").style.display === "block"; }
function hideJumpPopup(){ $("#jumpPopup").style.display = "none"; }
$("#btnJumpCmd").addEventListener("click", () => {
  if(jumpPopupVisible()){ hideJumpPopup(); return; }
  hideSpeakerPopup(); hideSlashPopup();
  const inner = $("#jumpPopupInner");
  let h = "";
  const grouped = project.sceneGroups.length > 0;
  let lastGroup;
  for(const { scene: s, groupName } of scenesInGroupOrder()){
    if(grouped && groupName !== lastGroup){
      h += `<div class="popup-section">${esc(groupName || "未分類")}</div>`;
      lastGroup = groupName;
    }
    h += `<div class="popup-item" data-id="${s.id}"><span class="p-cmd">${esc(s.name)}</span><span class="p-desc">このシーンへジャンプ</span></div>`;
  }
  h += `<div class="popup-item" data-id="__new__"><span class="p-cmd">${icon("plus")} 新規シーン…</span><span class="p-desc">シーンを作成してジャンプ</span></div>`;
  inner.innerHTML = h;
  inner.querySelectorAll(".popup-item").forEach(el => {
    el.addEventListener("mousedown", e => {
      e.preventDefault();
      hideJumpPopup();
      let id = el.dataset.id;
      if(id === "__new__"){
        const name = prompt("新規シーン名:");
        if(!name || !name.trim()) return;
        id = findOrCreateScene(name.trim());
      }
      insertCmd({ type: "jump", target: id });
      mainInput.focus();
    });
  });
  $("#jumpPopup").style.display = "block";
});
document.addEventListener("click", e => {
  if(!e.target.closest("#jumpPopup") && !e.target.closest("#btnJumpCmd")) hideJumpPopup();
});
