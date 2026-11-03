// Sequence editor / player (class j1): up to 10 exercises, uploaded to slots 101-110.
import { h, toolbar, dialog, popupMenu, popupWindow, segmented, abtn, toast, enable, confirmDelete } from "../ui.js";
import { drawTable, Slider, COL } from "../widgets.js";
import { robot, C, ST } from "../ble.js";
import * as engine from "../engine.js";
import { store } from "../store.js";
import { nav } from "../app.js";
import { newGame, cloneGame, RND, CYCLE_PLAY } from "../model.js";
import { propertiesDialog, robotErrorDialog } from "../dialogs.js";
import { editorScreen, keepScreenOn } from "./editor.js";

function seqCycleText(c){
  if (!c.enabled) return "Sequence cycle:\noff";
  if (c.sequenceMode) return "Sequence cycle:\nunique";
  return `Sequence cycle\n(${c.ballMode ? "repeat" : "secs"}): ${c.play} / ${c.delay}`;
}

export function sequenceScreen(uuid){
  let seq, dirty = false, mode = 0, playTable = -1, playBall = -1;
  const load = () => { seq = store.get(uuid) || newGame({sequence:true}); dirty = false; };
  load();
  const S = () => seq.settings;
  const markDirty = () => { dirty = true; };

  const tb = toolbar({title: seq.name, blue:true, onBack: () => up()});
  const saveAction = {label:"Save", onClick: e => saveMenu(e.currentTarget)};
  const tables = [];
  const grid = h("div", {class:"seq-grid"});
  for (let i = 0; i < 10; i++){
    const c = h("canvas", {class:"seq-table"});
    bindTable(c, i);
    tables.push(c); grid.append(c);
  }
  const status = h("div", {class:"play-status"});

  // idle
  const desc = h("div", {class:"ed-desc", onclick: async () => {
    if (await propertiesDialog(seq, {title:"Set Sequence Properties"})){ markDirty(); texts(); } }});
  const cycleBtn = abtn("", {iconName:"loop", onClick: e => cyclePopup(e.currentTarget)});
  const toggleRandom = async () => {
    S().randomEnabled = !S().randomEnabled; S().random = S().randomEnabled ? RND.TYPE : 0;
    markDirty(); texts();
    if (mode === 2) await engine.pushSettings(S());
  };
  const randomBtn = abtn("", {iconName:"shuffle", onClick: toggleRandom});
  const resetBtn = abtn("Reset\nhead", {iconName:"reset", onClick: () => robot.req(C.RECAL), cls:"end"});
  const playBtn = h("button", {class:"btn-play", onclick: () => play()}, "Play sequence");
  const viewBpm = new Slider({label:"Ball/min: %d", min:5, max:120, value:S().bpm,
    onChange: (p, v) => { S().bpm = v; playBpm.setValue(v); markDirty(); }});
  const idle = h("div", {class:"ed-mode"}, desc, h("div", {class:"btn-row"}, cycleBtn, randomBtn, resetBtn), playBtn, viewBpm.el);

  // playing
  const playRandom = abtn("", {iconName:"shuffle", top:true, onClick: toggleRandom});
  const stopBtn = h("button", {class:"btn-stop seq", onclick: () => stop()}, "Stop sequence");
  let bpmDebounce = 0;
  const playBpm = new Slider({label:"Ball/min: %d", min:5, max:120, value:S().bpm, onChange: (p, v) => {
    S().bpm = v; viewBpm.setValue(v); markDirty();
    clearTimeout(bpmDebounce); bpmDebounce = setTimeout(() => engine.pushSettings(S()), 200);
  }});
  const playing = h("div", {class:"ed-mode"}, h("div", {class:"btn-row center"}, playRandom), stopBtn, playBpm.el);

  const el = h("div", {class:"screen"}, tb, h("div", {class:"ed-scroll"}, grid, status, idle, playing));

  function draw(){
    const cyc = S().cycle;
    tables.forEach((c, i) => {
      const ex = seq.exercises[i];
      drawTable(c, ex ? ex.balls : null, {
        playing: i === playTable ? playBall : -1,
        cycle: ex?.cycle.enabled ? (cyc.enabled && cyc.sequenceMode ? 2 : 1) : 0});
      c.classList.toggle("active", i === playTable);
    });
  }
  function texts(){
    tb.setTitle(seq.name || "Sequence");
    desc.textContent = seq.description || "";
    cycleBtn.setText(seqCycleText(S().cycle));
    const t = S().randomEnabled ? "Random: On" : "Random: Off";
    const io = {color: S().randomEnabled ? "#009900" : "#808080", strike: !S().randomEnabled};
    randomBtn.setText(t); randomBtn.setIcon("shuffle", io);
    playRandom.setText(t); playRandom.setIcon("shuffle", io);
    viewBpm.setValue(S().bpm); playBpm.setValue(S().bpm);
  }
  function setMode(m){
    mode = m;
    idle.style.display = m === 0 ? "" : "none";
    playing.style.display = m === 2 ? "" : "none";
    if (m === 0){ playTable = -1; playBall = -1; status.textContent = ""; }
    tb.setActions(m === 2 ? [] : [saveAction]);
    [playBtn, resetBtn].forEach(b => enable(b, robot.connected));
    texts(); requestAnimationFrame(draw);
  }

  // ---------- tables ----------
  function bindTable(c, i){
    let t = 0, long = false;
    c.addEventListener("pointerdown", () => { long = false; t = setTimeout(() => { long = true; tableMenu(i, c); }, 500); });
    c.addEventListener("pointerup", () => { clearTimeout(t); if (!long) openSlot(i); });
    c.addEventListener("pointerleave", () => clearTimeout(t));
    c.addEventListener("pointercancel", () => clearTimeout(t));
  }
  async function openSlot(i){
    if (i > seq.exercises.length) i = seq.exercises.length;          // empty slot: the next free one
    if (i >= 10) return;
    if (mode === 2) await stop();
    if (dirty || !store.get(uuid)){
      const v = await dialog({title:"Sequence not saved", message:"Do you want to save it before close?",
        buttons:[{label:"Close without Save", value:"close"}, {label:"Save and Close", value:"save"}]});
      if (v === undefined) return;
      if (v === "save" || !store.get(uuid)){ if (!(await save())) return; }
    }
    nav.push(editorScreen({seqUuid: uuid, slot: i, onSaved: () => { load(); }}));
  }
  async function tableMenu(i, anchor){
    if (mode === 2 || !seq.exercises[i]) return;
    const n = seq.exercises.length;
    const v = await popupMenu(anchor, [{label:"Exercise operations:", disabled:true},
      {label:"Delete", value:"del", hidden: n <= 1}, {label:"Duplicate", value:"dup", hidden: n >= 10},
      {label:"Move left", value:"left", hidden: i === 0}, {label:"Move right", value:"right", hidden: i === n - 1}]);
    const E = seq.exercises;
    if (v === "del"){ if (!(await confirmDelete())) return; E.splice(i, 1); }
    else if (v === "dup") E.splice(i + 1, 0, cloneGame(E[i]));
    else if (v === "left") [E[i-1], E[i]] = [E[i], E[i-1]];
    else if (v === "right") [E[i+1], E[i]] = [E[i], E[i+1]];
    else return;
    markDirty(); draw();
  }

  // ---------- global cycle ----------
  function cyclePopup(anchor){
    const c = S().cycle;
    const segIdx = !c.enabled ? 0 : c.sequenceMode ? 3 : c.ballMode ? 2 : 1;
    const playSl = new Slider({label: c.ballMode ? "Play %d times" : "Play %d secs", min:CYCLE_PLAY.min,
      max: c.ballMode ? CYCLE_PLAY.maxRepeat : CYCLE_PLAY.maxTime, value:c.play,
      onChange: (p, v) => { c.play = v; changed(); }});
    const pauseSl = new Slider({label:"Pause %d secs", min:1, max:60, value:Math.max(1, c.delay),
      onChange: (p, v) => { c.delay = v; changed(); }});
    c.delay = Math.max(1, c.delay);
    const sliders = h("div", {}, playSl.el, pauseSl.el);
    const showSliders = i => sliders.style.display = i === 1 || i === 2 ? "" : "none";
    const seg = segmented(["off", "time", "repeat", "unique"], segIdx, i => {
      c.enabled = i > 0; c.sequenceMode = i === 3; c.ballMode = i === 2;
      playSl.setBounds(CYCLE_PLAY.min, c.ballMode ? CYCLE_PLAY.maxRepeat : CYCLE_PLAY.maxTime);
      playSl.setLabel(c.ballMode ? "Play %d times" : "Play %d secs");
      c.play = playSl.value; showSliders(i); changed();
    }, {width:"224px"});
    showSliders(segIdx);
    function changed(){ markDirty(); texts(); draw(); }
    popupWindow(anchor, h("div", {class:"pw-cycle"}, h("div", {class:"pw-row"}, h("span", {class:"pw-lbl"}, "Sequence cycle"), seg), sliders), {fullWidth:true});
  }

  // ---------- play ----------
  let progress = null;
  async function play(){
    if (!robot.connected){ toast("Amicus not connected"); return; }
    if (!seq.exercises.length){ toast("No exercise to play!"); return; }
    setMode(2); enable(stopBtn, false); keepScreenOn(true);
    const ok = await engine.playSequence(seq, S(), on => {
      if (on) progress = dialog({title:"Please wait", message:"Downloading sequence to Amicus", buttons:[], cancelable:false});
      else { progress?.close(); progress = null; }
    });
    if (!ok){ toast("Failed to start"); setMode(0); keepScreenOn(false); return; }
    enable(stopBtn, true);
  }
  async function stop(){
    await engine.stopPlay({remote:1});
    setMode(0); keepScreenOn(false);
  }

  // ---------- saving / closing ----------
  async function save(){
    if (!store.get(uuid) && !seq.name){
      if (!(await propertiesDialog(seq, {title:"Set Sequence Properties"}))) return false;
    }
    store.put(seq); dirty = false; texts();
    return true;
  }
  async function saveAs(){
    const g = cloneGame(seq); g.uuid = newGame().uuid;
    if (!(await propertiesDialog(g, {title:"Set Sequence Properties"}))) return;
    store.put(g); uuid = g.uuid; load(); texts(); draw();
  }
  async function saveMenu(anchor){
    const v = await popupMenu(anchor, [{label:"Save", value:"save"}, {label:"Save As...", value:"saveas"},
      {label:"", disabled:true}, {label:"Revert changes", value:"revert"}]);
    if (v === "save") save();
    else if (v === "saveas") saveAs();
    else if (v === "revert"){ load(); texts(); draw(); }
  }
  async function up(){
    if (mode === 2){ await stop(); return; }
    if (dirty){
      const v = await dialog({title:"Sequence not saved", message:"Do you want to save it before close?",
        buttons:[{label:"Close without Save", value:"close"}, {label:"Save and Close", value:"save"}]});
      if (v === undefined) return;
      if (v === "save" && !(await save())) return;
    }
    if (robot.connected) robot.req(C.REMOTE_MODE, [0]);
    nav.pop();
  }

  // ---------- robot events ----------
  let lastRemoteStart = 0;
  const offs = [
    robot.on("frame", ({cmd, p}) => {
      if (cmd === C.BALL && mode === 2 && p.length >= 4){
        playTable = p[3] - 1; playBall = p[0] - 1; enable(stopBtn, true); draw();
      } else if (cmd === C.PLAYING && mode === 2 && p.length >= 2){
        status.style.color = COL.green; status.textContent = `Playing for ${p[1]} ${p[0] === 1 ? "secs" : "times"}.`;
      } else if (cmd === C.PAUSED && mode === 2){
        status.style.color = COL.red; status.textContent = p[0] > 0 ? `Paused for ${p[0]} secs.` : "";
      } else if (cmd === C.REMOTE_BTN && p.length >= 2 && nav.isVisible(screen)){
        if (p[1] === 1 && mode !== 2 && Date.now() - lastRemoteStart > 1000){ lastRemoteStart = Date.now(); play(); }
        else if (p[1] === 8 && mode === 2) stop();
        else if (p[1] === 2 || p[1] === 4) robot.req(C.GET_BPM).then(r => { if (r && r[0] >= 5 && r[0] <= 120){ S().bpm = r[0]; markDirty(); texts(); } });
      }
    }),
    robot.on("state", ({state, code}) => {
      if (state === ST.ERROR && mode === 2){ setMode(0); robotErrorDialog(code); }
    }),
    robot.on("connected", () => setMode(mode)),
    robot.on("disconnected", () => { progress?.close(); if (mode === 2) setMode(0); else setMode(mode); }),
  ];

  const screen = {
    el,
    onShow(){ if (!dirty) load(); setMode(mode); if (robot.connected) robot.req(C.REMOTE_MODE, [mode === 2 ? 2 : 1]); },
    onReselect: () => up(),
    destroy(){ offs.forEach(f => f()); keepScreenOn(false); },
  };
  return screen;
}
