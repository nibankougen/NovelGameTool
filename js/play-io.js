"use strict";
/* ---------- モーダル共通 ---------- */
function showModal(sel){ $(sel).classList.add("show"); }
function hideModal(sel){ $(sel).classList.remove("show"); }
document.querySelectorAll(".modal-back").forEach(back => {
  back.addEventListener("mousedown", e => { if(e.target === back) back.classList.remove("show"); });
  back.querySelectorAll("[data-close]").forEach(b =>
    b.addEventListener("click", () => back.classList.remove("show")));
});
function anyModalOpen(){ return !!document.querySelector(".modal-back.show"); }

/* ---------- テストプレイ ---------- */
const play = { sceneId: null, idx: 0, waitingChoice: false };
function openPlay(){
  play.sceneId = currentSceneId;
  play.idx = 0; play.waitingChoice = false;
  $("#playBg").textContent = "背景: なし";
  $("#playBgm").textContent = "BGM: なし";
  $("#playFace").style.display = "none";
  showModal("#playModal");
  playStep();
}
function playShowText(name, color, text, isEnd){
  $("#playName").textContent = name || "";
  $("#playName").style.color = color || "var(--text)";
  $("#playText").textContent = text;
  $("#playNext").style.display = isEnd ? "none" : "";
}
function playStep(){
  if(play.waitingChoice) return;
  let guard = 0;
  while(guard++ < 5000){
    const sc = sceneById(play.sceneId);
    if(!sc){ playShowText("", "", "— END —（シーンがありません）", true); return; }
    $("#playSceneName").textContent = "シーン: " + sc.name;
    if(play.idx >= sc.commands.length){
      playShowText("", "", "— END —", true);
      return;
    }
    const c = sc.commands[play.idx++];
    switch(c.type){
      case "serif": {
        const ch = c.chara ? charById(c.chara) : null;
        if(ch){                              // 地の文では直前の顔画像を保持
          const img = $("#playFace");
          // 表情画像があれば優先、なければデフォルトイラスト
          const src = (c.face && (ch.exprImages || {})[c.face]) || ch.thumb;
          if(src){ img.src = src; img.style.display = ""; }
          else img.style.display = "none";
        }
        const name = ch ? ch.name + (c.face ? `（${c.face}）` : "") : "";
        playShowText(name, ch ? ch.color : "", textToResolved(c.text), false);
        return;
      }
      case "bg":  $("#playBg").textContent = "背景: " + (c.value || "なし"); break;
      case "bgm": $("#playBgm").textContent = "BGM: " + (c.value || "なし"); break;
      case "se":  break;
      case "wait": break;
      case "comment": break;
      case "jump": {
        const t = sceneById(c.target);
        if(!t){ playShowText("", "", "⚠ ジャンプ先シーンが見つかりません", true); return; }
        play.sceneId = t.id; play.idx = 0;
        break;
      }
      case "choice": {
        play.waitingChoice = true;
        const box = $("#playChoices");
        box.innerHTML = "";
        for(const o of c.options){
          const b = document.createElement("button");
          b.textContent = o.text;
          b.addEventListener("click", e => {
            e.stopPropagation();
            box.style.display = "none";
            play.waitingChoice = false;
            if(o.target){
              const t = sceneById(o.target);
              if(t){ play.sceneId = t.id; play.idx = 0; }
            }
            playStep();
          });
          box.appendChild(b);
        }
        box.style.display = "flex";
        playShowText("", "", "", true);
        return;
      }
    }
    // セリフ・選択肢が出るまで環境系コマンドを消化しながら進む
  }
  playShowText("", "", "⚠ 無限ループの可能性があります（5000コマンド超過）", true);
}
$("#playArea").addEventListener("click", () => { if(!play.waitingChoice) playStep(); });
$("#playRestart").addEventListener("click", () => {
  $("#playChoices").style.display = "none";
  openPlay();
});

