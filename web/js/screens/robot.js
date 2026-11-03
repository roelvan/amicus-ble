// Tab 1: robot scan list ("Connection Manager", f1) and robot control (a1) with calibration.
import { h, toolbar, toast, segmented, enable } from "../ui.js";
import { robot, C, OK } from "../ble.js";
import * as engine from "../engine.js";
import { nav } from "../app.js";

export function scanScreen(){
  const spinner = h("div", {class:"spinner", style:{visibility:"hidden"}});
  const tb = toolbar({title:"Connection Manager"});
  const list = h("div", {class:"robot-list"});
  const el = h("div", {class:"screen"}, tb, list);
  tb.setActions([{node: spinner}, {label:"Rescan", onClick: () => rescan()}]);

  async function rescan(){
    if (!navigator.bluetooth){ render(); return; }
    spinner.style.visibility = "visible";
    try { await robot.choose(); }
    catch (e) { if (e.name !== "NotFoundError") toast(e.message, true); }
    finally { spinner.style.visibility = "hidden"; render(); }
  }
  async function render(){
    if (!navigator.bluetooth){
      list.replaceChildren(h("div", {class:"empty"},
        h("b", {}, "Web Bluetooth is not available in this browser."), h("br"),
        "On iPhone or iPad, open this page in the Bluefy browser. On Android or a computer, use Chrome or Edge."));
      return;
    }
    const devs = await robot.knownDevices();
    const rows = devs.map(d => {
      const busy = h("div", {class:"spinner", style:{display:"none"}});
      const btn = h("button", {class:"abtn", onclick: async () => {
        btn.style.display = "none"; busy.style.display = "";
        try { await robot.connect(d); } catch (e) { toast(e.message, true); }
        btn.style.display = ""; busy.style.display = "none";
      }}, "Connect");
      return h("div", {class:"robot-row"},
        h("div", {class:"robot-ids"}, h("div", {class:"robot-name"}, d.name || "Amicus"), h("div", {class:"robot-id"}, d.id)), btn, busy);
    });
    list.replaceChildren(...rows, h("div", {class:"empty"},
      rows.length ? "Or tap Rescan to look for another robot." : "Switch on the Amicus and tap Rescan to look for it."));
  }
  return {el, onShow: render};
}

const DESC = [
  "Step 1: Center the head\nUse the Sample button below to launch a test ball. Make sure the ball is landing approximately on the line of the table. If this is not the case correct it by rotating the head. Place a small piece of masking tape 40cm (16 in.) from the end of the table and along the centerline to mark the target area.",
  "Step 2: Correct spin\nIf the ball has back/top spin use the topspin correction controls to correct it. If the ball has side spin use the sidespin correction controls to correct it.",
  "Correct height/speed\nThe ball should be reaching the table 40cm from the edge. Adjust height/speed until it does so.",
  "Step 3: Symmetry calibration\nUse the buttons so the left and right balls are landing at approximately the same depth on the table.",
];
// stand-ins for calibration_center.png / calibration_speedtr.png
const IMG_TOP = `<svg viewBox="0 0 230 119" class="cal-img"><rect x="20" y="12" width="200" height="95" fill="#1f5fbf"/><rect x="20" y="12" width="200" height="95" fill="none" stroke="#fff" stroke-width="2"/><line x1="120" y1="12" x2="120" y2="107" stroke="#fff" stroke-width="2"/><line x1="20" y1="59.5" x2="220" y2="59.5" stroke="#fff"/><rect x="2" y="48" width="22" height="23" fill="#000"/><line x1="26" y1="59.5" x2="190" y2="59.5" stroke="#000" stroke-width="2" stroke-dasharray="5 4"/><path d="M190 54l9 5.5-9 5.5z"/><rect x="186" y="54" width="6" height="11" fill="#f5d76e"/></svg>`;
const IMG_SIDE = `<svg viewBox="0 0 230 90" class="cal-img"><rect x="20" y="70" width="200" height="5" fill="#1f5fbf"/><rect x="118" y="52" width="4" height="18" fill="#444"/><rect x="2" y="44" width="22" height="30" fill="#000"/><path d="M24 50 Q110 -10 190 70" fill="none" stroke="#000" stroke-width="2" stroke-dasharray="5 4"/><rect x="186" y="66" width="6" height="4" fill="#f5d76e"/></svg>`;

