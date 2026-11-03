// Custom views of the original app, redrawn on <canvas>:
// TablePreviewView, BallTrajectoryView, SpinView and SliderWithNumbers.
import { flight, HEAD, NET_H, clamp } from "./model.js";
import { h } from "./ui.js";

export const COL = {
  primary:"#3f51b5", accent:"#6a6c6e", table:"#00008b", tableEdge:"#cccccc", line:"#ffffff",
  selected:"#ffaf00", serve:"#ffc0cb", red:"#cc0000", green:"#669900",
};

function prep(canvas){
  const dpr = devicePixelRatio || 1;
  const w = canvas.clientWidth, hgt = canvas.clientHeight;
  if (canvas.width !== Math.round(w*dpr) || canvas.height !== Math.round(hgt*dpr)){
    canvas.width = Math.round(w*dpr); canvas.height = Math.round(hgt*dpr);
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, hgt);
  return [ctx, w, hgt];
}

// ---------- TablePreviewView: top view, robot on the left, player on the right ----------
export function drawTable(canvas, balls, {selected = -1, playing = -1, cycle = 0} = {}){
  const [ctx, w, hh] = prep(canvas);
  if (!w || !hh) return;
  const f = Math.min(w/50, 1.5);
  const R = clamp(hh/30, 2, 5);
  // zoom out when a ball lands off the table, so its dot stays visible (the original clips it)
  let hl = 1.37, hw = 0.7625, out = false;
  for (const b of balls || []) if (b){
    const l = flight(b).land;
    if (Math.abs(l[2]) > hl || Math.abs(l[0]) > hw){ out = true; hl = Math.max(hl, Math.abs(l[2])); hw = Math.max(hw, Math.abs(l[0])); }
  }
  const pad = out ? Math.max(R, 5)*1.2 + 2 : 0;
  const k = Math.min((w - 2*pad)/(2*hl), (hh - 2*pad)/(2*hw));
  const tw = 2.74*k, th = 1.525*k, x0 = (w - tw)/2, y0 = (hh - th)/2;
  const px = p => [p[2]*k + w/2, p[0]*k + hh/2];
  ctx.globalAlpha = balls && balls.length ? 1 : 0.25;
  ctx.fillStyle = COL.table; ctx.fillRect(x0, y0, tw, th);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = COL.tableEdge; ctx.lineWidth = 1.5*f; ctx.strokeRect(x0, y0, tw, th);
  ctx.strokeStyle = COL.line;
  ctx.beginPath(); ctx.moveTo(w/2, y0); ctx.lineTo(w/2, y0 + th); ctx.stroke();          // net
  ctx.lineWidth = 0.75*f;
  ctx.beginPath(); ctx.moveTo(x0 + tw*0.03, hh/2); ctx.lineTo(x0 + tw*0.97, hh/2); ctx.stroke();   // centre line
  if (!balls) return;
  const o = px(HEAD);
  const pts = balls.map(b => b ? px(flight(b).land) : null);
  ctx.lineWidth = f; ctx.strokeStyle = COL.line;
  for (const p of pts) if (p){ ctx.beginPath(); ctx.moveTo(o[0], o[1]); ctx.lineTo(p[0], p[1]); ctx.stroke(); }
  const dot = (p, r, fill) => {
    ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI*2);
    ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = COL.line; ctx.stroke();
  };
  pts.forEach((p, i) => { if (p && i !== selected && i !== playing) dot(p, R, COL.table); });
  if (pts[selected]) dot(pts[selected], R*1.2, COL.selected);
  if (pts[playing]) dot(pts[playing], Math.max(R, 5)*1.2, COL.selected);
  if (cycle > 0) drawLoop(ctx, x0 + 2, y0 + th*3/4, th/4, cycle > 1 ? "#ffff00" : "#ffffff");
}
function drawLoop(ctx, x, y, s, color){
  ctx.save(); ctx.translate(x, y); ctx.scale(s/24, s/24); ctx.fillStyle = color;
  ctx.fill(new Path2D("M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"));
  ctx.restore();
}

