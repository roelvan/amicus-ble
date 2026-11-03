// Bluetooth layer for the Amicus robot (replaces classes s, q, b, c of the official app).
// Differences on purpose (bugs of the original): replies resolve FIFO per command so concurrent
// requests never get lost, timeouts are reported, no read-after-write, the receive buffer is reset
// for each connection, the MTU/CCCD handling is done by the browser.
import { ballBytes, PASS_BALL } from "./model.js";

export const SERVICE = "a7bdef44-a80c-11e7-abc4-cec278b6b50a";
export const CHAR = "a7bdf2aa-a80c-11e7-abc4-cec278b6b50a";
export const C = {
  INFO:0x01, RECAL:0x03, STATE:0x05, ERROR:0x07, SEL:0x11, LOAD1:0x12, LOAD:0x14, ADJ:0x15,
  CAL_GET:0x18, CAL_SET:0x19, CAL_END:0x1A, SYM_GET:0x1B, SYM_SET:0x1C, WAIT_MODE:0x1E, PASS:0x1F,
  START:0x20, STOP:0x21, BPM:0x22, SAMPLE:0x23, SAMPLE_STOP:0x24, RANDOM:0x25, CYCLE:0x27,
  START_PROG:0x29, GET_BPM:0x2B, BALL:0x2C, SLOT:0x31, SLOT_CLEAR:0x32, SLOT_CYCLE:0x39,
  PAUSED:0x3A, PLAYING:0x3B, LEARN:0x50, LEARN_SECS:0x51, LEARN_STORED:0x52, LEARN_DONE:0x53,
  REMOTE_BTN:0x54, REMOTE_MODE:0x55,
};
export const ST = {IDLE:2, PLAYING:3, STOPPING:4, ERROR:10, WAIT_SERVE:15, BOOTLOADER:64};
export const OK = p => !!p && (p[0] === 0xF0 || p[0] === 0x00);
const hex = a => [...a].map(b => b.toString(16).padStart(2, "0")).join(" ");
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Ring buffer log, attached to "Report an issue" like the original (1200 lines).
export const LOG = [];
export function log(msg){
  const t = new Date().toISOString().slice(11, 23);
  LOG.push(`${t} ${msg}`);
  if (LOG.length > 1200) LOG.shift();
}

const LS_DEV = "CONNECTED_ROBOT_ID";

export class Robot extends EventTarget {
  constructor(){
    super();
    this.dev = null; this.chr = null;
    this.state = 0; this.errorCode = 0;
    this.info = null; this.fwMajor = 5; this.fwMinor = 0;
    this.rx = []; this.waiters = new Map(); this.queue = Promise.resolve();
    this.lastRx = 0; this.timers = []; this.userDisconnect = false; this.connecting = false;
    this.onNotify = this.onNotify.bind(this);
    this.onGattDisconnected = this.onGattDisconnected.bind(this);
  }
  get connected(){ return !!this.chr; }
  get name(){ return this.dev?.name || "Amicus"; }
  emit(type, detail){ this.dispatchEvent(new CustomEvent(type, {detail})); }
  on(type, fn){ const f = e => fn(e.detail); this.addEventListener(type, f); return () => this.removeEventListener(type, f); }

  // ---------- connect ----------
  static get supported(){ return !!navigator.bluetooth; }

  async choose(){
    const dev = await navigator.bluetooth.requestDevice({filters:[{services:[SERVICE]}]});
    return this.connect(dev);
  }
  // Devices this site already has permission for (Chrome; not all browsers have it).
  async knownDevices(){
    try { return navigator.bluetooth?.getDevices ? await navigator.bluetooth.getDevices() : []; } catch { return []; }
  }
  async autoConnect(){
    const id = localStorage.getItem(LS_DEV);
    if (!id || this.connected || this.connecting) return;
    const dev = (await this.knownDevices()).find(d => d.id === id);
    if (dev) await this.connect(dev).catch(() => {});
  }

