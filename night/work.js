// The Work section from the homepage, on the island: every project wired to the skills it uses, and a
// panel for the one you pick. Same data (projects.js) and behaviour as the homepage's; see home.js.
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const small = () => innerWidth <= 900;
const P = window.PROJECTS;
const pad = (i) => String(i + 1).padStart(2, "0");

const U = (u) => (/^(https?:|mailto:|tel:|\.\.\/|#)/.test(u) ? u : "../" + u);   // site-root paths, from /night/
const receiptHTML = (p) => !p.receipt ? "" : `<div class="receipt"><p>${esc(p.receipt.how)}</p>${p.receipt.see.map(([t, u]) => `<a href="${U(u)}">${esc(t)}</a>`).join("")}</div>`;
// the receipts strip lower down opens the same receipts from its numbers
document.querySelectorAll(".nums [data-p]").forEach((d) => { const p = P.find((x) => x.id === d.dataset.p); if (p) d.insertAdjacentHTML("beforeend", receiptHTML(p)); });
// the part of a project's panel that the globe's file and the map's panel share; they differ in the
// header, the heading level and the picture's class
function projectBody(p, i, h, shot) {
  return `<${h}>${esc(p.name)}</${h}><p class="meta">${esc(p.kind)} · ${i + 1} of ${P.length}</p><p>${esc(p.line)}</p>
    <details class="proof"><summary><b>${esc(p.proof[0])}</b><span>${esc(p.proof[1])}${p.receipt ? "<em>See the proof</em>" : ""}</span></summary>${receiptHTML(p)}</details>
    <a class="${shot}" href="${U(p.live[1])}" aria-label="Open ${esc(p.name)}">${still
      ? `<img src="${U(p.img)}" alt=""${p.phone ? ' class="phone"' : ""}>`
      : `<video src="../assets/previews/${p.id}.mp4" ${p.phone ? "" : `poster="${U(p.img)}"`} autoplay muted loop playsinline preload="auto" aria-hidden="true"></video>`}<span class="mono">Live preview</span></a>
    <div class="stack">${p.skills.map((k) => `<span>${esc(k)}</span>`).join("")}</div>
    <div class="go"><a href="${U(p.live[1])}">${esc(p.live[0])} <svg class="arr" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg></a>${p.study !== p.live[1] ? `<a class="o" href="${U(p.study)}">Case study</a>` : ""}${p.download ? `<a class="o" href="${U(p.download)}" download>Workbook</a>` : ""}${p.source ? `<a class="o" href="${p.source}">Source</a>` : ""}</div>`;
}
function playOrStill(root, p) {
  const v = root.querySelector(".shot video"), q = v && v.play && v.play();
  if (q && q.catch) q.catch(() => {
    const img = document.createElement("img"); img.alt = ""; img.src = v.getAttribute("poster") || U(p.img);
    if (p.phone) img.className = "phone";
    v.replaceWith(img);
  });
}

// ------------------------------------------------------------------ the work map
const map = $("map"), cv = $("lines"), ctx = cv.getContext("2d"), hud = $("hud");
const SKILLS = [...new Set(P.flatMap((p) => p.skills))];
const VISIT_ID = Object.fromEntries(P.map((p) => [p.short, p.id]));   // the short id each project site reports, to the portfolio id
let seen = new Set();
try { seen = new Set(JSON.parse(localStorage.getItem("town-visited") || "[]").map((v) => VISIT_ID[v]).filter(Boolean)); } catch {}
let W = 0, H = 0, nodes = [], edges = [], cur = 0, hover = null;

// The town from above: each project's building sits where it stands on the island, and each skill is a
// signpost on the roads to the buildings that use it, so a skill several projects share ends up on a main
// street between them. Grid units match town3d.js, where the island is 12 x 12.
const SPOT = { econ: [2.2, 2.2, "#E63946"], store: [6.5, 2.0, "#FFB020"], triage: [2.3, 4.9, "#3E8BFF"], fifa: [6.3, 6.1, "#22C3A6"],
  fine: [4.85, 9.6, "#FF4F8B"], wh: [9.5, 7.9, "#FF6B35"], dock: [10.2, 1.8, "#2E86AB"], sorted: [2.3, 7.7, "#8A4DFF"] };
let isle = { x: 0, y: 0, s: 0, sx: 0, sy: 0 };   // s: the smaller side, for sizes; sx, sy: the island's own width and height
const at = (gx, gz) => [isle.x + (0.12 + (gx / 12) * 0.76) * isle.sx, isle.y + (0.12 + (gz / 12) * 0.76) * isle.sy];
// nudge the signposts apart, and off the buildings, until no two labels overlap; sizes are measured
function spread() {
  const sideX = isle.sx, sideY = isle.sy;
  nodes.forEach((n) => { n.w = n.el.offsetWidth + 8; n.h = n.el.offsetHeight + 6; });
  const signs = nodes.filter((n) => n.k === "s"), pad = 10;
  for (let it = 0; it < 400; it++) {
    let moved = false;
    for (const a of signs) for (const o of nodes) {
      if (a === o) continue;
      const ox = (a.w + o.w) / 2 - Math.abs(a.x - o.x), oy = (a.h + o.h) / 2 - Math.abs(a.y - o.y);
      if (ox <= 0 || oy <= 0) continue;
      moved = true;
      // push along the shorter overlap; a signpost moves, a building never does
      const k = o.k === "s" ? 0.5 : 1;
      // ...unless it's pinned against the island's top or bottom edge: then it slides along it
      const minY = isle.y + a.h / 2 + pad, maxY = isle.y + sideY - a.h / 2 - pad, pinned = a.y <= minY + 0.5 || a.y >= maxY - 0.5;
      if (ox < oy * 2.2 || pinned) a.x += Math.sign(a.x - o.x || 1) * ox * k; else a.y += Math.sign(a.y - o.y || 1) * oy * k;
    }
    for (const a of signs) {
      a.x = Math.min(isle.x + sideX - a.w / 2 - pad, Math.max(isle.x + a.w / 2 + pad, a.x));
      a.y = Math.min(isle.y + sideY - a.h / 2 - pad, Math.max(isle.y + a.h / 2 + pad, a.y));
    }
    if (!moved) break;
  }
  // anything still touching something: the nearest free spot, searched in widening rings
  const hits = (a, x, y) => nodes.some((o) => o !== a && Math.abs(x - o.x) < (a.w + o.w) / 2 && Math.abs(y - o.y) < (a.h + o.h) / 2);
  const inside = (a, x, y) => x - a.w / 2 >= isle.x + pad && x + a.w / 2 <= isle.x + sideX - pad && y - a.h / 2 >= isle.y + pad && y + a.h / 2 <= isle.y + sideY - pad;
  for (const a of signs) {
    if (!hits(a, a.x, a.y)) continue;
    search: for (let r = 12; r < Math.min(sideX, sideY) / 2; r += 10) for (let k = 0; k < 16; k++) {
      const x = a.x + Math.cos((k / 16) * Math.PI * 2) * r * 1.8, y = a.y + Math.sin((k / 16) * Math.PI * 2) * r;
      if (inside(a, x, y) && !hits(a, x, y)) { a.x = x; a.y = y; break search; }
    }
  }
}
function layout() {
  const r = map.getBoundingClientRect(), dpr = Math.min(devicePixelRatio, 2);
  W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  map.querySelectorAll(".node").forEach((n) => n.remove()); nodes = []; edges = [];
  const S = small(), side = Math.min(W, H) * (S ? 0.94 : 0.9);
  // phones: the map is taller than wide, and the island stretches to fill it, so the huts get room
  const sx = S ? W * 0.92 : side, sy = S ? H * 0.92 : side;
  isle = { x: (W - sx) / 2, y: (H - sy) / 2, s: Math.min(sx, sy), sx, sy };
  P.forEach((p, i) => {
    const [gx, gz, color] = SPOT[p.short] || [6, 6, "#999999"], [x, y] = at(gx, gz);
    nodes.push({ k: "p", i, id: p.id, label: p.name, x, y, color, ph: Math.random() * 6 });
  });
  if (!S) {
    const proj = nodes.filter((n) => n.k === "p");
    SKILLS.forEach((sk, i) => {
      const users = proj.filter((n) => P[n.i].skills.includes(sk));
      let x = users.reduce((t, n) => t + n.x, 0) / users.length, y = users.reduce((t, n) => t + n.y, 0) / users.length;
      if (users.length === 1) { const a = i * 2.4; x += Math.cos(a) * side * 0.12; y += Math.sin(a) * side * 0.1; }   // one project's own skill sits beside it
      nodes.push({ k: "s", id: sk, label: sk, x, y, ph: Math.random() * 6 });
    });
  }
  nodes.forEach((n) => {
    const b = document.createElement("button"); b.type = "button"; n.el = b;
    b.className = `node ${n.k}${n.k === "p" && seen.has(n.id) ? " seen" : ""}`;
    if (n.k === "p") { b.innerHTML = `<span class="dot" style="--c:${n.color}"></span><b>${esc(n.label)}</b>`; b.setAttribute("aria-label", `${n.label}, project ${n.i + 1} of ${P.length}`); }
    else { b.textContent = n.label; b.setAttribute("aria-label", `${n.label}: show the projects that use it`); }
    // previews are for a mouse or the keyboard only: on a phone a tap goes straight to the project
    b.addEventListener("pointerenter", (e) => { if (e.pointerType !== "mouse") return; hover = n; paint(); });
    b.addEventListener("focus", () => { if (!b.matches(":focus-visible")) return; hover = n; paint(); });
    b.addEventListener("click", () => { if (n.k === "p") { hover = null; go(n.i, true); } else { hover = n; paint(); } });
    map.appendChild(b);
  });
  nodes.forEach((n) => { n.hy = n.k === "p" ? n.y - n.el.offsetHeight / 2 + 15 : n.y; n.w = n.el.offsetWidth + 8; n.h = n.el.offsetHeight + 6; });
  if (!S) spread();
  paperKey = "";
  nodes.filter((n) => n.k === "p").forEach((p) => {
    P[p.i].skills.forEach((sk) => { const sn = nodes.find((n) => n.k === "s" && n.id === sk); if (sn) edges.push({ a: p, b: sn, q: [Math.random(), Math.random()] }); });
  });
}
map.addEventListener("pointerleave", (e) => { if (e.pointerType !== "mouse") return; hover = null; paint(); });

const shown = () => hover || nodes.find((n) => n.k === "p" && n.i === cur);
function related(n) {
  if (!n) return null;
  const set = new Set([n]);
  edges.forEach((e) => { if (e.a === n) set.add(e.b); if (e.b === n) set.add(e.a); });
  return set;
}
let lastShown = null;
function paint() {
  // pointing at a project or skill lights it up on the map; only a click changes the file
  const n = shown(), rel = related(n);
  map.classList.toggle("focus", !!hover);   // the map dims only while you point at something
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
// Changing project: the old panel slides out the way you're going and the new one settles in line by
// line from the other side, while a packet of light travels the map between the two.
let swapT = 0;
function swapPanel(render, quick) {
  clearTimeout(swapT);
  const enter = () => {
    hud.classList.remove("leaving"); render();
    [...hud.children].forEach((c, k) => c.style.setProperty("--i", k));
    hud.classList.remove("entering"); void hud.offsetWidth; hud.classList.add("entering");
    playOrStill(hud, P[cur]);
  };
  if (reduce || quick || !hud.children.length) { enter(); return; }
  hud.classList.add("leaving");
  swapT = setTimeout(enter, 190);
}
// the live preview leans a little toward the pointer, like a screen you could pick up (mouse only)
if (!reduce && matchMedia("(hover: hover) and (pointer: fine)").matches) {
  hud.addEventListener("pointermove", (e) => {
    const s = e.target.closest(".shot"); if (!s) return;
    const r = s.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    s.style.transform = `perspective(900px) rotateX(${(-y * 5).toFixed(2)}deg) rotateY(${(x * 7).toFixed(2)}deg) scale(1.015)`;
  });
  hud.addEventListener("pointerout", (e) => { const s = e.target.closest(".shot"); if (s && !s.contains(e.relatedTarget)) s.style.transform = ""; });
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
  hud.innerHTML = projectBody(p, i, "h3", "shot pop");
  hud.dataset.short = p.short;
}
function showSkill(s) {
  const ps = P.filter((p) => p.skills.includes(s));
  hud.innerHTML = `<h3>${esc(s)}</h3><p class="meta">Skill · ${ps.length} project${ps.length > 1 ? "s" : ""}</p><p>Used in ${ps.map((p) => esc(p.name)).join(", ")}.</p>
    <div class="stack">${ps.map((p) => `<span>${pad(P.indexOf(p))} ${esc(p.name)}</span>`).join("")}</div>
    <p class="meta">Click a project on the map to open it.</p>`;
}
function setCur(i) {
  i = (i + P.length) % P.length;
  if (i !== cur) {
    send(cur, i);
    const fwd = (i - cur + P.length) % P.length <= P.length / 2;
    hud.style.setProperty("--sx", fwd ? "28px" : "-28px");
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
  const r = $("projects").getBoundingClientRect();
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
  if (small() && (m.top < 40 || m.top > innerHeight * 0.3)) scrollTo({ top: scrollY + m.top - 64, behavior: reduce ? "auto" : "smooth" });
}

let mapVisible = true;
new IntersectionObserver(([e]) => { mapVisible = e.isIntersecting; }).observe(map);
// ------------------------------------------------------------------ the treasure map
// A black-and-white treasure map, drawn in ink: torn paper, a coastline with bays, palms, snowy mountains, a
// ship and sharks at sea, a compass, and a dashed trail through every project in order. The project you're
// looking at gets the big X. Pointing at a skill draws trails to the projects that use it. The paper and
// everything on it that never moves is drawn once per size and kept.
// the paper sits just off the page colour: a shade lighter at night, a shade darker by day; the ink flips with it
let INKC = "#EDE4D3", PAPER = "#1B1814";
const mapColours = () => { const day = document.documentElement.dataset.theme === "light"; INKC = day ? "#2A2118" : "#EDE4D3"; PAPER = day ? "#F2E5CB" : "#1C1915"; return day; };
const seeded = (n) => () => ((n = (n * 16807) % 2147483647) - 1) / 2147483646;
let paper = null, paperKey = "", trail = [];
// a smooth curve through points (Catmull-Rom), sampled
function smooth(pts, steps = 14) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    for (let k = 0; k < steps; k++) {
      const t = k / steps, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((d) => 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3)));
    }
  }
  out.push(pts[pts.length - 1]); return out;
}
function coastPath(g, cx, cy, rx, ry) {
  g.beginPath();
  for (let i = 0; i <= 120; i++) {
    const a = (i / 120) * Math.PI * 2, sq = 1 / Math.pow(Math.pow(Math.abs(Math.cos(a)), 4) + Math.pow(Math.abs(Math.sin(a)), 4), 1 / 4);
    const k = sq * (1 + Math.sin(a * 2 + 0.6) * 0.06 + Math.sin(a * 5 + 2) * 0.045 + Math.sin(a * 11) * 0.012);   // bays and headlands
    const x = cx + Math.cos(a) * rx * k, y = cy + Math.sin(a) * ry * k;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.closePath();
}
const ink = (g, w = 2) => { g.strokeStyle = INKC; g.lineWidth = w; g.lineCap = "round"; g.lineJoin = "round"; };
function palm(g, x, y, h, lean) {
  ink(g, 1.6); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + lean * h * 0.3, y - h * 0.55, x + lean * h * 0.15, y - h); g.stroke();
  for (let i = 1; i < 5; i++) { const ty = y - (h * i) / 5, tx = x + lean * h * 0.3 * Math.sin((i / 5) * Math.PI) ; g.beginPath(); g.moveTo(tx - 2.5, ty); g.lineTo(tx + 2.5, ty + 1); g.lineWidth = 1; g.stroke(); }
  const tx = x + lean * h * 0.15, ty = y - h;
  ink(g, 1.4);
  for (const a of [-2.7, -2.2, -1.6, -1.0, -0.45]) {
    g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(tx + Math.cos(a) * h * 0.35, ty + Math.sin(a) * h * 0.35 - h * 0.08, tx + Math.cos(a) * h * 0.55, ty + Math.sin(a) * h * 0.28 + h * 0.12); g.stroke();
  }
}
function mountain(g, x, y, w, h) {
  ink(g, 1.6); g.fillStyle = PAPER;
  g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x - w * 0.08, y - h); g.lineTo(x + w * 0.06, y - h * 0.9); g.lineTo(x + w / 2, y); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(x - w * 0.25, y - h * 0.55); g.lineTo(x - w * 0.14, y - h * 0.48); g.lineTo(x - w * 0.04, y - h * 0.6); g.lineTo(x + w * 0.05, y - h * 0.5); g.lineTo(x + w * 0.16, y - h * 0.58); g.stroke();
}
function shark(g, x, y) {
  g.fillStyle = INKC; g.beginPath(); g.moveTo(x - 7, y); g.quadraticCurveTo(x - 2, y - 6, x + 1, y - 15); g.quadraticCurveTo(x + 2, y - 6, x + 7, y); g.closePath(); g.fill();
  ink(g, 1.3); for (const [dx, dy] of [[-13, 2], [4, 4]]) { g.beginPath(); g.moveTo(x + dx, y + dy); g.quadraticCurveTo(x + dx + 3, y + dy - 3, x + dx + 6, y + dy); g.quadraticCurveTo(x + dx + 9, y + dy - 3, x + dx + 12, y + dy); g.stroke(); }
}
function ship(g, x, y, s) {
  g.fillStyle = INKC;
  g.beginPath(); g.moveTo(x - s, y - s * 0.25); g.lineTo(x + s * 1.05, y - s * 0.25); g.lineTo(x + s * 0.7, y + s * 0.18); g.lineTo(x - s * 0.75, y + s * 0.18); g.closePath(); g.fill();
  for (const [mx, mh] of [[-0.45, 1.05], [0.05, 1.3], [0.5, 0.95]]) {
    g.fillRect(x + mx * s - 1, y - s * 0.25 - s * mh, 2, s * mh);
    for (const k of [0.25, 0.62]) { const sy = y - s * 0.25 - s * mh * (1 - k); g.beginPath(); g.moveTo(x + mx * s - s * 0.22, sy - s * 0.24); g.quadraticCurveTo(x + mx * s - s * 0.1, sy, x + mx * s - s * 0.2, sy + s * 0.12); g.lineTo(x + mx * s + s * 0.22, sy + s * 0.12); g.quadraticCurveTo(x + mx * s + s * 0.3, sy, x + mx * s + s * 0.2, sy - s * 0.24); g.closePath(); g.fill(); }
    g.beginPath(); g.moveTo(x + mx * s, y - s * 0.25 - s * mh); g.lineTo(x + mx * s + s * 0.18, y - s * 0.2 - s * mh); g.lineTo(x + mx * s, y - s * 0.15 - s * mh); g.fill();
  }
  ink(g, 1.3); g.beginPath(); g.moveTo(x - s * 1.2, y + s * 0.28); g.quadraticCurveTo(x, y + s * 0.4, x + s * 1.25, y + s * 0.26); g.stroke();
}
function skull(g, x, y, s) {
  g.fillStyle = INKC; ink(g, s * 0.32);
  g.beginPath(); g.moveTo(x - s * 1.1, y - s * 0.2); g.lineTo(x + s * 1.1, y + s * 1.1); g.moveTo(x + s * 1.1, y - s * 0.2); g.lineTo(x - s * 1.1, y + s * 1.1); g.stroke();
  g.beginPath(); g.arc(x, y - s * 0.4, s * 0.7, 0, Math.PI * 2); g.fill(); g.fillRect(x - s * 0.42, y - s * 0.1, s * 0.84, s * 0.55);
  g.fillStyle = PAPER; g.beginPath(); g.arc(x - s * 0.27, y - s * 0.38, s * 0.19, 0, 7); g.arc(x + s * 0.27, y - s * 0.38, s * 0.19, 0, 7); g.fill();
}
function compass(g, x, y, r) {
  ink(g, 1.4); g.fillStyle = PAPER;
  g.beginPath(); g.arc(x, y, r * 0.62, 0, 7); g.fill(); g.stroke(); g.beginPath(); g.arc(x, y, r * 0.5, 0, 7); g.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2, l = i % 2 ? r * 0.62 : r, w = i % 2 ? 0.28 : 0.2;
    for (const side of [-1, 1]) {
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.lineTo(x + Math.cos(a + side * w) * r * 0.22, y + Math.sin(a + side * w) * r * 0.22); g.closePath();
      g.fillStyle = side < 0 ? INKC : PAPER; g.fill(); g.lineWidth = 1; g.stroke();
    }
  }
  g.fillStyle = INKC; g.beginPath(); g.arc(x, y, r * 0.08, 0, 7); g.fill();
  g.font = `700 ${Math.round(r * 0.36)}px Georgia, serif`; g.textAlign = "center"; g.textBaseline = "middle";
  [["N", 0, -1], ["E", 1, 0], ["S", 0, 1], ["W", -1, 0]].forEach(([t, dx, dy]) => g.fillText(t, x + dx * r * 1.22, y + dy * r * 1.22));
}
// one landmark per project, all in the same ink; each sits on (x, y) with its base about 10px below
const fillInk = (g) => { g.fillStyle = INKC; g.fill(); }, fillPaper = (g) => { g.fillStyle = PAPER; g.fill(); };
const box = (g, x, y, w, h) => { g.beginPath(); g.rect(x - w / 2, y - h, w, h); fillPaper(g); g.stroke(); };
const LANDMARK = {
  econ(g, x, y) {   // a tall tower with a flag
    ink(g, 1.7); box(g, x, y + 10, 14, 30);
    for (const r of [0, 1, 2]) for (const c of [-1, 1]) g.fillRect(x + c * 3 - 1.5, y - 14 + r * 7, 3, 3.5);
    g.beginPath(); g.moveTo(x, y - 20); g.lineTo(x, y - 31); g.stroke();
    g.beginPath(); g.moveTo(x, y - 31); g.lineTo(x + 10, y - 28); g.lineTo(x, y - 25); fillInk(g);
  },
  store(g, x, y) {  // a shop with a striped awning
    ink(g, 1.7); box(g, x, y + 10, 24, 15);
    g.beginPath(); g.moveTo(x - 15, y - 5); g.lineTo(x - 11, y - 12); g.lineTo(x + 11, y - 12); g.lineTo(x + 15, y - 5); g.closePath(); fillPaper(g); g.stroke();
    for (let i = 0; i < 5; i += 2) { g.beginPath(); g.moveTo(x - 15 + i * 6, y - 5); g.lineTo(x - 11 + i * 4.4, y - 12); g.lineTo(x - 11 + (i + 1) * 4.4, y - 12); g.lineTo(x - 15 + (i + 1) * 6, y - 5); g.closePath(); fillInk(g); }
    g.fillRect(x - 3, y + 2, 6, 8);
  },
  triage(g, x, y) { // a post office with an envelope on the roof
    ink(g, 1.7); box(g, x, y + 10, 20, 15);
    g.beginPath(); g.moveTo(x - 13, y - 5); g.lineTo(x, y - 14); g.lineTo(x + 13, y - 5); g.closePath(); fillPaper(g); g.stroke();
    g.beginPath(); g.rect(x - 6, y - 24, 12, 8); fillPaper(g); g.stroke(); g.beginPath(); g.moveTo(x - 6, y - 24); g.lineTo(x, y - 19.5); g.lineTo(x + 6, y - 24); g.stroke();
    g.fillRect(x - 2.5, y + 3, 5, 7);
  },
  fifa(g, x, y) {   // a stadium
    ink(g, 1.7); g.beginPath(); g.ellipse(x, y + 2, 16, 10, 0, 0, Math.PI * 2); fillPaper(g); g.stroke();
    g.beginPath(); g.ellipse(x, y + 2, 10, 5.5, 0, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(x, y - 3.5); g.lineTo(x, y + 7.5); g.lineWidth = 1; g.stroke();
    for (const c of [-1, 1]) { g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + c * 15, y - 2); g.lineTo(x + c * 15, y - 14); g.stroke(); g.fillRect(x + c * 15 - 3, y - 16, 6, 3); }
  },
  fine(g, x, y) {   // a lighthouse: it spots trouble before you hit it
    ink(g, 1.7); g.beginPath(); g.moveTo(x - 7, y + 10); g.lineTo(x - 4, y - 14); g.lineTo(x + 4, y - 14); g.lineTo(x + 7, y + 10); g.closePath(); fillPaper(g); g.stroke();
    for (const k of [0.25, 0.6]) { const yy = y + 10 - k * 24, hw = 7 - k * 3; g.fillRect(x - hw, yy - 2.5, hw * 2, 4); }
    g.beginPath(); g.rect(x - 5, y - 21, 10, 7); fillPaper(g); g.stroke();
    g.beginPath(); g.moveTo(x - 6, y - 21); g.lineTo(x, y - 27); g.lineTo(x + 6, y - 21); g.closePath(); fillInk(g);
    g.lineWidth = 1.2; for (const c of [-1, 1]) { g.beginPath(); g.moveTo(x + c * 7, y - 19); g.lineTo(x + c * 15, y - 22); g.moveTo(x + c * 7, y - 16); g.lineTo(x + c * 15, y - 15); g.stroke(); }
  },
  wh(g, x, y) {     // a warehouse with crates
    ink(g, 1.7); g.beginPath(); g.moveTo(x - 13, y + 10); g.lineTo(x - 13, y - 4); g.lineTo(x - 4, y - 11); g.lineTo(x + 4, y - 4); g.lineTo(x + 13, y - 11); g.lineTo(x + 13, y + 10); g.closePath(); fillPaper(g); g.stroke();
    g.beginPath(); g.rect(x - 6, y, 9, 10); g.stroke(); g.beginPath(); g.moveTo(x - 6, y); g.lineTo(x + 3, y + 10); g.moveTo(x + 3, y); g.lineTo(x - 6, y + 10); g.lineWidth = 1; g.stroke();
    ink(g, 1.4); for (const [cx, cy] of [[18, 10], [18, 4]]) { g.beginPath(); g.rect(x + cx - 4, y + cy - 6, 8, 6); fillPaper(g); g.stroke(); }
  },
  dock(g, x, y) {   // a boathouse on a pier
    ink(g, 1.7); box(g, x - 3, y + 6, 14, 11);
    g.beginPath(); g.moveTo(x - 12, y - 5); g.lineTo(x - 3, y - 13); g.lineTo(x + 6, y - 5); g.closePath(); fillInk(g);
    g.beginPath(); g.moveTo(x + 4, y + 6); g.lineTo(x + 18, y + 6); g.stroke();
    for (const px of [8, 13, 18]) { g.beginPath(); g.moveTo(x + px, y + 6); g.lineTo(x + px, y + 11); g.lineWidth = 1.3; g.stroke(); }
    g.lineWidth = 1.2; g.beginPath(); g.moveTo(x - 14, y + 11); g.quadraticCurveTo(x - 10, y + 8, x - 6, y + 11); g.quadraticCurveTo(x - 2, y + 8, x + 2, y + 11); g.stroke();
  },
  sorted(g, x, y) { // a sorting tent with parcels
    ink(g, 1.7); g.beginPath(); g.moveTo(x - 12, y + 9); g.lineTo(x - 2, y - 13); g.lineTo(x + 8, y + 9); g.closePath(); fillPaper(g); g.stroke();
    g.beginPath(); g.moveTo(x - 2, y - 13); g.lineTo(x - 2, y + 9); g.lineWidth = 1.2; g.stroke();
    g.beginPath(); g.moveTo(x - 2, y - 13); g.lineTo(x - 2, y - 19); g.lineTo(x + 5, y - 17); g.lineTo(x - 2, y - 15); g.lineWidth = 1.4; g.stroke();
    ink(g, 1.4); for (const [cx, cy, w] of [[13, 9, 8], [13, 3, 6], [19, 9, 5]]) { g.beginPath(); g.rect(x + cx - w / 2, y + cy - w * 0.75, w, w * 0.75); fillPaper(g); g.stroke(); }
  },
};
function hut(g, x, y, s, short) {
  if (LANDMARK[short]) { g.save(); g.fillStyle = INKC; LANDMARK[short](g, x, y); g.restore(); return; }
  ink(g, 1.8); g.fillStyle = PAPER;
  g.beginPath(); g.moveTo(x - s, y + s * 0.85); g.lineTo(x - s, y - s * 0.05); g.lineTo(x, y - s); g.lineTo(x + s, y - s * 0.05); g.lineTo(x + s, y + s * 0.85); g.closePath(); g.fill(); g.stroke();
}
function makePaper() {
  const day = mapColours(), dpr = Math.min(devicePixelRatio, 2), key = [W, H, dpr, day].join();
  if (paper && paperKey === key) return; paperKey = key;
  paper = document.createElement("canvas"); paper.width = W * dpr; paper.height = H * dpr;
  const g = paper.getContext("2d"), R = seeded(1553); g.scale(dpr, dpr);
  // torn paper with a double edge, and a few sharp tears
  const m = 10, edge = [], j = (n) => (R() - 0.5) * n;
  for (let x = m; x < W - m; x += 12) edge.push([x, m + j(5) + (R() < 0.08 ? 10 : 0)]);
  for (let y = m; y < H - m; y += 12) edge.push([W - m + j(5) - (R() < 0.08 ? 10 : 0), y]);
  for (let x = W - m; x > m; x -= 12) edge.push([x, H - m + j(5) - (R() < 0.08 ? 10 : 0)]);
  for (let y = H - m; y > m; y -= 12) edge.push([m + j(5) + (R() < 0.08 ? 10 : 0), y]);
  const tear = () => { g.beginPath(); edge.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };
  g.save(); g.shadowColor = day ? "rgba(60,40,10,.22)" : "rgba(0,0,0,.6)"; g.shadowBlur = 22; g.shadowOffsetY = 8; tear(); g.fillStyle = PAPER; g.fill(); g.restore();
  ink(g, 2); tear(); g.stroke();
  g.save(); g.translate(W / 2, H / 2); g.scale(1 - 10 / W, 1 - 10 / H); g.translate(-W / 2, -H / 2); ink(g, 1.2); tear(); g.stroke(); g.restore();
  g.save(); tear(); g.clip();
  const { x: ix, y: iy, s, sx, sy } = isle, cx = ix + sx / 2, cy = iy + sy / 2;
  // the coast: an ellipse the island's shape, kept inside the paper with room for its bays
  const crx = Math.min(sx * 0.47, (W / 2 - 22) / 1.12), cry = Math.min(sy * 0.47, (H / 2 - 22) / 1.12);
  // the coast
  ink(g, 2.4); coastPath(g, cx, cy, crx, cry); g.stroke();
  const onLand = (x, y) => { coastPath(g, cx, cy, crx - 14, cry - 14); return g.isPointInPath(x * dpr, y * dpr); };
  // the trail: a walk from hut to nearest hut, starting top left, so it winds instead of crossing itself
  const proj = nodes.filter((n) => n.k === "p"), walk = [];
  let at0 = proj.slice().sort((a, b) => a.x + a.hy - (b.x + b.hy))[0];
  while (at0) { walk.push(at0); const left = proj.filter((q) => !walk.includes(q)); at0 = left.sort((a, b) => Math.hypot(a.x - walk.at(-1).x, a.hy - walk.at(-1).hy) - Math.hypot(b.x - walk.at(-1).x, b.hy - walk.at(-1).hy))[0]; }
  trail = walk.length > 1 ? smooth(walk.map((n) => [n.x, n.hy])) : [];
  ink(g, 2.6); g.setLineDash([9, 7]); g.beginPath(); trail.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); g.setLineDash([]);
  // what must stay clear: every label and the trail
  const clear = (x, y, r) => !nodes.some((n) => Math.abs(n.x - x) < (n.w || 60) / 2 + r && Math.abs(n.y - y) < (n.h || 30) / 2 + r)
    && !trail.some(([tx, ty]) => Math.hypot(tx - x, ty - y) < r + 6);
  const spot = (r, land, tries = 300) => {
    for (let i = 0; i < tries; i++) {
      const x = r + 22 + R() * (W - 2 * r - 44), y = r + 24 + R() * (H - 2 * r - 48);   // whole thing on the paper
      const whole = [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r], [r * 0.7, r * 0.7], [-r * 0.7, r * 0.7], [r * 0.7, -r * 0.7], [-r * 0.7, -r * 0.7]].every(([dx, dy]) => onLand(x + dx, y + dy) === land);
      if (whole && clear(x, y, r)) return [x, y];   // the whole thing on one side of the coast
    }
    return null;
  };
  const used = [];
  const take = (r, land) => { let p = null; for (let i = 0; i < 40 && !p; i++) { const q = spot(r, land, 40); if (q && !used.some(([ux, uy, ur]) => Math.hypot(ux - q[0], uy - q[1]) < ur + r)) p = q; } if (p) used.push([...p, r]); return p; };
  const k = Math.max(0.7, Math.min(1.25, s / 560));
  // things at sea: the ship, two sharks, waves, and the compass
  let p = take(46 * k, false); if (p) ship(g, p[0], p[1], 26 * k);
  for (let i = 0; i < 2; i++) { p = take(22 * k, false); if (p) shark(g, p[0], p[1]); }
  ink(g, 1.2);
  for (let i = 0; i < 10; i++) { p = take(12, false); if (p) { const [x, y] = p; g.beginPath(); g.moveTo(x - 9, y); g.quadraticCurveTo(x - 4.5, y - 4, x, y); g.quadraticCurveTo(x + 4.5, y - 4, x + 9, y); g.stroke(); } }
  p = take(52 * k, false); if (p) compass(g, p[0], p[1], 30 * k);
  // things on land: mountain ranges, palm groves, a skull
  for (let i = 0; i < 2; i++) { p = take(40 * k, true); if (p) for (let q = 0; q < 3 + (i ? 0 : 1); q++) mountain(g, p[0] - 30 * k + q * 20 * k, p[1] + (q % 2) * 8 * k, 30 * k, (22 + (q % 2 ? 0 : 7)) * k); }
  for (let i = 0; i < 3; i++) { p = take(28 * k, true); if (p) for (let q = 0; q < 2 + (i % 2); q++) palm(g, p[0] - 10 * k + q * 11 * k, p[1] + (q % 2) * 4, (30 + (q % 2) * 6) * k, q % 2 ? 0.5 : -0.4); }
  p = take(20 * k, true); if (p) skull(g, p[0], p[1], 9 * k);
  // the huts
  proj.forEach((n) => hut(g, n.x, n.hy, 10, P[n.i].short));
  g.restore();
}
function bigX(x, y, s) {
  ctx.save(); ctx.strokeStyle = INKC; ctx.lineWidth = s * 0.55; ctx.lineCap = "butt";
  ctx.beginPath(); ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s); ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s); ctx.stroke(); ctx.restore();
}
function draw(t) {
  if (!W || !mapVisible) { requestAnimationFrame(draw); return; }   // off screen: skip
  makePaper();
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(paper, 0, 0, W, H);
  const n = shown(), rel = related(n);
  nodes.forEach((m) => { m.dx = m.x; m.dy = m.y; m.el.style.transform = `translate(${m.dx}px, ${m.dy}px)`; });
  // pointing at something: dashed trails from each skill to the projects that use it
  if (hover) edges.forEach((e) => {
    if (!(rel.has(e.a) && rel.has(e.b) && (n === e.a || n === e.b))) return;
    const ax = e.a.dx, ay = e.a.hy, bx = e.b.dx, by = e.b.dy, mx = (ax + bx) / 2 + (ay - by) * 0.2, my = (ay + by) / 2 + (bx - ax) * 0.2;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(mx, my, bx, by);
    ctx.setLineDash([6, 6]); ctx.lineDashOffset = reduce ? 0 : -t * 0.02; ctx.strokeStyle = INKC; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.stroke();
  });
  ctx.setLineDash([]);
  // X marks the project you're looking at
  const c = nodes.find((m) => m.k === "p" && m.i === cur);
  if (packet) {
    const k = Math.min(1, (t - packet.t0) / 600), e = easeIO(k), { a, b } = packet;
    bigX(a.dx + (b.dx - a.dx) * e + 28, a.hy + (b.hy - a.hy) * e - 18, 8);
    if (k >= 1) packet = null;
  } else if (c) bigX(c.dx + 28, c.hy - 18, 8);
  requestAnimationFrame(draw);
}

