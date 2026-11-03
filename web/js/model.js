// Data model, JSON (de)serialisation compatible with the official app's .amicusgame files,
// ball encoding and the landing physics of the official app (classes n, q0, e0, t0, l1).

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const int = (v, a, b, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? clamp(n, a, b) : d; };

export function uuid(){
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.random()*16|0; return (c === "x" ? r : (r & 3 | 8)).toString(16);
  });
}

// ---------- balls ----------
export const DEFAULT_BALL = Object.freeze({trajectory:92, spin:5, side_spin:6, speed:12, place:8, ball_per_min_percent:6, state:1, range:0});
export const PASS_BALL = Object.freeze({...DEFAULT_BALL, trajectory:141, spin:7, speed:8, place:4});
export const UNLOAD_BALL = Object.freeze({...DEFAULT_BALL, trajectory:153, spin:2, speed:0, place:8});
export const newBall = (b = {}) => ({...DEFAULT_BALL, ...b});
export const copyBall = b => ({...b});

export function parseBall(o = {}){
  return {
    trajectory: int(o.trajectory, 0, 153, 92),
    spin: int(o.spin, 0, 12, 5),
    side_spin: int(o.side_spin, 0, 12, 6),
    speed: int(o.speed, 0, 24, 12),
    place: int(o.place, 0, 16, 8),
    ball_per_min_percent: int(o.ball_per_min_percent, 0, 12, 6),
    state: [0, 1, 2].includes(o.state) ? o.state : 1,
    range: int(o.range ?? 0, 0, 8, 0),
  };
}
const ballJson = b => {
  const o = {trajectory:b.trajectory, spin:b.spin, side_spin:b.side_spin, speed:b.speed, place:b.place,
             ball_per_min_percent:b.ball_per_min_percent, state:b.state};
  if (b.range) o.range = b.range;
  return o;
};

// 7-byte ball (+ state as 8th byte when withState). Range goes into place bits 5-7, max 7, fw major > 5 only.
export function ballBytes(b, fwMajor = 5, withState = false){
  const place = b.place | (fwMajor > 5 && b.range > 0 ? Math.min(7, b.range) << 5 : 0);
  const a = [b.trajectory & 0xFF, b.trajectory >> 8, b.spin, b.side_spin, b.speed, place, b.ball_per_min_percent];
  if (withState) a.push(b.state);
  return a;
}
export const mirrorBall = b => { b.place = 16 - b.place; b.side_spin = 12 - b.side_spin; };

// ---------- cycle / random ----------
export const CYCLE_PLAY = {min:2, maxTime:120, maxRepeat:180};
export function parseCycle(c, {defEnabled = false} = {}){
  c = c || {};
  const ballMode = !!c.ballMode;
  let play = Number(c.play), delay = Number(c.delay);
  // factory files contain 0/0, which the original shows off-track; fall back to the defaults
  if (!(play >= CYCLE_PLAY.min)) play = 40;
  if (!(delay >= 0)) delay = 20;
  return {
    play: clamp(Math.round(play), CYCLE_PLAY.min, ballMode ? CYCLE_PLAY.maxRepeat : CYCLE_PLAY.maxTime),
    delay: clamp(Math.round(delay), 0, 60),
    enabled: c.enabled === undefined ? defEnabled : !!c.enabled,
    ballMode,
    sequenceMode: !!c.sequenceMode,
  };
}
export const defaultCycle = () => ({play:40, delay:20, enabled:false, ballMode:false, sequenceMode:false});
// cmd 39 / cmd 57 mode byte
export const cycleMode = c => !c.enabled ? 0 : c.sequenceMode ? 3 : c.ballMode ? 2 : 1;

export const RND = {TYPE:1, SCATTER:2, PLACE:4};
const RND_NAMES = [["type:RND", RND.TYPE], ["place:rnd", RND.SCATTER], ["place:RND", RND.PLACE]];
export const randomFromJson = a => Array.isArray(a) ? RND_NAMES.reduce((f, [n, bit]) => a.includes(n) ? f | bit : f, 0) : 0;
export const randomToJson = f => RND_NAMES.filter(([, bit]) => f & bit).map(([n]) => n);

// ---------- exercises / games ----------
export const newExercise = (balls = [newBall()]) => ({balls, cycle: defaultCycle()});

// Serve balls (state 2) are only allowed as a prefix of max 3 balls (q0.g).
export function normaliseServe(balls){
  balls.forEach((b, i) => {
    if (b.state === 2 && (i >= 3 || (i > 0 && balls[i-1].state !== 2))) b.state = 1;
  });
}

