"use strict";
/* ---------- 描画 ---------- */
function renderAll(){
  renderScenes();
  renderChars();
  renderCmds();
  if(searchOpen()) runSearch();   // データ変更に検索結果を追従させる
  renderSpeakerChip();
  $("#projectTitle").value = project.title;
}

/* ---------- シーングループ（章など） ---------- */
const collapsedGroups = new Set();   // 折りたたみ中のグループid（"__ungrouped__"含む）。セッション内のみ
const expandedScenes = new Set();     // あらすじメモを開いているシーンid。セッション内のみ
let sceneRowMap = [];                 // renderScenes()時点の可視シーン行の並び（ドラッグ&ドロップで参照）

const sceneGroupCount = groupId => project.scenes.filter(s => (s.groupId || null) === groupId).length;

function renderScenes(){
  const box = $("#sceneList");
  box.innerHTML = "";
  sceneRowMap = [];
  const groups = project.sceneGroups;

  const appendSceneRows = (groupId, indented) => {
    for(const s of project.scenes){
      if((s.groupId || null) !== groupId) continue;
      box.appendChild(makeSceneRow(s, indented));
      sceneRowMap.push({ sceneId: s.id, groupId });
      if(expandedScenes.has(s.id)) box.appendChild(makeSceneMemoPanel(s, indented));
    }
  };

  if(!groups.length){
    appendSceneRows(null, false);
    return;
  }

  groups.forEach(g => {
    box.appendChild(makeGroupHeadRow(g));
    if(!collapsedGroups.has(g.id)) appendSceneRows(g.id, true);
  });
  if(sceneGroupCount(null) > 0){
    box.appendChild(makeGroupHeadRow(null));
    if(!collapsedGroups.has("__ungrouped__")) appendSceneRows(null, true);
  }
}

function makeGroupHeadRow(g){
  const isUngrouped = !g;
  const id = isUngrouped ? "__ungrouped__" : g.id;
  const collapsed = collapsedGroups.has(id);
  const count = sceneGroupCount(isUngrouped ? null : g.id);
  const div = document.createElement("div");
  div.className = "scene-group-head" + (isUngrouped ? " ungrouped" : "");
  div.dataset.groupId = isUngrouped ? "" : g.id;   // ドラッグ中に見出しへドロップした際の判定に使用
  div.innerHTML =
    (isUngrouped ? "" : `<span class="drag-handle" title="ドラッグで並べ替え">${icon("grip-vertical")}</span>`) +
    `<span class="g-caret">${collapsed ? icon("chevron-right") : icon("chevron-down")}</span>` +
    `<span class="g-name">${isUngrouped ? "未分類" : esc(g.name)}</span>` +
    `<span class="s-count">${count}</span>` +
    (isUngrouped ? "" :
      `<span class="s-btns">` +
        `<button class="mini-btn" data-act="add" title="このグループにシーンを追加">${icon("plus")}</button>` +
        `<button class="mini-btn" data-act="ren" title="名前変更">${icon("pencil")}</button>` +
        `<button class="mini-btn" data-act="del" title="グループを削除（シーンは削除されず未分類になります）">${icon("trash-2")}</button>` +
      `</span>`);
  div.addEventListener("click", e => {
    const act = e.target.dataset.act;
    if(!isUngrouped && act === "del"){
      if(!confirm(`グループ「${g.name}」を削除しますか？\n（含まれるシーンは削除されず、未分類になります）`)) return;
      mutate(() => {
        const idx = project.sceneGroups.findIndex(x => x.id === g.id);
        project.sceneGroups.splice(idx, 1);
        for(const s of project.scenes) if(s.groupId === g.id) s.groupId = null;
      });
      return;
    }
    if(!isUngrouped && act === "ren"){ startGroupRename(div, g); return; }
    if(!isUngrouped && act === "add"){ createScene(g.id); return; }
    // それ以外（見出し本体クリック）は折りたたみ切替
    if(collapsed) collapsedGroups.delete(id); else collapsedGroups.add(id);
    renderScenes();
  });
  div.addEventListener("dblclick", e => {
    if(!isUngrouped && !e.target.dataset.act) startGroupRename(div, g);
  });
  return div;
}

