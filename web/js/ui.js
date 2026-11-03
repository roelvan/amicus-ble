// Small DOM helpers that mimic the Android widgets of the original (AlertDialog, PopupMenu,
// PopupWindow, Toast, SegmentedControl, Toolbar).

export function h(tag, attrs = {}, ...kids){
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})){
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "html") el.innerHTML = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
}
export const $ = (sel, root = document) => root.querySelector(sel);

// Material icons (Apache 2.0) and Material Design Icons (power plugs)
const P = {
  back: "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z",
  search: "M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z",
  close: "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
  loop: "M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z",
  shuffle: "M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z",
  mirror: "M15 21h2v-2h-2v2zm4-12h2V7h-2v2zM3 5v14c0 1.1.9 2 2 2h4v-2H5V5h4V3H5c-1.1 0-2 .9-2 2zm16-2v2h2c0-1.1-.9-2-2-2zm-8 20h2V1h-2v22zm8-6h2v-2h-2v2zM15 5h2V3h-2v2zm4 8h2v-2h-2v2zm0 8c1.1 0 2-.9 2-2h-2v2z",
  reset: "M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10 10-4.49 10-10S17.51 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3-8c0 1.66-1.34 3-3 3s-3-1.34-3-3 1.34-3 3-3 3 1.34 3 3z",
  drag: "M20 9H4v2h16V9zM4 15h16v-2H4v2z",
  delete: "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zm2.46-7.12l1.41-1.41L12 12.59l2.12-2.12 1.41 1.41L13.41 14l2.12 2.12-1.41 1.41L12 15.41l-2.12 2.12-1.41-1.41L10.59 14l-2.13-2.12zM15.5 4l-1-1h-5l-1 1H5v2h14V4z",
  info: "M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z",
  manual: "M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z",
  list: "M3 5h5v4H3zM3.8 5.8v2.4h3.4V5.8zM10 6h11v2H10zM3 10h5v4H3zm.8.8v2.4h3.4v-2.4zM10 11h11v2H10zM3 15h5v4H3zm.8.8v2.4h3.4v-2.4zM10 16h11v2H10z",
  plug: "M16,7V3H14V7H10V3H8V7H8C7,7 6,8 6,9V14.5L9.5,18V21H14.5V18L18,14.5V9C18,8 17,7 16,7Z",
  plugOff: "M8,3V6.18C11.1,9.23 14.1,12.3 17.2,15.3C17.4,15 17.8,14.8 18,14.4V8.8C18,7.68 16.7,7.16 16,6.84V3H14V7H10V3H8M3.28,4C2.85,4.42 2.43,4.85 2,5.27L6,9.27V14.5C7.17,15.65 8.33,16.83 9.5,18V21H14.5V18C14.72,17.73 14.95,17.5 15.17,17.25L18.73,20.82C19.15,20.39 19.58,19.97 20,19.54L3.28,4Z",
  more: "M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z",
  wait: "M2 20h20v1.5H2zM17.5 8.2a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8zM4 19.2C5.5 12 9 9.5 12 13.5l-1 .6C8.8 11.3 6.4 13 5.3 19.4zM12.6 13.2c1.2-3 2.6-3.6 3.6-3.2l-.3 1.2c-.6-.2-1.5.3-2.3 2.5z",
};
export function icon(name, {size = 24, color = "currentColor", strike = false, cls = ""} = {}){
  const s = `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" aria-hidden="true"><path d="${P[name]}"/>${strike ? '<path d="M3 3l18 18" stroke="#000" stroke-width="2"/>' : ""}</svg>`;
  const t = document.createElement("template"); t.innerHTML = s; return t.content.firstChild;
}

// ---------- toast ----------
let toastTimer = 0;
export function toast(msg, long = false){
  const el = $("#toast");
  el.textContent = msg; el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), long ? 3500 : 2000);
}

// ---------- AlertDialog ----------
// buttons: [{label, value}] in Android order (negative, neutral, positive: shown right-aligned)
export function dialog({title, message, body, buttons = [{label:"Ok", value:true}], cancelable = true, cls = ""}){
  let closeFn = () => {};
  const p = new Promise(resolve => {
    const scrim = h("div", {class:"scrim"});
    const close = v => { if (!scrim.isConnected) return; scrim.remove(); resolve(v); };
    closeFn = close;
    const box = h("div", {class:`dialog ${cls}`, role:"dialog"},
      title ? h("div", {class:"dlg-title"}, title) : null,
      message ? h("div", {class:"dlg-msg"}, message) : null,
      body || null,
      h("div", {class:"dlg-buttons"}, buttons.map(b => h("button", {class:"dlg-btn", onclick: async () => {
        if (b.validate && !(await b.validate())) return;
        close(b.value);
      }}, b.label))));
    scrim.append(box);
    if (cancelable) scrim.addEventListener("click", e => { if (e.target === scrim) close(undefined); });
    document.body.append(scrim);
    box.querySelector("input,textarea")?.focus();
  });
  p.close = v => closeFn(v);
  return p;
}
export const confirmDelete = () => dialog({title:"Delete", message:"Are you sure to delete this entry?",
  buttons:[{label:"Cancel", value:false}, {label:"Delete", value:true}]});