// ---------- BallTrajectoryView: side view ----------
export function drawTrajectory(canvas, balls, {selected = -1, playing = -1} = {}){
  const [ctx, w, hh] = prep(canvas);
  if (!w) return;
  // scale so the highest path fits (the original clips high balls)
  let top = 0.3, half = 1.37;
  for (const b of balls || []) if (b) for (const p of flight(b).path){ if (p[1] > top) top = p[1]; if (Math.abs(p[2]) + 0.08 > half) half = Math.abs(p[2]) + 0.08; }
  const s = Math.min(w/(2*half), (hh - 4)/top);
  const px = p => [p[2]*s + w/2, hh - p[1]*s];
  ctx.strokeStyle = COL.primary; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(w/2 - 1.37*s, hh - 0.5); ctx.lineTo(w/2 + 1.37*s, hh - 0.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w/2, hh); ctx.lineTo(w/2, hh - NET_H*s); ctx.stroke();
  const path = (b, color, lw) => {
    const pts = flight(b).path;
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.beginPath();
    pts.forEach((p, i) => { const [x, y] = px(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke();
  };
  (balls || []).forEach((b, i) => { if (b && i !== selected && i !== playing) path(b, "#000", 1.5); });
  for (const i of [selected, playing]) if (balls?.[i]) path(balls[i], COL.selected, 2.5);
}

// ---------- SpinView: the row of ball chips ----------
export class SpinView {
  constructor({editable = false, touchable = false, maxBalls = 10, onSelect, onAdd, onLongPress} = {}){
    Object.assign(this, {editable, touchable, maxBalls, onSelect, onAdd, onLongPress});
    this.balls = []; this.selected = -1; this.playing = -1;
    this.el = h("canvas", {class:"spinview"});
    this.geo = [];
    if (touchable) this.bindTouch();
  }
  set(balls, {selected = this.selected, playing = this.playing} = {}){
    this.balls = balls; this.selected = selected; this.playing = playing; this.draw();
  }
  layout(hh){
    const r = clamp(hh/5, 8, 36), w = clamp(r/6, 2, 4);
    const n = this.balls.length + (this.editable && this.balls.length < this.maxBalls ? 1 : 0);
    const pad = Math.max(1.21*r, r + 8) + 2;          // halo / arrowhead must stay inside
    const step = Math.max(0, (hh/2 - pad)/8);         // the original uses h/20 and clips at the edges
    const geo = [];
    for (let i = 0; i < n; i++){
      const b = this.balls[i];
      const d = b ? b.place - 8 : 0;
      const y = hh/2 - d*step;
      let x;
      if (i === 0) x = w + r;
      else {
        const m = clamp(Math.abs(y - geo[i-1].y) - r/1.5, 0, r);
        x = geo[i-1].x + 1.9*r + r/10 - 0.8*m*m/r;
      }
      geo.push({x, y});
    }
    return {r, w, geo, step, width: Math.ceil(w + n*2.2*r + r)};
  }
  draw(){
    const c = this.el;
    const hh = c.clientHeight || c.parentElement?.clientHeight || 60;
    const L = this.layout(hh);
    c.style.width = L.width + "px";
    const [ctx] = prep(c);
    this.geo = L.geo; this.r = L.r; const step = L.step;
    const {r, w} = L;
    const order = this.balls.map((_, i) => i).filter(i => i !== this.selected && i !== this.playing);
    if (this.selected >= 0) order.push(this.selected);
    if (this.playing >= 0 && this.playing !== this.selected) order.push(this.playing);
    for (const i of order){
      const b = this.balls[i], g = L.geo[i];
      if (!b || !g) continue;
      const hi = i === this.selected || i === this.playing;
      const rr = hi ? 1.1*r : r;
      if (b.range > 0){
        const ext = b.range*step;
        ctx.fillStyle = "#cccccc";
        roundRect(ctx, g.x - 6, g.y - ext - r, 12, 2*(ext + r), 4); ctx.fill();
      }
      if (hi){ ctx.fillStyle = COL.selected; disc(ctx, g.x, g.y, 1.1*rr); }
      else if (b.state === 2){ ctx.fillStyle = COL.serve; disc(ctx, g.x, g.y, r); }
      ring(ctx, g.x, g.y, rr, w, b.spin - 5);
      ctx.fillStyle = COL.primary;
      ctx.font = `${Math.round(1.3*r)}px Roboto, system-ui, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(String(b.speed + 1), g.x, g.y + 1);
    }
    if (this.editable && this.balls.length < this.maxBalls){
      const g = L.geo[this.balls.length];
      ctx.strokeStyle = COL.primary; ctx.lineWidth = w;
      ctx.beginPath(); ctx.arc(g.x, g.y, r, 0, Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(g.x - r/2, g.y); ctx.lineTo(g.x + r/2, g.y);
      ctx.moveTo(g.x, g.y - r/2); ctx.lineTo(g.x, g.y + r/2); ctx.stroke();
    }
  }
  hit(e){
    const rect = this.el.getBoundingClientRect(), x = e.clientX - rect.left, y = e.clientY - rect.top;
    for (let i = this.geo.length - 1; i >= 0; i--){
      const g = this.geo[i];
      if (Math.hypot(x - g.x, y - g.y) <= this.r + 3) return i;
    }
    return -1;
  }
  bindTouch(){
    let timer = 0, startI = -1, long = false, sx = 0;
    this.el.addEventListener("pointerdown", e => {
      startI = this.hit(e); long = false; sx = e.clientX;
      if (startI < 0) return;
      clearTimeout(timer);
      if (this.editable && startI < this.balls.length) timer = setTimeout(() => {
        long = true; navigator.vibrate?.(20);
        this.onLongPress?.(startI, this.el);
      }, 500);
    });
    this.el.addEventListener("pointermove", e => { if (Math.abs(e.clientX - sx) > 8) clearTimeout(timer); });
    const end = e => {
      clearTimeout(timer);
      if (long || startI < 0) return;
      if (Math.abs(e.clientX - sx) > 8) return;      // horizontal scroll, not a tap
      const i = this.hit(e);
      if (i !== startI) return;
      if (i === this.balls.length) this.onAdd?.();
      else this.onSelect?.(i);
      startI = -1;
    };
    this.el.addEventListener("pointerup", end);
    this.el.addEventListener("pointercancel", () => { clearTimeout(timer); startI = -1; });
  }
}
function disc(ctx, x, y, r){ ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill(); }
function roundRect(ctx, x, y, w, hh, r){
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + hh, r); ctx.arcTo(x + w, y + hh, x, y + hh, r);
  ctx.arcTo(x, y + hh, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
const RAD = Math.PI/180;
function ring(ctx, x, y, r, w, spin){
  ctx.lineWidth = w; ctx.lineCap = "butt";
  if (spin === 0){ ctx.strokeStyle = "#888888"; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.stroke(); return; }
  const top = spin > 0, sweep = Math.abs(spin)/6*270;
  ctx.strokeStyle = "#000";
  ctx.beginPath();
  if (top) ctx.arc(x, y, r, -45*RAD, 225*RAD);      // gap at the top
  else ctx.arc(x, y, r, 135*RAD, 405*RAD);          // gap at the bottom
  ctx.stroke();
  ctx.strokeStyle = top ? "#00ff00" : "#ff0000";
  ctx.beginPath();
  if (top) ctx.arc(x, y, r, -135*RAD, (-135 - sweep)*RAD, true);
  else ctx.arc(x, y, r, 135*RAD, (135 + sweep)*RAD, false);
  ctx.stroke();
  // arrowhead at the open end on the upper-left (top spin) or lower-left (back spin)
  const a = (top ? -135 : 135)*RAD, ex = x + r*Math.cos(a), ey = y + r*Math.sin(a);
  const dir = top ? [1, -1] : [1, 1];                 // up-right / down-right
  const n = Math.hypot(...dir), ux = dir[0]/n, uy = dir[1]/n;
  ctx.fillStyle = "#000"; ctx.beginPath();
  ctx.moveTo(ex + ux*8, ey + uy*8);
  ctx.lineTo(ex - uy*3.5, ey + ux*3.5);
  ctx.lineTo(ex + uy*3.5, ey - ux*3.5);
  ctx.closePath(); ctx.fill();
}

// ---------- SliderWithNumbers ----------
// value model like the original: progress 0..(max-min)/step, display = progress*step + min.
// Values are always clamped (the original does not clamp).
export class Slider {
  constructor({label, min, max, step = 1, value, ticks = false, vertical = false, leftRight = false,
               centerTick = false, centerTickValue = 0, range = 0, rangeEnabled = false, onChange, cls = ""}){
    Object.assign(this, {label, min, max, step, ticks, vertical, leftRight, centerTick, centerTickValue, onChange});
    this.n = Math.round((max - min)/step);
    this.progress = clamp(Math.round(((value ?? min) - min)/step), 0, this.n);
    this.range = range; this.rangeEnabled = rangeEnabled;
    this.lbl = h("div", {class:"sl-label"});
    this.track = h("canvas", {class:"sl-track"});
    const dec = this.repeatBtn(leftRight ? "<" : "—", -1), inc = this.repeatBtn(leftRight ? ">" : "+", 1);
    this.el = vertical
      ? h("div", {class:`slider vertical ${cls}`}, this.lbl, inc, this.track, dec)
      : h("div", {class:`slider ${ticks ? "ticks" : ""} ${cls}`}, dec, h("div", {class:"sl-mid"}, this.lbl, this.track), inc);
    this.bindTrack();
    this.render();
    new ResizeObserver(() => this.draw()).observe(this.track);
  }
  get value(){ return this.progress*this.step + this.min; }
  setValue(v, silent = true){ this.setProgress(Math.round((v - this.min)/this.step), silent); }
  setProgress(p, silent = true){
    p = clamp(Math.round(p), 0, this.n);
    if (this.rangeEnabled) p = clamp(p, this.range, this.n - this.range);
    const changed = p !== this.progress;
    this.progress = p; this.render();
    if (!silent && changed) this.fire();
  }
  setRange(r, enabled = r > 0){
    this.rangeEnabled = enabled; this.range = enabled ? clamp(r, 1, Math.floor(this.n/2)) : 0;
    if (enabled) this.progress = clamp(this.progress, this.range, this.n - this.range);
    this.render();
  }
  setBounds(min, max){                 // used by the cycle popups (time vs repeat)
    const v = this.value;
    this.min = min; this.max = max; this.n = Math.round((max - min)/this.step);
    this.setValue(v);
  }
  setLabel(l){ this.label = l; this.render(); }
  fire(){ this.onChange?.(this.progress, this.value, this.range); }
  render(){
    const v = this.value === this.centerTickValue && this.centerTick ? this.value : this.value;
    this.lbl.textContent = this.label.replace("%d", v) + (this.rangeEnabled && this.range > 0 ? ` ±${this.range}` : "");
    this.draw();
  }
  repeatBtn(text, d){
    const b = h("button", {class:"sl-btn"}, text);
    let t = 0, delay = 500, fired = false;
    const step = () => {
      fired = true;
      if (this.rangeEnabled){
        this.setProgress(this.progress + d, false);
      } else this.setProgress(this.progress + d, false);
      t = setTimeout(step, delay); delay = Math.max(50, delay*0.9);
    };
    b.addEventListener("pointerdown", e => { e.preventDefault(); fired = false; delay = 500; step(); });
    const stop = () => clearTimeout(t);
    b.addEventListener("pointerup", stop); b.addEventListener("pointerleave", stop); b.addEventListener("pointercancel", stop);
    b.addEventListener("click", e => e.preventDefault());
    return b;
  }
  geom(){
    const c = this.track, w = c.clientWidth, hh = c.clientHeight, th = 12;
    return this.vertical ? {len: hh - 2*th, pos: p => [w/2, hh - th - p/this.n*(hh - 2*th)], th}
                         : {len: w - 2*th, pos: p => [th + p/this.n*(w - 2*th), hh/2 + (this.centerTick ? 6 : 0)], th};
  }
  draw(){
    const c = this.track;
    if (!c.clientWidth) return;
    const [ctx, w, hh] = prep(c);
    const g = this.geom();
    const a = g.pos(0), b = g.pos(this.n);
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(106,108,110,0.2)"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
    if (this.ticks){
      ctx.fillStyle = "#000";
      for (let i = 0; i <= this.n; i++){ const p = g.pos(i); ctx.beginPath(); ctx.arc(p[0], p[1], 2, 0, Math.PI*2); ctx.fill(); }
    }
    ctx.strokeStyle = COL.accent; ctx.lineWidth = 4;
    if (this.rangeEnabled && this.range > 0){
      ctx.beginPath(); ctx.moveTo(...g.pos(this.progress - this.range)); ctx.lineTo(...g.pos(this.progress + this.range)); ctx.stroke();
    } else if (!this.ticks){
      ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...g.pos(this.progress)); ctx.stroke();
    }
    if (this.centerTick){
      const cp = Math.round((this.centerTickValue - this.min)/this.step), p = g.pos(cp);
      ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5; ctx.fillStyle = "#000";
      ctx.font = "13px Roboto, system-ui, sans-serif";
      if (this.vertical){
        ctx.beginPath(); ctx.moveTo(p[0] - 9, p[1]); ctx.lineTo(p[0] + 9, p[1]); ctx.stroke();
        ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(String(this.centerTickValue), p[0] - 12, p[1]);
      } else {
        ctx.beginPath(); ctx.moveTo(p[0], p[1] - 9); ctx.lineTo(p[0], p[1] + 9); ctx.stroke();
        ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(String(this.centerTickValue), p[0], 0);
      }
    }
    const thumb = p => {
      ctx.beginPath(); ctx.arc(p[0], p[1], g.th - 0.5, 0, Math.PI*2);
      ctx.fillStyle = "#fff"; ctx.fill(); ctx.strokeStyle = "rgba(0,0,0,0.53)"; ctx.lineWidth = 1; ctx.stroke();
    };
    if (this.rangeEnabled && this.range > 0){ thumb(g.pos(this.progress - this.range)); thumb(g.pos(this.progress + this.range)); }
    else thumb(g.pos(this.progress));
  }
  posToProgress(e){
    const r = this.track.getBoundingClientRect(), g = this.geom();
    const t = this.vertical ? 1 - (e.clientY - r.top - g.th)/g.len : (e.clientX - r.left - g.th)/g.len;
    return Math.round(clamp(t, 0, 1)*this.n);
  }
  bindTrack(){
    const c = this.track;
    let mode = null, sx = 0, sy = 0, startP = 0, grab = 0;
    c.addEventListener("pointerdown", e => {
      c.setPointerCapture(e.pointerId);
      sx = e.clientX; sy = e.clientY; startP = this.posToProgress(e); mode = "pending";
      const g = this.geom(), r = c.getBoundingClientRect();
      const near = p => { const q = g.pos(p); return Math.hypot(e.clientX - r.left - q[0], e.clientY - r.top - q[1]) <= 2*g.th; };
      if (this.rangeEnabled && this.range > 0){
        if (near(this.progress - this.range)) mode = "lo";
        else if (near(this.progress + this.range)) mode = "hi";
        else if (startP > this.progress - this.range && startP < this.progress + this.range){ mode = "span"; grab = startP - this.progress; }
      } else if (near(this.progress)) mode = "drag";
    });
    c.addEventListener("pointermove", e => {
      if (!mode) return;
      if (mode === "pending"){
        const along = this.vertical ? Math.abs(e.clientY - sy) : Math.abs(e.clientX - sx);
        const perp = this.vertical ? Math.abs(e.clientX - sx) : Math.abs(e.clientY - sy);
        if (along > 8 && along > perp) mode = this.rangeEnabled ? "span" : "drag";
        else if (perp > 8){ mode = null; return; }
        else return;
      }
      const p = this.posToProgress(e);
      if (mode === "drag") this.setProgress(p, false);
      else if (mode === "span") this.setProgress(p - grab, false);
      else if (mode === "lo" || mode === "hi"){
        const lo = mode === "lo" ? Math.min(p, this.progress + this.range - 2) : this.progress - this.range;
        const hi = mode === "hi" ? Math.max(p, this.progress - this.range + 2) : this.progress + this.range;
        const r = clamp(Math.round((hi - lo)/2), 1, Math.floor(this.n/2));
        const changed = r !== this.range || Math.round((lo + hi)/2) !== this.progress;
        this.range = r; this.progress = clamp(Math.round((lo + hi)/2), r, this.n - r);
        this.render();
        if (changed) this.fire();
      }
    });
    c.addEventListener("pointerup", e => {
      if (mode === "pending"){
        const p = this.posToProgress(e);
        this.setProgress(p, false);
      }
      mode = null;
    });
    c.addEventListener("pointercancel", () => mode = null);
  }
}
