// Microphone serve detection for wait mode (u6/u0 + v6/* of the original), and the level meter
// of the "Calibrate sound level" dialog. Levels use the 16-bit sample scale (0...32767) like the original.
// Unlike the original, the trigger uses the saved noise-filter setting.

let ctx = null;
export function audioCtx(){
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
  } catch { ctx = null; }
  return ctx;
}

export function beep(ms = 150, freq = 1000){
  const c = audioCtx(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
  o.frequency.value = freq; g.gain.value = 0.4;
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + ms/1000);
}

async function openMic(){
  const c = audioCtx();
  if (!c) throw new Error("No audio support");
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("No microphone access in this browser");
  const stream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false, noiseSuppression:false, autoGainControl:false}});
  const src = c.createMediaStreamSource(stream);
  const an = c.createAnalyser();
  an.fftSize = 2048; an.smoothingTimeConstant = 0;
  src.connect(an);
  const td = new Float32Array(an.fftSize), fd = new Float32Array(an.frequencyBinCount);
  const close = () => { stream.getTracks().forEach(t => t.stop()); src.disconnect(); };
  return {c, an, td, fd, close};
}

function peak(m){
  m.an.getFloatTimeDomainData(m.td);
  let mx = 0;
  for (const v of m.td) if (v > mx) mx = v;     // max positive sample, like the original
  return Math.round(mx*32768);
}
function dominantHz(m){
  m.an.getFloatFrequencyData(m.fd);
  let bi = 0;
  for (let i = 1; i < m.fd.length; i++) if (m.fd[i] > m.fd[bi]) bi = i;
  return bi*m.c.sampleRate/m.an.fftSize;
}

// Resolves "serve" on detection, "timeout" after 30 s, "cancel" when stop() is called.
export function waitForServe({threshold, filter, timeout = 30000}){
  let stop = () => {};
  const done = new Promise(async resolve => {
    let m;
    try { m = await openMic(); } catch (e) { resolve("error:" + e.message); return; }
    const t0 = performance.now();
    const iv = setInterval(() => {
      const t = performance.now() - t0;
      if (t > timeout){ finish("timeout"); return; }
      if (t < 600) return;                          // ignore the first 600 ms
      const p = peak(m);
      if (p > threshold && (!filter || (() => { const f = dominantHz(m); return f >= 1000 && f < 2000; })())) finish("serve");
    }, 20);
    function finish(r){ clearInterval(iv); m.close(); resolve(r); }
    stop = () => finish("cancel");
  });
  return {done, stop: () => stop()};
}

// Level meter with decay: a lower value shows the average of old and new; 0 after 200 ms quiet.
export async function soundMeter(onLevel){
  const m = await openMic();
  let shown = 0, quietSince = performance.now();
  const iv = setInterval(() => {
    const p = peak(m);
    if (p > 50) quietSince = performance.now();
    shown = p >= shown ? p : Math.round((shown + p)/2);
    if (performance.now() - quietSince > 200) shown = 0;
    onLevel(shown);
  }, 30);
  return () => { clearInterval(iv); m.close(); };
}
