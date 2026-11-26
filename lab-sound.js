// The apparatus drives these sounds. Browsers unlock the mixer on the first gesture.
const profiles = {
  motor: {hz: 55, motor: 0.12, air: 0.026, cutoff: 320},
  burner: {hz: 72, motor: 0.0, air: 0.16, cutoff: 1250},
  boil: {hz: 84, motor: 0.01, air: 0.19, cutoff: 1800},
  stir: {hz: 75, motor: 0, air: 0.085, cutoff: 1050},
  water: {hz: 90, motor: 0, air: 0.11, cutoff: 2400},
};
export function createLabSound() {
  let ctx, master, motor, hum, air, filter, noiseBuffer;
  let enabled = true, lastKey = "", lastEvent = null, nextDetail = 0, prevLevel = -1;
  try { enabled = localStorage.getItem("ma3mal.sound") !== "off"; } catch {}
  function gain(value, dest) {
    const node = ctx.createGain();
    node.gain.value = value;
    node.connect(dest);
    return node;
  }
  function unlock() {
    if (!enabled || document.hidden) return;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    if (!ctx) {
      ctx = new Audio();
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -16;
      limiter.connect(ctx.destination);
      master = gain(0.68, limiter);
      hum = gain(0, master);
      motor = ctx.createOscillator();
      motor.type = "triangle"; motor.frequency.value = 55; motor.connect(hum); motor.start();
      air = gain(0, master);
      filter = ctx.createBiquadFilter(); filter.type = "bandpass"; filter.Q.value = 0.65;
      filter.connect(air);
      noiseBuffer = ctx.createBuffer(1, 2 * ctx.sampleRate, ctx.sampleRate);
      const values = noiseBuffer.getChannelData(0);
      for (let i = 0; i < values.length; i++) values[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer; noise.loop = true; noise.connect(filter); noise.start();
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
  }
  function transient(from, to, duration, level, noise = false) {
    if (!enabled || !ctx || ctx.state !== "running" || document.hidden) return;
    const t = ctx.currentTime, out = gain(0.0001, master);
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(level, t + 0.008);
    out.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    let voice, band;
    if (noise) {
      voice = ctx.createBufferSource(); voice.buffer = noiseBuffer;
      band = ctx.createBiquadFilter(); band.type = "bandpass"; band.Q.value = 1;
      band.frequency.setValueAtTime(from, t);
      band.frequency.exponentialRampToValueAtTime(to, t + duration);
      voice.connect(band); band.connect(out);
    } else {
      voice = ctx.createOscillator();
      voice.frequency.setValueAtTime(from, t);
      voice.frequency.exponentialRampToValueAtTime(to, t + duration); voice.connect(out);
    }
    voice.onended = () => { voice.disconnect(); band?.disconnect(); out.disconnect(); };
    voice.start(t); voice.stop(t + duration + 0.01);
  }
  function silence() {
    if (ctx) {
      hum.gain.setTargetAtTime(0, ctx.currentTime, 0.025);
      air.gain.setTargetAtTime(0, ctx.currentTime, 0.025);
    }
    lastKey = ""; lastEvent = null; prevLevel = -1; nextDetail = 0;
  }
  function update(ui) {
    if (!ctx || !enabled || document.hidden || ctx.state !== "running") return;
    const key = ui.emerging ? "" : ui.sound || "";
    const level = Math.round((ui.soundLevel || 0) * 12) / 12;
    const t = ctx.currentTime;
    if (key !== lastKey || level !== prevLevel) {
      const p = profiles[key];
      hum.gain.setTargetAtTime(p ? p.motor * (0.65 + level * 0.35) : 0, t, 0.08);
      air.gain.setTargetAtTime(p ? p.air * (0.62 + level * 0.38) : 0, t, 0.06);
      if (p) {
        motor.frequency.setTargetAtTime(p.hz + 7 * level, t, 0.12);
        filter.frequency.setTargetAtTime(p.cutoff * (0.8 + 0.35 * level), t, 0.09);
      }
      if (key !== lastKey) nextDetail = t;
      lastKey = key; prevLevel = level;
    }
    if (t >= nextDetail && (key === "stir" || key === "boil")) {
      if (key === "boil") transient(400 + Math.random()*130, 135, 0.065, 0.063);
      else transient(1160, 730, 0.09, 0.035);
      nextDetail = t + (key === "stir" ? 0.49 : 0.16 + Math.random()*0.15);
    }
    const event = ui.emerging ? null : ui.event || "";
    if (event && lastEvent !== null && lastEvent !== event) {
      if (event === "pack") transient(3200, 580, 0.21, 0.27, true);
      if (event === "drop") transient(1250, 490, 0.14, 0.12);
      if (event.startsWith("door-")) transient(170, 57, 0.16, 0.14);
    }
    lastEvent = event;
  }
  function toggle() {
    enabled = !enabled;
    try { localStorage.setItem("ma3mal.sound", enabled ? "on" : "off"); } catch {}
    if (enabled) { unlock(); if (master) master.gain.setTargetAtTime(0.68, ctx.currentTime, 0.015); }
    else { silence(); if (master) master.gain.setTargetAtTime(0, ctx.currentTime, 0.008); }
  }
  return { unlock, update, silence, toggle, get enabled() { return enabled; },
    page() { transient(1900, 520, 0.16, 0.07, true); },
    build() { transient(850, 420, 0.06, 0.025, true); } };
}