export function controlScreen(){
  const versions = h("div", {class:"rc-versions"}, "Waiting for informations…");
  const name = h("div", {class:"rc-value"}, robot.name);
  const btn = (t, f) => h("button", {class:"abtn", onclick:f}, t);
  const calibrateBtn = btn("Calibrate", () => calStart());
  const learnBtn = btn("Learn remote", () => learn());
  const unloadBtn = btn("Unload balls", () => toggleUnload());
  const discBtn = btn("Disconnect", () => robot.disconnect({forget:true}));
  const buttons = h("div", {class:"rc-buttons"},
    h("div", {class:"rc-line"}, h("span", {class:"rc-lbl"}, "Name"), name),
    versions,
    h("div", {class:"rc-grid"}, calibrateBtn, learnBtn, unloadBtn, discBtn),
    h("div", {class:"rc-note"}, "Firmware updates are only possible with the official app."));
  const calView = h("div", {class:"rc-cal", style:{display:"none"}});
  const el = h("div", {class:"screen"}, h("div", {class:"ed-scroll"}, buttons, calView));

  function showInfo(i = robot.info){
    if (!i) return;
    versions.textContent = `Hardware version: ${i.hw}\nFirmware version: ${i.fwMajor}.${i.fwMinor}\nSerial number: ${i.serial}\nBootloader version: ${i.bootloader}`;
  }

  // ---------- calibration ----------
  let cal = null;      // {height, top, side, speed}
  let calibrating = false;
  const s8 = b => b > 127 ? b - 256 : b;
  async function readCal(){
    const r = await robot.req(C.CAL_GET, [], {timeout:3000});
    if (r && r.length >= 5) cal = {height:s8(r[1]), top:s8(r[2]), side:s8(r[3]), speed:s8(r[4])};
    return !!cal;
  }
  function calStart(){
    calibrating = true; cal = null;
    buttons.style.display = "none"; calView.style.display = "";
    page1();
  }
  async function calEnd(save){
    await robot.req(C.CAL_END, [save ? 1 : 0]);
    calibrating = false;
    calView.style.display = "none"; buttons.style.display = "";
  }
  function page1(){
    const sample = h("button", {class:"abtn", onclick: async () => { sample.style.display = "none"; await readCal(); }}, "Sample");
    calView.replaceChildren(h("div", {class:"cal-desc"}, DESC[0]), h("div", {html:IMG_TOP}),
      h("div", {class:"btn-row"}, sample, h("button", {class:"abtn", onclick: async () => {
        if (!cal && !(await readCal())){ toast("No calibration data from the robot"); return; }
        page2();
      }}, "Continue calibration")));
  }
  function page2(){
    const lbl = {};
    const line = (title, key) => {
      lbl[key] = h("span", {class:"cal-val"}, String(cal[key]));
      return h("div", {class:"cal-line"}, h("span", {class:"cal-name"}, title),
        h("button", {class:"abtn large", onclick: () => change(key, -1)}, "—"), lbl[key],
        h("button", {class:"abtn large", onclick: () => change(key, 1)}, "+"));
    };
    async function change(key, d){
      const next = {...cal, [key]: Math.max(-128, Math.min(127, cal[key] + d))};
      const r = await robot.req(C.CAL_SET, [next.height & 255, next.top & 255, next.side & 255, next.speed & 255]);
      if (r && r.length >= 5) cal = {height:s8(r[1]), top:s8(r[2]), side:s8(r[3]), speed:s8(r[4])};
      else if (OK(r)) cal = next;
      for (const k in lbl) lbl[k].textContent = String(cal[k]);
    }
    calView.replaceChildren(h("div", {class:"cal-desc"}, DESC[1]),
      line("topspin correction:", "top"), line("sidespin correction:", "side"),
      h("div", {class:"cal-desc"}, DESC[2]), h("div", {html:IMG_SIDE}),
      line("height:", "height"), line("speed:", "speed"),
      h("div", {class:"btn-row"},
        h("button", {class:"abtn", onclick: () => calEnd(false)}, "Cancel"),
        h("button", {class:"abtn", onclick: async () => {
          if (robot.fwMajor > 6 || (robot.fwMajor === 6 && robot.fwMinor > 17)) page3();
          else calEnd(true);
        }}, "Continue calibration")));
  }
  async function page3(){
    const seg = segmented(["-2", "-1", "0", "+1", "+2"], 2, i => robot.req(C.SYM_SET, [i]));
    calView.replaceChildren(h("div", {class:"cal-desc"}, DESC[3]), seg,
      h("div", {class:"btn-row"},
        h("button", {class:"abtn", onclick: () => calEnd(false)}, "Cancel"),
        h("button", {class:"abtn", onclick: () => calEnd(true)}, "Save calibration")));
    const r = await robot.req(C.SYM_GET);
    if (r && r.length >= 2){ const v = s8(r[1]); if (v >= -2 && v <= 2) seg.set(v + 2); }
  }

  // ---------- learn remote ----------
  let learning = false;
  async function learn(){
    if (learning) return;
    learning = true; enable(learnBtn, false);
    await robot.req(C.REMOTE_MODE, [1]);
    await robot.req(C.LEARN, [], {replies:[C.LEARN_DONE], timeout:120000});
    learnBtn.textContent = "Learn remote"; enable(learnBtn, true); learning = false;
    await robot.req(C.REMOTE_MODE, [0]);
  }

  // ---------- unload ----------
  let unloading = false;
  async function toggleUnload(){
    if (!unloading){
      if (await engine.unload()){ unloading = true; unloadBtn.textContent = "Stop unload"; }
      else toast("Failed to start");
    } else {
      await robot.req(C.STOP); unloading = false; unloadBtn.textContent = "Unload balls";
    }
  }

  const offs = [
    robot.on("info", showInfo),
    robot.on("frame", ({cmd, p}) => {
      if (cmd === C.LEARN_SECS && learning) learnBtn.textContent = `Learning (${p[0]} secs.)`;
      else if (cmd === C.LEARN_STORED) toast(`Stored button ${p[0]}`);
    }),
  ];
  showInfo();
  return {
    el,
    onShow(){ name.textContent = robot.name; showInfo(); },
    destroy(){
      offs.forEach(f => f());
      if (calibrating && robot.connected) robot.req(C.CAL_END, [0]);
      if (unloading && robot.connected) robot.req(C.STOP);
    },
  };
}

// switch the Robot tab between scan list and control screen
export function bindRobotTab(){
  robot.on("connected", () => nav.replaceRoot(1, controlScreen()));
  robot.on("disconnected", () => nav.replaceRoot(1, scanScreen()));
}
