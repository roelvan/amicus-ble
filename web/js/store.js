// Persistent storage (games_list.json + .bak, pass/unload ball, prefs) in localStorage.
import { parseGameset, gamesetJson, defaultGame, cloneGame, parseBall, PASS_BALL, UNLOAD_BALL } from "./model.js";
import factory from "./factory.js";

const KEY = "games_list.json";
const ls = {
  get(k){ try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v){ try { localStorage.setItem(k, v); return true; } catch { return false; } },
};

export const prefs = {
  get waitMode(){ return ls.get("WAIT_MODE") === "1"; },
  set waitMode(v){ ls.set("WAIT_MODE", v ? "1" : "0"); },
  get soundThreshold(){ const n = parseInt(ls.get("SOUND_THRESHOLD"), 10); return Number.isFinite(n) ? n : 6000; },
  set soundThreshold(v){ ls.set("SOUND_THRESHOLD", String(v)); },
  get soundFilter(){ return ls.get("SOUND_FILTER") === "1"; },
  set soundFilter(v){ ls.set("SOUND_FILTER", v ? "1" : "0"); },
};

export function loadBall(name, def){
  try { const o = JSON.parse(ls.get(name)); if (o) return parseBall(o); } catch {}
  return {...def};
}
export const passBall = () => loadBall("pass.json", PASS_BALL);
export const unloadBall = () => loadBall("unload.json", UNLOAD_BALL);
export const saveBall = (name, b) => ls.set(name, JSON.stringify(b));

class Store extends EventTarget {
  constructor(){
    super();
    this.games = this.read(KEY) || this.read(KEY + ".bak");
    if (!this.games){
      // first start: default game, then the factory exercises (migration of the original)
      this.games = [defaultGame(), ...parseGameset(factory)];
      this.save();
    }
  }
  read(k){
    try { const s = ls.get(k); return s ? parseGameset(JSON.parse(s)) : null; } catch { return null; }
  }
  save(){
    const old = ls.get(KEY);
    if (old) ls.set(KEY + ".bak", old);
    ls.set(KEY, JSON.stringify(gamesetJson(this.games)));
    this.dispatchEvent(new Event("change"));
  }
  index(uuid){ return this.games.findIndex(g => g.uuid === uuid); }
  get(uuid){ const g = this.games.find(g => g.uuid === uuid); return g ? cloneGame(g) : null; }
  put(game){                        // replace by uuid, or append
    const i = this.index(game.uuid), g = cloneGame(game);
    if (i >= 0) this.games[i] = g; else this.games.push(g);
    this.save();
  }
  remove(uuid){ const i = this.index(uuid); if (i >= 0){ this.games.splice(i, 1); this.save(); } }
  move(from, to){ const [g] = this.games.splice(from, 1); this.games.splice(to, 0, g); this.save(); }
  merge(games){                     // import: same uuid replaced in place, others appended
    for (const g of games){
      const i = this.index(g.uuid);
      if (i >= 0) this.games[i] = cloneGame(g); else this.games.push(cloneGame(g));
    }
    this.save();
  }
  factoryGames(){ return parseGameset(factory); }
}
export const store = new Store();
