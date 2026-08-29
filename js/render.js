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
let sceneRowMap = [];                 // renderScenes()時点の可視シーン行の並び（ドラッグ&ドロップ・Shift範囲選択で参照）
let selectedSceneIds = new Set();     // Shift+クリックで複数選択中のシーンid（結合などの一括操作用。セッション内のみ）
let sceneSelectAnchorId = null;       // Shift+クリック範囲選択の起点
let selectedCmdIndices = new Set();   // Shift+クリックで複数選択中の行index（シーン分離などの一括操作用。セッション内のみ）
let cmdSelectAnchor = null;           // Shift+クリック範囲選択の起点（行index）

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
  div.className = "scene-item" + (indented ? " grouped" : "") + (s.id === currentSceneId ? " active" : "")
    + (selectedSceneIds.has(s.id) ? " msel" : "");
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
    }else if(e.shiftKey){
      selectSceneRange(s.id);
    }else{
      selectedSceneIds.clear();
      sceneSelectAnchorId = s.id;
      if(currentSceneId !== s.id){
        currentSceneId = s.id; selIndex = null; editIndex = null;
        renderAll();
        $("#mainInput").focus();
      }else{
        renderScenes();   // 選択解除だけでも見た目に反映
      }
    }
  });
  div.addEventListener("dblclick", e => {
    if(!e.target.dataset.act) startSceneRename(div, s);
  });
  div.addEventListener("contextmenu", e => {
    e.preventDefault();
    if(!selectedSceneIds.has(s.id)){
      selectedSceneIds = new Set([s.id]);
      sceneSelectAnchorId = s.id;
      renderScenes();
    }
    openSceneContextMenu(e.clientX, e.clientY);
  });
  return div;
}

/* ---------- シーンの複数選択（Shift+クリック）と右クリックメニュー ---------- */
function selectSceneRange(clickedId){
  const order = sceneRowMap.map(x => x.sceneId);
  const anchor = (sceneSelectAnchorId && order.includes(sceneSelectAnchorId)) ? sceneSelectAnchorId : currentSceneId;
  const ai = order.indexOf(anchor), ci = order.indexOf(clickedId);
  if(ai === -1 || ci === -1) selectedSceneIds = new Set([clickedId]);
  else{
    const lo = Math.min(ai, ci), hi = Math.max(ai, ci);
    selectedSceneIds = new Set(order.slice(lo, hi + 1));
  }
  renderScenes();
}

/* ---------- 汎用の右クリックコンテキストメニュー（シーン一覧・行一覧で共用） ---------- */
let ctxMenuEl = null;
function closeCtxMenu(){
  if(!ctxMenuEl) return;
  ctxMenuEl.remove();
  ctxMenuEl = null;
  document.removeEventListener("contextmenu", closeCtxMenuOnOutside, true);
  document.removeEventListener("keydown", closeCtxMenuOnEsc);
}
function closeCtxMenuOnOutside(e){
  if(ctxMenuEl && !ctxMenuEl.contains(e.target)) closeCtxMenu();
}
function closeCtxMenuOnEsc(e){
  if(e.key === "Escape") closeCtxMenu();
}
function openCtxMenu(x, y, items){
  closeCtxMenu();
  const menu = document.createElement("div");
  menu.className = "edit-menu ctx-menu";
  for(const it of items){
    const el = document.createElement("div");
    el.className = "em-item" + (it.disabled ? " em-disabled" : "");
    el.textContent = it.label;
    if(!it.disabled) el.addEventListener("click", () => { closeCtxMenu(); it.onClick(); });
    menu.appendChild(el);
  }
  document.body.appendChild(menu);
  const mw = menu.offsetWidth, mh = menu.offsetHeight;
  menu.style.left = Math.max(4, Math.min(x, window.innerWidth - mw - 4)) + "px";
  menu.style.top = Math.max(4, Math.min(y, window.innerHeight - mh - 4)) + "px";
  ctxMenuEl = menu;
  // 開いた瞬間の click/contextmenu で即座に閉じないよう、リスナー登録を次ティックへ遅延
  setTimeout(() => {
    document.addEventListener("click", closeCtxMenu, { once: true });
    document.addEventListener("contextmenu", closeCtxMenuOnOutside, true);
    document.addEventListener("keydown", closeCtxMenuOnEsc);
  }, 0);
}
function openSceneContextMenu(x, y){
  const n = selectedSceneIds.size;
  openCtxMenu(x, y, [{
    label: n >= 2 ? `選択した${n}件のシーンを結合` : "結合するには2件以上選択（Shift+クリック）",
    disabled: n < 2,
    onClick: mergeSelectedScenes,
  }]);
}

