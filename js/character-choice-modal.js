"use strict";
/* ---------- キャラクターモーダル ---------- */
let editingCharId = null;
let pendingThumb = null;          // モーダル内で編集中のサムネイル(dataURL)
function openCharModal(c){
  editingCharId = c ? c.id : null;
  $("#charModalTitle").textContent = c ? "キャラクター編集" : "キャラクター追加";
  $("#charNameInput").value = c ? c.name : "";
  $("#charColorInput").value = c ? c.color : PALETTE[project.characters.length % PALETTE.length];
  exprStaged = c
    ? (c.expressions || []).map(n => ({ orig: n, name: n, img: (c.exprImages || {})[n] || null }))
    : project.exprTemplate.map(n => ({ orig: null, name: n, img: null }));   // 新規キャラはテンプレを自動適用
  $("#charExprInput").value = "";
  renderExprTags();
  renderExprTmplInfo();
  $("#charMemoInput").value = c ? (c.memo || "") : "";
  pendingThumb = c ? (c.thumb || null) : null;
  renderThumbPreview();
  $("#charDeleteBtn").style.display = c ? "" : "none";
  renderColorPal();
  showModal("#charModal");
  $("#charNameInput").focus();
}
function renderThumbPreview(){
  const img = $("#charThumbPreview");
  if(pendingThumb){ img.src = pendingThumb; img.style.display = ""; $("#charThumbDelBtn").style.display = ""; }
  else { img.removeAttribute("src"); img.style.display = "none"; $("#charThumbDelBtn").style.display = "none"; }
  renderExprTags();   // 表情タグのデフォルトイラストプレビューを追従させる
}
$("#charThumbBtn").addEventListener("click", () => $("#charThumbInput").click());
$("#charThumbDelBtn").addEventListener("click", () => { pendingThumb = null; renderThumbPreview(); });
// localStorageを圧迫しないよう最大256pxに縮小してdataURL化
function loadImageAsThumb(file, cb){
  const reader = new FileReader();
  reader.onload = () => {
    const im = new Image();
    im.onload = () => {
      const MAX = 256;
      const sc = Math.min(1, MAX / Math.max(im.width, im.height));
      const cv = document.createElement("canvas");
      cv.width = Math.max(1, Math.round(im.width * sc));
      cv.height = Math.max(1, Math.round(im.height * sc));
      cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height);
      cb(file.type === "image/jpeg"
        ? cv.toDataURL("image/jpeg", 0.85)
        : cv.toDataURL("image/png"));    // png等は透過を保持
    };
    im.onerror = () => toast("画像を読み込めませんでした", true);
    im.src = reader.result;
  };
  reader.readAsDataURL(file);
}
$("#charThumbInput").addEventListener("change", e => {
  const file = e.target.files[0];
  e.target.value = "";
  if(!file) return;
  loadImageAsThumb(file, url => { pendingThumb = url; renderThumbPreview(); });
});

/* ---------- 画像ファイルのドラッグ&ドロップ登録（デフォルトイラスト・表情ごとの画像） ---------- */
const hasFileDrag = e => !!(e.dataTransfer && [...e.dataTransfer.types].includes("Files"));
const firstImageFile = e => [...(e.dataTransfer.files || [])].find(f => f.type.startsWith("image/"));

const charThumbRow = $("#charThumbRow");
charThumbRow.addEventListener("dragover", e => {
  if(!hasFileDrag(e)) return;
  e.preventDefault();
  charThumbRow.classList.add("drag-over");
});
charThumbRow.addEventListener("dragleave", e => {
  if(!charThumbRow.contains(e.relatedTarget)) charThumbRow.classList.remove("drag-over");
});
charThumbRow.addEventListener("drop", e => {
  charThumbRow.classList.remove("drag-over");
  if(!hasFileDrag(e)) return;
  e.preventDefault();
  const file = firstImageFile(e);
  if(!file){ toast("画像ファイルをドロップしてください", true); return; }
  loadImageAsThumb(file, url => { pendingThumb = url; renderThumbPreview(); });
});