  async connect(dev){
    if (this.connecting) return;
    this.connecting = true; this.userDisconnect = false;
    this.emit("connecting", true);
    try {
      if (this.dev && this.dev !== dev) this.dev.removeEventListener("gattserverdisconnected", this.onGattDisconnected);
      this.dev = dev;
      dev.removeEventListener("gattserverdisconnected", this.onGattDisconnected);
      dev.addEventListener("gattserverdisconnected", this.onGattDisconnected);
      log(`connect ${dev.name || dev.id}`);
      const server = await dev.gatt.connect();
      const svc = await server.getPrimaryService(SERVICE);
      const chr = await svc.getCharacteristic(CHAR);
      chr.removeEventListener("characteristicvaluechanged", this.onNotify);
      chr.addEventListener("characteristicvaluechanged", this.onNotify);
      await chr.startNotifications();
      this.rx = [];
      await sleep(1000);                       // the original waits 1 s after enabling notifications
      this.chr = chr;
      this.lastRx = Date.now();
      localStorage.setItem(LS_DEV, dev.id);
      await this.handshake();
      this.startTimers();
      this.emit("connected");
    } catch (e) {
      log(`connect failed: ${e.message}`);
      this.chr = null;
      throw e;
    } finally {
      this.connecting = false;
      this.emit("connecting", false);
    }
  }

  async handshake(){
    const info = await this.req(C.INFO);
    if (info && info.length >= 7){
      this.info = {
        hw: `${info[1] >> 4}.${info[1] & 15}`, bootloader: info[2],
        fwMajor: info[3], fwMinor: info[4], serial: info[5] | (info[6] << 8),
      };
      this.fwMajor = info[3]; this.fwMinor = info[4];
      this.emit("info", this.info);
    }
    await this.req(C.STATE);
    if (this.fwAtLeast(6, 24)){
      await this.req(C.WAIT_MODE, [localStorage.getItem("WAIT_MODE") === "1" ? 1 : 0]);
      await this.sendPassBall();
    }
  }
  fwAtLeast(maj, min){ return this.fwMajor > maj || (this.fwMajor === maj && this.fwMinor >= min); }
  async sendPassBall(){
    let b = null; try { b = JSON.parse(localStorage.getItem("pass.json")); } catch {}
    b = b || PASS_BALL;
    await this.req(C.PASS, [0x01, b.state ?? 1, ...ballBytes(b, this.fwMajor)]);
  }

  startTimers(){
    this.stopTimers();
    // keepalive: the robot expects a state poll every 2 s
    this.timers.push(setInterval(() => {
      if (this.connected) this.req(C.STATE, [], {timeout:1500, quiet:true}).catch(() => {});
    }, 2000));
    // watchdog: no notification for 6 s = link is dead
    this.timers.push(setInterval(() => {
      if (this.connected && Date.now() - this.lastRx > 6000){
        log("watchdog: no data for 6 s, disconnecting");
        this.dev?.gatt?.disconnect();
      }
    }, 1000));
  }
  stopTimers(){ this.timers.forEach(clearInterval); this.timers = []; }

  async disconnect({forget = false} = {}){
    this.userDisconnect = true;
    if (forget) localStorage.removeItem(LS_DEV);
    if (this.dev?.gatt?.connected) this.dev.gatt.disconnect();
    else this.onGattDisconnected();
  }

  onGattDisconnected(){
    const was = this.connected;
    this.chr = null; this.rx = [];
    this.stopTimers();
    for (const list of this.waiters.values()) for (const w of list){ clearTimeout(w.timer); w.resolve(null); }
    this.waiters.clear();
    this.setState(0);
    if (was){ log("disconnected"); this.emit("disconnected", {user: this.userDisconnect}); }
    // automatic reconnect after an unexpected drop (the original rescans)
    if (was && !this.userDisconnect && this.dev) this.reconnect(this.dev);
  }
  async reconnect(dev){
    for (let i = 0; i < 5 && !this.connected && !this.userDisconnect && this.dev === dev; i++){
      await sleep(1000 + i*1500);
      if (this.connected || this.userDisconnect) return;
      try { await this.connect(dev); return; } catch {}
    }
  }

