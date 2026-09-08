"use strict";
/* ---------- その他UI ---------- */
// ページ内の指定ゾーン以外に画像ファイルをドロップした際、ブラウザが既定でファイルを開いて
// アプリの状態を失わないようにする安全策（各ドロップゾーン側は個別に preventDefault 済み）
window.addEventListener("dragover", e => e.preventDefault());
window.addEventListener("drop", e => e.preventDefault());

$("#projectTitle").addEventListener("change", e => {
  mutate(() => { project.title = e.target.value.trim() || "無題"; });
});
function createScene(groupId){
  // 現在開いているシーンがあれば、その直下（同じグループ内）に新規シーンを配置する。
  // グループ未指定（全体の追加ボタン）の場合は現在開いているシーンの所属グループに従う。
  const curScene = project.scenes.find(s => s.id === currentSceneId);
  let effectiveGroupId = groupId || null;
  let insertAfterId = null;
  if(groupId == null){
    if(curScene){ effectiveGroupId = curScene.groupId || null; insertAfterId = curScene.id; }
  }else if(curScene && (curScene.groupId || null) === groupId){
    insertAfterId = curScene.id;
  }
  let n = project.scenes.length + 1;
  while(project.scenes.some(s => s.name === "シーン" + n)) n++;
  let newScene;
  mutate(() => {
    newScene = { id: uid(), name: "シーン" + n, commands: [], groupId: effectiveGroupId, synopsis: "" };
    if(insertAfterId){
      const idx = project.scenes.findIndex(s => s.id === insertAfterId);
      project.scenes.splice(idx + 1, 0, newScene);
    }else{
      project.scenes.push(newScene);
    }
    currentSceneId = newScene.id;
    selIndex = null;
  });
  // すぐ名前変更できるように
  const div = document.querySelector(`#sceneList .scene-item[data-scene-id="${newScene.id}"]`);
  if(div) startSceneRename(div, newScene);
}
$("#btnAddScene").addEventListener("click", () => createScene(null));
$("#btnAddGroup").addEventListener("click", () => {
  let n = project.sceneGroups.length + 1;
  while(project.sceneGroups.some(g => g.name === "グループ" + n)) n++;
  let newGroup;
  mutate(() => { newGroup = { id: uid(), name: "グループ" + n }; project.sceneGroups.push(newGroup); });
  const heads = [...document.querySelectorAll("#sceneList .scene-group-head:not(.ungrouped)")];
  const div = heads[heads.length - 1];
  if(div) startGroupRename(div, newGroup);
});
$("#btnAddChar").addEventListener("click", () => openCharModal(null));
$("#btnPlay").addEventListener("click", openPlay);
$("#btnHelp").addEventListener("click", () => showModal("#helpModal"));

/* ---------- サイドバーの開閉 ---------- */
function setSidebarCollapsed(v){
  document.body.classList.toggle("sidebar-collapsed", !!v);
  try{ localStorage.setItem(SIDEBAR_LS_KEY, v ? "1" : "0"); }catch(e){}
}
function toggleSidebar(){ setSidebarCollapsed(!document.body.classList.contains("sidebar-collapsed")); }
try{ if(localStorage.getItem(SIDEBAR_LS_KEY) === "1") document.body.classList.add("sidebar-collapsed"); }catch(e){}
$("#btnToggleSidebar").addEventListener("click", toggleSidebar);

/* ---------- ヘッダの「…」メニュー（狭幅時にボタン群を集約） ---------- */
(function(){
  const mq = window.matchMedia("(max-width:720px)");
  const topbar = $("#topbar"), menu = $("#moreMenu"), moreBtn = $("#btnMore"),
        tbMain = $("#tbMain"), thumbCtrl = $("#thumbSizeCtrl"), saveStatus = $("#saveStatus");
  // 実DOMノードを移動する（クローンしない）ので、各操作のイベントリスナーはそのまま生きる。
  // ボタン群に加えてサムネイルサイズ調整もメニューへ移し、狭幅でも変更できるようにする
  function place(){
    if(mq.matches){
      if(tbMain.parentElement !== menu) menu.appendChild(tbMain);
      if(thumbCtrl.parentElement !== menu) menu.appendChild(thumbCtrl);
    }else{
      if(thumbCtrl.parentElement !== topbar) topbar.insertBefore(thumbCtrl, saveStatus);
      if(tbMain.parentElement !== topbar) topbar.insertBefore(tbMain, thumbCtrl);
      menu.classList.remove("show");
    }
  }
  mq.addEventListener("change", place);
  moreBtn.addEventListener("click", e => { e.stopPropagation(); menu.classList.toggle("show"); });
  menu.addEventListener("click", e => { if(e.target.closest("button")) menu.classList.remove("show"); });
  document.addEventListener("click", e => {
    if(menu.classList.contains("show") && !menu.contains(e.target) && !moreBtn.contains(e.target))
      menu.classList.remove("show");
  });
  place();
})();

