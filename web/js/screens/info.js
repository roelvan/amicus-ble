// Tab 2: Info (k0) and tab 3: Manual (p0).
import { h, dialog, toast } from "../ui.js";
import { robot, C, LOG } from "../ble.js";
import { store, prefs, passBall, unloadBall } from "../store.js";
import { ballEditorDialog, soundCalibrateDialog } from "../dialogs.js";

export const VERSION = "2.0 (web)";
const SUPPORT = "https://en.butterfly.tt/amicus";
const PASS_DESC = "This window lets you set where you want the pass ball to be delivered when the New Wait Mode switch is turned on and Pass Wait is activated for an exercise. It also lets you set the speed and trajectory parameters for the Pass Ball. A Pass Ball is a ball that is thrown out for the user to catch. It is then used to serve and start the next repetition of the exercise.";

export function infoScreen(){
  const btn = (t, f) => h("button", {class:"abtn block", onclick:f}, t);
  const wait = h("button", {class:"abtn block toggle", onclick: async () => {
    prefs.waitMode = !prefs.waitMode; text();
    if (robot.connected) await robot.req(C.WAIT_MODE, [prefs.waitMode ? 1 : 0]);
  }});
  const text = () => wait.textContent = `New wait mode: ${prefs.waitMode ? "ON" : "OFF"}`;
  text();
  const el = h("div", {class:"screen"}, h("div", {class:"ed-scroll info"},
    h("div", {class:"version"}, `Version: ${VERSION}`),
    btn("Support website", () => window.open(SUPPORT, "_blank", "noopener")),
    btn("Report an issue", () => downloadLog()),
    btn("Restore factory exercises", async () => {
      const games = store.factoryGames();
      const ok = await dialog({title:"Import games", message:`Are you sure to import ${games.length} games?`,
        buttons:[{label:"Cancel", value:false}, {label:"Import", value:true}]});
      if (ok){ store.merge(games); toast("Factory exercises restored"); }
    }),
    btn("Calibrate sound level", () => soundCalibrateDialog()),
    btn("Set Unload ball", () => ballEditorDialog("Unload ball", "unload.json", unloadBall())),
    btn("Set Pass ball", () => ballEditorDialog("Pass ball", "pass.json", passBall(), PASS_DESC)),
    wait));
  return {el};
}

// The original mails the log to Butterfly; this unofficial app saves it as a file instead.
function downloadLog(){
  const info = robot.info ? `Robot: hw ${robot.info.hw}, fw ${robot.info.fwMajor}.${robot.info.fwMinor}, serial ${robot.info.serial}\n` : "";
  const text = `Amicus web app ${VERSION}\n${navigator.userAgent}\n${info}\nLog:\n${LOG.join("\n")}\n`;
  const a = h("a", {href: URL.createObjectURL(new Blob([text], {type:"text/plain"})), download:"amicus-log.txt"});
  document.body.append(a); a.click(); a.remove();
}

export function manualScreen(){
  const el = h("div", {class:"screen"}, h("div", {class:"ed-scroll info"},
    h("p", {class:"manual-text"}, "The owner's manual of the Amicus is available on the Butterfly support website."),
    h("button", {class:"abtn block", onclick: () => window.open(SUPPORT, "_blank", "noopener")}, "Open the support website")));
  return {el};
}
