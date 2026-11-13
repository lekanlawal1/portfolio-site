/* Home page: the particle story, the project map and the small things around them.
   Three.js is loaded here; Lenis (smooth scrolling) comes from a classic script in the page.
   Everything degrades: no WebGL means the story's captions stack as plain text, and no Lenis means
   the page scrolls the browser's own way. */
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const small = () => innerWidth <= 900;
const P = window.PROJECTS;
const pad = (i) => String(i + 1).padStart(2, "0");

// ------------------------------------------------------------------ smooth scrolling
let lenis = null;
if (!reduce && window.Lenis) {
  lenis = new Lenis({ lerp: 0.1 });
  const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
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
  const past = scrollY > $("top").offsetHeight - 80;
  document.querySelector(".nav").classList.toggle("solid", past);
  // on desktop the pinned work section has its own step bar along the bottom: the dock steps aside there
  const pr = $("pin").getBoundingClientRect(), inPin = !small() && pr.top < innerHeight * 0.5 && pr.bottom > innerHeight * 0.5;
  const down = scrollY > lastScroll + 2, up = scrollY < lastScroll - 2; lastScroll = scrollY;
  if (down) dockAway = true; else if (up) dockAway = false;
  dockPast = past; dockPin = inPin;
  $("dock").classList.toggle("on", past && !inPin && !dockAway);
}, { passive: true });

// ------------------------------------------------------------------ the globe (centerpiece)
// globe.js draws and turns it; this part owns the file that opens beside it. Picking a project
// turns it to face you and zooms in; the file arrives as the zoom settles.
const hero = $("top"), gfile = $("gfile");
let G = null, gcur = -1, gT = 0;
// what opens when a proof number is tapped: how it was measured, and where to check it
const receiptHTML = (p) => `<div class="receipt"><p>${esc(p.receipt.how)}</p>${p.receipt.see.map(([t, u]) => `<a href="${u}">${esc(t)}</a>`).join("")}</div>`;
// the receipts strip lower down opens the same receipts from its numbers
document.querySelectorAll(".nums [data-p]").forEach((d) => { const p = P.find((x) => x.id === d.dataset.p); if (p) d.insertAdjacentHTML("beforeend", receiptHTML(p)); });
// the part of a project's panel that the globe's file and the map's panel share; they differ in the
// header, the heading level and the picture's class
function projectBody(p, i, h, shot) {
  return `<${h}>${esc(p.name)}</${h}><p>${esc(p.line)}</p>
    <details class="proof"><summary><b>${esc(p.proof[0])}</b><span>${esc(p.proof[1])}<em>See the proof</em></span></summary>${receiptHTML(p)}</details>
    <a class="${shot}" href="${p.live[1]}" aria-label="Open ${esc(p.name)}">${still
      ? `<img src="${p.img}" alt=""${p.phone ? ' class="phone"' : ""}>`
      : `<video src="assets/previews/${p.id}.mp4" ${p.phone ? "" : `poster="${p.img}"`} autoplay muted loop playsinline preload="auto" aria-hidden="true"></video>`}<span class="mono">Live preview</span></a>
    <div class="stack">${p.skills.map((k) => `<span>${esc(k)}</span>`).join("")}</div>
    <div class="go"><a href="${p.live[1]}">${esc(p.live[0])} ↗</a>${p.study !== p.live[1] ? `<a class="o" href="${p.study}">Case study</a>` : ""}${p.download ? `<a class="o" href="${p.download}" download>Workbook</a>` : ""}${p.source ? `<a class="o" href="${p.source}">Source</a>` : ""}</div>
    <a class="tour-here mono" href="${p.tour || p.live[1]}" data-tour="${p.id}">Tour from here: this one and the next two →</a>`;
}
function fileHTML(p, i) {
  return `<div class="top mono"><span>File ${pad(i)} // ${esc(p.kind)}</span><button type="button" class="x" aria-label="Close the file">&times;</button></div>` + projectBody(p, i, "h2", "shot");
}
function playOrStill(root, p) {
  const v = root.querySelector(".shot video"), q = v && v.play && v.play();
  if (q && q.catch) q.catch(() => {
    const img = document.createElement("img"); img.alt = ""; img.src = v.getAttribute("poster") || p.img;
    if (p.phone) img.className = "phone";
    v.replaceWith(img);
  });
}
function drawGNames() {
  $("gnames").innerHTML = P.map((p, i) => `<button type="button" data-i="${i}"${i === gcur ? ' class="on"' : ""}>${esc(p.name.split(" ").slice(-1)[0])}</button>`).join("");
}
function gopen(i) {
  i = (i + P.length) % P.length;
  const swap = gcur >= 0;
  gcur = i;
  hero.classList.add("open");
  if (G) G.focus(i);
  $("gnames").querySelectorAll("button").forEach((b, k) => b.classList.toggle("on", k === i));
  const render = () => {
    gfile.innerHTML = fileHTML(P[i], i);
    gfile.querySelector(".x").addEventListener("click", gclose);
    gfile.classList.remove("swap"); gfile.classList.add("show");
    playOrStill(gfile, P[i]);
  };
  clearTimeout(gT);
  if (reduce) render();
  else if (swap) { gfile.classList.add("swap"); gT = setTimeout(render, 420); }   // out, turn, back in
  else { gfile.classList.remove("show"); gT = setTimeout(render, 380); }          // let the zoom start first
}
function gclose() {
  clearTimeout(gT); gcur = -1; hero.classList.remove("open"); gfile.classList.remove("show");
  $("gnames").querySelectorAll("button").forEach((b) => b.classList.remove("on"));
  if (G) G.release();
}
drawGNames();
$("gnames").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) gopen(+b.dataset.i); });
$("gprev").addEventListener("click", () => gopen(gcur < 0 ? P.length - 1 : gcur - 1));
$("gnext").addEventListener("click", () => gopen(gcur < 0 ? 0 : gcur + 1));
addEventListener("keydown", (e) => {
  const r = hero.getBoundingClientRect();
  if (r.bottom < innerHeight * 0.5 || /input|textarea|select/i.test(e.target.tagName)) return;
  if (e.key === "Escape" && gcur >= 0) gclose();
  if (e.key === "ArrowRight") { e.preventDefault(); gopen(gcur + 1); }
  if (e.key === "ArrowLeft") { e.preventDefault(); gopen(gcur < 0 ? P.length - 1 : gcur - 1); }
});
// phones: swipe the open file sideways for the next or previous project
let gsx = 0, gsy = 0;
gfile.addEventListener("touchstart", (e) => { gsx = e.touches[0].clientX; gsy = e.touches[0].clientY; }, { passive: true });
gfile.addEventListener("touchend", (e) => {
  const dx = e.changedTouches[0].clientX - gsx, dy = e.changedTouches[0].clientY - gsy;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) gopen(gcur + (dx < 0 ? 1 : -1));
}, { passive: true });

