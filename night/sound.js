/* Sound for the island, off until the visitor turns it on. Every sound is made here with the
   Web Audio API (oscillators and a little noise), so there are no audio files to download.
   The island scripts announce moments with an "island-sound" event (hover, fly, plant, photo,
   star, reward); this file decides whether and how they sound. Underneath, a quiet ambient
   layer: waves and the waterfall, with birds by day and crickets at night. It fades out when
   the island is scrolled out of view. */
(() => {
  const wrap = document.querySelector(".town-wrap");
  if (!wrap) return;
  const KEY = "island-sound";
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;

  let on = false;
  try { on = localStorage.getItem(KEY) === "on"; } catch {}
  let ctx = null, master = null;

  // Browsers only allow sound after the visitor has clicked or tapped, so the context is made
  // (or woken) inside a gesture. With sound remembered as on, the first tap anywhere wakes it.
  function wake() {
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx.state !== "closed";
  }
  const ready = () => on && ctx && ctx.state === "running";

  // one note: a pitch (or a slide between two), a shape, a quick rise and a soft fall
  function note(freq, { at = 0, dur = 0.18, type = "sine", vol = 0.2, to = null, attack = 0.008 } = {}) {
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur * 0.8);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  // a bell: a sine with a quieter, higher partial that dies away first
  const bell = (freq, at, vol = 0.16, dur = 0.7) => {
    note(freq, { at, dur, vol });
    note(freq * 2.76, { at, dur: dur * 0.4, vol: vol * 0.25 });
  };
  // air rushing past: filtered noise with the filter sweeping up
  function whoosh() {
    const len = 0.7, t = ctx.currentTime;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * len), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = buf;
    f.type = "bandpass"; f.Q.value = 1.4;
    f.frequency.setValueAtTime(350, t);
    f.frequency.exponentialRampToValueAtTime(2600, t + len * 0.85);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32, t + len * 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(f).connect(g).connect(master);
    src.start(t);
  }

  const SOUNDS = {
    hover: () => note(620, { to: 900, dur: 0.09, vol: 0.07, type: "triangle" }),
    fly: () => whoosh(),
    plant: () => { note(420, { to: 980, dur: 0.12, vol: 0.14 }); note(1320, { at: 0.07, dur: 0.1, vol: 0.06 }); },
    photo: () => { note(523, { dur: 0.12, vol: 0.13, type: "triangle" }); note(784, { at: 0.09, dur: 0.18, vol: 0.13, type: "triangle" }); },
    star: () => [1047, 1319, 1568].forEach((f, i) => bell(f, i * 0.08, 0.12, 0.6)),
    reward: () => [523, 659, 784, 1047, 1319].forEach((f, i) => bell(f, i * 0.1, 0.14, i === 4 ? 1.4 : 0.5)),
    on: () => { bell(784, 0, 0.12, 0.4); bell(1175, 0.09, 0.1, 0.5); },
  };
  // a building hovered over again and again shouldn't chatter
  let lastHover = 0;
  document.addEventListener("island-sound", (e) => {
    if (!ready() || !SOUNDS[e.detail]) return;
    if (e.detail === "hover") { const now = performance.now(); if (now - lastHover < 90) return; lastHover = now; }
    try { SOUNDS[e.detail](); } catch {}
  });
  // planting already announces itself for the toasts
  document.addEventListener("tree-planted", () => document.dispatchEvent(new CustomEvent("island-sound", { detail: "plant" })));

  // ---- ambient: waves, the waterfall, and birds or crickets depending on the theme
  const amb = { bus: null, started: false, timer: 0 };
  let inView = true;
  const night = () => document.documentElement.dataset.theme === "dark";
  const audible = () => ready() && inView && !document.hidden;

  // brown noise: a soft, deep rumble that sounds like water when filtered
  function noiseBuffer(seconds) {
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    return buf;
  }
  function startAmbient() {
    if (amb.started) return;
    amb.started = true;
    amb.bus = ctx.createGain();
    amb.bus.gain.value = 0.0001;
    amb.bus.connect(master);
    const buf = noiseBuffer(6);
    // waves: low noise whose loudness swells in and out, with two slow cycles so it never repeats exactly
    const waves = ctx.createBufferSource(); waves.buffer = buf; waves.loop = true;
    const wLow = ctx.createBiquadFilter(); wLow.type = "lowpass"; wLow.frequency.value = 520;
    const wGain = ctx.createGain(); wGain.gain.value = 0.32;
    for (const [rate, depth] of [[0.11, 0.18], [0.047, 0.1]]) {
      const lfo = ctx.createOscillator(), amt = ctx.createGain();
      lfo.frequency.value = rate; amt.gain.value = depth;
      lfo.connect(amt).connect(wGain.gain); lfo.start();
    }
    waves.connect(wLow).connect(wGain).connect(amb.bus); waves.start();
    // the waterfall: a steady, brighter hiss, very low
    const fall = ctx.createBufferSource(); fall.buffer = buf; fall.loop = true; fall.playbackRate.value = 1.9;
    const fBand = ctx.createBiquadFilter(); fBand.type = "bandpass"; fBand.frequency.value = 1400; fBand.Q.value = 0.6;
    const fGain = ctx.createGain(); fGain.gain.value = 0.22;
    fall.connect(fBand).connect(fGain).connect(amb.bus); fall.start();
    creatures();
  }
  // a short sound on the ambient layer rather than the main one
  function soft(freq, at, dur, vol, to) {
    const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.01, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(amb.bus);
    o.start(t); o.stop(t + dur + 0.02);
  }
  const rand = (a, b) => a + Math.random() * (b - a);
  // a bird: two to four quick whistles that slide up or down
  function bird() {
    const base = rand(2400, 3800), n = 2 + Math.floor(Math.random() * 3);
    let at = 0;
    for (let i = 0; i < n; i++) {
      const d = rand(0.05, 0.11);
      soft(base * rand(0.9, 1.1), at, d, 0.05, base * rand(1.15, 1.4));
      at += d + rand(0.03, 0.08);
    }
  }
  // a cricket: a quick train of high pulses
  function cricket() {
    const f = rand(4300, 4800);
    for (let i = 0; i < 4; i++) soft(f, i * 0.045, 0.025, 0.022);
  }
  // birds now and then by day; crickets in a steadier rhythm at night
  function creatures() {
    clearTimeout(amb.timer);
    if (audible()) night() ? cricket() : bird();
    amb.timer = setTimeout(creatures, night() ? rand(700, 1500) : rand(2200, 6500));
  }
  // fade the whole layer in or out, never cut it
  function fadeAmbient() {
    if (!amb.started) return;
    amb.bus.gain.setTargetAtTime(audible() ? 0.32 : 0.0001, ctx.currentTime, audible() ? 0.8 : 0.35);
  }
  // only while the island is on screen
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([e]) => { inView = e.isIntersecting; fadeAmbient(); }, { threshold: 0.15 }).observe(wrap);
  }
  const begin = () => { if (ready()) { startAmbient(); fadeAmbient(); } };

  // the switch
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "sound-toggle";
  const draw = () => {
    btn.setAttribute("aria-pressed", String(on));
    btn.setAttribute("aria-label", on ? "Sound on. Turn island sound off" : "Sound off. Turn island sound on");
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>${on
      ? '<path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
      : '<path d="M16 9l5 6M21 9l-5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'}</svg><span>${on ? "Sound on" : "Sound off"}</span>`;
  };
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    on = !on;
    try { localStorage.setItem(KEY, on ? "on" : "off"); } catch {}
    draw();
    if (on && wake()) setTimeout(() => { if (ready()) { SOUNDS.on(); begin(); } }, 30);
    else fadeAmbient();
  });
  draw();
  wrap.appendChild(btn);

  // remembered as on: the first gesture on the page wakes the audio
  if (on) {
    const first = () => {
      wake(); setTimeout(begin, 30);
      removeEventListener("pointerdown", first, true); removeEventListener("keydown", first, true);
    };
    addEventListener("pointerdown", first, true);
    addEventListener("keydown", first, true);
  }
  // nothing keeps playing in a hidden tab
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else if (on) ctx.resume().then(fadeAmbient);
  });
})();