function boot() {
  layout(); setCur(cur); requestAnimationFrame(draw);
  // a link like /#economy (the "All projects" pill on each project) comes back to that project on the globe
  const id = location.hash.slice(1), i = P.findIndex((p) => p.id === id);
  if (i >= 0) { go(i); $("projects").scrollIntoView(); }
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
if (document.fonts && document.fonts.load) Promise.all([document.fonts.load('400 17px "IM Fell English SC"'), document.fonts.load('italic 400 14px "IM Fell English"'), document.fonts.ready]).then(boot, boot); else boot();

// ------------------------------------------------------------------ recently watched, from Letterboxd
// tools/letterboxd.mjs (run every few hours by a GitHub Action) keeps data/letterboxd.json fresh
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.4l2.65 5.4 5.95.86-4.3 4.2 1 5.93L12 17l-5.3 2.8 1-5.93-4.3-4.2 5.95-.86z"/></svg>';
const stars = (r) => !r ? "" : `<span class="stars" role="img" aria-label="${r} out of 5">${STAR.repeat(Math.floor(r))}${r % 1 ? `<i>${STAR}</i>` : ""}</span>`;
fetch("../data/letterboxd.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).then((d) => {
  if (!d?.films?.length) return;
  $("film-row").innerHTML = d.films.map((f) => `<li><a href="${esc(f.url)}">
    <span class="poster"><img src="${esc(f.poster)}" alt="" width="300" height="450" loading="lazy" decoding="async">${f.review ? `<span class="review"><span>${esc(f.review).replace(/\{bleep:(\d+)\}/g, (_, n) => `<i class="bleep" role="img" aria-label="censored" style="width: ${Math.min(+n, 12) * 0.5}em"></i>`)}</span></span>` : ""}</span>
    <b>${esc(f.title)} <small>${esc(f.year)}</small></b>${stars(f.rating)}</a></li>`).join("");
  $("films").hidden = false;
}).catch(() => {});   // no list is fine: the section reads the same without it

// ------------------------------------------------------------------ Derby, in the corner
{
  const chip = $("derby-chip"), top = document.querySelector(".hero");
  let gone = false;
  try { gone = localStorage.getItem("derby-chip") === "hidden"; } catch {}
  const place = () => { chip.hidden = gone || scrollY < (top ? top.offsetHeight * 0.7 : 400); };
  if (chip && !gone) { addEventListener("scroll", place, { passive: true }); place(); }
  chip?.querySelector("button").addEventListener("click", () => { gone = true; chip.hidden = true; try { localStorage.setItem("derby-chip", "hidden"); } catch {} });
}