// the side piece in About: the four-step story, small and self-playing
const HOWI = ["2,000 of a real store's sales lines, as they arrive: duplicates, junk rows, gaps.",
  "Sorted into rows. Junk rows found and reported, never quietly dropped. Every column checked.",
  "Counted, never guessed: the bars are that store's real monthly sales, 2015 to 2018, worked out in SQL.",
  "Checked, then shipped. When AI is involved, code checks every answer it gives before you see it."];
let story = null;
const howiStep = (k) => {
  document.querySelectorAll(".howi-steps button").forEach((b) => b.classList.toggle("on", +b.dataset.s === k));
  $("howi-text").textContent = HOWI[k];
};
document.querySelector(".howi-steps").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; howiStep(+b.dataset.s); if (story) story.go(+b.dataset.s); });

import("./vendor/three.module.min.js").then(async (THREE) => {
  const [{ makeGlobe }, { makeStory }] = await Promise.all([import("./globe.js?v=20261114"), import("./story.js?v=20261113")]);
  G = makeGlobe(THREE, { hero, stage: $("stage"), projects: P, onPick: gopen,
    keepClear: () => { const r = $("intro").getBoundingClientRect(), t = hero.getBoundingClientRect(); return r.bottom - t.top + 8; } });
  if (gcur >= 0) G.focus(gcur);
  try { if (sessionStorage.getItem("pf-role")) G.dim(P.slice(0, 3).map((p) => p.id)); } catch {}
  try { story = makeStory(THREE, { box: $("howi-stage"), onStep: howiStep }); } catch { document.querySelector(".howi").classList.add("no-gl"); }
}).catch(() => document.documentElement.classList.add("no-gl"));

