"use strict";
/* ---------- 全文検索 ---------- */
const searchPanel = $("#searchPanel"), searchInput = $("#searchInput"), searchResults = $("#searchResults");
let searchHits = [];      // {sceneId, idx}  idx=null はシーン名ヒット
let searchActive = 0;     // ↑↓で選択中の結果
const SEARCH_MAX = 200;

function searchOpen(){ return searchPanel.classList.contains("show"); }
function openSearch(){ searchPanel.classList.add("show"); searchInput.focus(); searchInput.select(); runSearch(); }
function closeSearch(){ searchPanel.classList.remove("show"); mainInput.focus(); }

// コマンドから検索対象のテキストを列挙
function cmdSearchTexts(c){
  switch(c.type){
    case "serif": {
      const ch = c.chara ? charById(c.chara) : null;
      return [textToResolved(c.text), ...Object.values(c.tr || {}), ch ? ch.name : "", c.face || ""];
    }
    case "bg": case "bgm": case "se": return [String(c.value ?? "")];
    case "wait":    return [String(c.value ?? "")];
    case "jump":    { const s = sceneById(c.target); return s ? [s.name] : []; }
    case "choice":  {
      const a = [];
      for(const o of c.options){
        a.push(o.text, ...Object.values(o.tr || {}));
        const s = o.target ? sceneById(o.target) : null;
        if(s) a.push(s.name);
      }
      return a;
    }
    case "comment": return [c.text];
    default:        return [];
  }
}

// ヒット箇所を <mark> で強調したスニペット（長文は最初のヒット周辺に切り詰め）
function highlightSnippet(text, q){
  const ql = q.toLowerCase();
  let s = text;
  if(s.length > 70){
    const pos = Math.max(0, s.toLowerCase().indexOf(ql));
    const start = Math.max(0, pos - 25);
    const end = Math.min(s.length, start + 70);
    s = (start > 0 ? "…" : "") + s.slice(start, end) + (end < s.length ? "…" : "");
  }
  const sl = s.toLowerCase(), out = [];
  let i = 0;
  while(true){
    const j = sl.indexOf(ql, i);
    if(j === -1){ out.push(esc(s.slice(i))); break; }
    out.push(esc(s.slice(i, j)), `<mark>${esc(s.slice(j, j + q.length))}</mark>`);
    i = j + q.length;
  }
  return out.join("");
}

function runSearch(){
  const q = searchInput.value.trim();
  searchHits = [];
  if(!q){ searchResults.innerHTML = ""; $("#searchCount").textContent = ""; return; }
  const ql = q.toLowerCase();
  let total = 0, h = "";
  const push = (sceneId, idx, sceneLabel, lineLabel, snippet) => {
    total++;
    if(searchHits.length >= SEARCH_MAX) return;
    searchHits.push({ sceneId, idx });
    h += `<div class="sr-item" data-n="${searchHits.length - 1}">` +
         `<span class="sr-scene">${sceneLabel}</span><span class="sr-line">${lineLabel}</span>` +
         `<span class="sr-text">${snippet}</span></div>`;
  };
  for(const s of project.scenes){
    if(s.name.toLowerCase().includes(ql))
      push(s.id, null, "シーン名", "", highlightSnippet(s.name, q));
    s.commands.forEach((c, i) => {
      const t = cmdSearchTexts(c).find(t => t.toLowerCase().includes(ql));
      if(t !== undefined) push(s.id, i, esc(s.name), i + 1, highlightSnippet(t, q));
    });
  }
  if(total === 0) h = `<div class="sr-empty">見つかりませんでした</div>`;
  else if(total > searchHits.length) h += `<div class="sr-empty">他 ${total - searchHits.length} 件 — キーワードで絞り込んでください</div>`;
  searchResults.innerHTML = h;
  $("#searchCount").textContent = total ? `${total}件` : "";
  searchActive = Math.min(searchActive, Math.max(0, searchHits.length - 1));
  updateSearchActive();
}
function updateSearchActive(){
  searchResults.querySelectorAll(".sr-item").forEach(el => {
    const on = +el.dataset.n === searchActive;
    el.classList.toggle("active", on);
    if(on) el.scrollIntoView({ block: "nearest" });
  });
}
function gotoSearchHit(n){
  const hit = searchHits[n];
  if(!hit || !sceneById(hit.sceneId)) return;
  searchActive = n;
  currentSceneId = hit.sceneId;
  selIndex = hit.idx; editIndex = null;
  renderAll();
  if(hit.idx !== null){
    const row = $(`.cmd-row[data-idx="${hit.idx}"]`);
    if(row) row.scrollIntoView({ block: "center" });
  }
}

$("#btnSearch").addEventListener("click", () => searchOpen() ? closeSearch() : openSearch());
$("#searchClose").addEventListener("click", closeSearch);
searchInput.addEventListener("input", () => { searchActive = 0; runSearch(); });
searchInput.addEventListener("keydown", e => {
  if(e.isComposing || e.keyCode === 229) return;
  if(e.key === "Escape"){ e.preventDefault(); closeSearch(); }
  else if(e.key === "ArrowDown"){ e.preventDefault(); if(searchHits.length){ searchActive = (searchActive + 1) % searchHits.length; updateSearchActive(); } }
  else if(e.key === "ArrowUp"){ e.preventDefault(); if(searchHits.length){ searchActive = (searchActive - 1 + searchHits.length) % searchHits.length; updateSearchActive(); } }
  else if(e.key === "Enter"){ e.preventDefault(); gotoSearchHit(searchActive); }
  e.stopPropagation();   // アプリ側のショートカットに流さない
});
searchResults.addEventListener("click", e => {
  const el = e.target.closest(".sr-item");
  if(el) gotoSearchHit(+el.dataset.n);
});

