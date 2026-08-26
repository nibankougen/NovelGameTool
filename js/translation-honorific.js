"use strict";
/* ---------- 翻訳画面 ---------- */
const transCurLang = () => $("#transLang").value || null;

function renderTransLangSel(){
  const sel = $("#transLang");
  const cur = sel.value;
  sel.innerHTML = project.languages.map(l => `<option value="${esc(l)}">${esc(l)}</option>`).join("");
  if(project.languages.includes(cur)) sel.value = cur;
  const has = project.languages.length > 0;
  sel.style.display = has ? "" : "none";
  $("#transDelLang").style.display = has ? "" : "none";
  $("#transOnlyEmpty").parentElement.style.display = has ? "" : "none";
}

// 翻訳対象を列挙: {section} 見出し / {src, holder, key} 行（holder[key] が {言語: 訳文} のマップ）
function collectTransItems(){
  const items = [{ section: "プロジェクト・キャラクター" }];
  items.push({ src: `<span class="tr-label">タイトル</span>${esc(project.title || "無題")}`, holder: project, key: "titleTr" });
  for(const c of project.characters)
    items.push({ src: `<span class="tr-label">キャラ名</span><b style="color:${esc(c.color)}">${esc(c.name)}</b>`, holder: c, key: "tr" });
  for(const s of project.scenes){
    items.push({ section: `シーン: ${esc(s.name)}` });
    s.commands.forEach((cmd, i) => {
      if(cmd.type === "serif"){
        const ch = cmd.chara ? charById(cmd.chara) : null;
        const who = ch ? `<b style="color:${esc(ch.color)}">${esc(ch.name)}</b>` : `<span class="tr-label">地の文</span>`;
        const face = cmd.face ? `<span class="face-tag">（${esc(cmd.face)}）</span>` : "";
        items.push({ src: `<span class="tr-label">${i + 1}</span>${who}${face} ${textToHtml(cmd.text)}`, holder: cmd, key: "tr" });
      }else if(cmd.type === "choice"){
        for(const o of cmd.options)
          items.push({ src: `<span class="tr-label">${i + 1} 選択肢</span>◆ ${esc(o.text)}`, holder: o, key: "tr" });
      }
    });
  }
  return items;
}

function updateTransProgress(){
  const lang = transCurLang();
  if(!lang){ $("#transProgress").textContent = ""; return; }
  let total = 0, done = 0;
  for(const it of collectTransItems()){
    if(it.section) continue;
    total++;
    if((it.holder[it.key] || {})[lang]) done++;
  }
  $("#transProgress").textContent = `翻訳済み ${done} / ${total}`;
}

function renderTransList(){
  const list = $("#transList");
  const lang = transCurLang();
  list.innerHTML = "";
  if(!project.languages.length){
    list.innerHTML = `<div class="tr-empty">翻訳先の言語がまだありません。<br>「＋言語」から言語コード（例: en, zh-CN, ko）を追加してください。</div>`;
    return;
  }
  const onlyEmpty = $("#transOnlyEmpty").checked;
  let pendingSection = null, shown = 0;
  for(const it of collectTransItems()){
    if(it.section){ pendingSection = it.section; continue; }
    const val = (it.holder[it.key] || {})[lang] || "";
    if(onlyEmpty && val) continue;
    if(pendingSection){
      const h = document.createElement("div");
      h.className = "tr-section"; h.innerHTML = pendingSection;
      list.appendChild(h);
      pendingSection = null;
    }
    shown++;
    const row = document.createElement("div");
    row.className = "tr-row";
    const src = document.createElement("div");
    src.className = "tr-src"; src.innerHTML = it.src;
    const inp = document.createElement("input");
    inp.type = "text"; inp.className = "tr-input";
    inp.placeholder = `${lang} 訳を入力…`;
    inp.value = val;
    inp.addEventListener("focus", () => pushUndo(), { once: true });   // 編集セッション単位でUndo可能に
    inp.addEventListener("input", () => {
      const v = inp.value;
      if(!it.holder[it.key]) it.holder[it.key] = {};
      if(v) it.holder[it.key][lang] = v;
      else delete it.holder[it.key][lang];
      scheduleSave();
      updateTransProgress();
    });
    inp.addEventListener("keydown", e => {
      if(e.isComposing || e.keyCode === 229) return;
      if(e.key === "Enter"){                       // Enterで次の欄へ
        e.preventDefault();
        const all = [...list.querySelectorAll(".tr-input")];
        const n = all.indexOf(inp);
        if(n + 1 < all.length){ all[n + 1].focus(); all[n + 1].select(); }
      }else if(e.key === "Escape"){ inp.blur(); }  // もう一度Escで画面を閉じる
      e.stopPropagation();
    });
    row.append(src, inp);
    list.appendChild(row);
  }
  if(!shown)
    list.innerHTML += `<div class="tr-empty">${onlyEmpty ? "未翻訳の項目はありません 🎉" : "翻訳対象のテキストがありません"}</div>`;
}

