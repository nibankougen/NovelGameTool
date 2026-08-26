"use strict";
/* ---------- インライン編集 ---------- */
// 編集で行オブジェクトを置き換える際、既存の翻訳(tr)を引き継ぐ
// （セリフはそのまま、選択肢は同一テキストの選択肢にのみ引き継ぐ）
function carryTr(oldCmd, newCmd){
  if(!oldCmd || !newCmd) return newCmd;
  if(oldCmd.type === "serif" && newCmd.type === "serif" && oldCmd.tr) newCmd.tr = oldCmd.tr;
  if(oldCmd.type === "choice" && newCmd.type === "choice"){
    for(const o of newCmd.options){
      const m = oldCmd.options.find(x => x.text === o.text && x.tr);
      if(m) o.tr = m.tr;
    }
  }
  return newCmd;
}

function cmdToInputText(c){
  switch(c.type){
    case "serif":  return c.chara ? `@${(charById(c.chara) || {name:"?"}).name}${c.face ? `(${c.face})` : ""} ${c.text}` : `@ ${c.text}`;
    case "bg":     return `/bg ${c.value}`;
    case "bgm":    return `/bgm ${c.value}`;
    case "se":     return `/se ${c.value}`;
    case "wait":   return `/wait ${c.value}`;
    case "jump":   return `/jump ${(sceneById(c.target) || {name:""}).name}`;
    case "comment":return `//${c.text}`;
    default: return null;
  }
}

/* 非編集時のクリック位置から、編集開始時のカーソル位置や操作対象（話者/表情チップ）を推定 */
function computeClickInfo(e, c){
  let node = null, offset = 0;
  if(document.caretRangeFromPoint){
    const r = document.caretRangeFromPoint(e.clientX, e.clientY);
    if(r){ node = r.startContainer; offset = r.startOffset; }
  }else if(document.caretPositionFromPoint){
    const p = document.caretPositionFromPoint(e.clientX, e.clientY);
    if(p){ node = p.offsetNode; offset = p.offset; }
  }
  if(!node || node.nodeType !== Node.TEXT_NODE) return null;
  const parent = node.parentElement;
  if(!parent) return null;
  if(parent.closest(".speaker-name")) return { zone: "speaker" };
  if(parent.closest(".face-tag")) return { zone: "face" };
  if(c.type === "serif"){
    // 本文中に名前参照（《名前》）があると1つのテキストノードに収まらないため、
    // 「」または地の文全体を囲うコンテナ内での絶対位置（解決済み表示上の位置）から算出する
    const container = parent.closest(".serif-text") || parent.closest(".narration");
    let resolvedOff;
    if(container){
      const range = document.createRange();
      range.selectNodeContents(container);
      range.setEnd(node, offset);
      resolvedOff = range.toString().length;
      if(container.classList.contains("serif-text")) resolvedOff -= 1;   // 先頭の「 を除外
    }else{
      const raw = node.data;
      resolvedOff = raw.charAt(0) === "「" ? offset - 1 : offset;
    }
    resolvedOff = Math.max(0, resolvedOff);
    // 編集欄は《名前》表示のため、その文字位置に変換してから返す
    const off = Math.max(0, Math.min(resolvedOffsetToDisplayOffset(c.text, resolvedOff), textToDisplay(c.text).length));
    return { zone: "text", offset: off };
  }
  if(parent.classList.contains("sys-tag")) return null;   // ラベル部分（背景/BGM等の見出し語）は対象外
  if(!(parent.classList.contains("sys-cmd") || parent.classList.contains("comment-cmd"))) return null;
  if(cmdBroken(c)) return null;                            // 壊れた参照は表示文字列が値と一致しないため対象外
  if(c.type === "bgm" && !c.value) return null;             // 「（停止）」表示は値と一致しない
  const inputText = cmdToInputText(c) ?? "";
  if(!inputText) return null;
  let off = offset;
  if(c.type === "wait") off = Math.min(off, String(c.value).length);   // 末尾の "ms" 分を除外
  const distFromEnd = Math.max(0, node.data.length - off);
  const pos = Math.max(0, Math.min(inputText.length, inputText.length - distFromEnd));
  return { zone: "text", offset: pos };
}

