// App shell: bottom navigation with one screen stack per tab (MainActivity + u6/h).
import { h, icon, toast, dialog, $ } from "./ui.js";
import { robot, ST } from "./ble.js";

export const TABS = [
  {id:"exercises", label:"Exercises", icon:"list"},
  {id:"robot", label:"Robot", icon:"plugOff"},
  {id:"info", label:"Info", icon:"info"},
  {id:"manual", label:"Manual", icon:"manual"},
];

class Nav {
  constructor(){
    this.stacks = TABS.map(() => []);
    this.factories = [];
    this.current = 0;
    this.content = $("#content");
    this.bar = $("#nav");
    this.items = TABS.map((t, i) => {
      const b = h("button", {class:"nav-item", onclick: () => this.select(i)},
        h("span", {class:"nav-ic"}, icon(t.icon, {size:28})), h("span", {class:"nav-lbl"}, t.label));
      this.bar.append(b);
      return b;
    });
  }
  init(factories){
    this.factories = factories;
    factories.forEach((f, i) => this.stacks[i].push(f()));
    this.select(0, true);
  }
  top(tab = this.current){ const s = this.stacks[tab]; return s[s.length - 1]; }
  show(){
    const s = this.top();
    this.content.replaceChildren(s.el);
    s.onShow?.();
    this.items.forEach((b, i) => b.classList.toggle("on", i === this.current));
  }
  select(i, first = false){
    if (!first && i === this.current){ this.top().onReselect?.(); return; }
    if (!first) this.top().onHide?.();
    this.current = i;
    this.top(i).onTabSelected?.();
    this.show();
  }
  push(screen, tab = this.current){
    if (tab === this.current) this.top().onHide?.();
    this.stacks[tab].push(screen);
    if (tab === this.current) this.show();
  }
  pop(tab = this.current){
    const s = this.stacks[tab];
    if (s.length <= 1) return;
    const old = s.pop();
    if (tab === this.current) old.onHide?.();
    old.destroy?.();
    if (tab === this.current) this.show();
  }
  popTo(screen, tab){
    while (this.top(tab) !== screen && this.stacks[tab].length > 1) this.pop(tab);
  }
  replaceRoot(tab, screen){
    const s = this.stacks[tab];
    while (s.length > 1) this.pop(tab);
    if (tab === this.current) s[0].onHide?.();
    s[0].destroy?.();
    s[0] = screen;
    if (tab === this.current) this.show();
  }
  setRobotIcon(name){
    this.items[1].querySelector(".nav-ic").replaceChildren(icon(name, {size:28}));
  }
  isVisible(screen){ return this.top() === screen; }
}
export const nav = new Nav();

// ---------- global robot messages (MainActivity) ----------
let blink = 0;
robot.on("connecting", on => {
  clearInterval(blink);
  if (on){
    let a = false;
    blink = setInterval(() => nav.setRobotIcon((a = !a) ? "plug" : "plugOff"), 500);
  } else nav.setRobotIcon(robot.connected ? "plug" : "plugOff");
});
robot.on("connected", () => { nav.setRobotIcon("plug"); toast("Amicus connected"); });
robot.on("disconnected", () => { nav.setRobotIcon("plugOff"); toast("Amicus disconnected"); });
robot.on("state", ({state}) => {
  if (state === ST.ERROR) toast("Robot Error");
  if (state === ST.BOOTLOADER) dialog({title:"Robot Error",
    message:"Damaged Amicus firmware detected. Please try re-run the Update Firmware process on the Robot tab!\n\nFirmware updates are only possible with the official app."});
});