export function parseExercise(o = {}){
  const keys = Object.keys(o).filter(k => /^\d+$/.test(k)).sort((a, b) => a - b);
  const balls = keys.map(k => parseBall(o[k])).slice(0, 10);
  normaliseServe(balls);
  return {balls, cycle: parseCycle(o.cycle)};
}
function exerciseJson(ex){
  const o = {};
  ex.balls.forEach((b, i) => o[i] = ballJson(b));
  o.cycle = {play:ex.cycle.play, delay:ex.cycle.delay, enabled:ex.cycle.enabled, ballMode:ex.cycle.ballMode};
  return o;
}

export function newGame({sequence = false, name = "", description = ""} = {}){
  return {
    uuid: uuid(), name, description, sequence,
    exercises: sequence ? [] : [newExercise()],
    settings: {bpm:40, random:0, randomEnabled:false, cycle: defaultCycle()},
  };
}

export function parseGame(o = {}){
  const sequence = !!o.sequence;
  let exs = Array.isArray(o.exercises) ? o.exercises : (o.ballsData ? [o.ballsData] : []);
  exs = exs.slice(0, sequence ? 10 : 1).map(parseExercise).filter(e => e.balls.length);
  if (!sequence && !exs.length) exs = [newExercise()];
  const s = o.settings || {};
  const random = randomFromJson(s.random_mode);
  return {
    uuid: typeof o.uuid === "string" && o.uuid ? o.uuid : uuid(),   // the original crashes on a missing uuid
    name: String(o.name ?? ""), description: String(o.description ?? ""),
    sequence, exercises: exs,
    settings: {
      bpm: int(s.ball_per_min ?? 40, 5, 120, 40),
      random, randomEnabled: s.random_enabled ?? random !== 0,
      cycle: parseCycle(s.cycle),
    },
  };
}
export function gameJson(g){
  return {
    name: g.name, description: g.description, uuid: g.uuid, sequence: g.sequence,
    exercises: g.exercises.map(exerciseJson),
    settings: {
      ball_per_min: g.settings.bpm,
      random_mode: randomToJson(g.settings.random),
      random_enabled: g.settings.randomEnabled,
      cycle: {...g.settings.cycle},
    },
  };
}
export const cloneGame = g => JSON.parse(JSON.stringify(g));
export function parseGameset(o){
  if (!o || !Array.isArray(o.games)) throw new Error("not an Amicus game file");
  return o.games.map(parseGame);
}
export const gamesetJson = games => ({version:"1.0", games: games.map(gameJson)});

// Default game created by the original on first start (e0.java)
export const defaultGame = () => ({...newGame({name:"Default game", description:"default ball"}),
  uuid:"92D86A79-E6BA-49FD-923D-B9F490B0239A"});

// Live adjust range check (q0.e). param 0 = trajectory, 1 = spin, 3 = speed.
export function canAdjust(balls, param, d){
  const [key, max] = param === 0 ? ["trajectory", 153] : param === 1 ? ["spin", 12] : ["speed", 24];
  return balls.every(b => b[key] + d >= 0 && b[key] + d <= max);
}
export function applyAdjust(balls, param, d){
  const key = param === 0 ? "trajectory" : param === 1 ? "spin" : "speed";
  balls.forEach(b => b[key] += d);
}

// ---------- landing physics (t0.e + l1.e) ----------
// launch speed factor in % [spin 0-12][speed 0-24]
export const SPEED_FAC = [
  [100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,99,99,99,98],
  [100,100,100,100,100,100,100,100,100,100,100,100,100,102,100,100,103,104,106,109,109,107,110,113,113],
  [100,100,100,100,100,100,100,100,100,100,100,100,100,103,110,114,118,124,127,127,124,121,121,121,120],
  [100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,99,100,99,97,96,98,104],
  [100,100,100,100,100,100,100,100,100,100,100,100,102,100,103,102,103,103,103,103,101,100,100,102,104],
  [100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100],
  [100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,99,99,99,97,94,97,98,97],
  [100,100,100,100,100,100,100,100,100,100,100,100,100,100,98,96,93,93,93,93,91,90,90,91,90],
  [100,100,100,100,100,100,100,100,100,100,100,100,100,98,98,96,93,93,93,93,91,88,88,90,90],
  [100,100,100,100,100,100,100,100,100,100,100,100,98,98,96,96,93,93,93,93,91,88,87,89,89],
  [100,100,100,100,100,100,100,100,100,100,100,100,98,97,94,93,91,90,90,89,87,87,87,87,87],
  [100,100,100,100,100,100,100,100,100,100,101,98,95,93,89,87,85,84,83,83,81,79,78,79,78],
  [100,100,100,100,100,100,100,100,100,100,101,98,95,91,90,88,85,84,82,81,80,78,77,78,77]];