// 表情タグへのドロップ: どのタグの上にいるかで対象を切り替える（.missing タグは対象外）
let exprDropHighlight = null;
function clearExprDropHighlight(){
  if(exprDropHighlight){ exprDropHighlight.classList.remove("drag-over"); exprDropHighlight = null; }
}
const charExprTagsEl = $("#charExprTags");
charExprTagsEl.addEventListener("dragover", e => {
  if(!hasFileDrag(e)) return;
  const tag = e.target.closest(".expr-tag:not(.missing)");
  if(tag !== exprDropHighlight){
    clearExprDropHighlight();
    if(tag){ tag.classList.add("drag-over"); exprDropHighlight = tag; }
  }
  if(tag) e.preventDefault();
});
charExprTagsEl.addEventListener("dragleave", e => {
  if(!charExprTagsEl.contains(e.relatedTarget)) clearExprDropHighlight();
});
charExprTagsEl.addEventListener("drop", e => {
  const tag = e.target.closest(".expr-tag:not(.missing)");
  clearExprDropHighlight();
  if(!tag || !hasFileDrag(e)) return;
  e.preventDefault();
  const file = firstImageFile(e);
  if(!file){ toast("画像ファイルをドロップしてください", true); return; }
  const i = +tag.dataset.i;
  loadImageAsThumb(file, url => { if(exprStaged[i]){ exprStaged[i].img = url; renderExprTags(); } });
});
// 表情画像の選択（exprImgTarget = 対象の exprStaged index）
let exprImgTarget = null;
$("#exprImgInput").addEventListener("change", e => {
  const file = e.target.files[0];
  e.target.value = "";
  if(!file || exprImgTarget === null || !exprStaged[exprImgTarget]) return;
  const i = exprImgTarget;
  loadImageAsThumb(file, url => {
    if(exprStaged[i]){ exprStaged[i].img = url; renderExprTags(); }
  });
});
function renderColorPal(){
  const pal = $("#colorPal");
  pal.innerHTML = "";
  PALETTE.forEach(col => {
    const sw = document.createElement("div");
    sw.className = "color-sw" + (col.toLowerCase() === $("#charColorInput").value.toLowerCase() ? " sel" : "");
    sw.style.background = col;
    sw.addEventListener("click", () => { $("#charColorInput").value = col; renderColorPal(); });
    pal.appendChild(sw);
  });
}
$("#charColorInput").addEventListener("input", renderColorPal);

/* 表情の使用状況: 全シーンのセリフを走査して表情ごとの使用回数を集計 */
function faceUsageCounts(charId){
  const counts = new Map();
  for(const s of project.scenes)
    for(const c of s.commands)
      if(c.type === "serif" && c.chara === charId && c.face)
        counts.set(c.face, (counts.get(c.face) || 0) + 1);
  return counts;
}
/* 表情タグ編集（ステージング）: 保存を押すまで実データには反映しない。
   orig = モーダルを開いた時点の名前（新規追加は null）。orig ≠ name なら保存時に全セリフへリネーム反映 */
let exprStaged = [];

