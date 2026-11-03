// Dialogs of the original (class d) and the shared ball slider block.
import { h, dialog, toast } from "./ui.js";
import { Slider, drawTable, drawTrajectory } from "./widgets.js";
import { robot, C } from "./ble.js";
import { ballBytes } from "./model.js";
import * as engine from "./engine.js";
import { store, prefs, saveBall } from "./store.js";
import { soundMeter } from "./sound.js";

// ---------- ball sliders (content_game_edit ball editor / dialog_balleditor) ----------
export function ballSliders(onChange, {centerTickOnPlace = false} = {}){
  let ball = null;
  const set = (key) => (p, v, range) => {
    if (!ball) return;
    ball[key] = p;
    if (key === "place" && sl.place.rangeEnabled) ball.range = range;
    onChange(key);
  };
  const sl = {
    angle: new Slider({label:"∠%d", min:-92, max:61, vertical:true, centerTick:true, centerTickValue:0, onChange:set("trajectory"), cls:"angle"}),
    place: new Slider({label:"Place %d", min:-8, max:8, ticks:true, leftRight:true, centerTick:centerTickOnPlace, centerTickValue:0, onChange:set("place")}),
    freq: new Slider({label:"Ball/min %d%", min:-60, max:60, step:10, ticks:true, onChange:set("ball_per_min_percent")}),
    side: new Slider({label:"Side spin %d°", min:-90, max:90, step:15, ticks:true, onChange:set("side_spin")}),
    speed: new Slider({label:"Speed %d", min:1, max:25, ticks:true, onChange:set("speed")}),
    spin: new Slider({label:"Spin %d", min:-5, max:7, ticks:true, onChange:set("spin")}),
  };
  const el = h("div", {class:"ball-sliders"},
    h("div", {class:"bs-angle"}, sl.angle.el),
    h("div", {class:"bs-right"}, sl.place.el, sl.freq.el, sl.side.el, sl.speed.el, sl.spin.el));
  return {
    el, sl,
    setBall(b){
      ball = b;
      sl.angle.setProgress(b.trajectory); sl.spin.setProgress(b.spin); sl.side.setProgress(b.side_spin);
      sl.speed.setProgress(b.speed); sl.freq.setProgress(b.ball_per_min_percent);
      sl.place.setRange(b.range || 0, (b.range || 0) > 0);
      sl.place.setProgress(b.place);
    },
    get ball(){ return ball; },
  };
}

// ---------- Exercise properties ----------
export async function propertiesDialog(game, {title = "Set Exercise Properties"} = {}){
  const name = h("input", {type:"text", value: game.name || ""});
  const desc = h("textarea", {rows:5, placeholder:"Description"}, game.description || "");
  const body = h("div", {class:"dlg-body"},
    h("div", {class:"dlg-subtitle"}, title),
    h("label", {}, "Name:"), name, h("label", {}, "Description:"), desc);
  const ok = await dialog({body, buttons:[{label:"Cancel", value:false}, {label:"Save", value:true,
    validate: () => { if (!name.value.trim()){ toast("Please enter a name"); return false; } return true; }}]});
  if (!ok) return false;
  game.name = name.value.trim(); game.description = desc.value;
  return true;
}

