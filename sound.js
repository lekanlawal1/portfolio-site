/* Sound for the island, off until the visitor turns it on. Every sound is made here with the
   Web Audio API (oscillators and a little noise), so there are no audio files to download.
   The island scripts announce moments with an "island-sound" event (hover, fly, plant, photo,
   star, reward); this file decides whether and how they sound. */
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
    if (on && wake()) setTimeout(() => ready() && SOUNDS.on(), 30);
  });
  draw();
  wrap.appendChild(btn);

  // remembered as on: the first gesture on the page wakes the audio
  if (on) {
    const first = () => { wake(); removeEventListener("pointerdown", first, true); removeEventListener("keydown", first, true); };
    addEventListener("pointerdown", first, true);
    addEventListener("keydown", first, true);
  }
  // nothing keeps playing in a hidden tab
  document.addEventListener("visibilitychange", () => { if (ctx && document.hidden) ctx.suspend(); else if (ctx && on) ctx.resume(); });
})();