function renderExprTags(){
  const box = $("#charExprTags");
  const counts = editingCharId ? faceUsageCounts(editingCharId) : new Map();
  let h = "";
  exprStaged.forEach((x, i) => {
    const n = x.orig ? (counts.get(x.orig) || 0) : 0;
    h += `<span class="expr-tag${n ? "" : " unused"}" data-i="${i}" title="${n ? `セリフ ${n} 行で使用中` : "どのセリフでも使われていません"}">` +
         (x.img
           ? `<img class="et-img" src="${esc(x.img)}" alt="" title="表情画像（クリックで外す）">`
           : (pendingThumb ? `<img class="et-img et-def" src="${esc(pendingThumb)}" alt="" title="表情画像なし → デフォルトイラストを使用（クリックで表情画像を設定）">` : "")) +
         `<span class="et-name">${esc(x.name)}</span>` +
         `<span class="expr-n">${n ? `${n}回` : "未使用"}</span>` +
         `<button type="button" class="et-btn" data-act="img" title="${x.img ? "表情画像を差し替え…" : "表情画像を設定…（テストプレイの立ち絵に使われます）"}">${icon("image")}</button>` +
         `<button type="button" class="et-btn" data-act="ren" title="名前を変更（使用中の全セリフに反映）">${icon("pencil")}</button>` +
         `<button type="button" class="et-btn" data-act="del" title="候補から削除">${icon("x")}</button></span>`;
  });
  for(const [ex, n] of counts)
    if(!exprStaged.some(x => x.orig === ex))
      h += `<span class="expr-tag missing" data-name="${esc(ex)}" title="セリフ ${n} 行で使用中ですが候補にありません。このまま保存すると該当行にアラートが出ます。クリックで候補に戻す">` +
           `${icon("triangle-alert")}<span class="et-name">${esc(ex)}</span><span class="expr-n">${n}回</span></span>`;
  box.innerHTML = h || `<span class="expr-none">表情はまだ登録されていません</span>`;
}

function addExprNames(raw){
  let added = 0;
  for(const name of raw.split(/[,、，]/).map(s => s.trim()).filter(Boolean)){
    if(exprStaged.some(x => x.name === name)){ toast(`表情「${name}」は既にあります`, true); continue; }
    // 使用中なのに候補から外れていた名前なら「復帰」扱い（orig を持たせて使用回数と紐付け）
    const inUse = editingCharId && faceUsageCounts(editingCharId).has(name);
    exprStaged.push({ orig: inUse ? name : null, name, img: null });
    added++;
  }
  if(added) renderExprTags();
  return added;
}
function commitExprInput(){
  const v = $("#charExprInput").value.trim();
  if(v) addExprNames(v);
  $("#charExprInput").value = "";
}

function startExprRename(tag, i){
  const inp = document.createElement("input");
  inp.type = "text"; inp.className = "et-input"; inp.value = exprStaged[i].name;
  tag.replaceChildren(inp);
  inp.focus(); inp.select();
  let done = false;
  const commit = ok => {
    if(done) return; done = true;
    const v = inp.value.trim();
    if(ok && v && v !== exprStaged[i].name){
      if(exprStaged.some((x, j) => j !== i && x.name === v)) toast(`表情「${v}」は既にあります`, true);
      else exprStaged[i].name = v;
    }
    renderExprTags();
  };
  inp.addEventListener("keydown", e => {
    if(e.isComposing || e.keyCode === 229) return;
    if(e.key === "Enter"){ e.preventDefault(); commit(true); }
    if(e.key === "Escape"){ e.preventDefault(); commit(false); }
    e.stopPropagation();   // モーダルの Esc 閉じを発火させない
  });
  inp.addEventListener("blur", () => commit(true));
}

$("#charExprTags").addEventListener("click", e => {
  const btn = e.target.closest(".et-btn");
  const tag = e.target.closest(".expr-tag");
  if(!tag) return;
  const imgEl = e.target.closest(".et-img");
  if(imgEl){
    const i = +tag.dataset.i;
    if(imgEl.classList.contains("et-def")){   // デフォルト使用中の薄いプレビュー → 表情画像を設定
      exprImgTarget = i; $("#exprImgInput").click();
    }else{                                    // 表情画像のプレビュー → クリックで外す
      exprStaged[i].img = null; renderExprTags();
    }
    return;
  }
  if(btn){
    const i = +tag.dataset.i;
    if(btn.dataset.act === "img"){ exprImgTarget = i; $("#exprImgInput").click(); }
    else if(btn.dataset.act === "del"){
      const x = exprStaged[i];
      const n = (x.orig && editingCharId) ? (faceUsageCounts(editingCharId).get(x.orig) || 0) : 0;
      if(n && !confirm(`表情「${x.name}」はセリフ ${n} 行で使われています。候補から削除しますか？\n（削除したまま保存すると該当行にアラートが表示されます）`)) return;
      exprStaged.splice(i, 1); renderExprTags();
    }
    else startExprRename(tag, i);
  }else if(tag.classList.contains("missing")){
    addExprNames(tag.dataset.name);   // 赤タグクリックで候補に復帰
  }
});
$("#charExprInput").addEventListener("keydown", e => {
  if(e.isComposing || e.keyCode === 229) return;
  if(e.key === "Enter"){ e.preventDefault(); commitExprInput(); }
  else if(e.key === "Escape" && $("#charExprInput").value){ e.stopPropagation(); $("#charExprInput").value = ""; }
});