// ---------- Ball editor (pass / unload ball) ----------
export async function ballEditorDialog(title, key, ball, description){
  const b = {...ball};
  const table = h("canvas", {class:"be-table"}), traj = h("canvas", {class:"be-traj"});
  const redraw = () => { drawTable(table, [b], {selected:0}); drawTrajectory(traj, [b], {selected:0}); };
  let sampling = false, debounce = 0;
  const bs = ballSliders(() => {
    redraw();
    if (sampling){ clearTimeout(debounce); debounce = setTimeout(() => engine.sampleUpdate(b), 200); }
  }, {centerTickOnPlace:true});
  const sampleBtn = h("button", {class:"abtn", onclick: async () => {
    if (!sampling){
      if (!(await engine.sampleStart(b))){ toast("Failed to start sample"); return; }
      sampling = true; sampleBtn.textContent = "Stop sample";
    } else {
      if (!(await engine.sampleStop())) toast("Failed to stop sample");
      sampling = false; sampleBtn.textContent = "Sample";
    }
  }}, "Sample");
  if (!robot.connected) sampleBtn.style.display = "none";
  const body = h("div", {class:"dlg-body ball-editor"},
    description ? h("div", {class:"be-desc"}, description) : null,
    h("div", {class:"be-head"}, table, traj),
    bs.el, sampleBtn);
  const p = dialog({title:`Edit ball : ${title}`, body, cancelable:false, cls:"wide",
    buttons:[{label:"Cancel", value:false}, {label:"Save", value:true}]});
  requestAnimationFrame(() => { bs.setBall(b); redraw(); });
  const ok = await p;
  if (sampling) await engine.sampleStop();
  if (!ok) return null;
  saveBall(key, b);                         // raw values (the original stored the % label here)
  if (key === "pass.json" && robot.connected) await robot.req(C.PASS, [0x01, b.state, ...ballBytes(b, robot.fwMajor)]);
  return b;
}

// ---------- Save to Sequence ----------
export async function saveToSequenceDialog(){
  const list = h("div", {class:"seq-pick"});
  const p = dialog({title:"Save to Sequence", body:list,
    buttons:[{label:"Cancel", value:null}, {label:"New Sequence", value:"new"}]});
  for (const g of store.games.filter(g => g.sequence)){
    const tables = h("div", {class:"mini-tables"});
    const cs = [];
    for (let i = 0; i < 10; i++){ const c = h("canvas", {class:"mini"}); cs.push(c); tables.append(c); }
    list.append(h("div", {class:"seq-row", onclick: () => p.close(g.uuid)}, tables, h("div", {class:"seq-name"}, g.name || "(no name)")));
    requestAnimationFrame(() => cs.forEach((c, i) => drawTable(c, g.exercises[i]?.balls || null)));
  }
  if (!list.children.length) list.append(h("div", {class:"dlg-msg"}, "No sequences yet."));
  return (await p) ?? null;
}

// ---------- Calibrate sound level ----------
export async function soundCalibrateDialog(){
  const meter = h("progress", {max:23000, value:0, class:"meter"});
  const thr = h("input", {type:"range", min:0, max:23000, value:prefs.soundThreshold});
  const thrLbl = h("span", {class:"thr-val"}, String(prefs.soundThreshold));
  thr.addEventListener("input", () => thrLbl.textContent = thr.value);
  const filter = h("input", {type:"checkbox", class:"switch"}); filter.checked = prefs.soundFilter;
  const body = h("div", {class:"dlg-body"},
    h("div", {class:"dlg-subtitle"}, "Current sound level:"), meter,
    h("div", {class:"dlg-subtitle"}, "Threshold: ", thrLbl), thr,
    h("div", {class:"dlg-msg"}, "Move the threshold above the background noise level, and below the ball bouncing noise level."),
    h("label", {class:"switch-row"}, "Noise filter:", filter));
  let stop = null;
  const p = dialog({title:"Calibrate sound level", body, cancelable:false,
    buttons:[{label:"Cancel", value:false}, {label:"Save calibration", value:true}]});
  try { stop = await soundMeter(v => meter.value = v); }
  catch (e) { toast(e.message, true); }
  const ok = await p;
  stop?.();
  if (ok){ prefs.soundThreshold = +thr.value; prefs.soundFilter = filter.checked; }
}

// ---------- Robot error (cmd 7 codes) ----------
const ERRORS = {
  1: "The feeding motors has been stuck.\nBall jam!! Defective or oversized ball or foreign object jamming the lower ball channel.\nClear channel and test ball feed.",
  2: "Ball gets stuck between ball throw discs.\nIf so, turn off power, and then remove that ball",
  3: "Overheated electronics.\nSwitch off power and wait several minutes.\nIf error disappears, resume operations, otherwise call your Amicus Service Center.",
};
export const robotErrorDialog = code => dialog({title:"Robot Error",
  message: ERRORS[code] || "The ball is permanently jammed. Please remove the ball manually from the robot!"});