/* ---------- あらすじビュー ---------- */
let outlineOverviewTouched = false;   // 大枠メモの最初のフォーカスでのみUndoチェックポイントを作る
function renderOutline(){
  $("#outlineOverviewInput").value = project.overview || "";
  const list = $("#outlineList");
  list.innerHTML = "";
  const grouped = project.sceneGroups.length > 0;
  let lastGroup;
  for(const { scene: s, groupName } of scenesInGroupOrder()){
    if(grouped && groupName !== lastGroup){
      const h = document.createElement("div");
      h.className = "ol-section";
      h.textContent = groupName || "未分類";
      list.appendChild(h);
      lastGroup = groupName;
    }
    const row = document.createElement("div");
    row.className = "ol-row";
    const nameRow = document.createElement("div");
    nameRow.className = "ol-name";
    const gotoBtn = document.createElement("button");
    gotoBtn.type = "button"; gotoBtn.className = "ol-goto"; gotoBtn.textContent = s.name;
    gotoBtn.title = "このシーンへ移動";
    gotoBtn.addEventListener("click", () => {
      currentSceneId = s.id; selIndex = null; editIndex = null;
      hideModal("#outlineModal");
      renderAll();
      mainInput.focus();
    });
    const count = document.createElement("span");
    count.className = "s-count"; count.textContent = `${s.commands.length}行`;
    nameRow.append(gotoBtn, count);
    const ta = document.createElement("textarea");
    ta.className = "ol-syn"; ta.placeholder = "このシーンのあらすじ…"; ta.value = s.synopsis || "";
    ta.addEventListener("focus", () => pushUndo(), { once: true });
    ta.addEventListener("input", () => { s.synopsis = ta.value; scheduleSave(); });
    ta.addEventListener("keydown", e => e.stopPropagation());
    row.append(nameRow, ta);
    list.appendChild(row);
  }
  if(!project.scenes.length){
    const empty = document.createElement("div");
    empty.className = "tr-empty"; empty.textContent = "シーンがありません";
    list.appendChild(empty);
  }
}
function openOutline(){
  outlineOverviewTouched = false;
  renderOutline();
  showModal("#outlineModal");
  $("#outlineOverviewInput").focus();
}
$("#btnOutline").addEventListener("click", openOutline);
$("#outlineOverviewInput").addEventListener("focus", () => {
  if(!outlineOverviewTouched){ outlineOverviewTouched = true; pushUndo(); }
});
$("#outlineOverviewInput").addEventListener("input", e => {
  project.overview = e.target.value;
  scheduleSave();
});
$("#outlineOverviewInput").addEventListener("keydown", e => e.stopPropagation());

/* ---------- 統計情報 ---------- */
// シーンごとのセリフ数・文字数を集計。文字数はゲーム出力時と同じ解決済みテキスト（キャラ名参照を実名に変換）の長さ
function sceneStats(s){
  let count = 0, chars = 0;
  for(const cmd of s.commands){
    if(cmd.type !== "serif") continue;
    count++;
    chars += textToResolved(cmd.text).length;
  }
  return { count, chars };
}
function renderStats(){
  const list = $("#statsList");
  list.innerHTML = "";
  const groups = [];
  const byName = new Map();
  for(const { scene: s, groupName } of scenesInGroupOrder()){
    const key = groupName || "";
    let g = byName.get(key);
    if(!g){ g = { name: groupName, scenes: [], count: 0, chars: 0 }; byName.set(key, g); groups.push(g); }
    const st = sceneStats(s);
    g.scenes.push({ scene: s, ...st });
    g.count += st.count; g.chars += st.chars;
  }
  const showGroupHeads = project.sceneGroups.length > 0;
  let totalCount = 0, totalChars = 0;
  for(const g of groups){
    totalCount += g.count; totalChars += g.chars;
    if(showGroupHeads){
      const h = document.createElement("div");
      h.className = "stat-group-row";
      h.innerHTML = `<span>${esc(g.name || "未分類")}</span><span class="stat-num">${g.count}</span><span class="stat-num">${g.chars}</span>`;
      list.appendChild(h);
    }
    for(const { scene: s, count, chars } of g.scenes){
      const row = document.createElement("div");
      row.className = "stat-row";
      row.innerHTML = `<span>${esc(s.name)}</span><span class="stat-num">${count}</span><span class="stat-num">${chars}</span>`;
      row.addEventListener("click", () => {
        currentSceneId = s.id; selIndex = null; editIndex = null;
        hideModal("#statsModal");
        renderAll();
        mainInput.focus();
      });
      list.appendChild(row);
    }
  }
  if(!project.scenes.length)
    list.innerHTML = `<div class="tr-empty">シーンがありません</div>`;
  $("#statsTotalRow").innerHTML = `<span>合計</span><span class="stat-num">${totalCount}</span><span class="stat-num">${totalChars}</span>`;
}
function openStats(){
  renderStats();
  showModal("#statsModal");
}
$("#btnStats").addEventListener("click", openStats);