function openTrans(){
  renderTransLangSel();
  renderTransList();
  updateTransProgress();
  showModal("#transModal");
  const first = $("#transList .tr-input");
  if(first) first.focus();
}
$("#btnTrans").addEventListener("click", openTrans);
$("#transLang").addEventListener("change", () => { renderTransList(); updateTransProgress(); });
$("#transOnlyEmpty").addEventListener("change", () => renderTransList());
$("#transAddLang").addEventListener("click", () => {
  const raw = prompt("追加する言語コード（例: en, zh-CN, ko）:");
  if(raw === null) return;
  const code = raw.trim();
  if(!code) return;
  if(code === "ja"){ toast("日本語（ja）はベース言語です", true); return; }
  if(!/^[A-Za-z][A-Za-z0-9_-]{0,14}$/.test(code)){ toast("言語コードは英数字とハイフンで入力してください", true); return; }
  if(project.languages.includes(code)){ toast(`言語「${code}」は既にあります`, true); return; }
  mutate(() => { project.languages.push(code); });
  renderTransLangSel();
  $("#transLang").value = code;
  renderTransList(); updateTransProgress();
  toast(`言語「${code}」を追加しました`);
});
$("#transDelLang").addEventListener("click", () => {
  const lang = transCurLang();
  if(!lang) return;
  if(!confirm(`言語「${lang}」を削除しますか？\n入力済みの「${lang}」の翻訳もすべて削除されます。`)) return;
  mutate(() => {
    project.languages = project.languages.filter(l => l !== lang);
    for(const it of collectTransItems())
      if(!it.section && it.holder[it.key]) delete it.holder[it.key][lang];
  });
  renderTransLangSel();
  renderTransList(); updateTransProgress();
  toast(`言語「${lang}」を削除しました`);
});