// jump/choiceの参照先が結合で消えるシーンを指していた場合、結合後のシーンIDへ付け替える
function retargetSceneRefs(cmd, removedIds, newTargetId){
  if(cmd.type === "jump" && removedIds.has(cmd.target)) cmd.target = newTargetId;
  else if(cmd.type === "choice")
    for(const o of cmd.options) if(o.target && removedIds.has(o.target)) o.target = newTargetId;
}

function mergeSelectedScenes(){
  const order = sceneRowMap.map(x => x.sceneId);
  const scenes = order.filter(id => selectedSceneIds.has(id)).map(sceneById).filter(Boolean);
  if(scenes.length < 2) return;
  const names = scenes.map(s => s.name).join("」「");
  if(!confirm(`シーン「${names}」を1つに結合しますか？\n（先頭のシーンにセリフ等がまとめられ、残りのシーンは削除されます。ジャンプ・選択肢からの参照先は自動的に結合後のシーンへ付け替えられます）`)) return;

  const target = scenes[0];
  const removedIds = new Set(scenes.slice(1).map(s => s.id));
  selectedSceneIds = new Set();
  sceneSelectAnchorId = null;
  mutate(() => {
    for(const src of scenes.slice(1)){
      target.commands.push(...src.commands);
      if(src.synopsis && src.synopsis.trim())
        target.synopsis = (target.synopsis ? target.synopsis + "\n\n" : "") + src.synopsis;
    }
    for(const sc of project.scenes) for(const cmd of sc.commands) retargetSceneRefs(cmd, removedIds, target.id);
    project.scenes = project.scenes.filter(s => !removedIds.has(s.id));
    if(removedIds.has(currentSceneId)) currentSceneId = target.id;
  });
  toast(`${scenes.length}件のシーンを「${target.name}」に結合しました`);
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

// 人称チェックのバッジをクリック確認済み（薄く表示）にする。undo対象外の軽量な表示状態のため scheduleSave のみ
function toggleHonorAck(i){
  const c = cmds()[i];
  if(!c) return;
  if(c.honorAckText === c.text) delete c.honorAckText;
  else c.honorAckText = c.text;
  scheduleSave();
  renderCmds();
}

function cmdHtml(c, hIssues){
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
        const body = `<span class="speaker-name" style="color:${color}">${name}</span>${face}<span class="serif-text">「${textToHtml(c.text)}」</span>`;
        // クリックで確認済み（薄く表示）にできる。テキストが変わったら自動的に元の濃さに戻る
        const acked = !!(hIssues && hIssues.length && c.honorAckText === c.text);
        const ackTitle = acked ? "確認済み（クリックで戻す）" : "クリックで確認済みにする（薄く表示）";
        const badgeH = (hIssues && hIssues.length)
          ? `<div class="honor-badge-row"><span class="honor-badge${acked ? " acked" : ""}" data-act="honor-ack" title="${esc(ackTitle + "\n人称の表記ゆれ: " + hIssues.join("、"))}">${icon("circle-alert")}</span></div>`
          : "";
        const imgH = img ? `<img class="row-face" src="${esc(img)}" alt="">` : "";
        // サムネイル付き、または人称バッジ付きは左右分割
        // （サムネ固定・テキスト側が複数行に折り返してもサムネは縦中央／バッジは画像の右・セリフの上に配置）
        if(img || badgeH) return `<div class="serif-row-inner">${imgH}<div class="serif-content">${badgeH}${body}</div></div>`;
        return body;
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
    row.className = "cmd-row" + (cmdBroken(c) ? " alert" : "") + (i === selIndex ? " selected" : "")
      + (selectedCmdIndices.has(i) ? " msel" : "");
    row.dataset.idx = i;
    const hIssues = honorificIssues(c);
    row.innerHTML =
      `<span class="drag-handle" title="ドラッグで並べ替え">${icon("grip-vertical")}</span>` +
      `<span class="row-num">${i + 1}</span>` +
      `<div class="row-body">${cmdHtml(c, hIssues)}</div>` +
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
      else if(act === "honor-ack") toggleHonorAck(i);
      else if(e.shiftKey){
        editIndex = null;
        selectCmdRange(i);   // Shift+クリックで範囲選択（シーン分離などの一括操作用）
      }else{
        selectedCmdIndices = new Set();
        cmdSelectAnchor = i;
        selIndex = i;   // 選択状態にして矢印キー等の操作対象にする
        pendingEditClick = computeClickInfo(e, c);   // クリック位置→カーソル位置/チップ自動展開に使用
        startEdit(i);   // 行の文字部分クリックで即編集開始
      }
    });
    row.addEventListener("contextmenu", e => {
      e.preventDefault();
      if(!selectedCmdIndices.has(i)){
        selectedCmdIndices = new Set([i]);
        cmdSelectAnchor = i;
        renderCmds();
      }
      openCmdContextMenu(e.clientX, e.clientY);
    });
    box.appendChild(row);
  });
  if(editIndex !== null) mountEditRow();
}