/* 表情テンプレート: 新規キャラクター作成時（@名前 での自動登録含む）に自動適用される */
function renderExprTmplInfo(){
  const t = project.exprTemplate;
  $("#exprTmplInfo").textContent = t.length ? `テンプレ: ${t.join(", ")}` : "テンプレ未設定";
  $("#exprTmplInfo").title = t.length ? `新規キャラクターに自動適用されます: ${t.join(", ")}` : "";
  $("#exprTmplCarryOver").checked = loadGlobalExprTemplate().enabled;
}
$("#exprTmplSave").addEventListener("click", () => {
  commitExprInput();
  project.exprTemplate = exprStaged.map(x => x.name);
  scheduleSave();
  const g = loadGlobalExprTemplate();
  if(g.enabled){ g.template = [...project.exprTemplate]; saveGlobalExprTemplate(g); }
  renderExprTmplInfo();
  toast(project.exprTemplate.length
    ? "表情テンプレートを保存しました（新規キャラクターに自動適用されます）"
    : "表情テンプレートを空にしました（自動適用は行われません）");
});
$("#exprTmplCarryOver").addEventListener("change", e => {
  const g = loadGlobalExprTemplate();
  g.enabled = e.target.checked;
  if(g.enabled) g.template = [...project.exprTemplate];   // オンにした時点の内容を引き継ぎ対象にする
  saveGlobalExprTemplate(g);
  toast(g.enabled
    ? "新規プロジェクトにも表情テンプレートを引き継ぐようにしました"
    : "新規プロジェクトへの引き継ぎをオフにしました");
});
$("#exprTmplApply").addEventListener("click", () => {
  if(!project.exprTemplate.length){ toast("表情テンプレートはまだ保存されていません", true); return; }
  let added = 0;
  for(const name of project.exprTemplate){
    if(exprStaged.some(x => x.name === name)) continue;
    const inUse = editingCharId && faceUsageCounts(editingCharId).has(name);
    exprStaged.push({ orig: inUse ? name : null, name, img: null });
    added++;
  }
  if(added){ renderExprTags(); toast(`テンプレートから ${added} 件の表情を追加しました`); }
  else toast("テンプレートの表情はすべて追加済みです");
});
$("#charSaveBtn").addEventListener("click", () => {
  const name = $("#charNameInput").value.trim();
  if(!name){ toast("名前を入力してください", true); return; }
  const dup = project.characters.find(c => c.name === name && c.id !== editingCharId);
  if(dup){ toast("同名のキャラクターがいます", true); return; }
  commitExprInput();                        // 入力欄に打ちかけの表情名も追加扱いに
  const expressions = exprStaged.map(x => x.name);
  const exprImages = {};
  for(const x of exprStaged) if(x.img) exprImages[x.name] = x.img;
  const memo = $("#charMemoInput").value;
  mutate(() => {
    if(editingCharId){
      const c = charById(editingCharId);
      c.name = name; c.color = $("#charColorInput").value;
      c.memo = memo; c.thumb = pendingThumb; c.expressions = expressions;
      c.exprImages = exprImages;
      // リネームされた表情を、使用中の全セリフへ反映
      for(const x of exprStaged){
        if(!x.orig || x.orig === x.name) continue;
        for(const s of project.scenes)
          for(const cmd of s.commands)
            if(cmd.type === "serif" && cmd.chara === editingCharId && cmd.face === x.orig)
              cmd.face = x.name;
      }
    }else{
      const c = { id: uid(), name, color: $("#charColorInput").value,
                  memo, thumb: pendingThumb, expressions, exprImages };
      project.characters.push(c);
      speakerId = c.id;
    }
  });
  // 入力バーのスティッキー表情: リネームに追従し、候補から外れたら解除
  if(speakerId === editingCharId && speakerFace){
    const rn = exprStaged.find(x => x.orig === speakerFace);
    speakerFace = rn ? rn.name : (expressions.includes(speakerFace) ? speakerFace : null);
    renderSpeakerChip();
  }
  hideModal("#charModal");
  mainInput.focus();
});
$("#charDeleteBtn").addEventListener("click", () => {
  const c = charById(editingCharId);
  if(!c) return;
  if(!confirm(`「${c.name}」を削除しますか？\nこのキャラのセリフは地の文になります。`)) return;
  mutate(() => {
    for(const s of project.scenes)
      for(const cmd of s.commands)
        if(cmd.type === "serif" && cmd.chara === editingCharId) cmd.chara = null;
    project.characters = project.characters.filter(x => x.id !== editingCharId);
    project.honorificRules = project.honorificRules.filter(r => r.speakerId !== editingCharId && r.targetId !== editingCharId);
    if(speakerId === editingCharId) speakerId = null;
  });
  hideModal("#charModal");
});
$("#charNameInput").addEventListener("keydown", e => {
  if(e.isComposing) return;
  if(e.key === "Enter") $("#charSaveBtn").click();
});