/* ---------- 入出力 ---------- */
function download(filename, text, mime){
  const blob = new Blob([text], { type: mime || "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
function safeName(s){ return (s || "novel").replace(/[\\/:*?"<>|]/g, "_"); }

$("#btnExport").addEventListener("click", () => {
  download(safeName(project.title) + ".json", JSON.stringify(project, null, 2));
  toast("JSONを書き出しました");
});

// ゲーム用書き出し: 制作用データ（メモ・仮サムネイル）を常に除外し、他は設定に従う
function gameExportData(cfg){
  const langs = project.languages || [];
  // 設定済み言語のうち、入力のある翻訳だけを抽出（なければ省略）
  const pickTr = tr => {
    if(!tr) return null;
    const o = {};
    for(const l of langs) if(tr[l]) o[l] = tr[l];
    return Object.keys(o).length ? o : null;
  };
  const root = {
    title: project.title,
    characters: project.characters.map(c => {
      const o = { id: c.id, name: c.name };
      const tr = pickTr(c.tr); if(tr) o.tr = tr;
      if(cfg.color) o.color = c.color;
      if(cfg.face) o.expressions = c.expressions || [];
      return o;
    }),
    scenes: project.scenes.map(s => {
      const o = { id: s.id };
      if(cfg.sceneName) o.name = s.name;
      o.commands = s.commands.filter(c => cfg.comment || c.type !== "comment").map(c => {
        if(c.type === "serif"){
          const out = { type: "serif", chara: c.chara, text: textToResolved(c.text) };
          if(cfg.face && c.face) out.face = c.face;
          const tr = pickTr(c.tr); if(tr) out.tr = tr;
          return out;
        }
        if(c.type === "choice"){
          return { type: "choice", options: c.options.map(op => {
            const oo = { text: op.text, target: op.target ?? null };
            const tr = pickTr(op.tr); if(tr) oo.tr = tr;
            return oo;
          }) };
        }
        return c;
      });
      return o;
    }),
  };
  if(langs.length) root.languages = ["ja", ...langs];   // 先頭がベース言語
  const ttr = pickTr(project.titleTr); if(ttr) root.titleTr = ttr;
  return root;
}
$("#btnExportGame").addEventListener("click", () => {
  const cfg = project.exportSettings;
  $("#expFace").checked = cfg.face;
  $("#expSceneName").checked = cfg.sceneName;
  $("#expColor").checked = cfg.color;
  $("#expComment").checked = cfg.comment;
  $("#expPretty").checked = cfg.pretty;
  showModal("#exportModal");
});
$("#btnExportGameGo").addEventListener("click", () => {
  const cfg = {
    face: $("#expFace").checked,
    sceneName: $("#expSceneName").checked,
    color: $("#expColor").checked,
    comment: $("#expComment").checked,
    pretty: $("#expPretty").checked,
  };
  project.exportSettings = cfg;
  scheduleSave();
  const data = gameExportData(cfg);
  download(safeName(project.title) + ".game.json", JSON.stringify(data, null, cfg.pretty ? 2 : undefined));
  hideModal("#exportModal");
  toast("ゲーム用JSONを書き出しました");
});

$("#btnExportTxt").addEventListener("click", () => {
  let out = `${project.title}\n${"=".repeat(30)}\n\n`;
  for(const s of project.scenes){
    out += `■ シーン: ${s.name}\n${"-".repeat(30)}\n`;
    for(const c of s.commands){
      switch(c.type){
        case "serif": {
          if(c.chara){
            const ch = charById(c.chara);
            out += `${ch ? ch.name : "？"}${c.face ? `（${c.face}）` : ""}「${textToResolved(c.text)}」\n`;
          }else out += `　${textToResolved(c.text)}\n`;
          break;
        }
        case "bg":   out += `【背景】${c.value}\n`; break;
        case "bgm":  out += `【BGM】${c.value || "停止"}\n`; break;
        case "se":   out += `【SE】${c.value}\n`; break;
        case "wait": out += `【待機】${c.value}ms\n`; break;
        case "jump": out += `【ジャンプ】→ ${(sceneById(c.target) || {name:"？"}).name}\n`; break;
        case "choice":
          out += `【選択肢】\n`;
          for(const o of c.options)
            out += `　◆ ${o.text} → ${o.target ? (sceneById(o.target) || {name:"？"}).name : "続行"}\n`;
          break;
        case "comment": out += `※ ${c.text}\n`; break;
      }
    }
    out += "\n";
  }
  download(safeName(project.title) + ".txt", out, "text/plain");
  toast("台本テキストを書き出しました");
});

$("#btnImport").addEventListener("click", () => $("#fileInput").click());
$("#fileInput").addEventListener("change", e => {
  const file = e.target.files[0];
  e.target.value = "";
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const p = JSON.parse(reader.result);
      if(!p || !Array.isArray(p.scenes) || !Array.isArray(p.characters))
        throw new Error("形式が違います");
      if(!confirm(`「${p.title || "無題"}」を読み込みますか？\n現在の内容は履歴（Ctrl+Z）に残ります。`)) return;
      pushUndo();
      project = normalizeProject(p);
      currentSceneId = project.scenes[0]?.id;
      if(!project.scenes.length) project.scenes.push({ id: uid(), name: "シーン1", commands: [], groupId: null, synopsis: "" });
      currentSceneId = project.scenes[0].id;
      speakerId = null; selIndex = null; editIndex = null;
      scheduleSave(); renderAll();
      toast("読み込みました");
    }catch(err){
      toast("読み込みに失敗しました: " + err.message, true);
    }
  };
  reader.readAsText(file, "utf-8");
});

$("#btnNew").addEventListener("click", () => {
  if(!confirm("新規プロジェクトを作成しますか？\n現在の内容は履歴（Ctrl+Z）に残りますが、JSON保存でのバックアップをおすすめします。")) return;
  pushUndo();
  project = createNewProject();
  currentSceneId = project.scenes[0].id;
  speakerId = null; selIndex = null; editIndex = null;
  scheduleSave(); renderAll();
});
