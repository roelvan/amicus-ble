import { nav } from "./app.js";
import { robot } from "./ble.js";
import { exercisesScreen } from "./screens/exercises.js";
import { scanScreen, bindRobotTab } from "./screens/robot.js";
import { infoScreen, manualScreen } from "./screens/info.js";
import { audioCtx } from "./sound.js";

nav.init([exercisesScreen, scanScreen, infoScreen, manualScreen]);
bindRobotTab();
robot.autoConnect();
// iOS only allows audio after a user gesture: unlock it on the first tap (wait-mode beep)
addEventListener("pointerdown", () => audioCtx(), {once:true});
// long press must open our own menus, not the browser's context menu
addEventListener("contextmenu", e => { if (!e.target.closest("input,textarea")) e.preventDefault(); });