function startGroupRename(div, g){
  const inp = document.createElement("input");
  inp.type = "text"; inp.value = g.name;
  inp.style.cssText = "width:100%;padding:2px 6px;font-size:13px";
  div.innerHTML = ""; div.appendChild(inp);
  inp.focus(); inp.select();
  let done = false;
  const commit = ok => {
    if(done) return; done = true;
    const v = inp.value.trim();
    if(ok && v && v !== g.name) mutate(() => { g.name = v; });
    else renderAll();
  };
  inp.addEventListener("keydown", e => {
    if(e.isComposing) return;
    if(e.key === "Enter") commit(true);
    if(e.key === "Escape") commit(false);
    e.stopPropagation();
  });
  inp.addEventListener("blur", () => commit(true));
  inp.addEventListener("click", e => e.stopPropagation());
}

function makeSceneRow(s, indented){
  const div = document.createElement("div");
  div.className = "scene-item" + (indented ? " grouped" : "") + (s.id === currentSceneId ? " active" : "");
  div.dataset.sceneId = s.id;
  div.innerHTML =
    `<span class="drag-handle" title="ドラッグで並べ替え">${icon("grip-vertical")}</span>` +
    `<span class="s-name">${esc(s.name)}</span>` +
    (sceneHasAlert(s) ? `<span class="s-alert" title="削除済みのシーンやキャラへの参照があります">${icon("triangle-alert")}</span>` : "") +
    `<span class="s-count">${s.commands.length}</span>` +
    `<button class="mini-btn s-caret" data-act="memo" title="あらすじメモを開閉">${expandedScenes.has(s.id) ? icon("chevron-down") : icon("chevron-right")}</button>` +
    `<span class="s-btns">` +
      `<button class="mini-btn" data-act="ren" title="名前変更">${icon("pencil")}</button>` +
      `<button class="mini-btn" data-act="del" title="削除">${icon("trash-2")}</button>` +
    `</span>`;
  div.addEventListener("click", e => {
    const act = e.target.dataset.act;
    if(act === "del"){
      if(project.scenes.length <= 1){ toast("最後のシーンは削除できません", true); return; }
      if(!confirm(`シーン「${s.name}」を削除しますか？`)) return;
      mutate(() => {
        const idx = project.scenes.findIndex(x => x.id === s.id);
        project.scenes.splice(idx, 1);
        if(currentSceneId === s.id) currentSceneId = project.scenes[0].id;
      });
    }else if(act === "ren"){
      startSceneRename(div, s);
    }else if(act === "memo"){
      if(expandedScenes.has(s.id)) expandedScenes.delete(s.id); else expandedScenes.add(s.id);
      renderScenes();
    }else{
      if(currentSceneId !== s.id){
        currentSceneId = s.id; selIndex = null; editIndex = null;
        renderAll();
        $("#mainInput").focus();
      }
    }
  });
  div.addEventListener("dblclick", e => {
    if(!e.target.dataset.act) startSceneRename(div, s);
  });
  return div;
}

function makeSceneMemoPanel(s, indented){
  const panel = document.createElement("div");
  panel.className = "scene-memo-panel" + (indented ? " grouped" : "");
  const ta = document.createElement("textarea");
  ta.placeholder = "このシーンのあらすじ・メモ…";
  ta.value = s.synopsis || "";
  ta.addEventListener("focus", () => pushUndo(), { once: true });   // 編集セッション単位でUndo可能に
  ta.addEventListener("input", () => { s.synopsis = ta.value; scheduleSave(); });
  ta.addEventListener("keydown", e => e.stopPropagation());
  panel.appendChild(ta);
  return panel;
}

