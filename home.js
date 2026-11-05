/* Home page: the particle story, the project map and the small things around them.
   Three.js is loaded here; GSAP, ScrollTrigger and Lenis come from classic scripts in the page.
   Everything degrades: no WebGL means the story's captions stack as plain text, and no GSAP means
   the map simply responds to clicks instead of scrolling. */
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const small = () => innerWidth <= 900;
const P = window.PROJECTS;
const pad = (i) => String(i + 1).padStart(2, "0");

// ------------------------------------------------------------------ smooth scrolling
const hasGsap = !!(window.gsap && window.ScrollTrigger);
let lenis = null;
if (hasGsap) {
  gsap.registerPlugin(ScrollTrigger);
  if (!reduce && window.Lenis) {
    lenis = new Lenis({ lerp: 0.1 });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
}
const scrollToY = (y, d = 1.1) => (lenis ? lenis.scrollTo(y, { duration: d }) : scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" }));
const land = (y) => { if (lenis) lenis.scrollTo(y, { immediate: true, force: true }); else scrollTo(0, y); };
// A short hop glides. Anything longer warps (warp.js): the page gathers into a ring with the
// destination's name, and opens again there, so nobody has to watch the whole page slide past.
const WARP = window.PFWarp;
const SECTION = { top: "Back to the start|Messy data in", work: "The work|Eight builds", about: "About|Lekan Lawal", contact: "Contact|Let's talk" };
function jumpTo(y, label) {
  if (Math.abs(y - scrollY) < innerHeight * 1.2 || !WARP || reduce) { scrollToY(y); return; }
  WARP.out(() => land(y), { label });
}
document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
  const id = a.getAttribute("href").slice(1), t = document.getElementById(id);
  if (!t) return;
  e.preventDefault();
  jumpTo(id === "top" ? 0 : t.getBoundingClientRect().top + scrollY, SECTION[id]);
  history.replaceState(null, "", id === "top" ? location.pathname : `#${id}`);
}));
let lastScroll = scrollY, dockAway = false, dockRest = 0, dockPast = false, dockPin = false;
addEventListener("scroll", () => {
  const past = scrollY > $("story").offsetHeight - innerHeight * 0.6;
  document.querySelector(".nav").classList.toggle("solid", past);
  // on desktop the pinned work section has its own step bar along the bottom: the dock steps aside there
  const pr = $("pin").getBoundingClientRect(), inPin = !small() && pr.top < innerHeight * 0.5 && pr.bottom > innerHeight * 0.5;
  const down = scrollY > lastScroll + 2, up = scrollY < lastScroll - 2; lastScroll = scrollY;
  if (down) dockAway = true; else if (up) dockAway = false;
  dockPast = past; dockPin = inPin;
  $("dock").classList.toggle("on", past && !inPin && !dockAway);
}, { passive: true });

// ------------------------------------------------------------------ the story
// The scroll position becomes p, 0 to 3: each whole number is a shape (messy, clean, count, check),
// and each shape holds for a while before the next change starts.
const SALES = [14237, 4520, 55691, 28014, 23648, 34595, 33946, 27909, 81777, 31453, 78629, 69546, 18174, 11951, 38726, 34195, 30132, 24797, 28765, 36898, 64596, 31405, 75973, 74920,
  18542, 22979, 51716, 38750, 56988, 40345, 39262, 31115, 73410, 59688, 79412, 96999, 43971, 20301, 58872, 36522, 44261, 52982, 45264, 63121, 87867, 77777, 118448, 83829];
const SEG = [0.45, 1, 0.6, 1, 0.6, 1, 0.75];
const TOT = SEG.reduce((a, b) => a + b, 0);
function toP(f) { let x = f * TOT, p = 0; for (let i = 0; i < SEG.length; i++) { const L = SEG[i]; if (i % 2) p += Math.min(1, Math.max(0, x / L)); if (x <= L) break; x -= L; } return p; }
const story = { p: 0, shown: 0 };
function storyProgress() {
  const el = $("story"), r = el.getBoundingClientRect(), span = el.offsetHeight - innerHeight;
  return Math.min(1, Math.max(0, -r.top / Math.max(1, span)));
}
const caps = [$("c0"), $("c1"), $("c2"), $("c3")];
const LABEL = ["messy", "clean", "count", "check"];
function captions(p) {
  caps.forEach((el, i) => {
    const o = Math.max(0, 1 - Math.abs(p - i) * 2.4);
    el.style.opacity = o.toFixed(3);
    el.style.transform = `translateY(${((1 - o) * 24).toFixed(1)}px)`;
    el.setAttribute("aria-hidden", o < 0.5 ? "true" : "false");
  });
  const k = Math.min(3, Math.round(p));
  $("prog").textContent = `[ 0${k + 1} / 04 ] ${LABEL[k]}`;
  $("hint").style.opacity = Math.max(0, 1 - p * 4);
}

