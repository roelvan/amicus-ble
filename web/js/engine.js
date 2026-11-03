// Play logic (classes v0, w0, o, k1, h1 of the official app). All steps check the reply.
import { robot, C, OK, ST, log } from "./ble.js";
import { ballBytes, cycleMode, UNLOAD_BALL } from "./model.js";

const fw = () => robot.fwMajor;

// cmd 34 balls/min -> cmd 37 random flags -> cmd 39 cycle
export async function pushSettings({bpm, random, randomEnabled, cycle}){
  if (!robot.connected) return false;
  const a = await robot.req(C.BPM, [bpm]);
  const b = await robot.req(C.RANDOM, [randomEnabled ? random : 0]);
  const c = cycle || {enabled:false, play:40, delay:20};
  const d = await robot.req(C.CYCLE, [cycleMode(c), c.play, c.delay]);
  return !!(a && b && d);
}

export function drillPayload(balls){
  const p = new Array(81).fill(0);
  balls.slice(0, 10).forEach((b, i) => {
    p[1 + i*8] = b.state;
    ballBytes(b, fw()).forEach((v, j) => p[2 + i*8 + j] = v);
  });
  return p;
}

// Returns true when the robot started (or is waiting for the serve in wait mode).
export async function playExercise(balls, settings, wait = false){
  if (!robot.connected) throw new Error("Amicus not connected");
  await pushSettings(settings);
  const r = await robot.req(C.LOAD, drillPayload(balls), {timeout:3000});
  let ok = OK(r);
  if (ok) ok = OK(await robot.req(C.START, [wait ? 2 : 0], {timeout:2000}));
  if (!ok){
    const s = await robot.req(C.STATE);
    if (s && s[0] === ST.PLAYING) await robot.req(C.STOP);
    return false;
  }
  await robot.req(C.REMOTE_MODE, [2]);
  return true;
}

export async function stopPlay({remote = 1} = {}){
  if (!robot.connected) return false;
  const r = await robot.req(C.STOP, [], {timeout:2000});
  if (remote !== null) await robot.req(C.REMOTE_MODE, [remote]);
  return OK(r);
}

// ---------- sample (single ball preview) ----------
export async function sampleStart(ball){
  if (!robot.connected) return false;
  const a = await robot.req(C.LOAD1, [0x01, 0x01, ...ballBytes(ball, fw())], {timeout:1000});
  const b = await robot.req(C.SEL, [0x01], {timeout:1000});
  const c = await robot.req(C.BPM, [20], {timeout:1000});
  const d = await robot.req(C.SAMPLE, [], {timeout:1000});
  return !!(a && b && c && OK(d));
}
export const sampleUpdate = ball => robot.req(C.LOAD1, [0x01, 0x01, ...ballBytes(ball, fw())], {timeout:1000});
export async function sampleStop(){
  if (!robot.connected) return false;
  robot.setState(ST.STOPPING);
  return OK(await robot.req(C.SAMPLE_STOP, [], {timeout:2000}));
}

// ---------- sequence (program upload to slots 101-110) ----------
// Tracks what is in the robot, so a changed sequence or a reconnect always uploads again.
let uploaded = null;
robot.on("connected", () => uploaded = null);
robot.on("disconnected", () => uploaded = null);
const seqKey = g => JSON.stringify(g.exercises);

export async function playSequence(game, settings, onProgress = () => {}){
  if (!robot.connected) throw new Error("Amicus not connected");
  await pushSettings(settings);
  const key = seqKey(game);
  if (uploaded !== key){
    uploaded = null;
    onProgress(true);
    try {
      for (let i = 0; i < 10; i++){
        const slot = 101 + i, ex = game.exercises[i];
        if (ex){
          const p = [slot];
          for (let j = 0; j < 10; j++){
            const b = ex.balls[j];
            p.push(...(b ? ballBytes(b, fw(), true) : [0,0,0,0,0,0,0,0]));
          }
          if (!OK(await robot.req(C.SLOT, p, {timeout:10000}))) throw new Error(`upload slot ${slot} failed`);
        } else {
          const r = await robot.req(C.SLOT_CLEAR, [slot], {timeout:2000});
          const st = r && (r.length >= 2 ? r[1] : r[0]);
          if (!(st === 0xF0 || st === 0x00)) throw new Error(`clear slot ${slot} failed`);
        }
      }
      const cyc = [0x01];
      for (let i = 0; i < 10; i++){
        const c = game.exercises[i]?.cycle;
        cyc.push(...(c ? [cycleMode({...c, sequenceMode:false}), c.play, c.delay] : [0, 0, 0]));
      }
      if (!OK(await robot.req(C.SLOT_CYCLE, cyc, {timeout:3000}))) throw new Error("slot cycles failed");
      uploaded = key;
    } catch (e) {
      log(e.message);
      onProgress(false);
      return false;
    }
    onProgress(false);
  }
  const g = settings.cycle;
  await robot.req(C.CYCLE, [cycleMode(g), g.play, g.delay]);
  const r = await robot.req(C.START_PROG, [0x01], {timeout:2000, replies:[C.START_PROG, C.STATE]});
  const ok = !!r && (r[0] === 0xF0 || r[0] === 0x00 || r[0] === ST.PLAYING);
  if (!ok){
    const s = await robot.req(C.STATE);
    if (s && s[0] === ST.PLAYING) await robot.req(C.STOP);
    return false;
  }
  await robot.req(C.REMOTE_MODE, [2]);
  return true;
}

// ---------- unload ----------
export async function unload(){
  let b = UNLOAD_BALL;
  try { b = JSON.parse(localStorage.getItem("unload.json")) || b; } catch {}
  // the original does not reset random/cycle first, so an old mode could stay active
  await robot.req(C.STOP);
  await pushSettings({bpm:100, random:0, randomEnabled:false, cycle:null});
  if (!OK(await robot.req(C.LOAD, drillPayload([{...b, state:1}]), {timeout:3000}))) return false;
  return OK(await robot.req(C.START, [0]));
}