function startSceneRename(div, s){
  const inp = document.createElement("input");
  inp.type = "text"; inp.value = s.name;
  inp.style.cssText = "width:100%;padding:2px 6px;font-size:13px";
  div.innerHTML = ""; div.appendChild(inp);
  inp.focus(); inp.select();
  let done = false;
  const commit = ok => {
    if(done) return; done = true;
    const v = inp.value.trim();
    if(ok && v && v !== s.name) mutate(() => { s.name = v; });
    else renderAll();
  };
  inp.addEventListener("keydown", e => {
    if(e.isComposing) return;
    if(e.key === "Enter") commit(true);
    if(e.key === "Escape") commit(false);
    e.stopPropagation();
  });
  inp.addEventListener("blur", () => commit(true));
  inp.addEventListener("click", e => e.stopPropagation());
}


const expandedChars = new Set();   // メモを開いているキャラid
function renderChars(){
  const box = $("#charList");
  box.innerHTML = "";
  project.characters.forEach((c, i) => {
    const open = expandedChars.has(c.id);
    const div = document.createElement("div");
    div.className = "char-item";
    div.title = "クリックで話者に設定／鉛筆で編集／矢印でメモ";
    div.innerHTML =
      `<span class="drag-handle" title="ドラッグで並べ替え">${icon("grip-vertical")}</span>` +
      (c.thumb
        ? `<img class="char-thumb" src="${esc(c.thumb)}" alt="">`
        : `<span class="char-chip" style="background:${esc(c.color)}"></span>`) +
      `<span class="c-name" style="color:${esc(c.color)}">${esc(c.name)}</span>` +
      (i < 9 ? `<span class="c-key">Ctrl+${i + 1}</span>` : "") +
      `<span class="c-btns"><button class="mini-btn" data-act="edit" title="編集">${icon("pencil")}</button></span>` +
      `<button class="mini-btn c-caret" data-act="memo" title="メモを開閉">${open ? icon("chevron-down") : icon("chevron-right")}</button>`;
    div.addEventListener("click", e => {
      const act = e.target.dataset.act;
      if(act === "edit") openCharModal(c);
      else if(act === "memo"){
        open ? expandedChars.delete(c.id) : expandedChars.add(c.id);
        renderChars();
      }
      else { setSpeaker(c.id); $("#mainInput").focus(); }
    });
    box.appendChild(div);
    if(open){
      const panel = document.createElement("div");
      panel.className = "char-memo-panel";
      const ta = document.createElement("textarea");
      ta.placeholder = "設定メモ…";
      ta.value = c.memo || "";
      ta.addEventListener("focus", () => pushUndo(), { once: true });  // 編集セッション単位でUndo可能に
      ta.addEventListener("input", () => { c.memo = ta.value; scheduleSave(); });
      ta.addEventListener("keydown", e => e.stopPropagation());
      panel.appendChild(ta);
      box.appendChild(panel);
    }
  });
}

/* データ整合性: 削除済みキャラ／シーンへの参照が残っていないか */
function cmdBroken(c){
  switch(c.type){
    case "serif": {
      if(!c.chara) return false;
      const ch = charById(c.chara);
      return !ch || !!(c.face && !ch.expressions.includes(c.face));
    }
    case "jump":   return !sceneById(c.target);
    case "choice": return c.options.some(o => o.target && !sceneById(o.target));
    default:       return false;
  }
}
const sceneHasAlert = s => s.commands.some(cmdBroken);

/* ---------- 人称チェック（簡易） ----------
   キャラごとに登録した一人称・他キャラの呼び方（正規表現）と、
   プロジェクト共通の候補語リストを突き合わせ、登録と異なる言い回しを検出する。
   あくまで簡易チェック（誤検出・見逃しはあり得る）。narration（地の文）は話者がいないため対象外。 */