// ---------- PopupMenu ----------
// items: [{label, value, disabled, hidden}]
export function popupMenu(anchor, items){
  return new Promise(resolve => {
    const scrim = h("div", {class:"scrim clear"});
    const menu = h("div", {class:"popup-menu"});
    const close = v => { scrim.remove(); resolve(v); };
    for (const it of items){
      if (it.hidden) continue;
      menu.append(h("div", {class:`pm-item${it.disabled ? " disabled" : ""}`,
        onclick: it.disabled ? null : () => close(it.value)}, it.label || " "));
    }
    scrim.addEventListener("click", e => { if (e.target === scrim) close(undefined); });
    scrim.append(menu); document.body.append(scrim);
    place(menu, anchor);
  });
}
function place(el, anchor, {fullWidth = false, offsetY = 0} = {}){
  const r = anchor.getBoundingClientRect(), vw = innerWidth, vh = innerHeight;
  const w = fullWidth ? vw - 16 : Math.min(el.offsetWidth, vw - 16);
  if (fullWidth) el.style.width = w + "px";
  let x = fullWidth ? 8 : Math.min(Math.max(8, r.left), vw - w - 8);
  let y = r.top + offsetY;
  if (y + el.offsetHeight > vh - 8) y = Math.max(8, vh - el.offsetHeight - 8);
  el.style.left = x + "px"; el.style.top = y + "px";
}

// ---------- PopupWindow (cycle / random popups) ----------
export function popupWindow(anchor, content, {fullWidth = false} = {}){
  return new Promise(resolve => {
    const scrim = h("div", {class:"scrim clear"});
    const box = h("div", {class:"popup-window"}, content);
    scrim.addEventListener("click", e => { if (e.target === scrim){ scrim.remove(); resolve(); } });
    scrim.append(box); document.body.append(scrim);
    place(box, anchor, {fullWidth, offsetY: -60});
  });
}

// ---------- SegmentedControl ----------
export function segmented(options, selected, onChange, {width} = {}){
  const el = h("div", {class:"segmented", style: width ? {width} : null});
  const btns = options.map((o, i) => h("button", {class: i === selected ? "on" : "", onclick: () => set(i, true)}, o));
  function set(i, user){
    btns.forEach((b, j) => b.classList.toggle("on", i === j));
    el.value = i;
    if (user) onChange(i);
  }
  el.value = selected; el.set = i => set(i, false);
  el.append(...btns);
  return el;
}

// ---------- Toolbar ----------
// blue = editor toolbar (colorPrimary), else white list toolbar
export function toolbar({title, blue = false, onBack, actions = []}){
  const t = h("div", {class:`toolbar${blue ? " blue" : ""}`});
  if (onBack) t.append(h("button", {class:"tb-icon", onclick:onBack, "aria-label":"Back"}, icon("back")));
  const ttl = h("div", {class:"tb-title"}, title || "");
  t.append(ttl);
  const acts = h("div", {class:"tb-actions"});
  t.append(acts);
  t.setTitle = s => ttl.textContent = s;
  t.setActions = list => {
    acts.replaceChildren(...list.filter(Boolean).map(a => a.node || h("button", {
      class: a.icon ? "tb-icon" : "tb-text", onclick: a.onClick, "aria-label": a.label},
      a.icon ? icon(a.icon) : a.label)));
  };
  t.setActions(actions);
  return t;
}

// Android Button with compound drawable (icon start or top)
export function abtn(label, {iconName, top = false, onClick, cls = "", iconOpts} = {}){
  const b = h("button", {class:`abtn ${top ? "top" : ""} ${cls}`, onclick:onClick});
  if (iconName) b.append(icon(iconName, iconOpts));
  const t = h("span", {class:"abtn-text"}, label);
  b.append(t);
  b.setText = s => t.textContent = s;
  b.setIcon = (n, o) => { b.querySelector("svg")?.replaceWith(icon(n, o)); };
  return b;
}

export function enable(el, on){
  el.disabled = !on;
  el.classList.toggle("dim", !on);
}