let gl = null;    // { render(p, t) } once Three.js is up
async function startGL() {
  const THREE = await import("https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js");
  const canvas = $("gl");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const S = small(), COLS = 48, ROWS = S ? 30 : 50, N = COLS * ROWS;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const A = new Float32Array(N * 3), B = new Float32Array(N * 3), C = new Float32Array(N * 3), D = new Float32Array(N * 3), seed = new Float32Array(N);
  const W = S ? 3.9 : 9, H = S ? 6 : 5.2, max = Math.max(...SALES);
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    const i = c * ROWS + r, k = i * 3; seed[i] = Math.random();
    const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1), rad = Math.cbrt(Math.random()) * (Math.random() < 0.08 ? 5.5 : 3.2);
    A[k] = rad * Math.sin(ph) * Math.cos(th) * (S ? 0.9 : 1.5) + rnd(-0.3, 0.3); A[k + 1] = rad * Math.cos(ph) * 0.9; A[k + 2] = rad * Math.sin(ph) * Math.sin(th);
    B[k] = (c / (COLS - 1) - 0.5) * W; B[k + 1] = S ? (r / (ROWS - 1) - 0.5) * 3.8 + 0.7 : (r / (ROWS - 1) - 0.5) * H * 0.8; B[k + 2] = 0;
    C[k] = B[k]; C[k + 1] = S ? -1.0 + (r / (ROWS - 1)) * (SALES[c] / max * 4.0) : -H / 2 + (r / (ROWS - 1)) * (SALES[c] / max * H); C[k + 2] = 0;
    const t = (i / N) * Math.PI * 2, a = t * 7 + seed[i] * 0.4, R = (S ? 2.0 : 2.6) + Math.sin(i * 0.37) * 0.28 + rnd(-0.12, 0.12);
    D[k] = Math.cos(t) * R; D[k + 1] = Math.sin(t) * R; D[k + 2] = Math.sin(a) * 0.35;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(A), 3));
  for (const [n, a] of [["aA", A], ["aB", B], ["aC", C], ["aD", D]]) geo.setAttribute(n, new THREE.BufferAttribute(a, 3));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  // each point moves between the shapes a little early or late, so every change ripples
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uP: { value: 0 }, uT: { value: 0 }, uK: { value: 0 }, uM: { value: new THREE.Vector3(0, 0, 0) }, uSize: { value: (S ? 3.6 : 4.6) * Math.min(devicePixelRatio, 2) } },
    vertexShader: `attribute vec3 aA, aB, aC, aD; attribute float aSeed; uniform float uP, uT, uSize, uK; uniform vec3 uM; varying float vG;
      void main() {
        float d = aSeed * .35;
        float s1 = smoothstep(0., 1., clamp((uP - d) * 1.55, 0., 1.));
        float s2 = smoothstep(0., 1., clamp((uP - 1. - d) * 1.55, 0., 1.));
        float s3 = smoothstep(0., 1., clamp((uP - 2. - d) * 1.55, 0., 1.));
        vec3 p = mix(aA, aB, s1); p = mix(p, aC, s2); p = mix(p, aD, s3);
        p += vec3(sin(uT * .6 + aSeed * 40.), cos(uT * .5 + aSeed * 31.), sin(uT * .4 + aSeed * 17.)) * .08 * ((1. - s1) + s3 * .5);
        float ka = uK * (1.2 + aSeed * 2.); p.xy = mat2(cos(ka), -sin(ka), sin(ka), cos(ka)) * p.xy * (1. + uK * .45 * sin(aSeed * 31.));
        vec2 dm = p.xy - uM.xy; float rm = length(dm);
        p.xy += dm / max(rm, .001) * uM.z * smoothstep(1.5, 0., rm) * .75;
        vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
        vG = .55 + .45 * sin(uT * 1.4 + aSeed * 60.);
        gl_PointSize = uSize * (.7 + aSeed * .7) * (9. / -mv.z);
      }`,
    fragmentShader: `varying float vG; void main() { vec2 c = gl_PointCoord - .5; float d = length(c); if (d > .5) discard;
      float a = smoothstep(.5, 0., d); vec3 col = mix(vec3(1., .62, .22), vec3(1., .93, .78), a * a); gl_FragColor = vec4(col, min(1., a * vG * 1.35)); }` });
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  cam.position.set(0, 0, S ? 13 : 11);
  const group = new THREE.Group(); group.add(new THREE.Points(geo, mat)); scene.add(group);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
    vertexShader: `varying vec2 vU; void main() { vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `varying vec2 vU; void main() { float d = distance(vU, vec2(.5, .47)); gl_FragColor = vec4(1., .55, .15, smoothstep(.32, 0., d) * .16); }` }));
  glow.position.z = -4; scene.add(glow);
  const size = () => { renderer.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); };
  size(); addEventListener("resize", size);
  let mx = 0, my = 0;
  let push = 0, lastMove = 0;
  addEventListener("pointermove", (e) => { if (e.pointerType === "touch") return; mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; lastMove = performance.now(); });
  let burst = 0, touched = 0;
  const touchAt = (t) => { mx = t.clientX / innerWidth - 0.5; my = t.clientY / innerHeight - 0.5; lastMove = touched = performance.now(); };
  addEventListener("touchstart", (e) => { touchAt(e.touches[0]); burst = 1; }, { passive: true });
  addEventListener("touchmove", (e) => touchAt(e.touches[0]), { passive: true });
  const coarse = matchMedia("(pointer: coarse)").matches;
  const half = Math.tan((cam.fov / 2) * Math.PI / 180) * cam.position.z;
  let kick = 0;
  return {
    kick() { kick = 1; },
    render(p, t) {
      kick *= 0.955; mat.uniforms.uK.value = reduce ? 0 : kick * kick;
      mat.uniforms.uP.value = p; mat.uniforms.uT.value = reduce ? 0 : t;
      group.rotation.y = (p < 1 && !reduce ? (1 - p) * t * 0.12 : 0) + mx * 0.25 * (1 - Math.min(1, p) * 0.6);
      // where the pointer sits on the particles' plane, and how hard it pushes (fades when it stops)
      const now = performance.now();
      if (coarse && !reduce && now - touched > 2500) {   // nobody touching: let the push drift on its own
        mx = Math.sin(t * 0.41) * 0.28; my = Math.sin(t * 0.53 + 1) * 0.22; lastMove = now; }
      burst *= 0.94;
      const want = reduce ? 0 : (now - lastMove < 900 ? (coarse && now - touched > 2500 ? 0.6 : 1) : 0) + burst * 1.3;
      push += (want - push) * (want > push ? 0.25 : 0.06);
      mat.uniforms.uM.value.set(mx * 2 * half * cam.aspect - group.position.x, -my * 2 * half - group.position.y, push);
      group.rotation.x = my * 0.15; group.position.y = S ? 1.4 * Math.min(1, p) : 0; group.rotation.z = Math.max(0, p - 2) * 0.15;
      group.position.x = S ? 0 : 2.2 * Math.max(0, 1 - p) - 1.4 * Math.min(1, p) + 1.0 * Math.max(0, Math.min(1, p - 2));
      renderer.render(scene, cam);
    },
  };
}
startGL().then((g) => { gl = g; }).catch(() => document.documentElement.classList.add("no-gl"));

const t0 = performance.now();
function frame(now) {
  story.p = toP(storyProgress());
  story.shown += (story.p - story.shown) * (reduce ? 1 : 0.09);
  captions(story.shown);
  // only draw while the story is on screen
  const onScreen = $("story").getBoundingClientRect().bottom > 0;
  $("gl").style.visibility = onScreen ? "visible" : "hidden";
  if (gl && onScreen) gl.render(story.shown, (now - t0) / 1000);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ------------------------------------------------------------------ the work map
const map = $("map"), cv = $("lines"), ctx = cv.getContext("2d"), hud = $("hud");
const SKILLS = [...new Set(P.flatMap((p) => p.skills))];
const VISIT_ID = { fine: "fine-print", dock: "docket", econ: "economy", wh: "discrepancy", store: "superstore", triage: "triage", fifa: "football", sorted: "sorted" };
let seen = new Set();
try { seen = new Set(JSON.parse(localStorage.getItem("town-visited") || "[]").map((v) => VISIT_ID[v]).filter(Boolean)); } catch {}
let W = 0, H = 0, nodes = [], edges = [], cur = 0, hover = null;

function layout() {
  const r = map.getBoundingClientRect(), dpr = Math.min(devicePixelRatio, 2);
  W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  map.querySelectorAll(".node").forEach((n) => n.remove()); nodes = []; edges = [];
  const cx = W / 2, cy = H / 2, S = small();
  P.forEach((p, i) => {
    const a = -Math.PI / 2 + (i / P.length) * Math.PI * 2;
    nodes.push({ k: "p", i, id: p.id, label: p.name, x: cx + Math.cos(a) * W * (S ? 0.36 : 0.27), y: cy + Math.sin(a) * H * (S ? 0.36 : 0.28), ph: Math.random() * 6 });
  });
  if (!S) SKILLS.forEach((s, i) => {
    const a = -Math.PI / 2 + ((i + 0.5) / SKILLS.length) * Math.PI * 2;
    nodes.push({ k: "s", id: s, label: s, x: cx + Math.cos(a) * W * 0.41, y: cy + Math.sin(a) * H * 0.45, ph: Math.random() * 6 });
  });
  nodes.forEach((n) => {
    const b = document.createElement("button"); b.type = "button"; n.el = b;
    b.className = `node ${n.k}${n.k === "p" && seen.has(n.id) ? " seen" : ""}`;
    if (n.k === "p") { b.innerHTML = `<span class="dot"></span><b>${esc(n.label)}</b><small>${pad(n.i)}</small>`; b.setAttribute("aria-label", `${n.label}, project ${n.i + 1} of ${P.length}`); }
    else { b.textContent = n.label; b.setAttribute("aria-label", `${n.label}: show the projects that use it`); }
    // previews are for a mouse or the keyboard only: on a phone, Safari treats a tap that changes
    // the page on "hover" as a hover and never sends the click, so a tap goes straight to the project
    b.addEventListener("pointerenter", (e) => { if (e.pointerType !== "mouse") return; hover = n; paint(); });
    b.addEventListener("focus", () => { if (!b.matches(":focus-visible")) return; hover = n; paint(); });
    b.addEventListener("click", () => { if (n.k === "p") { hover = null; go(n.i, true); } else { hover = n; paint(); } });
    map.appendChild(b);
  });
  nodes.filter((n) => n.k === "p").forEach((p) => {
    edges.push({ a: null, b: p, hub: true, q: [Math.random(), Math.random()] });
    P[p.i].skills.forEach((s) => { const sn = nodes.find((n) => n.k === "s" && n.id === s); if (sn) edges.push({ a: p, b: sn, q: [Math.random(), Math.random(), Math.random()] }); });
  });
}
map.addEventListener("pointerleave", (e) => { if (e.pointerType !== "mouse") return; hover = null; paint(); });

const shown = () => hover || nodes.find((n) => n.k === "p" && n.i === cur);
function related(n) {
  if (!n) return null;
  const set = new Set([n]);
  edges.forEach((e) => { if (e.a === n) set.add(e.b); if (e.b === n && e.a) set.add(e.a); if (e.hub && e.b === n) set.add(e.b); });
  return set;
}
let lastShown = null;
function paint() {
  const n = shown(), rel = related(n);
  map.classList.toggle("focus", !!n);
  nodes.forEach((m) => { m.el.classList.toggle("lit", !!rel && rel.has(m)); if (m.k === "p") m.el.classList.toggle("cur", m.i === cur); });
  if (n === lastShown) return;
  lastShown = n;
  if (!n) return;
  if (n.k === "p") swapPanel(() => showProject(n.i), !!hover); else swapPanel(() => showSkill(n.id), true);
}
// Changing project: the old panel lifts away, the new one settles in line by line, its name
// resolving out of scrambled letters, while a packet of light travels the map between the two.
const GLYPH = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/#%";
function scramble(el, ms = 460) {
  if (!el || reduce) return;
  const text = el.textContent, t0 = performance.now();
  const tick = (now) => {
    const k = Math.min(1, (now - t0) / ms), n = Math.floor(k * text.length);
    el.textContent = text.slice(0, n) + text.slice(n).replace(/\S/g, () => GLYPH[(Math.random() * GLYPH.length) | 0]);
    if (k < 1) requestAnimationFrame(tick); else el.textContent = text;
  };
  requestAnimationFrame(tick);
}
let swapT = 0;
function swapPanel(render, quick) {
  clearTimeout(swapT);
  const enter = () => {
    hud.classList.remove("leaving"); render();
    [...hud.children].forEach((c, k) => c.style.setProperty("--i", k));
    hud.classList.remove("entering"); void hud.offsetWidth; hud.classList.add("entering");
    scramble(hud.querySelector("h3")); scramble(hud.querySelector(".proof b"), 380);
  };
  if (reduce || quick || !hud.children.length) { enter(); return; }
  hud.classList.add("leaving");
  swapT = setTimeout(enter, 190);
}
let packet = null;   // { a, b, t0 }: light travelling from one project to another
function send(from, to) {
  if (reduce || from === to) return;
  const a = nodes.find((n) => n.k === "p" && n.i === from), b = nodes.find((n) => n.k === "p" && n.i === to);
  if (a && b) packet = { a, b, t0: performance.now() };
}

// each panel plays a short silent clip of the live tool; people who ask for less motion or less data get a still
const still = reduce || !!(navigator.connection && navigator.connection.saveData);
function showProject(i) {
  const p = P[i];
  hud.innerHTML = `<div class="bar mono"><span>File ${pad(i)} // ${esc(p.name)}</span><span>${esc(p.kind)}</span></div>
    <h3>${esc(p.name)}</h3><p>${esc(p.line)}</p>
    <div class="proof"><b>${esc(p.proof[0])}</b><span>${esc(p.proof[1])}</span></div>
    <a class="shot reveal" href="${p.live[1]}" aria-label="Open ${esc(p.name)}">${still
      ? `<img src="${p.img}" alt=""${p.phone ? ' class="phone"' : ""}>`
      : `<video src="assets/previews/${p.id}.mp4" ${p.phone ? "" : `poster="${p.img}"`} autoplay muted loop playsinline preload="auto" aria-hidden="true"></video>`}<span class="mono">Live preview</span></a>
    <div class="stack">${p.skills.map((s) => `<span>${esc(s)}</span>`).join("")}</div>
    <div class="go"><a href="${p.live[1]}">${esc(p.live[0])} ↗</a>${p.study !== p.live[1] ? `<a class="o" href="${p.study}">Case study</a>` : ""}${p.download ? `<a class="o" href="${p.download}" download>Workbook</a>` : ""}${p.source ? `<a class="o" href="${p.source}">Source</a>` : ""}</div>
    <a class="tour-here mono" href="${p.tour || p.live[1]}" data-tour="${p.id}">Tour from here: ${pad(i)} of ${pad(P.length - 1)}, then the rest →</a>`;
}
function showSkill(s) {
  const ps = P.filter((p) => p.skills.includes(s));
  hud.innerHTML = `<div class="bar mono"><span>Skill // ${esc(s)}</span><span>${ps.length} project${ps.length > 1 ? "s" : ""}</span></div>
    <h3>${esc(s)}</h3><p>Used in ${ps.map((p) => esc(p.name)).join(", ")}.</p>
    <div class="stack">${ps.map((p) => `<span>${pad(P.indexOf(p))} ${esc(p.name)}</span>`).join("")}</div>
    <p class="mono" style="color:var(--mut);margin-top:14px">Click a project on the map to open it.</p>`;
}
function setCur(i) {
  i = (i + P.length) % P.length;
  if (i !== cur) {
    send(cur, i);
    const fwd = (i - cur + P.length) % P.length <= P.length / 2;
    hud.style.setProperty("--sx", small() ? (fwd ? "34px" : "-34px") : "0px");
  }
  cur = i;
  const nx = P[cur + 1];
  $("nexthint").textContent = pinST ? (nx ? `Next: ${nx.name} ↓` : "Then: about me ↓") : "";
  $("count").textContent = $("pcount").textContent = `${pad(cur)} / ${pad(P.length - 1)}`;
  $("fill").style.width = `${(cur / (P.length - 1)) * 100}%`;
  $("names").querySelectorAll("button").forEach((b, k) => b.classList.toggle("on", k === cur));
  paint();
}
const drawNames = () => { $("names").innerHTML = P.map((p, i) => `<button type="button" data-i="${i}">${esc(p.name.split(" ").slice(-1)[0])}</button>`).join(""); };
drawNames();
$("names").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) go(+b.dataset.i, true); });
$("prev").addEventListener("click", () => go(cur - 1));
addEventListener("keydown", (e) => {
  if (e.altKey || e.metaKey || e.ctrlKey || /input|textarea|select/i.test(e.target.tagName)) return;
  const r = $("pin").getBoundingClientRect();
  if (r.top > innerHeight * 0.3 || r.bottom < innerHeight * 0.7) return;
  if (e.key === "ArrowRight") { e.preventDefault(); go(cur + 1); }
  if (e.key === "ArrowLeft") { e.preventDefault(); go(cur - 1); }
});
$("next").addEventListener("click", () => go(cur + 1));
// phones: swipe the panel sideways for the next or previous project
let sx = 0, sy = 0;
hud.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
hud.addEventListener("touchend", (e) => {
  const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) go(cur + (dx < 0 ? 1 : -1));
}, { passive: true });

// Desktop: the section pins and scrolling steps through the projects. Elsewhere: buttons and taps.
let pinST = null;
function setupPin() {
  if (pinST) { pinST.kill(); pinST = null; }
  if (!hasGsap || small()) return;
  pinST = ScrollTrigger.create({ trigger: "#pin", pin: true, start: "top top", end: () => `+=${(P.length - 1) * innerHeight * 0.45}`,
    snap: reduce ? false : { snapTo: 1 / (P.length - 1), duration: { min: 0.35, max: 0.7 }, delay: 0.12, ease: "power2.inOut" },
    onUpdate: (s) => { if (gliding) return; const k = Math.round(s.progress * (P.length - 1)); if (k !== cur) { hover = null; setCur(k); } } });
}
let gliding = false, glideT = 0;
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function go(i, jump) {
  i = (i + P.length) % P.length;
  if (pinST) {
    // the page glides to that project's place while the panel goes straight from this one to that
    // one: no flicker through the projects in between
    const y = pinST.start + (i / (P.length - 1)) * (pinST.end - pinST.start);
    hover = null; setCur(i);
    if (!lenis) { scrollTo(0, y + 1); return; }
    gliding = true; clearTimeout(glideT);
    const d = Math.min(1.1, 0.55 + Math.abs(y - scrollY) / innerHeight * 0.18);
    lenis.scrollTo(y + 1, { duration: d, easing: easeIO, force: true, onComplete: () => { gliding = false; } });
    glideT = setTimeout(() => { gliding = false; }, d * 1000 + 300);
  } else {
    hover = null; setCur(i);
    // phones and tablets: keep the map and the top of the new panel in view together, so you see
    // the light travel and the panel arrive
    const m = map.getBoundingClientRect();
    if (m.top < 40 || m.top > innerHeight * 0.3) scrollToY(scrollY + m.top - 64, 0.8);
  }
}

// one soft glow, drawn once and stamped wherever a dot needs one (blurring every dot each frame is slow)
const GLOW = (() => {
  const g = document.createElement("canvas"); g.width = g.height = 64;
  const c = g.getContext("2d"), r = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,236,200,1)"); r.addColorStop(0.18, "rgba(255,200,120,.9)"); r.addColorStop(0.45, "rgba(255,181,71,.28)"); r.addColorStop(1, "rgba(255,181,71,0)");
  c.fillStyle = r; c.fillRect(0, 0, 64, 64); return g;
})();
const glow = (x, y, size, alpha) => { ctx.globalAlpha = alpha; ctx.drawImage(GLOW, x - size, y - size, size * 2, size * 2); ctx.globalAlpha = 1; };
function draw(t) {
  if (!W) { requestAnimationFrame(draw); return; }
  const r = map.getBoundingClientRect();
  if (r.bottom < 0 || r.top > innerHeight) { requestAnimationFrame(draw); return; }   // off screen: skip
  ctx.clearRect(0, 0, W, H);
  const n = shown(), rel = related(n);
  nodes.forEach((m) => {
    const dx = reduce ? 0 : Math.sin(t * 0.0006 + m.ph) * 3, dy = reduce ? 0 : Math.cos(t * 0.0005 + m.ph) * 3;
    m.dx = m.x + dx; m.dy = m.y + dy; m.el.style.left = `${m.dx}px`; m.el.style.top = `${m.dy}px`;
  });
  edges.forEach((e) => {
    const ax = e.hub ? W / 2 : e.a.dx, ay = e.hub ? H / 2 : e.a.dy, bx = e.b.dx, by = e.b.dy;
    const on = !!rel && (e.hub ? n === e.b : rel.has(e.a) && rel.has(e.b) && (n === e.a || n === e.b));
    const dim = !!n && !on;
    const mx = (ax + bx) / 2 + (ay - by) * 0.12, my = (ay + by) / 2 + (bx - ax) * 0.12;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(mx, my, bx, by);
    ctx.strokeStyle = on ? "rgba(255,181,71,.65)" : dim ? "rgba(242,238,231,.035)" : e.hub ? "rgba(255,181,71,.16)" : "rgba(242,238,231,.07)";
    ctx.lineWidth = on ? 1.4 : 1; ctx.setLineDash(e.hub ? [] : [2, 5]); ctx.stroke(); ctx.setLineDash([]);
    if (!dim) e.q.forEach((q) => {
      const s = reduce ? q : (q + t * (on ? 0.00028 : 0.00009)) % 1, u = 1 - s;
      glow(u * u * ax + 2 * u * s * mx + s * s * bx, u * u * ay + 2 * u * s * my + s * s * by, on ? 7 : 4, on ? 1 : 0.6);
    });
  });
  if (packet) {
    // a bright packet with a short tail: out of the old project, through the hub, into the new one
    const k = Math.min(1, (t - packet.t0) / 700), { a, b } = packet;
    const at = (q) => { const s = q < 0.5 ? q * 2 : (q - 0.5) * 2, [x0, y0, x1, y1] = q < 0.5 ? [a.dx, a.dy, W / 2, H / 2] : [W / 2, H / 2, b.dx, b.dy], u = 1 - s;
      const cx = (x0 + x1) / 2 + (y0 - y1) * 0.12, cy = (y0 + y1) / 2 + (x1 - x0) * 0.12;
      return [u * u * x0 + 2 * u * s * cx + s * s * x1, u * u * y0 + 2 * u * s * cy + s * s * y1]; };
    const e = easeIO(k);
    for (let j = 0; j < 14; j++) {
      const q = Math.max(0, e - j * 0.018), [x, y] = at(q);
      glow(x, y, (j ? 9 : 18) * (1 - j / 16), (1 - j / 14) * (1 - Math.max(0, k - 0.85) / 0.15));
    }
    if (k >= 1) packet = null;
  }
  for (let i = 0; i < 90; i++) {
    const a = (i / 90) * Math.PI * 2 + (reduce ? 0 : t * 0.0002), rr = 34 + Math.sin(i * 1.7 + t * 0.001) * 3;
    ctx.beginPath(); ctx.arc(W / 2 + Math.cos(a) * rr, H / 2 + Math.sin(a) * rr, 1.1, 0, 7); ctx.fillStyle = "rgba(255,181,71,.7)"; ctx.fill();
  }
  requestAnimationFrame(draw);
}

function boot() {
  layout(); setCur(cur); setupPin(); requestAnimationFrame(draw);
  // a link like /#economy (the "All projects" pill on each project) opens that project
  const id = location.hash.slice(1), i = P.findIndex((p) => p.id === id);
  if (i >= 0) {
    if (pinST) { requestAnimationFrame(() => { const y = pinST.start + (i / (P.length - 1)) * (pinST.end - pinST.start); scrollTo(0, y + 2); if (lenis) lenis.scrollTo(y + 2, { immediate: true }); setCur(i); }); }
    else { setCur(i); $("work").scrollIntoView(); }
  }
}
let lastW = innerWidth, rt;
addEventListener("resize", () => {
  clearTimeout(rt);
  rt = setTimeout(() => { const crossed = (lastW <= 900) !== (innerWidth <= 900); lastW = innerWidth; layout(); lastShown = null; paint(); if (crossed) setupPin(); if (hasGsap) ScrollTrigger.refresh(); }, 200);
});
if (document.fonts && document.fonts.ready) document.fonts.ready.then(boot); else boot();

// ------------------------------------------------------------------ hiring for
// Picking a role puts the work that fits it first: on the map, in the step bar, and on the tour.
const ROLES = {
  analyst: ["Data analyst", ["economy", "superstore", "football", "discrepancy", "sorted", "triage", "fine-print", "docket"]],
  bi: ["BI", ["superstore", "economy", "discrepancy", "football", "triage", "sorted", "docket", "fine-print"]],
  ai: ["AI engineer", ["fine-print", "sorted", "football", "triage", "economy", "superstore", "docket", "discrepancy"]],
  ops: ["Operations", ["discrepancy", "superstore", "docket", "sorted", "economy", "triage", "fine-print", "football"]],
};
const TOUR_ID = Object.fromEntries(Object.entries(VISIT_ID).map(([k, v]) => [v, k]));
const saveOrder = () => { try { sessionStorage.setItem("pf-order", JSON.stringify(P.map((p) => TOUR_ID[p.id]))); } catch {} };
function pickRole(role, quiet) {
  const r = ROLES[role]; if (!r) return;
  const byId = Object.fromEntries(P.map((p) => [p.id, p]));
  P.splice(0, P.length, ...r[1].map((id) => byId[id]).filter(Boolean));
  document.querySelectorAll("[data-role]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.role === role)));
  $("role-note").innerHTML = `${esc(P[0].name)}, ${esc(P[1].name)} and ${esc(P[2].name)} first. <button type="button" id="role-clear">Show all</button>`;
  $("role-note").classList.add("set");
  $("tour-label").textContent = `Take the ${r[0]} tour`;
  try { sessionStorage.setItem("pf-role", role); } catch {}
  saveOrder();
  if (W) { cur = 0; layout(); drawNames(); lastShown = null; setCur(0); if (hasGsap) ScrollTrigger.refresh(); }
  if (!quiet && gl) gl.kick();
}
document.querySelectorAll("[data-role]").forEach((b) => b.addEventListener("click", () => pickRole(b.dataset.role)));
$("role-note").addEventListener("click", (e) => {
  if (!e.target.closest("#role-clear")) return;
  try { sessionStorage.removeItem("pf-role"); } catch {}
  const byId = Object.fromEntries(P.map((p) => [p.id, p]));
  P.splice(0, P.length, ...ORIGINAL.map((id) => byId[id]));
  document.querySelectorAll("[data-role]").forEach((b) => b.setAttribute("aria-pressed", "false"));
  $("role-note").textContent = "Pick one and the tour starts with the work that fits."; $("role-note").classList.remove("set");
  $("tour-label").textContent = "Take the tour";
  saveOrder(); cur = 0; layout(); drawNames(); lastShown = null; setCur(0); if (gl) gl.kick();
});
const ORIGINAL = P.map((p) => p.id);
try { const r = sessionStorage.getItem("pf-role"); if (r) pickRole(r, true); } catch {}

// ------------------------------------------------------------------ the tour
// "Take the tour" warps into the first project; on every project the pill then shows a stop card,
// the eight stops as a small constellation, and the way to the next one (portfolio-bar.js).
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-tour]");
  if (!b) return;
  e.preventDefault();
  const from = Math.max(0, P.findIndex((p) => p.id === b.dataset.tour));
  try { sessionStorage.setItem("pf-tour", "1"); } catch {}
  saveOrder();
  const url = P[from].tour || P[from].live[1], label = `Stop ${from + 1} of ${P.length}|${P[from].name}`;
  if (WARP) WARP.out(url, { label }); else location.href = url;
});

// the end of the tour: the eight stops close into the ring, and a way to get in touch
let finale = false;
try { finale = sessionStorage.getItem("pf-finale") === "1"; sessionStorage.removeItem("pf-finale"); } catch {}
if (finale && $("finale").showModal) {
  setTimeout(() => { $("finale").showModal(); $("finale").classList.add("play"); }, reduce ? 0 : 650);
  $("fin-close").addEventListener("click", () => { $("finale").close(); jumpTo($("work").getBoundingClientRect().top + scrollY, SECTION.work); });
}

// ------------------------------------------------------------------ contact
document.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(b.dataset.copy); } catch { location.href = `mailto:${b.dataset.copy}`; return; }
  const s = b.querySelector("small"), was = s.textContent; s.textContent = "copied"; setTimeout(() => { s.textContent = was; }, 1600);
}));