function honorificIssues(c){
  if(c.type !== "serif" || !c.chara) return [];
  const rules = (project.honorificRules || []).filter(r => r.speakerId === c.chara);
  if(!rules.length) return [];
  const text = textToResolved(c.text);
  const vocab = project.honorificVocab || {};
  const issues = [];

  // 一人称: 候補語のうち、登録パターンに一致しないものが本文に出てきたら通知
  const selfRules = rules.filter(r => !r.targetId && r.pattern);
  if(selfRules.length){
    let re = null;
    try{ re = new RegExp(selfRules.map(r => `(?:${r.pattern})`).join("|")); }catch(e){}
    if(re) for(const w of vocab.self || [])
      if(w && text.includes(w) && !re.test(w)) issues.push(`一人称「${w}」`);
  }

  // 二人称（名前を伴わない呼びかけ: キミ・あなた等）: 一人称と同様に候補語と照合
  const secondRules = rules.filter(r => r.targetId === HONOR_SECOND && r.pattern);
  if(secondRules.length){
    let re = null;
    try{ re = new RegExp(secondRules.map(r => `(?:${r.pattern})`).join("|")); }catch(e){}
    if(re) for(const w of vocab.second || [])
      if(w && text.includes(w) && !re.test(w)) issues.push(`二人称「${w}」`);
  }

  // 呼び方（対他キャラ）: 対象名＋敬称候補が出てきたとき、登録パターン（＋呼び捨て許可）に一致しなければ通知
  const byTarget = new Map();
  for(const r of rules) if(r.targetId && r.targetId !== HONOR_SECOND){
    if(!byTarget.has(r.targetId)) byTarget.set(r.targetId, []);
    byTarget.get(r.targetId).push(r);
  }
  for(const [targetId, rs] of byTarget){
    const target = charById(targetId);
    if(!target || !target.name) continue;
    const pat = rs.map(r => r.pattern).filter(Boolean).join("|");
    let re = null;
    if(pat){ try{ re = new RegExp("^(?:" + pat + ")"); }catch(e){} }
    const allowBare = rs.some(r => r.allowBare);
    const name = target.name;
    let idx = 0;
    while(true){
      const p = text.indexOf(name, idx);
      if(p === -1) break;
      idx = p + name.length;
      const rest = text.slice(idx);
      const suffix = (vocab.suffix || []).find(s => s && rest.startsWith(s));
      if(suffix){
        if(!re || !re.test(rest)) issues.push(`「${name}${suffix}」`);
      }else if(!allowBare){
        issues.push(`「${name}」を呼び捨て`);
      }
    }
  }
  return [...new Set(issues)];
}

function cmdHtml(c){
  switch(c.type){
    case "serif": {
      if(c.chara){
        const ch = charById(c.chara);
        const name = ch ? esc(ch.name) : `<span class="broken-ref">${icon("triangle-alert")}（削除済キャラ）</span>`;
        const color = ch ? esc(ch.color) : "var(--danger)";
        const faceBroken = !!(c.face && ch && !ch.expressions.includes(c.face));
        const face = c.face
          ? (faceBroken
              ? `<span class="face-tag broken-ref" title="表情候補から削除された表情です">${icon("triangle-alert")}（${esc(c.face)}）</span>`
              : `<span class="face-tag">（${esc(c.face)}）</span>`)
          : "";
        // 顔画像: 表情画像 > デフォルトイラスト（なければ非表示）
        const img = ch ? ((c.face && (ch.exprImages || {})[c.face]) || ch.thumb) : null;
        const imgH = img ? `<img class="row-face" src="${esc(img)}" alt="">` : "";
        return `${imgH}<span class="speaker-name" style="color:${color}">${name}</span>${face}<span class="serif-text">「${textToHtml(c.text)}」</span>`;
      }
      return `<span class="narration">${textToHtml(c.text)}</span>`;
    }
    case "bg":   return `<span class="sys-cmd"><span class="sys-tag">背景</span>${esc(c.value)}</span>`;
    case "bgm":  return `<span class="sys-cmd"><span class="sys-tag">BGM</span>${c.value ? esc(c.value) : "（停止）"}</span>`;
    case "se":   return `<span class="sys-cmd"><span class="sys-tag">効果音</span>${esc(c.value)}</span>`;
    case "wait": return `<span class="sys-cmd"><span class="sys-tag">待機</span>${esc(c.value)}ms</span>`;
    case "jump": {
      const s = sceneById(c.target);
      const dest = s
        ? `→ ${esc(s.name)}<button type="button" class="opt-goto" data-act="goto-scene" data-scene-id="${s.id}" title="このシーンへ移動">${icon("corner-down-right")}</button>`
        : `<span class="broken-ref">${icon("triangle-alert")}→（削除済シーン）</span>`;
      return `<span class="sys-cmd"><span class="sys-tag">ジャンプ</span>${dest}</span>`;
    }
    case "choice": {
      let h = `<span class="choice-cmd"><span class="sys-tag">選択肢</span></span>`;
      for(const o of c.options){
        const s = o.target ? sceneById(o.target) : null;
        const dest = o.target
          ? (s
              ? `<span class="opt-arrow">→ ${esc(s.name)}<button type="button" class="opt-goto" data-act="goto-scene" data-scene-id="${s.id}" title="このシーンへ移動">${icon("corner-down-right")}</button></span>`
              : `<span class="opt-arrow broken-ref">${icon("triangle-alert")}→（削除済シーン）</span>`)
          : `<span class="opt-arrow">→ 続行</span>`;
        h += `<span class="choice-opt">◆ ${esc(o.text)}${dest}</span>`;
      }
      return h;
    }
    case "comment": return `<span class="comment-cmd">💬 ${esc(c.text)}</span>`;
    default: return esc(JSON.stringify(c));
  }
}

