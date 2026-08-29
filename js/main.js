"use strict";
/* ---------- 起動 ---------- */
project = loadLocal() || createNewProject();
if(!project.scenes.length) project.scenes.push({ id: uid(), name: "シーン1", commands: [], groupId: null, synopsis: "" });
currentSceneId = project.scenes[0].id;
renderAll();
mainInput.focus();

applyThumbSizeStep(loadThumbSizeStep());
$("#thumbSizeSlider").addEventListener("input", e => {
  const step = parseInt(e.target.value, 10);
  applyThumbSizeStep(step);
  saveThumbSizeStep(step);
});