/* ---------- グローバルショートカット ---------- */
document.addEventListener("keydown", e => {
  if(e.isComposing || e.keyCode === 229) return;

  // モーダル表示中は Esc で閉じるのみ
  if(anyModalOpen()){
    if(e.key === "Escape"){
      document.querySelectorAll(".modal-back.show").forEach(m => { if(canCloseModal(m)) m.classList.remove("show"); });
      mainInput.focus();
    }
    return;
  }

  if(e.ctrlKey && !e.shiftKey && (e.key === "z" || e.key === "Z")){ e.preventDefault(); undo(); return; }
  if(e.ctrlKey && ((e.key === "y" || e.key === "Y") || (e.shiftKey && (e.key === "z" || e.key === "Z")))){ e.preventDefault(); redo(); return; }
  if(e.ctrlKey && (e.key === "s" || e.key === "S")){ e.preventDefault(); $("#btnExport").click(); return; }
  if(e.ctrlKey && !e.shiftKey && !e.altKey && (e.key === "b" || e.key === "B")){ e.preventDefault(); toggleSidebar(); return; }
  if(e.ctrlKey && (e.key === "p" || e.key === "P")){ e.preventDefault(); openPlay(); return; }
  if(e.ctrlKey && (e.key === "f" || e.key === "F")){ e.preventDefault(); openSearch(); return; }
  if(e.key === "F1"){ e.preventDefault(); showModal("#helpModal"); return; }

  // Ctrl+0〜9 話者切替
  if(e.ctrlKey && /^[0-9]$/.test(e.key)){
    e.preventDefault();
    const n = parseInt(e.key, 10);
    if(n === 0) setSpeaker(null);
    else if(project.characters[n - 1]) setSpeaker(project.characters[n - 1].id);
    mainInput.focus();
    return;
  }

  // どこにもフォーカスがないとき、文字キーで入力欄へ
  const tag = document.activeElement ? document.activeElement.tagName : "";
  if(tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT" && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey){
    mainInput.focus();
  }
});

/* ---------- トースト ---------- */
let toastTimer = null, toastEl = null;
function toast(msg, isErr){
  if(toastEl) toastEl.remove();
  toastEl = document.createElement("div");
  toastEl.className = "toast" + (isErr ? " err" : "");
  toastEl.textContent = msg;
  document.body.appendChild(toastEl);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { if(toastEl){ toastEl.remove(); toastEl = null; } }, 2600);
}

/* ---------- ドラッグ&ドロップ並べ替え ---------- */
let dndSuppressClick = 0;   // ドラッグ直後の click で行選択等が発火しないようにする
document.addEventListener("click", e => {
  if(Date.now() < dndSuppressClick){ e.stopPropagation(); e.preventDefault(); }
}, true);