  // ---------- frames ----------
  onNotify(e){
    const v = e.target.value;
    this.lastRx = Date.now();
    for (let i = 0; i < v.byteLength; i++) this.rx.push(v.getUint8(i));
    while (this.rx.length >= 3){
      if (this.rx[0] !== 0x2A){ const i = this.rx.indexOf(0x2A); this.rx = i < 0 ? [] : this.rx.slice(i); continue; }
      const n = this.rx[1] | (this.rx[2] << 8);
      if (n < 4){ this.rx.shift(); continue; }
      if (this.rx.length < n) break;
      const cmd = this.rx[3], p = this.rx.slice(4, n);
      this.rx = this.rx.slice(n);
      this.handle(cmd, p);
    }
  }

  handle(cmd, p){
    if (cmd !== C.STATE && cmd !== C.BALL) log(`<- ${cmd.toString(16).padStart(2, "0")} ${hex(p)}`);
    if (cmd === C.STATE && p.length) this.setState(p[0]);
    else if (cmd === C.ERROR) this.setState(ST.ERROR, p[0] ?? 0);
    else if (cmd === C.BALL || cmd === C.PAUSED || cmd === C.PLAYING){
      if (this.state !== ST.PLAYING) this.setState(ST.PLAYING);
    }
    // one-shot reply: oldest waiter for this command
    const list = this.waiters.get(cmd);
    if (list?.length){
      const w = list.shift();
      for (const c of w.cmds) if (c !== cmd){ const l = this.waiters.get(c); const i = l?.indexOf(w); if (i >= 0) l.splice(i, 1); }
      clearTimeout(w.timer);
      w.resolve(p.length === 1 && p[0] === 0x07 && cmd !== C.STATE ? null : p);
    }
    this.emit("frame", {cmd, p});
  }

  setState(s, code = 0){
    if (s === this.state && code === this.errorCode) return;
    const old = this.state;
    this.state = s; this.errorCode = code;
    this.emit("state", {old, state: s, code});
  }

  write(cmd, payload = []){
    const n = 4 + payload.length;
    const data = new Uint8Array([0x2A, n & 0xFF, n >> 8, cmd, ...payload]);
    const job = this.queue.then(async () => {
      if (!this.chr) throw new Error("not connected");
      if (cmd !== C.STATE) log(`-> ${hex(data)}`);
      try {
        await (this.chr.writeValueWithResponse ? this.chr.writeValueWithResponse(data) : this.chr.writeValue(data));
      } catch (e) {
        await sleep(500);                      // the original retries a failed write after 500 ms
        if (!this.chr) throw e;
        await (this.chr.writeValueWithResponse ? this.chr.writeValueWithResponse(data) : this.chr.writeValue(data));
      }
    });
    this.queue = job.catch(() => {});
    return job;
  }

  // Send and wait for the reply. Resolves the payload, or null on timeout / protocol error.
  req(cmd, payload = [], {timeout = 2000, replies = [cmd], quiet = false} = {}){
    if (!this.chr) return Promise.resolve(null);
    return new Promise(resolve => {
      const w = {resolve, cmds: replies, timer: 0};
      w.timer = setTimeout(() => {
        for (const c of replies){ const l = this.waiters.get(c); const i = l?.indexOf(w); if (i >= 0) l.splice(i, 1); }
        if (!quiet) log(`timeout waiting for ${cmd.toString(16)}`);
        resolve(null);
      }, timeout);
      for (const c of replies){ if (!this.waiters.has(c)) this.waiters.set(c, []); this.waiters.get(c).push(w); }
      this.write(cmd, payload).catch(e => { clearTimeout(w.timer); log(`write failed: ${e.message}`); resolve(null); });
    });
  }
}

export const robot = new Robot();