function selectCmdRange(clickedIdx){
  const len = cmds().length;
  const anchor = (cmdSelectAnchor !== null && cmdSelectAnchor < len) ? cmdSelectAnchor : (selIndex !== null ? selIndex : clickedIdx);
  const lo = Math.min(anchor, clickedIdx), hi = Math.max(anchor, clickedIdx);
  selectedCmdIndices = new Set();
  for(let k = lo; k <= hi; k++) selectedCmdIndices.add(k);
  selIndex = clickedIdx;
  renderCmds();
}

function openCmdContextMenu(x, y){
  const n = selectedCmdIndices.size;
  openCtxMenu(x, y, [{
    label: n >= 1 ? `選択した${n}行を新しいシーンとして分離` : "分離する行を選択してください（Shift+クリック）",
    disabled: n < 1,
    onClick: splitSelectedCmdsToScene,
  }]);
}

// 選択した行を、現在のシーンから抜き出して新しいシーンにする（結合の逆操作）。
// jump/choiceはシーン単位の参照なので、分離しても既存の参照先は変わらない
function splitSelectedCmdsToScene(){
  const idxs = [...selectedCmdIndices].sort((a, b) => a - b);
  if(!idxs.length) return;
  if(!confirm(`選択した${idxs.length}行を新しいシーンとして分離しますか？`)) return;
  const removedSet = new Set(idxs);
  let newSceneName = "";
  mutate(() => {
    const scene = curScene();
    const moved = scene.commands.filter((_, i) => removedSet.has(i));
    scene.commands = scene.commands.filter((_, i) => !removedSet.has(i));
    newSceneName = scene.name + "（分離）";
    const newScene = { id: uid(), name: newSceneName, commands: moved, groupId: scene.groupId, synopsis: "" };
    const pos = project.scenes.findIndex(x => x.id === scene.id);
    project.scenes.splice(pos + 1, 0, newScene);
    selIndex = null; editIndex = null;
  });
  toast(`選択した行を新しいシーン「${newSceneName}」として分離しました`);
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
