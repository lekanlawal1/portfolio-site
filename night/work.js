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
let isle = { x: 0, y: 0, s: 0 };
const at = (gx, gz) => [isle.x + (gx / 12) * isle.s, isle.y + (gz / 12) * isle.s];
// nudge the signposts apart, and off the buildings, until no two labels overlap; sizes are measured
function spread(side) {
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
      const minY = isle.y + a.h / 2 + pad, maxY = isle.y + side - a.h / 2 - pad, pinned = a.y <= minY + 0.5 || a.y >= maxY - 0.5;
      if (ox < oy * 2.2 || pinned) a.x += Math.sign(a.x - o.x || 1) * ox * k; else a.y += Math.sign(a.y - o.y || 1) * oy * k;
    }
    for (const a of signs) {
      a.x = Math.min(isle.x + side - a.w / 2 - pad, Math.max(isle.x + a.w / 2 + pad, a.x));
      a.y = Math.min(isle.y + side - a.h / 2 - pad, Math.max(isle.y + a.h / 2 + pad, a.y));
    }
    if (!moved) break;
  }
  // anything still touching something: the nearest free spot, searched in widening rings
  const hits = (a, x, y) => nodes.some((o) => o !== a && Math.abs(x - o.x) < (a.w + o.w) / 2 && Math.abs(y - o.y) < (a.h + o.h) / 2);
  const inside = (a, x, y) => x - a.w / 2 >= isle.x + pad && x + a.w / 2 <= isle.x + side - pad && y - a.h / 2 >= isle.y + pad && y + a.h / 2 <= isle.y + side - pad;
  for (const a of signs) {
    if (!hits(a, a.x, a.y)) continue;
    search: for (let r = 12; r < side / 2; r += 10) for (let k = 0; k < 16; k++) {
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
  isle = { x: (W - side) / 2, y: (H - side) / 2, s: side };
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
  if (!S) spread(side);
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
// the map's lines follow the island's day or night
const INK = () => (document.documentElement.dataset.theme === "light" ? "29,21,53" : "242,238,231");
const AMB = () => (document.documentElement.dataset.theme === "light" ? "255,93,58" : "255,181,71");
function rr(x, y, w, h, r, fill, stroke, lw) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
// the island from above: soil edge, grass, the lake by Docket's boathouse and the ring road
function ground() {
  const day = document.documentElement.dataset.theme === "light", { x, y, s } = isle, r = s * 0.06;
  rr(x, y + s * 0.03, s, s, r, day ? "#C98B5B" : "#2A1C11");
  rr(x, y, s, s, r, day ? "#86D69A" : "#17291C");
  const [lx, ly] = at(7.5, 1.35); rr(lx, ly, s * 0.2, s * 0.175, s * 0.05, day ? "#7FD0F5" : "#14313F");
  const k = s * 0.07; rr(x + k, y + k, s - 2 * k, s - 2 * k, r * 0.7, null, day ? "#5B5872" : "#2B2A30", s * 0.035);
  ctx.setLineDash([s * 0.02, s * 0.025]); rr(x + k, y + k, s - 2 * k, s - 2 * k, r * 0.7, null, day ? "#FFD66B" : "rgba(255,181,71,.35)", 1.5); ctx.setLineDash([]);
}
function draw(t) {
  if (!W || !mapVisible) { requestAnimationFrame(draw); return; }   // off screen: skip
  ctx.clearRect(0, 0, W, H);
  ground();
  const n = shown(), rel = related(n);
  nodes.forEach((m) => {
    const dy = reduce || m.k === "p" ? 0 : Math.sin(t * 0.0008 + m.ph) * 1.5;   // signposts sway a little; buildings stay put
    m.dx = m.x; m.dy = m.y + dy; m.el.style.transform = `translate(${m.dx}px, ${m.dy}px)`;
  });
  // roads from each signpost to the buildings that use it; little lights travel the lit ones
  edges.forEach((e) => {
    const ax = e.a.dx, ay = e.a.dy, bx = e.b.dx, by = e.b.dy;
    const on = !!rel && rel.has(e.a) && rel.has(e.b) && (n === e.a || n === e.b), dim = !!n && !on;
    const mx = (ax + bx) / 2 + (ay - by) * 0.1, my = (ay + by) / 2 + (bx - ax) * 0.1;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(mx, my, bx, by);
    ctx.lineCap = "round"; ctx.strokeStyle = on ? `rgba(${AMB()},.8)` : dim ? `rgba(${INK()},.05)` : `rgba(${INK()},.13)`;
    ctx.lineWidth = on ? 3 : 2; ctx.stroke();
    if (on) e.q.forEach((q) => {
      const s = reduce ? q : (q + t * 0.00025) % 1, u = 1 - s;
      glow(u * u * ax + 2 * u * s * mx + s * s * bx, u * u * ay + 2 * u * s * my + s * s * by, 7, 1);
    });
  });
  if (packet) {
    // a bright packet with a short tail, straight from the old project's building to the new one's
    const k = Math.min(1, (t - packet.t0) / 650), { a, b } = packet, e = easeIO(k);
    for (let j = 0; j < 14; j++) {
      const q = Math.max(0, e - j * 0.02);
      glow(a.dx + (b.dx - a.dx) * q, a.dy + (b.dy - a.dy) * q, (j ? 9 : 18) * (1 - j / 16), (1 - j / 14) * (1 - Math.max(0, k - 0.85) / 0.15));
    }
    if (k >= 1) packet = null;
  }
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
if (document.fonts && document.fonts.ready) document.fonts.ready.then(boot); else boot();

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
