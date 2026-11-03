// Exercise editor / player (class a0): view mode 0, ball edit mode 1, play mode 2.
import { h, icon, toolbar, dialog, popupMenu, popupWindow, segmented, abtn, toast, enable } from "../ui.js";
import { drawTable, drawTrajectory, SpinView, Slider, COL } from "../widgets.js";
import { robot, C, ST } from "../ble.js";
import * as engine from "../engine.js";
import { store, prefs } from "../store.js";
import { nav } from "../app.js";
import { newGame, newBall, copyBall, mirrorBall, normaliseServe, canAdjust, applyAdjust, cloneGame, RND, CYCLE_PLAY, defaultCycle } from "../model.js";
import { ballSliders, propertiesDialog, saveToSequenceDialog, robotErrorDialog } from "../dialogs.js";
import { waitForServe, beep } from "../sound.js";
import { openGame } from "./open.js";

export function cycleText(c){
  if (!c.enabled) return "Cycle:\noff";
  return `Cycle(${c.ballMode ? "reps" : "secs"}):\n${c.play} / ${c.delay}`;
}
export function randomText(f, enabled){
  if (!enabled || !f) return "Random:\noff";
  const ty = f & RND.TYPE, pl = f & RND.PLACE, sc = f & RND.SCATTER;
  let t = ty ? (pl ? "Total RND" : "Type RND") : (pl ? "Place RND" : "");
  if (sc) t = t ? `${t},\nScatter` : "Scatter";
  return t;
}

let wakeLock = null;
export async function keepScreenOn(on){
  try {
    if (on && !wakeLock && navigator.wakeLock) wakeLock = await navigator.wakeLock.request("screen");
    if (!on && wakeLock){ await wakeLock.release(); wakeLock = null; }
  } catch {}
}