// correction added to the trajectory value [spin 0-12][speed 0-24]
export const ANGLE_CORR = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0,-8,-10,-13,-18,-22,-25,-28,-32,-32,-32,-32,-32],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,-12,-15,-21,-27,-32,-36,-39,-42,-44,-46,-48,-50],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,-15,-30,-38,-45,-52,-54,-55,-55,-55,-55,-55,-55],
  [0,0,0,0,0,0,0,0,0,0,0,0,-3,-6,-10,-15,-19,-22,-24,-27,-28,-28,-28,-30,-40],
  [0,0,0,0,0,0,0,0,0,0,0,0,-5,-10,-18,-22,-28,-30,-32,-32,-33,-34,-36,-38,-40],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,-5,-12,-17,-22,-25,-27,-28,-31,-35,-35,-35,-35],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,-5,-10,-14,-18,-20,-22,-24,-26,-26,-30,-30,-30],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,-3,-5,-7,-8,-9,-11,-13,-15,-17,-19,-20,-21],
  [0,0,0,0,0,0,0,0,0,0,0,0,3,1,-4,-7,-8,-9,-13,-14,-15,-15,-17,-17,-20],
  [0,0,0,0,0,0,0,0,0,0,0,3,6,1,-1,-5,-8,-10,-13,-14,-14,-14,-14,-14,-16],
  [0,0,0,0,0,0,0,0,0,0,0,3,6,3,2,0,-2,-3,-6,-7,-8,-10,-12,-12,-12],
  [0,0,0,0,0,0,0,0,0,0,5,10,15,15,15,15,14,12,11,10,10,10,9,8,8],
  [0,0,0,0,0,0,0,0,0,0,5,10,18,18,17,16,15,15,15,15,14,13,12,12,12]];

export const HEAD = [0, 0.2, -1.26];   // launch point in m: x across, y height above the table, z along (net = 0)
const DRAG = 3.383181128650849e-4 / 0.0027, G = 9.80665, DT = 0.01;
export const NET_H = 0.1525;

function launchSpeed(s){
  if (s >= 19) return ((s-18)*0.2 + 6.45) * 1.2;
  if (s >= 11) return ((s-10)*0.25 + 4.45) * 1.2;
  if (s === 10) return 5.34;
  if (s === 9) return 4.92;
  if (s === 8) return 4.5;
  return (3.75 - (8-s)*0.2) * 1.2;
}
function launchVelocity(b){
  const sp = clamp(b.spin, 0, 12), s = clamp(b.speed, 0, 24);
  const v = launchSpeed(s) * SPEED_FAC[sp][s] / 100;
  const el = Math.asin(((b.trajectory + ANGLE_CORR[sp][s]) - 90) * 0.05 / 14 + 0.25);
  const p = b.place - 8;
  let a = p;
  if (p){ const sg = Math.sign(p), ab = Math.abs(p); a += sg; if (ab > 1) a += 0.36*sg; if (ab > 2) a += 0.216*sg; }
  const az = -a * 2.2 * Math.PI / 180;
  return [Math.sin(az)*Math.cos(el)*v, Math.sin(el)*v, Math.cos(az)*Math.cos(el)*v];
}
// Exact key (the original caches on a lossy hash of the velocity).
const cache = new Map();
export function flight(b){
  const key = `${b.trajectory},${b.spin},${b.speed},${b.place}`;
  let r = cache.get(key);
  if (r) return r;
  const pos = [...HEAD], vel = launchVelocity(b), path = [[...pos]];
  for (let i = 0; pos[1] > 0 && i < 1000; i++){
    for (let k = 0; k < 3; k++) pos[k] += vel[k]*DT;
    const sp = Math.hypot(...vel), f = DRAG * sp * DT;
    for (let k = 0; k < 3; k++) vel[k] -= vel[k]*f;
    vel[1] -= G*DT;
    path.push([...pos]);
  }
  r = {land: pos, path};
  if (cache.size > 5000) cache.clear();
  cache.set(key, r);
  return r;
}