function startEdit(i){
  const c = cmds()[i];
  if(c.type === "choice"){ openChoiceModal(i); return; }
  editIndex = i;
  renderCmds();
}

function mountEditRow(){
  const i = editIndex;
  const row = $(`.cmd-row[data-idx="${i}"]`);
  if(!row) { editIndex = null; return; }
  const c = cmds()[i];
  const clickInfo = pendingEditClick; pendingEditClick = null;
  row.querySelector(".row-actions").style.display = "none";
  row.addEventListener("dblclick", e => e.stopPropagation());
  if(c.type === "serif") mountSerifEditRow(row, i, c, clickInfo);
  else mountPlainEditRow(row, i, c, clickInfo);
}

/* セリフ以外の行: 従来どおりテキストで編集 */
function mountPlainEditRow(row, i, c, clickInfo){
  const body = row.querySelector(".row-body");
  const inp = document.createElement("input");
  inp.type = "text";
  inp.className = "plain-edit-text";
  inp.value = cmdToInputText(c) ?? "";
  inp.style.cssText = "width:100%;font-size:14px";
  body.innerHTML = ""; body.appendChild(inp);
  inp.focus();
  const pos = (clickInfo && clickInfo.zone === "text") ? clickInfo.offset : inp.value.length;
  inp.setSelectionRange(pos, pos);
  let done = false;
  const finish = commit => {
    if(done) return; done = true;
    if(commit){
      const r = parseInput(inp.value, { sticky: false });
      if(r && r.error){ toast(r.error, true); done = false; inp.focus(); return; }
      editIndex = null;                       // mutate→renderCmds の再入で編集行が再生成されないよう先にクリア
      if(r && r.cmd){
        mutate(() => { cmds()[i] = carryTr(cmds()[i], r.cmd); });
      }else{
        renderCmds();
      }
    }else{
      editIndex = null;
      renderCmds();
    }
    $("#mainInput").focus();
  };
  inp.addEventListener("keydown", e => {
    if(e.isComposing || e.keyCode === 229) return;
    if(e.key === "Enter"){ e.preventDefault(); finish(true); }
    else if(e.key === "Escape"){ e.preventDefault(); finish(false); }
    e.stopPropagation();
  });
  inp.addEventListener("blur", () => finish(true));
  inp.addEventListener("click", e => e.stopPropagation());
}