// ctx: {uuid} single exercise (null = new) | {seqUuid, slot} one exercise of a sequence
export function editorScreen(ctx = {}){
  let game, ex, seqName = "";
  let dirty = false, mode = 0, sel = -1, playing = -1, sampling = false, lastWait = false;
  let settings;           // {bpm, random, randomEnabled}
  let waiter = null, lastRemoteStart = 0, offs = [];

  function load(){
    if (ctx.seqUuid){
      const seq = store.get(ctx.seqUuid);
      seqName = seq?.name || "";
      ex = cloneGame(seq?.exercises[ctx.slot] || {balls:[newBall()], cycle: defaultCycle()});
      game = {name: seqName, description: seq?.description || "", settings: seq?.settings || newGame().settings};
    } else {
      game = (ctx.uuid && store.get(ctx.uuid)) || newGame();
      ex = game.exercises[0];
    }
    if (!ex.balls.length) ex.balls.push(newBall());
    settings = {bpm: game.settings.bpm, random: game.settings.random, randomEnabled: game.settings.randomEnabled};
    dirty = false; sel = -1; playing = -1;
  }
  load();
  const isNew = () => !ctx.seqUuid && !ctx.uuid;
  const title = () => ctx.seqUuid ? `${seqName} / ${ctx.slot + 1}` : (game.name || "New Exercise");
  const playSettings = () => ({...settings, cycle: ex.cycle});
  const markDirty = () => { dirty = true; };

  // ---------- header ----------
  const tb = toolbar({title: title(), blue:true, onBack: () => up()});
  const saveBtn = {label:"Save", onClick: e => saveMenu(e.currentTarget)};
  const table = h("canvas", {class:"ed-table"});
  const traj = h("canvas", {class:"ed-traj"});
  const status = h("div", {class:"play-status"});
  const spin = new SpinView({editable:true, touchable:true, maxBalls:10,
    onSelect: i => chipTap(i), onAdd: () => addBall(), onLongPress: (i, anchor) => chipMenu(i, anchor)});
  const spinWrap = h("div", {class:"ed-spin"}, spin.el);
  const header = h("div", {class:"ed-header"}, table, spinWrap, traj, status);

  // ---------- mode 0: description area ----------
  const desc = h("div", {class:"ed-desc", onclick: editProps});
  const cycleBtn = abtn("", {iconName:"loop", onClick: e => cyclePopup(e.currentTarget)});
  const randomBtn = abtn("", {iconName:"shuffle", onClick: e => randomPopup(e.currentTarget)});
  const resetBtn = abtn("Reset\nhead", {iconName:"reset", onClick: () => robot.req(C.RECAL), cls:"end"});
  const mirrorBtn = abtn("Mirror\nleft/right", {iconName:"mirror", onClick: () => { ex.balls.forEach(mirrorBall); markDirty(); redraw(); }});
  const waitBtn = abtn("Wait", {iconName:"wait", onClick: () => play(true)});
  const playBtn = h("button", {class:"btn-play", onclick: () => play(false)}, "Play Exercise");
  const viewBpm = new Slider({label:"Ball/min: %d", min:5, max:120, value:settings.bpm,
    onChange: (p, v) => { settings.bpm = v; playBpm.setValue(v); markDirty(); }});
  const descArea = h("div", {class:"ed-mode"}, desc,
    h("div", {class:"btn-row"}, cycleBtn, randomBtn, resetBtn),
    h("div", {class:"btn-row"}, mirrorBtn, waitBtn),
    playBtn, viewBpm.el);

  // ---------- mode 1: ball editor ----------
  let sampleDebounce = 0;
  const bs = ballSliders(key => {
    markDirty(); redraw();
    if (sampling){ clearTimeout(sampleDebounce); sampleDebounce = setTimeout(() => engine.sampleUpdate(ex.balls[sel]), 200); }
  });
  const sector = h("input", {type:"checkbox", class:"switch", onchange: () => {
    const b = ex.balls[sel]; if (!b) return;
    if (sector.checked){ b.range = Math.max(b.range || 0, 3); b.place = Math.min(13, Math.max(3, b.place)); }
    else b.range = 0;
    bs.setBall(b); markDirty(); redraw();
  }});
  const serve = h("input", {type:"checkbox", class:"switch", onchange: () => {
    const b = ex.balls[sel]; if (!b) return;
    if (serve.checked) b.state = 2;
    else { b.state = 1; for (let i = sel + 1; i < ex.balls.length && ex.balls[i].state === 2; i++) ex.balls[i].state = 1; }
    normaliseServe(ex.balls); markDirty(); redraw();
  }});
  const serveLbl = h("label", {class:"switch-row"}, "Serve", serve);
  const quickPlay = h("button", {class:"btn-play", onclick: () => play(lastWait)}, "Play");
  const sampleBtn = h("button", {class:"abtn", onclick: () => toggleSample()}, "Sample");
  const ballEditor = h("div", {class:"ed-mode ed-balleditor"},
    h("div", {class:"switches"}, h("label", {class:"switch-row"}, "Sector", sector), serveLbl),
    bs.el,
    h("div", {class:"btn-row half"}, quickPlay, sampleBtn));

  // ---------- mode 2: play controller ----------
  const adj = (param, d) => async () => {
    if (!canAdjust(ex.balls, param, d)) return;
    const r = await robot.req(C.ADJ, [param, d > 0 ? 0x01 : 0xFF]);
    if (!r) return;
    applyAdjust(ex.balls, param, d); markDirty(); redraw();
  };
  const L = (t, f) => h("button", {class:"abtn large", onclick:f}, t);
  const spinRow = h("div", {class:"adj-row"}, L("—", adj(1, -1)), h("span", {}, "Spins"), L("+", adj(1, 1)));
  const tglCycle = abtn("", {iconName:"loop", top:true, onClick: async () => {
    ex.cycle.enabled = !ex.cycle.enabled; markDirty(); updateTexts(); await engine.pushSettings(playSettings()); }});
  const tglRandom = abtn("", {iconName:"shuffle", top:true, onClick: async () => {
    settings.randomEnabled = !settings.randomEnabled; markDirty(); updateTexts(); await engine.pushSettings(playSettings()); }});
  const playMirror = abtn("Mirror", {iconName:"mirror", top:true, onClick: async () => {
    await engine.stopPlay({remote:null}); ex.balls.forEach(mirrorBall); markDirty(); redraw(); await startPlay(lastWait); }});
  const stopBtn = h("button", {class:"btn-stop", onclick: () => stop()}, "Stop Exercise");
  let bpmDebounce = 0;
  const playBpm = new Slider({label:"Ball/min: %d", min:5, max:120, value:settings.bpm, onChange: (p, v) => {
    settings.bpm = v; viewBpm.setValue(v); markDirty();
    clearTimeout(bpmDebounce); bpmDebounce = setTimeout(() => engine.pushSettings(playSettings()), 200);
  }});
  const playController = h("div", {class:"ed-mode ed-play"},
    h("div", {class:"adj-title"}, "Adjust all balls"),
    h("div", {class:"adj-grid"},
      h("div", {class:"adj-col"}, L("+", adj(0, 1)), h("span", {}, "Traject."), L("—", adj(0, -1))),
      h("div", {class:"adj-rows"}, spinRow, h("div", {class:"adj-row"}, L("—", adj(3, -1)), h("span", {}, "Speeds"), L("+", adj(3, 1))))),
    h("div", {class:"btn-row three"}, tglCycle, playMirror, tglRandom),
    stopBtn, playBpm.el);

  const body = h("div", {class:"ed-scroll"}, header, descArea, ballEditor, playController);
  const el = h("div", {class:"screen"}, tb, body);

  // ---------- drawing / texts ----------
  function redraw(){
    drawTable(table, ex.balls, {selected: mode === 1 ? sel : -1, playing});
    drawTrajectory(traj, ex.balls, {selected: mode === 1 ? sel : -1, playing});
    spinWrap.style.height = table.clientHeight + "px";
    spin.set(ex.balls, {selected: mode === 1 ? sel : -1, playing});
    spinRow.style.visibility = ex.balls.every(b => b.spin === ex.balls[0].spin) ? "visible" : "hidden";
    if (mode === 1 && ex.balls[sel]){
      const b = ex.balls[sel];
      const canServe = sel <= 2 && (sel === 0 || ex.balls[sel-1].state === 2);
      serveLbl.style.display = canServe ? "" : "none";
      serve.checked = b.state === 2;
      sector.checked = (b.range || 0) > 0;
    }
  }
  function updateTexts(){
    tb.setTitle(title());
    desc.textContent = game.description || "";
    cycleBtn.setText(cycleText(ex.cycle));
    randomBtn.setText(randomText(settings.random, settings.randomEnabled));
    tglCycle.setText(ex.cycle.enabled ? "Cycle: On" : "Cycle: Off");
    tglCycle.setIcon("loop", {color: ex.cycle.enabled ? "currentColor" : "#808080", strike: !ex.cycle.enabled});
    tglRandom.setText(settings.randomEnabled ? "Random: On" : "Random: Off");
    tglRandom.setIcon("shuffle", {color: settings.randomEnabled ? "#009900" : "#808080", strike: !settings.randomEnabled});
    waitBtn.setText(prefs.waitMode ? "Pass wait" : "Wait");
    quickPlay.textContent = lastWait ? "Wait" : "Play";
    viewBpm.setValue(settings.bpm); playBpm.setValue(settings.bpm);
  }
  function setMode(m){
    mode = m;
    descArea.style.display = m === 0 ? "" : "none";
    ballEditor.style.display = m === 1 ? "" : "none";
    playController.style.display = m === 2 ? "" : "none";
    spin.editable = !sampling && m !== 2;
    if (m !== 2){ playing = -1; status.textContent = ""; }
    if (m === 1 && ex.balls[sel]) bs.setBall(ex.balls[sel]);
    updateActions(); updateEnabled(); updateTexts();
    requestAnimationFrame(redraw);
  }
  function updateActions(){ tb.setActions(mode === 2 || sampling ? [] : [saveBtn]); }
  function updateEnabled(){
    const c = robot.connected;
    [playBtn, waitBtn, resetBtn, quickPlay, sampleBtn].forEach(b => enable(b, c));
    spin.editable = !sampling && mode !== 2;
  }

  // ---------- chips ----------
  async function chipTap(i){
    if (mode === 2){
      await stop();
      sel = i; setMode(1);
      if (robot.connected) toggleSample(true);
      return;
    }
    sel = i;
    if (sampling) engine.sampleUpdate(ex.balls[sel]);
    setMode(1);
  }
  function addBall(){
    if (sampling || ex.balls.length >= 10) return;
    const b = ex.balls[sel] ? {...copyBall(ex.balls[sel]), state:1} : newBall();
    ex.balls.push(b); sel = ex.balls.length - 1; markDirty(); setMode(1);
  }
  async function chipMenu(i, anchor){
    if (mode === 2 || sampling) return;
    sel = i; setMode(1);
    const v = await popupMenu(anchor, [
      {label:"Ball operations:", disabled:true}, {label:"Delete", value:"del"},
      {label:"Duplicate", value:"dup", hidden: ex.balls.length >= 10},
      {label:"Move left", value:"left", hidden: i === 0}, {label:"Move right", value:"right", hidden: i === ex.balls.length - 1}]);
    if (!v) return;
    const B = ex.balls;
    if (v === "del"){
      if (B.length <= 1){ toast("Last ball couldn't be deleted!"); return; }
      B.splice(i, 1); sel = Math.min(i, B.length - 1);
    } else if (v === "dup"){ B.splice(i, 0, {...copyBall(B[i]), state:1}); sel = i + 1; }
    else if (v === "left"){ [B[i-1], B[i]] = [B[i], B[i-1]]; sel = i - 1; }
    else if (v === "right"){ [B[i+1], B[i]] = [B[i], B[i+1]]; sel = i + 1; }
    normaliseServe(B); markDirty(); setMode(1);
  }

  // ---------- sample ----------
  async function toggleSample(forceStart = false){
    if (!sampling || forceStart){
      if (!ex.balls[sel]) return;
      await keepScreenOn(true);
      if (!(await engine.sampleStart(ex.balls[sel]))){ toast("Failed to start sample"); return; }
      sampling = true; sampleBtn.textContent = "Stop sample";
    } else {
      if (!(await engine.sampleStop())) toast("Failed to stop sample");
      sampling = false; sampleBtn.textContent = "Sample";
      keepScreenOn(false);
    }
    updateActions(); updateEnabled(); redraw();
  }

  // ---------- play ----------
  async function play(wait){
    if (!robot.connected){ toast("Amicus not connected"); return; }
    if (!ex.balls.some(b => b.state !== 0)){ toast("No balls to play"); return; }
    if (sampling) await toggleSample();
    lastWait = wait;
    await startPlay(wait);
  }
  async function startPlay(wait){
    setMode(2);
    enable(stopBtn, false);
    keepScreenOn(true);
    const ok = await engine.playExercise(ex.balls, playSettings(), wait);
    if (!ok){ toast("Failed to start"); setMode(0); keepScreenOn(false); return; }
    enable(stopBtn, true);
  }
  async function stop(){
    waiter?.stop(); waiter = null;
    await engine.stopPlay({remote:1});
    setMode(0);
    keepScreenOn(false);
  }

  // ---------- popups ----------
  function cyclePopup(anchor){
    const c = ex.cycle;
    const presets = [null, [20, 10], [40, 20], [60, 30], [80, 40]];
    const initialSeg = () => { if (!c.enabled) return 0; const i = presets.findIndex(p => p && p[0] === c.play && p[1] === c.delay); return i > 0 ? i : 5; };
    const playSl = new Slider({label: c.ballMode ? "Play %d times" : "Play %d secs", min:CYCLE_PLAY.min,
      max: c.ballMode ? CYCLE_PLAY.maxRepeat : CYCLE_PLAY.maxTime, value:c.play,
      onChange: (p, v) => { c.play = v; c.enabled = true; seg.set(5); changed(); }});
    const pauseSl = new Slider({label:"Pause %d secs", min:0, max:60, value:c.delay,
      onChange: (p, v) => { c.delay = v; c.enabled = true; seg.set(5); changed(); }});
    const seg = segmented(["off", "20", "40", "60", "80", "custom"], initialSeg(), i => {
      if (i === 0) c.enabled = false;
      else { c.enabled = true; if (presets[i]){ [c.play, c.delay] = presets[i]; playSl.setValue(c.play); pauseSl.setValue(c.delay); } }
      changed();
    });
    const modeSeg = segmented(["time", "repeat"], c.ballMode ? 1 : 0, i => {
      c.ballMode = i === 1;
      playSl.setBounds(CYCLE_PLAY.min, c.ballMode ? CYCLE_PLAY.maxRepeat : CYCLE_PLAY.maxTime);
      playSl.setLabel(c.ballMode ? "Play %d times" : "Play %d secs");
      c.play = playSl.value; changed();
    });
    function changed(){ markDirty(); updateTexts(); }
    popupWindow(anchor, h("div", {class:"pw-cycle"},
      h("div", {class:"pw-row"}, h("span", {class:"pw-lbl"}, "Cycle"), seg),
      h("div", {class:"pw-row"}, h("span", {class:"pw-lbl"}, "Mode"), modeSeg),
      playSl.el, pauseSl.el), {fullWidth:true});
  }
  function randomPopup(anchor){
    const mk = (label, bit) => {
      const cb = h("input", {type:"checkbox", class:"big-check"}); cb.checked = !!(settings.random & bit) && settings.randomEnabled;
      cb.addEventListener("change", () => {
        let f = settings.randomEnabled ? settings.random : 0;
        f = cb.checked ? f | bit : f & ~bit;
        settings.random = f; settings.randomEnabled = f !== 0; markDirty(); updateTexts();
      });
      return h("label", {class:"pw-check"}, cb, label);
    };
    popupWindow(anchor, h("div", {class:"pw-random"}, mk("Scatter", RND.SCATTER), mk("Place RND", RND.PLACE), mk("Type RND", RND.TYPE)))
      .then(() => { if (robot.connected) engine.pushSettings(playSettings()); });
  }

  // ---------- saving ----------
  async function editProps(){
    if (ctx.seqUuid){ toast("Edit the sequence properties in the sequence"); return; }
    if (await propertiesDialog(game)){ markDirty(); updateTexts(); }
  }
  function writeInto(g){
    g.exercises = [{balls: ex.balls.map(copyBall), cycle: {...ex.cycle}}];
    g.settings = {...g.settings, bpm: settings.bpm, random: settings.random, randomEnabled: settings.randomEnabled};
  }
  async function save(){
    if (ctx.seqUuid){
      const seq = store.get(ctx.seqUuid);
      if (!seq){ toast("Sequence not found"); return false; }
      const copy = {balls: ex.balls.map(copyBall), cycle: {...ex.cycle}};
      if (ctx.slot < seq.exercises.length) seq.exercises[ctx.slot] = copy;
      else { if (seq.exercises.length >= 10) return false; seq.exercises.push(copy); ctx.slot = seq.exercises.length - 1; }
      store.put(seq); dirty = false; ctx.onSaved?.(); updateTexts();
      return true;
    }
    if (isNew()){
      if (!(await propertiesDialog(game))) return false;
      game.settings.cycle = {...ex.cycle};
    }
    writeInto(game);
    store.put(game); ctx.uuid = game.uuid; dirty = false; updateTexts();
    return true;
  }
  async function saveAs(){
    const g = newGame({name: ctx.seqUuid ? `${seqName} ${ctx.slot + 1}` : game.name, description: game.description || ""});
    if (!(await propertiesDialog(g))) return;
    writeInto(g); g.settings.cycle = {...ex.cycle};
    store.put(g);
    ctx = {uuid: g.uuid}; game = store.get(g.uuid); ex = game.exercises[0]; dirty = false;
    updateTexts(); redraw();
  }
  async function saveToSequence(){
    const pick = await saveToSequenceDialog();
    if (!pick) return;
    let seq;
    if (pick === "new"){
      seq = newGame({sequence:true, name:""});
      if (!(await propertiesDialog(seq, {title:"Set Sequence Properties"}))) return;
    } else seq = store.get(pick);
    if (seq.exercises.length >= 10){
      await dialog({title:"Cannot add to sequence", message:"Selected sequence is full, please remove an Exercise before adding a new one."});
      return;
    }
    seq.exercises.push({balls: ex.balls.map(copyBall), cycle: {...ex.cycle}});   // a copy, not the live object
    store.put(seq);
    if (dirty){
      const v = await dialog({title:"Exercise is not saved", message:"Do you want to save it before close?",
        buttons:[{label:"Close without Save", value:"close"}, {label:"Save and Close", value:"save"}]});
      if (v === undefined) return;
      if (v === "save" && !(await save())) return;
    }
    await leave();
    openGame(seq.uuid);
  }
  function revert(){ load(); sel = -1; setMode(0); }
  async function saveMenu(anchor){
    const v = await popupMenu(anchor, [
      {label:"Save", value:"save"}, {label:"Save As...", value:"saveas"},
      {label:"Save to Sequence", value:"seq"}, {label:"", disabled:true}, {label:"Revert changes", value:"revert"}]);
    if (v === "save") save();
    else if (v === "saveas") saveAs();
    else if (v === "seq") saveToSequence();
    else if (v === "revert") revert();
  }

  // ---------- navigation ----------
  async function up(){
    if (mode === 1){ if (sampling) await toggleSample(); setMode(0); return; }
    if (mode === 2){ await stop(); return; }
    await close();
  }
  async function close(){
    if (mode === 2) await stop();
    if (sampling) await toggleSample();
    if (dirty){
      const v = await dialog({title:"Exercise is not saved", message:"Do you want to save it before close?",
        buttons:[{label:"Close without Save", value:"close"}, {label:"Save and Close", value:"save"}]});
      if (v === undefined) return;
      if (v === "save" && !(await save())) return;
    }
    await leave();
  }
  async function leave(){
    dirty = false;
    if (robot.connected) robot.req(C.REMOTE_MODE, [0]);
    nav.pop();
  }

  // ---------- robot events ----------
  function onFrame({cmd, p}){
    if (cmd === C.BALL && mode === 2 && p.length){
      playing = p[0] - 1; enable(stopBtn, true); redraw();
    } else if (cmd === C.PLAYING && p.length >= 2 && mode === 2){
      status.style.color = COL.green; status.textContent = `Playing for ${p[1]} ${p[0] === 1 ? "secs" : "times"}.`;
    } else if (cmd === C.PAUSED && mode === 2){
      status.style.color = COL.red; status.textContent = p[0] > 0 ? `Paused for ${p[0]} secs.` : "";
    } else if (cmd === C.REMOTE_BTN && p.length >= 2 && nav.isVisible(screen)) remoteButton(p[1]);
  }
  async function remoteButton(btn){
    if (btn === 1){
      if (mode === 2 || Date.now() - lastRemoteStart < 1000) return;
      lastRemoteStart = Date.now(); play(lastWait);
    } else if (btn === 2 || btn === 4){
      const r = await robot.req(C.GET_BPM);
      if (r && r[0] >= 5 && r[0] <= 120){ settings.bpm = r[0]; markDirty(); updateTexts(); }
    } else if (btn === 8){
      if (mode === 2) await stop();
      if (sampling) await toggleSample();
      setMode(0);
    }
  }
  async function onState({state, code}){
    if (state === ST.ERROR){
      if (mode === 0 && !sampling && !nav.isVisible(screen)) return;
      if (sampling){ sampling = false; sampleBtn.textContent = "Sample"; }
      if (mode === 2) setMode(0);
      robotErrorDialog(code);
    } else if (state === ST.WAIT_SERVE && mode === 2 && !waiter){
      beep(150);
      status.style.color = "#000"; status.textContent = "Waiting for serve";
      waiter = waitForServe({threshold: prefs.soundThreshold, filter: prefs.soundFilter});
      const r = await waiter.done; waiter = null;
      if (r === "serve"){ status.textContent = ""; await robot.req(C.START, [0]); }
      else if (r === "timeout"){ await stop(); }
      else if (r.startsWith("error:")){ toast(r.slice(6), true); await stop(); }
    }
  }
  function onConn(){
    updateEnabled();
    if (robot.connected && nav.isVisible(screen)) robot.req(C.REMOTE_MODE, [mode === 2 ? 2 : 1]);
  }
  function onDisc(){
    updateEnabled();
    if (mode === 2){ waiter?.stop(); setMode(0); }
    sampling = false; sampleBtn.textContent = "Sample";
  }

  offs = [robot.on("frame", onFrame), robot.on("state", onState), robot.on("connected", onConn), robot.on("disconnected", onDisc)];
  let first = true;
  const screen = {
    el,
    onShow(){
      if (robot.connected) robot.req(C.REMOTE_MODE, [mode === 2 ? 2 : 1]);
      if (first && isNew()) sel = 0;
      setMode(first && isNew() ? 1 : mode);
      first = false;
    },
    onReselect: () => close(),
    destroy(){ offs.forEach(f => f()); keepScreenOn(false); waiter?.stop(); },
  };
  return screen;
}