// ------------------------------------------------------------------ the work map
const map = $("map"), cv = $("lines"), ctx = cv.getContext("2d"), hud = $("hud");
const SKILLS = [...new Set(P.flatMap((p) => p.skills))];
const VISIT_ID = Object.fromEntries(P.map((p) => [p.short, p.id]));   // the short id each project site reports, to the portfolio id
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
  // pointing at a project or skill lights it up on the map; only a click changes the file
  const n = shown(), rel = related(n);
  map.classList.toggle("focus", !!n);
  nodes.forEach((m) => { m.el.classList.toggle("lit", !!rel && rel.has(m)); if (m.k === "p") m.el.classList.toggle("cur", m.i === cur); });
  const c = nodes.find((m) => m.k === "p" && m.i === cur);
  if (!c || c === lastShown) return;
  lastShown = c;
  swapPanel(() => showProject(cur));
}
// a click on the map zooms in on that project and back out as its file arrives
function zoomMap(i) {
  const n = nodes.find((m) => m.k === "p" && m.i === i);
  if (reduce || !n || !map.animate) return;
  map.style.transformOrigin = `${n.x}px ${n.y}px`;
  map.animate([{ transform: "scale(1)" }, { transform: "scale(1.22)", offset: 0.42 }, { transform: "scale(1)" }], { duration: 950, easing: "cubic-bezier(.3,.7,.2,1)" });
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
    playOrStill(hud, P[cur]);
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
  hud.innerHTML = `<div class="bar mono"><span>File ${pad(i)} // ${esc(p.name)}</span><span>${esc(p.kind)}</span></div>` + projectBody(p, i, "h3", "shot reveal");
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
  $("count").textContent = $("pcount").textContent = `${pad(cur)} / ${pad(P.length - 1)}`;
  $("fill").style.width = `${(cur / (P.length - 1)) * 100}%`;
  $("names").querySelectorAll("button").forEach((b, k) => b.classList.toggle("on", k === cur));
  paint();
}
const drawNames = () => { $("names").innerHTML = P.map((p, i) => `<button type="button" data-i="${i}">${esc(p.name.split(" ").slice(-1)[0])}</button>`).join(""); };
drawNames();
$("names").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) go(+b.dataset.i, true); });
$("prev").addEventListener("click", () => go(cur - 1));
$("sprev").addEventListener("click", () => go(cur - 1));
$("snext").addEventListener("click", () => go(cur + 1));
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

// The section scrolls like any other; projects change on a click, an arrow, a key or a swipe.
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function go(i, jump) {
  i = (i + P.length) % P.length;
  if (i !== cur) zoomMap(i);
  hover = null; setCur(i);
  // phones and tablets: keep the map and the top of the new panel in view together, so you see
  // the light travel and the panel arrive
  const m = map.getBoundingClientRect();
  if (small() && (m.top < 40 || m.top > innerHeight * 0.3)) scrollToY(scrollY + m.top - 64, 0.8);
}

