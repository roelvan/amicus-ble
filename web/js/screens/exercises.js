// Tab 0: exercise list (ExercisesFragment + b0 rows).
import { h, icon, toolbar, dialog, confirmDelete, toast } from "../ui.js";
import { drawTable, SpinView } from "../widgets.js";
import { store } from "../store.js";
import { nav } from "../app.js";
import { parseGameset, gamesetJson, cloneGame } from "../model.js";
import { openGame } from "./open.js";
import { propertiesDialog } from "../dialogs.js";

export function exercisesScreen(){
  let edit = false, query = "", searching = false;
  const selected = new Set();
  const list = h("div", {class:"ex-list"});
  const searchInput = h("input", {type:"search", class:"tb-search", placeholder:"Search",
    oninput: () => { query = searchInput.value; render(); }});
  const fileInput = h("input", {type:"file", accept:".amicusgame,.json,application/json,application/octet-stream", style:{display:"none"},
    onchange: () => importFile(fileInput.files[0])});
  const tb = toolbar({title:"Exercises"});
  const el = h("div", {class:"screen"}, tb, list, fileInput);

  function setActions(){
    if (edit) tb.setActions([{label:"Done", onClick: () => { edit = false; selected.clear(); setActions(); render(); }},
                            {label:"Share", onClick: share}]);
    else if (searching) tb.setActions([{node: searchInput}, {icon:"close", label:"Close search",
      onClick: () => { searching = false; query = ""; searchInput.value = ""; setActions(); render(); }}]);
    else tb.setActions([{icon:"search", label:"Search", onClick: () => { searching = true; setActions(); searchInput.focus(); }},
                        {label:"Edit", onClick: () => { edit = true; searching = false; query = ""; searchInput.value = ""; setActions(); render(); }},
                        {label:"New", onClick: () => openGame(null)},
                        {label:"Import", onClick: () => fileInput.click()}]);
    tb.querySelector(".tb-title").style.display = searching ? "none" : "";
  }

  function render(){
    const q = query.trim().toLowerCase();
    const games = store.games.filter(g => !q || g.name.toLowerCase().includes(q));
    list.replaceChildren(...games.map(rowFor));
    requestAnimationFrame(() => list.querySelectorAll("[data-draw]").forEach(c => c._draw?.()));
  }

  function rowFor(g){
    const fg = h("div", {class:"row-fg"});
    const row = h("div", {class:`ex-row${g.sequence ? " seq" : ""}`, "data-uuid": g.uuid},
      h("div", {class:"row-bg"}, icon("delete", {color:"#fff"})), fg);
    if (edit){
      const cb = h("input", {type:"checkbox", class:"chk", onclick: e => e.stopPropagation(),
        onchange: () => cb.checked ? selected.add(g.uuid) : selected.delete(g.uuid)});
      cb.checked = selected.has(g.uuid);
      fg.append(cb);
    }
    if (g.sequence){
      const tables = h("div", {class:"seq-tables"});
      for (let i = 0; i < 10; i++){
        const c = h("canvas", {class:"seq-mini", "data-draw":""});
        c._draw = () => drawTable(c, g.exercises[i]?.balls || null);
        tables.append(c);
      }
      fg.append(tables, h("div", {class:"ex-label"}, g.name));
    } else {
      const c = h("canvas", {class:"ex-table", "data-draw":""});
      const balls = g.exercises[0]?.balls || [];
      c._draw = () => drawTable(c, balls);
      const sv = new SpinView({maxBalls:10});
      const svWrap = h("div", {class:"ex-spin"}, sv.el);
      sv.el.setAttribute("data-draw", ""); sv.el._draw = () => sv.set(balls);
      fg.append(c, svWrap, h("div", {class:"ex-label"}, g.name));
    }
    if (edit){
      const handle = h("div", {class:"drag-handle"}, icon("drag", {color:"#777"}));
      fg.append(handle);
      bindDrag(row, handle);
      bindSwipe(row, fg, g);
    }
    fg.addEventListener("click", async () => {
      if (row._swiped) return;
      if (!edit){ openGame(g.uuid); return; }
      const copy = cloneGame(g);
      if (await propertiesDialog(copy, {title: copy.sequence ? "Set Sequence Properties" : "Set Exercise Properties"})){
        store.put(copy); render();
      }
    });
    return row;
  }

  // long-press-free reorder with the drag handle; saved immediately (the original forgot to save)
  function bindDrag(row, handle){
    handle.addEventListener("pointerdown", e => {
      e.preventDefault(); e.stopPropagation();
      handle.setPointerCapture(e.pointerId);
      row.classList.add("dragging");
      const move = ev => {
        const rows = [...list.children];
        const target = rows.find(r => { const b = r.getBoundingClientRect(); return ev.clientY >= b.top && ev.clientY < b.bottom; });
        if (target && target !== row){
          const b = target.getBoundingClientRect();
          list.insertBefore(row, ev.clientY < b.top + b.height/2 ? target : target.nextSibling);
        }
      };
      const up = () => {
        handle.removeEventListener("pointermove", move);
        row.classList.remove("dragging");
        const order = [...list.children].map(r => r.dataset.uuid);
        store.games.sort((a, b) => order.indexOf(a.uuid) - order.indexOf(b.uuid));
        store.save();
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up, {once:true});
      handle.addEventListener("pointercancel", up, {once:true});
    });
  }
  function bindSwipe(row, fg, g){
    let sx = 0, sy = 0, dx = 0, active = false;
    fg.addEventListener("pointerdown", e => { sx = e.clientX; sy = e.clientY; dx = 0; active = true; row._swiped = false; });
    fg.addEventListener("pointermove", e => {
      if (!active) return;
      dx = Math.min(0, e.clientX - sx);
      if (Math.abs(e.clientY - sy) > 20 && Math.abs(dx) < 20){ active = false; fg.style.transform = ""; return; }
      if (dx < -10){ row._swiped = true; fg.style.transform = `translateX(${dx}px)`; row.classList.add("swiping"); }
    });
    const end = async () => {
      if (!active) return;
      active = false;
      if (dx < -row.clientWidth*0.35){
        fg.style.transform = "translateX(-100%)";
        if (await confirmDelete()){ store.remove(g.uuid); selected.delete(g.uuid); render(); return; }
      }
      fg.style.transform = ""; row.classList.remove("swiping");
      setTimeout(() => row._swiped = false, 50);
    };
    fg.addEventListener("pointerup", end); fg.addEventListener("pointercancel", end);
  }

  async function share(){
    const games = store.games.filter(g => selected.has(g.uuid));
    if (!games.length){ toast("Select exercises to share"); return; }
    const text = JSON.stringify(gamesetJson(games));      // does not touch the stored games
    const name = `Amicus${Date.now()}.amicusgame`;
    const file = new File([text], name, {type:"application/json"});
    try {
      if (navigator.canShare?.({files:[file]})){ await navigator.share({files:[file], title:"Sharing Option"}); return; }
    } catch (e) { if (e.name === "AbortError") return; }
    const a = h("a", {href: URL.createObjectURL(file), download: name});
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  async function importFile(f){
    fileInput.value = "";
    if (!f) return;
    let games;
    try { games = parseGameset(JSON.parse(await f.text())); } catch { toast("Data Error, import failed!"); return; }
    if (!games.length) return;
    const ok = await dialog({title:"Import games", message:`Are you sure to import ${games.length} games?`,
      buttons:[{label:"Cancel", value:false}, {label:"Import", value:true}]});
    if (ok){ store.merge(games); render(); }
  }

  store.addEventListener("change", () => { if (nav.isVisible(screen)) render(); });
  const screen = {el, onShow(){ setActions(); render(); }};
  return screen;
}