function makeListDraggable(container, itemSelector, scroller, onDrop, onHover){
  container.addEventListener("mousedown", e => {
    if(e.button !== 0) return;
    const handle = e.target.closest(".drag-handle");
    if(!handle) return;
    const item = handle.closest(itemSelector);
    if(!item) return;
    e.preventDefault();
    const items = () => [...container.querySelectorAll(itemSelector)];
    const fromIdx = items().indexOf(item);
    let toIdx = fromIdx;
    let lastY = e.clientY;
    const indicator = document.createElement("div");
    indicator.className = "drop-indicator";
    item.classList.add("dragging");
    document.body.style.cursor = "grabbing";
    document.body.classList.add("dnd-dragging");   // ドラッグ中は他の行のhover演出(背景/ボタン表示)を止める
    const move = ev => {
      lastY = ev.clientY;
      const list = items();
      let idx = list.length;                 // マウスY座標から挿入位置を求める
      for(let i = 0; i < list.length; i++){
        const r = list[i].getBoundingClientRect();
        if(ev.clientY < r.top + r.height / 2){ idx = i; break; }
      }
      toIdx = idx;
      if(idx < list.length) container.insertBefore(indicator, list[idx]);
      else container.appendChild(indicator);
      const sr = scroller.getBoundingClientRect();   // リスト端に近づいたら自動スクロール
      if(ev.clientY < sr.top + 30) scroller.scrollTop -= 12;
      else if(ev.clientY > sr.bottom - 30) scroller.scrollTop += 12;
      if(onHover) onHover(ev);
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      item.classList.remove("dragging");
      indicator.remove();
      document.body.style.cursor = "";
      document.body.classList.remove("dnd-dragging");
      if(onHover) onHover(null);
      dndSuppressClick = Date.now() + 150;
      const rawTo = toIdx;                   // 補正前（ドロップ直前の並びでの挿入位置）
      let to = toIdx;
      if(to > fromIdx) to--;                 // 自分を除いた後の挿入位置に補正
      // 位置が変わらない場合でも呼び出す（シーンの見出しへのドロップ等、位置以外の判定を伴うケースがあるため）。
      // 単純な並べ替えのみを扱うonDropは呼び出し側でfrom===toの早期returnを行う
      onDrop(fromIdx, to, rawTo, lastY);
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
    move(e);
  });
}

makeListDraggable($("#cmdList"), ".cmd-row", $("#cmdListWrap"), (from, to) => {
  if(from === to) return;
  mutate(() => {
    const arr = cmds();
    const [c] = arr.splice(from, 1);
    arr.splice(to, 0, c);
    editIndex = null;
    if(selIndex !== null){                   // 選択行を移動に追従させる
      if(selIndex === from) selIndex = to;
      else{
        if(from < selIndex) selIndex--;
        if(to <= selIndex) selIndex++;
      }
    }
  });
});
// ドロップ位置に何（グループ見出し／別のシーン行）が重なっているかを直接判定する。
// makeListDraggableのインデックス計算はグループ見出しを無視した並びなので、
// グループ間の移動先はこの実座標での当たり判定を優先して決める。
function sceneDropTarget(lastY, excludeSceneId){
  if(lastY == null) return null;
  const headerHit = [...document.querySelectorAll("#sceneList .scene-group-head")].find(h => {
    const r = h.getBoundingClientRect();
    return lastY >= r.top && lastY <= r.bottom;
  });
  if(headerHit){
    const groupId = headerHit.classList.contains("ungrouped") ? null : headerHit.dataset.groupId;
    return { groupId, atGroupStart: true };
  }
  const rowHit = [...document.querySelectorAll("#sceneList .scene-item")].find(r => {
    if(r.dataset.sceneId === excludeSceneId) return false;
    const rect = r.getBoundingClientRect();
    return lastY >= rect.top && lastY <= rect.bottom;
  });
  if(rowHit){
    const rect = rowHit.getBoundingClientRect();
    const before = lastY < rect.top + rect.height / 2;
    const entry = sceneRowMap.find(e => e.sceneId === rowHit.dataset.sceneId);
    return { groupId: entry ? entry.groupId : null, beforeSceneId: before ? rowHit.dataset.sceneId : null, afterSceneId: before ? null : rowHit.dataset.sceneId };
  }
  return null;
}
makeListDraggable($("#sceneList"), ".scene-item", $("#sceneList"), (from, to, rawTo, lastY) => {
  const moved = sceneRowMap[from];
  if(!moved) return;
  let target = sceneDropTarget(lastY, moved.sceneId);
  if(!target){
    // どの行・見出しにも重なっていない（リスト最上部/最下部の余白）場合は従来のインデックス方式にフォールバック
    const afterEntry = sceneRowMap[rawTo];
    const beforeEntry = rawTo > 0 ? sceneRowMap[rawTo - 1] : null;
    target = afterEntry
      ? { groupId: afterEntry.groupId, beforeSceneId: afterEntry.sceneId }
      : (beforeEntry ? { groupId: beforeEntry.groupId, afterSceneId: beforeEntry.sceneId } : { groupId: null });
  }
  mutate(() => {
    const idx = project.scenes.findIndex(x => x.id === moved.sceneId);
    if(idx === -1) return;
    const [s] = project.scenes.splice(idx, 1);
    s.groupId = target.groupId || null;
    let insertAt;
    if(target.atGroupStart) insertAt = project.scenes.findIndex(x => (x.groupId || null) === (target.groupId || null));
    else if(target.beforeSceneId) insertAt = project.scenes.findIndex(x => x.id === target.beforeSceneId);
    else if(target.afterSceneId) insertAt = project.scenes.findIndex(x => x.id === target.afterSceneId) + 1;
    else insertAt = project.scenes.length;
    if(insertAt === -1) insertAt = project.scenes.length;
    project.scenes.splice(insertAt, 0, s);
  });
}, ev => {
  document.querySelectorAll("#sceneList .scene-group-head").forEach(h => h.classList.remove("drop-target"));
  document.querySelectorAll("#sceneList .scene-item").forEach(r => r.classList.remove("drop-target-before", "drop-target-after"));
  if(!ev) return;
  const dragging = document.querySelector("#sceneList .scene-item.dragging");
  const target = sceneDropTarget(ev.clientY, dragging ? dragging.dataset.sceneId : null);
  if(!target) return;
  if(target.atGroupStart){
    const headers = [...document.querySelectorAll("#sceneList .scene-group-head")];
    const h = headers.find(h => (h.classList.contains("ungrouped") ? null : h.dataset.groupId) === (target.groupId || null));
    if(h) h.classList.add("drop-target");
  }else{
    const sceneId = target.beforeSceneId || target.afterSceneId;
    const row = document.querySelector(`#sceneList .scene-item[data-scene-id="${sceneId}"]`);
    if(row) row.classList.add(target.beforeSceneId ? "drop-target-before" : "drop-target-after");
  }
});
makeListDraggable($("#sceneList"), ".scene-group-head:not(.ungrouped)", $("#sceneList"), (from, to) => {
  if(from === to) return;
  mutate(() => {
    const [g] = project.sceneGroups.splice(from, 1);
    project.sceneGroups.splice(to, 0, g);
  });
});
makeListDraggable($("#charList"), ".char-item", $("#charList"), (from, to) => {
  if(from === to) return;
  mutate(() => {
    const [c] = project.characters.splice(from, 1);
    project.characters.splice(to, 0, c);
  });
});