// one soft glow, drawn once and stamped wherever a dot needs one (blurring every dot each frame is slow)
const GLOW = (() => {
  const g = document.createElement("canvas"); g.width = g.height = 64;
  const c = g.getContext("2d"), r = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,236,200,1)"); r.addColorStop(0.18, "rgba(255,200,120,.9)"); r.addColorStop(0.45, "rgba(255,181,71,.28)"); r.addColorStop(1, "rgba(255,181,71,0)");
  c.fillStyle = r; c.fillRect(0, 0, 64, 64); return g;
})();
const glow = (x, y, size, alpha) => { ctx.globalAlpha = alpha; ctx.drawImage(GLOW, x - size, y - size, size * 2, size * 2); ctx.globalAlpha = 1; };
let mapVisible = true;
new IntersectionObserver(([e]) => { mapVisible = e.isIntersecting; }).observe(map);
function draw(t) {
  if (!W || !mapVisible) { requestAnimationFrame(draw); return; }   // off screen: skip
  ctx.clearRect(0, 0, W, H);
  const n = shown(), rel = related(n);
  nodes.forEach((m) => {
    const dx = reduce ? 0 : Math.sin(t * 0.0006 + m.ph) * 3, dy = reduce ? 0 : Math.cos(t * 0.0005 + m.ph) * 3;
    m.dx = m.x + dx; m.dy = m.y + dy; m.el.style.transform = `translate(${m.dx}px, ${m.dy}px)`;
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
  layout(); setCur(cur); requestAnimationFrame(draw);
  // a link like /#economy (the "All projects" pill on each project) comes back to that project on the globe
  const id = location.hash.slice(1), i = P.findIndex((p) => p.id === id);
  if (i >= 0) { scrollTo(0, 0); gopen(i); }
}
let lastW = innerWidth, lastH = innerHeight, rt;
addEventListener("resize", () => {
  // phones report a resize every time the address bar shrinks or grows while scrolling: only a real
  // change of width (or a desktop window changing height) should rebuild the map and panel
  if (innerWidth === lastW && (small() || Math.abs(innerHeight - lastH) < 120)) return;
  lastH = innerHeight;
  clearTimeout(rt);
  rt = setTimeout(() => { lastW = innerWidth; layout(); lastShown = null; paint(); }, 200);
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
const TOUR_STOPS = 3;   // the project the tour starts from and the next two in the current order
function pickRole(role, quiet) {
  const r = ROLES[role]; if (!r) return;
  const byId = Object.fromEntries(P.map((p) => [p.id, p]));
  P.splice(0, P.length, ...r[1].map((id) => byId[id]).filter(Boolean));
  document.querySelectorAll("[data-role]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.role === role)));
  $("role-note").innerHTML = `${esc(P[0].name)}, ${esc(P[1].name)} and ${esc(P[2].name)} first. <button type="button" id="role-clear">Show all</button><button type="button" id="role-copy">Copy link</button>`;
  $("role-note").classList.add("set");
  $("tour-label").textContent = `Take the ${r[0]} tour`;
  try { sessionStorage.setItem("pf-role", role); } catch {}
  history.replaceState(null, "", `?for=${role}${location.hash}`);   // an address to paste into an application
  if (W) { cur = 0; layout(); drawNames(); lastShown = null; setCur(0); }
  if (G) { G.refresh(); G.dim(P.slice(0, 3).map((p) => p.id)); }
  drawGNames();
  // the globe turns to the best fit and lights the three that fit; the buttons stay put
  if (!quiet) { gclose(); if (G) G.turn(0); }
}
// clicking the chosen role again unselects it
document.querySelectorAll("[data-role]").forEach((b) => b.addEventListener("click", () => {
  if (b.getAttribute("aria-pressed") === "true") clearRole(); else pickRole(b.dataset.role);
}));
$("role-note").addEventListener("click", async (e) => {
  if (e.target.closest("#role-clear")) clearRole();
  const c = e.target.closest("#role-copy");
  if (!c) return;
  try { await navigator.clipboard.writeText(location.href); c.textContent = "Copied"; setTimeout(() => { c.textContent = "Copy link"; }, 1600); } catch {}   // the address bar already holds it
});
function clearRole() {
  try { sessionStorage.removeItem("pf-role"); } catch {}
  const byId = Object.fromEntries(P.map((p) => [p.id, p]));
  P.splice(0, P.length, ...ORIGINAL.map((id) => byId[id]));
  document.querySelectorAll("[data-role]").forEach((b) => b.setAttribute("aria-pressed", "false"));
  $("role-note").textContent = ""; $("role-note").classList.remove("set");
  $("tour-label").textContent = "Take the tour";
  history.replaceState(null, "", location.pathname + location.hash);
  cur = 0; layout(); drawNames(); lastShown = null; setCur(0);
  gclose(); if (G) { G.refresh(); G.dim(null); } drawGNames();
}
const ORIGINAL = P.map((p) => p.id);
// ?for=analyst (or bi, ai, ops) opens the page already set to that role
{ let r = new URLSearchParams(location.search).get("for");
  if (!ROLES[r]) { r = null; try { r = sessionStorage.getItem("pf-role"); } catch {} }
  if (r) pickRole(r, true); }

// ------------------------------------------------------------------ the tour
// "Take the tour" warps into the first project; on every project the pill then shows a stop card,
// the three stops as a small constellation, and the way to the next one (portfolio-bar.js).
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-tour]");
  if (!b) return;
  e.preventDefault();
  const from = Math.max(0, P.findIndex((p) => p.id === b.dataset.tour));
  try {
    sessionStorage.setItem("pf-tour", "1");
    sessionStorage.setItem("pf-order", JSON.stringify(Array.from({ length: TOUR_STOPS }, (_, k) => TOUR_ID[P[(from + k) % P.length].id])));
  } catch {}
  const url = P[from].tour || P[from].live[1], label = `Stop 1 of ${TOUR_STOPS}|${P[from].name}`;
  if (WARP) WARP.out(url, { label }); else location.href = url;
});

// the end of the tour: the stops close into the ring, and a way to get in touch
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