function renderCmds(){
  const box = $("#cmdList");
  box.innerHTML = "";
  const list = cmds();
  if(!list.length){
    box.innerHTML = `<div id="emptyHint">まだ何もありません。<br>
      下の入力欄にセリフを入力して <kbd>Enter</kbd> で追加できます。<br>
      <kbd>@名前 セリフ</kbd> で話者切替、<kbd>/</kbd> でコマンド入力、<kbd>F1</kbd> でヘルプ。</div>`;
    return;
  }
  list.forEach((c, i) => {
    const row = document.createElement("div");
    row.className = "cmd-row" + (cmdBroken(c) ? " alert" : "") + (i === selIndex ? " selected" : "");
    row.dataset.idx = i;
    const hIssues = honorificIssues(c);
    row.innerHTML =
      `<span class="drag-handle" title="ドラッグで並べ替え">${icon("grip-vertical")}</span>` +
      `<span class="row-num">${i + 1}</span>` +
      (hIssues.length
        ? `<span class="honor-badge" title="${esc("人称の表記ゆれ: " + hIssues.join("、"))}">${icon("circle-alert")}</span>`
        : "") +
      `<span class="row-body">${cmdHtml(c)}</span>` +
      `<span class="row-actions">` +
        `<button data-act="up" title="上へ移動 (Ctrl+↑)">${icon("chevron-up")}</button>` +
        `<button data-act="down" title="下へ移動 (Ctrl+↓)">${icon("chevron-down")}</button>` +
        `<button data-act="dup" title="複製 (Ctrl+D)">${icon("copy")}</button>` +
        `<button data-act="edit" title="編集 (Enter)">${icon("pencil")}</button>` +
        `<button data-act="del" title="削除 (Del)">${icon("trash-2")}</button>` +
      `</span>`;
    row.addEventListener("click", e => {
      const act = e.target.dataset.act;
      if(act === "del") deleteCmd(i);
      else if(act === "dup") dupCmd(i);
      else if(act === "edit") startEdit(i);
      else if(act === "up") moveCmd(i, -1);
      else if(act === "down") moveCmd(i, 1);
      else if(act === "goto-scene") gotoScene(e.target.dataset.sceneId);
      else {
        selIndex = i;   // 選択状態にして矢印キー等の操作対象にする
        pendingEditClick = computeClickInfo(e, c);   // クリック位置→カーソル位置/チップ自動展開に使用
        startEdit(i);   // 行の文字部分クリックで即編集開始
      }
    });
    box.appendChild(row);
  });
  if(editIndex !== null) mountEditRow();
}

function gotoScene(sceneId){
  const s = sceneById(sceneId);
  if(!s) return;
  currentSceneId = s.id; selIndex = null; editIndex = null;
  renderAll();
}

function scrollToInsertPoint(){
  const wrap = $("#cmdListWrap");
  if(selIndex === null){ wrap.scrollTop = wrap.scrollHeight; return; }
  const row = $(`.cmd-row[data-idx="${selIndex}"]`);
  if(row) row.scrollIntoView({ block: "nearest" });
}