/* セリフ行: 話者・表情はチップ（クリックで切替、Backspace/Deleteで丸ごと削除） */
function mountSerifEditRow(row, i, c, clickInfo){
  const body = row.querySelector(".row-body");
  body.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "edit-wrap";
  body.appendChild(wrap);

  let spk  = (c.chara && charById(c.chara)) ? c.chara : null;
  let face = c.face || null;

  const editThumb = document.createElement("img");
  editThumb.className = "edit-thumb";
  editThumb.alt = "";
  editThumb.title = "話者のサムネイル（表情画像がない場合はデフォルトイラスト）";
  const spkChip = document.createElement("button");
  spkChip.type = "button"; spkChip.className = "edit-chip edit-chip-spk";
  spkChip.title = "クリックで話者切替／Backspaceで削除（地の文に）";
  const faceChip = document.createElement("button");
  faceChip.type = "button"; faceChip.className = "edit-chip edit-chip-face";
  faceChip.title = "クリックで表情切替／Backspaceで表情削除";
  // 表示時の「」を編集中も残し、本文の見た目位置をなるべく変えない
  const textGroup = document.createElement("span");
  textGroup.className = "edit-text-group";
  const qOpen = document.createElement("span");
  qOpen.className = "edit-quote"; qOpen.textContent = "「";
  const qClose = document.createElement("span");
  qClose.className = "edit-quote"; qClose.textContent = "」";
  const inp = document.createElement("input");
  inp.type = "text"; inp.className = "edit-text"; inp.value = textToDisplay(c.text);
  textGroup.append(qOpen, inp, qClose);
  wrap.append(editThumb, spkChip, faceChip, textGroup);

  function renderChips(){
    const ch = charById(spk);
    // サムネイル: 表情画像 > 基本サムネイル。地の文・画像なしは非表示
    const src = ch ? ((face && (ch.exprImages || {})[face]) || ch.thumb) : null;
    if(src){ editThumb.src = src; editThumb.style.display = ""; }
    else { editThumb.style.display = "none"; editThumb.removeAttribute("src"); }
    if(ch){
      spkChip.textContent = ch.name;   // 表示時の .speaker-name（色文字のみ）に合わせ、色ドットは付けない
      spkChip.style.color = ch.color;
      faceChip.style.display = "";
      faceChip.innerHTML = face ? esc(`（${face}）`) : `${icon("plus")}表情`;
      faceChip.style.color = face ? "" : "var(--text-dim)";
      // 表情未設定時は本文の後ろへ回し、本文の開始位置がズレないようにする
      faceChip.style.order = face ? "" : "2";
      qOpen.style.display = ""; qClose.style.display = "";
    }else{
      spkChip.textContent = "地の文";
      spkChip.style.color = "var(--narration)";
      faceChip.style.display = "none";
      qOpen.style.display = "none"; qClose.style.display = "none";
    }
  }
  renderChips();

  let menu = null;
  const closeMenu = () => { if(menu){ menu.remove(); menu = null; } };
  function openMenu(anchor, items){
    closeMenu();
    menu = document.createElement("div");
    menu.className = "edit-menu";
    for(const it of items){
      const el = document.createElement("div");
      el.className = "em-item";
      el.innerHTML = (it.icon ? icon(it.icon) + " " : "") + esc(it.label);
      if(it.color) el.style.color = it.color;
      // mousedownでフォーカスを奪わない／clickは行の選択トグルまで伝播させない
      el.addEventListener("mousedown", e => e.preventDefault());
      el.addEventListener("click", e => {
        e.stopPropagation();
        closeMenu(); it.pick();
      });
      menu.appendChild(el);
    }
    wrap.appendChild(menu);
    menu.style.left = Math.max(0, Math.min(anchor.offsetLeft, wrap.clientWidth - 160)) + "px";
    menu.style.top = (anchor.offsetTop + anchor.offsetHeight + 4) + "px";
  }

  spkChip.addEventListener("click", e => {
    e.stopPropagation();
    const items = [{ label: "地の文", color: "var(--narration)",
                     pick(){ spk = null; face = null; renderChips(); inp.focus(); } }];
    for(const ch of project.characters)
      items.push({ label: ch.name, color: ch.color, pick(){
        spk = ch.id;
        if(face && !ch.expressions.includes(face)) face = null;  // 切替先にない表情は外す
        renderChips(); inp.focus();
      }});
    items.push({ label: "新規キャラ…", icon: "plus", color: "var(--text-dim)", pick(){
      const name = prompt("新しいキャラクター名:");
      if(name && name.trim()){
        spk = findOrCreateChar(name).id;
        scheduleSave(); renderChars();
      }
      renderChips(); inp.focus();
    }});
    openMenu(spkChip, items);
  });
  faceChip.addEventListener("click", e => {
    e.stopPropagation();
    const ch = charById(spk);
    if(!ch) return;
    const items = [{ label: "（表情なし）", color: "var(--text-dim)",
                     pick(){ face = null; renderChips(); inp.focus(); } }];
    for(const ex of ch.expressions)
      items.push({ label: ex, pick(){ face = ex; renderChips(); inp.focus(); } });
    items.push({ label: "新しい表情…", icon: "plus", color: "var(--text-dim)", pick(){
      const ex = prompt("新しい表情名:");
      if(ex && ex.trim()){
        face = ex.trim();
        if(!ch.expressions.includes(face)) ch.expressions.push(face);
        scheduleSave();
      }
      renderChips(); inp.focus();
    }});
    openMenu(faceChip, items);
  });
  // チップにフォーカスして Delete/Backspace → チップ丸ごと削除
  spkChip.addEventListener("keydown", e => {
    if(e.key === "Delete" || e.key === "Backspace"){
      e.preventDefault(); spk = null; face = null; renderChips(); inp.focus();
    }
  });
  faceChip.addEventListener("keydown", e => {
    if(e.key === "Delete" || e.key === "Backspace"){
      e.preventDefault(); face = null; renderChips(); inp.focus();
    }
  });

  let done = false;
  const finish = commit => {
    if(done) return; done = true;
    closeMenu();
    if(commit){
      const t = inp.value.replace(/[\s　]+$/, "");
      if(/^[@＠/]/.test(t)){
        // 従来記法もそのまま使える（/bg 等へのコマンド変換・@記法）
        const r = parseInput(t, { sticky: false });
        if(r && r.error){ toast(r.error, true); done = false; inp.focus(); return; }
        editIndex = null;
        if(r && r.cmd) mutate(() => { cmds()[i] = carryTr(cmds()[i], r.cmd); });
        else renderCmds();
      }else if(t){
        editIndex = null;
        mutate(() => { cmds()[i] = carryTr(cmds()[i], { type: "serif", chara: spk, face: spk ? face : null, text: textToStorage(t) }); });
      }else{
        editIndex = null;
        renderCmds();
      }
    }else{
      editIndex = null;
      renderCmds();
    }
    $("#mainInput").focus();
  };

  inp.addEventListener("keydown", e => {
    if(e.isComposing || e.keyCode === 229) return;
    if(e.key === "Enter"){ e.preventDefault(); finish(true); }
    else if(e.key === "Escape"){ e.preventDefault(); if(menu) closeMenu(); else finish(false); }
    else if(e.key === "Backspace" && inp.selectionStart === 0 && inp.selectionEnd === 0){
      // 文頭でBackspace → 表情 → 話者 の順にチップを丸ごと削除
      e.preventDefault();
      if(face) face = null;
      else if(spk){ spk = null; }
      renderChips();
    }
    else if(e.altKey && /^[1-9]$/.test(e.key)){
      // Alt+1〜9: カーソル位置へキャラクター1〜9番の名前を挿入
      e.preventDefault();
      insertMentionAtCursor(inp, +e.key - 1);
    }
    e.stopPropagation();
  });
  // チップ上のキー操作でもグローバルショートカットを発火させない
  wrap.addEventListener("keydown", e => {
    if(e.target !== inp && e.key === "Escape"){
      e.preventDefault();
      if(menu) closeMenu(); else finish(false);
    }
    e.stopPropagation();
  });
  wrap.addEventListener("click", e => e.stopPropagation());
  // フォーカスがチップ⇔入力欄の間で移動しても確定しない。wrap外に出たら確定
  wrap.addEventListener("focusout", e => {
    if(wrap.contains(e.relatedTarget)) return;
    setTimeout(() => {
      if(!done && !wrap.contains(document.activeElement)) finish(true);
    }, 0);
  });

  if(clickInfo && clickInfo.zone === "speaker"){
    spkChip.focus(); spkChip.click();          // 話者名クリック → すぐ話者変更メニュー
  }else if(clickInfo && clickInfo.zone === "face" && faceChip.style.display !== "none"){
    faceChip.focus(); faceChip.click();        // 表情クリック → すぐ表情変更メニュー
  }else{
    inp.focus();
    const pos = (clickInfo && clickInfo.zone === "text") ? clickInfo.offset : inp.value.length;
    inp.setSelectionRange(pos, pos);
  }
}