/* ---------- 人称チェック設定 ---------- */
function parseVocabInput(raw){
  const seen = new Set(), out = [];
  for(const w of String(raw ?? "").split(/[,，、\s]+/)){
    const t = w.trim();
    if(t && !seen.has(t)){ seen.add(t); out.push(t); }
  }
  return out;
}
function renderHonorVocab(){
  $("#honorVocabSelf").value = (project.honorificVocab.self || []).join("、");
  $("#honorVocabSecond").value = (project.honorificVocab.second || []).join("、");
  $("#honorVocabSuffix").value = (project.honorificVocab.suffix || []).join("、");
}
function charOptionsHtml(selectedId){
  return project.characters.map(c =>
    `<option value="${esc(c.id)}"${c.id === selectedId ? " selected" : ""}>${esc(c.name)}</option>`).join("");
}
function renderHonorRules(){
  const box = $("#honorRulesBody");
  box.innerHTML = "";
  if(!project.honorificRules.length){
    box.innerHTML = `<div class="tr-empty">まだ登録がありません。「行を追加」から登録してください。</div>`;
    return;
  }
  for(const r of project.honorificRules){
    const row = document.createElement("div");
    row.className = "honor-row";
    row.dataset.id = r.id;
    row.innerHTML =
      `<span class="drag-handle" title="ドラッグで並べ替え">${icon("grip-vertical")}</span>` +
      `<select class="hr-speaker">${charOptionsHtml(r.speakerId)}</select>` +
      `<select class="hr-target">` +
        `<option value=""${!r.targetId ? " selected" : ""}>（自分＝一人称）</option>` +
        `<option value="${HONOR_SECOND}"${r.targetId === HONOR_SECOND ? " selected" : ""}>（相手＝二人称）</option>` +
        `${charOptionsHtml(r.targetId)}` +
      `</select>` +
      `<input type="text" class="hr-pattern" value="${esc(r.pattern)}" placeholder="正規表現　例: くん|君">` +
      `<input type="checkbox" class="hr-bare" ${r.allowBare ? "checked" : ""}>` +
      `<button type="button" class="hr-del" data-act="del" title="この行を削除">${icon("trash-2")}</button>`;
    box.appendChild(row);
  }
}
function honorRuleById(id){ return project.honorificRules.find(r => r.id === id); }
function openHonorModal(){
  renderHonorVocab();
  renderHonorRules();
  showModal("#honorModal");
}
$("#btnHonor").addEventListener("click", openHonorModal);
$("#honorVocabSelf").addEventListener("input", () => {
  project.honorificVocab.self = parseVocabInput($("#honorVocabSelf").value);
  scheduleSave(); renderCmds();
});
$("#honorVocabSecond").addEventListener("input", () => {
  project.honorificVocab.second = parseVocabInput($("#honorVocabSecond").value);
  scheduleSave(); renderCmds();
});
$("#honorVocabSuffix").addEventListener("input", () => {
  project.honorificVocab.suffix = parseVocabInput($("#honorVocabSuffix").value);
  scheduleSave(); renderCmds();
});
$("#honorAddRule").addEventListener("click", () => {
  if(!project.characters.length){ toast("先にキャラクターを登録してください", true); return; }
  project.honorificRules.push({ id: uid(), speakerId: project.characters[0].id, targetId: null, pattern: "", allowBare: false });
  scheduleSave(); renderHonorRules();
});
$("#honorRulesBody").addEventListener("change", e => {
  const row = e.target.closest(".honor-row");
  if(!row) return;
  const r = honorRuleById(row.dataset.id);
  if(!r) return;
  if(e.target.classList.contains("hr-speaker")) r.speakerId = e.target.value;
  else if(e.target.classList.contains("hr-target")) r.targetId = e.target.value || null;
  else if(e.target.classList.contains("hr-bare")) r.allowBare = e.target.checked;
  else return;
  scheduleSave(); renderCmds();
});
$("#honorRulesBody").addEventListener("input", e => {
  if(!e.target.classList.contains("hr-pattern")) return;
  const row = e.target.closest(".honor-row");
  const r = row && honorRuleById(row.dataset.id);
  if(!r) return;
  r.pattern = e.target.value;
  try{ new RegExp(r.pattern); e.target.classList.remove("invalid"); }
  catch(err){ e.target.classList.add("invalid"); }
  scheduleSave(); renderCmds();
});
$("#honorRulesBody").addEventListener("click", e => {
  if(e.target.closest("[data-act='del']")){
    const row = e.target.closest(".honor-row");
    project.honorificRules = project.honorificRules.filter(r => r.id !== row.dataset.id);
    scheduleSave(); renderHonorRules(); renderCmds();
  }
});
makeListDraggable($("#honorRulesBody"), ".honor-row", $("#honorRulesWrap"), (from, to) => {
  if(from === to) return;
  const [r] = project.honorificRules.splice(from, 1);
  project.honorificRules.splice(to, 0, r);
  scheduleSave(); renderHonorRules();
});