// シーンをグループ順（各グループ→最後に未分類）で列挙。{scene, groupName} の配列
function scenesInGroupOrder(){
  const groups = project.sceneGroups;
  if(!groups.length) return project.scenes.map(s => ({ scene: s, groupName: null }));
  const out = [];
  for(const g of groups)
    for(const s of project.scenes) if(s.groupId === g.id) out.push({ scene: s, groupName: g.name });
  for(const s of project.scenes)
    if(!s.groupId || !groups.some(g => g.id === s.groupId)) out.push({ scene: s, groupName: null });
  return out;
}

/* ---------- 選択肢モーダル ---------- */
let editingChoiceIndex = null;   // null=新規
function sceneSelectHtml(selected){
  let h = `<option value="">（続行 — 飛ばない）</option>`;
  const grouped = project.sceneGroups.length > 0;
  let lastGroup, openGroup = false;
  for(const { scene: s, groupName } of scenesInGroupOrder()){
    if(grouped && groupName !== lastGroup){
      if(openGroup) h += `</optgroup>`;
      h += `<optgroup label="${esc(groupName || "未分類")}">`;
      lastGroup = groupName; openGroup = true;
    }
    h += `<option value="${s.id}"${s.id === selected ? " selected" : ""}>${esc(s.name)}</option>`;
  }
  if(openGroup) h += `</optgroup>`;
  h += `<option value="__new__">＋ 新規シーン作成…</option>`;
  return h;
}
function addOptRow(text = "", target = null){
  const row = document.createElement("div");
  row.className = "opt-item";
  row.innerHTML =
    `<div class="opt-row">` +
      `<input type="text" class="opt-text" placeholder="選択肢の文" value="${esc(text)}">` +
      `<select>${sceneSelectHtml(target)}</select>` +
      `<button class="mini-btn" title="削除">${icon("trash-2")}</button>` +
    `</div>` +
    `<div class="opt-branch-row">` +
      `<span class="opt-branch-arrow">└</span>` +
      `<input type="text" class="opt-branch" placeholder="この選択肢だけの短い返答（任意・自動で合流先へつながります）">` +
    `</div>`;
  const select = row.querySelector("select");
  const branchRow = row.querySelector(".opt-branch-row");
  const syncBranchVisibility = () => {
    const show = select.value === "";                 // 明示的な行き先が無い（＝続行）選択肢だけ使える
    branchRow.classList.toggle("hidden", !show);
    if(!show) row.querySelector(".opt-branch").value = "";
  };
  select.addEventListener("change", e => {
    if(e.target.value === "__new__"){
      const name = prompt("新規シーン名:");
      if(name && name.trim()){
        const id = findOrCreateScene(name.trim());
        scheduleSave();
        // 全selectを更新
        document.querySelectorAll("#choiceOptList select").forEach(sel => {
          const cur = sel.value === "__new__" ? id : sel.value;
          sel.innerHTML = sceneSelectHtml(cur);
        });
        renderScenes();
      }else{
        e.target.value = "";
      }
    }
    syncBranchVisibility();
  });
  syncBranchVisibility();
  row.querySelector("button").addEventListener("click", () => row.remove());
  $("#choiceOptList").appendChild(row);
  return row;
}
function openChoiceModal(cmdIndex){
  editingChoiceIndex = cmdIndex;
  $("#choiceOptList").innerHTML = "";
  if(cmdIndex !== null){
    for(const o of cmds()[cmdIndex].options) addOptRow(o.text, o.target);
  }else{
    addOptRow(); addOptRow();
  }
  showModal("#choiceModal");
  $("#choiceOptList input").focus();
}
$("#btnAddOpt").addEventListener("click", () => addOptRow().querySelector("input").focus());
$("#choiceSaveBtn").addEventListener("click", () => {
  const parsed = [];
  document.querySelectorAll("#choiceOptList .opt-item").forEach(item => {
    const text = item.querySelector(".opt-text").value.trim();
    const selVal = item.querySelector("select").value;
    const target = (selVal && selVal !== "__new__") ? selVal : null;
    const branch = target ? "" : item.querySelector(".opt-branch").value.trim();
    if(text) parsed.push({ text, target, branch });
  });
  if(!parsed.length){ toast("選択肢を1つ以上入力してください", true); return; }

  // 「この選択肢だけの短い返答」が入力された分だけ、事前にパース＆検証しておく
  let branchError = null;
  const branchCmdList = parsed.map(o => {
    if(o.target || !o.branch) return null;
    const r = parseInput(o.branch, { sticky: false });
    if(r.error){ branchError = `「${o.text}」の返答: ${r.error}`; return null; }
    if(!r.cmd){ branchError = `「${o.text}」の返答の内容を入力してください`; return null; }
    return r.cmd;
  });
  if(branchError){ toast(branchError, true); return; }
  const needsSplit = branchCmdList.some(Boolean);

  const cmd = { type: "choice", options: parsed.map(o => ({ text: o.text, target: o.target })) };

  mutate(() => {
    const scene = curScene();
    let ci;                                              // 選択肢コマンドが配置されるインデックス
    if(editingChoiceIndex !== null){
      ci = editingChoiceIndex;
      scene.commands[ci] = carryTr(scene.commands[ci], cmd);
    }else{
      ci = selIndex === null ? scene.commands.length : selIndex + 1;
      scene.commands.splice(ci, 0, cmd);
      if(selIndex !== null) selIndex = ci;
    }

    if(needsSplit){
      const tail = scene.commands.splice(ci + 1);         // 選択肢より後ろ＝すべての分岐に共通する続き
      let mergeId = null;
      if(tail.length){
        const mergeScene = {
          id: uid(), name: uniqueSceneName(scene.name + "の続き"),
          commands: tail, groupId: scene.groupId, synopsis: "",
        };
        project.scenes.push(mergeScene);
        mergeId = mergeScene.id;
      }
      parsed.forEach((o, idx) => {
        if(o.target) return;                              // 明示的な行き先はそのまま
        const branchCmd = branchCmdList[idx];
        if(branchCmd){
          const branchCmds = [branchCmd];
          if(mergeId) branchCmds.push({ type: "jump", target: mergeId });
          const branchScene = {
            id: uid(), name: uniqueSceneName(o.text || "分岐"),
            commands: branchCmds, groupId: scene.groupId, synopsis: "",
          };
          project.scenes.push(branchScene);
          cmd.options[idx].target = branchScene.id;
        }else if(mergeId){
          cmd.options[idx].target = mergeId;                // 短い返答なし＝そのまま合流先へ
        }
      });
    }
  });
  scrollToInsertPoint();

  hideModal("#choiceModal");
  mainInput.focus();
});
