// The Work section from the homepage, on the island: every project wired to the skills it uses, and a
// panel for the one you pick. Same data (projects.js) and behaviour as the homepage's; see home.js.
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const small = () => innerWidth <= 900;
const P = window.PROJECTS;
const pad = (i) => String(i + 1).padStart(2, "0");

const U = (u) => u;   // paths in projects.js are from the site root, where this page lives
const receiptHTML = (p) => !p.receipt ? "" : `<div class="receipt"><p>${esc(p.receipt.how)}</p>${p.receipt.see.map(([t, u]) => `<a href="${U(u)}">${esc(t)}</a>`).join("")}</div>`;
// the receipts strip lower down opens the same receipts from its numbers
document.querySelectorAll(".nums [data-p]").forEach((d) => { const p = P.find((x) => x.id === d.dataset.p); if (p) d.insertAdjacentHTML("beforeend", receiptHTML(p)); });
// the part of a project's panel that the globe's file and the map's panel share; they differ in the
// header, the heading level and the picture's class
// an iPhone app gets a line-drawn mockup: two phones in the same ink as the map, its real screens inside
const SCREENS = { "fine-print": ["assets/fine-print/2-results.png", "assets/fine-print/5-detail-source.png"] };
function phoneMock(p, shot) {
  const screens = SCREENS[p.id] || [p.img];
  return `<a class="${shot} mock" href="${U(p.live[1])}" aria-label="Open ${esc(p.name)}">${screens.map((src, k) =>
    `<span class="device d${k}"><span class="screen"><img src="${U(src)}" alt="" loading="lazy"></span></span>`).join("")}<span class="mono">In the app</span></a>`;
}
function projectBody(p, i, h, shot) {
  return `<${h}>${esc(p.name)}</${h}><p class="meta">${esc(p.kind)} · ${i + 1} of ${P.length}</p><p>${esc(p.line)}</p>
    <details class="proof"><summary><b>${esc(p.proof[0])}</b><span>${esc(p.proof[1])}${p.receipt ? "<em>See the proof</em>" : ""}</span></summary>${receiptHTML(p)}</details>
    ${p.phone ? phoneMock(p, shot) : `<a class="${shot}" href="${U(p.live[1])}" aria-label="Open ${esc(p.name)}">${still
      ? `<img src="${U(p.img)}" alt=""${p.phone ? ' class="phone"' : ""}>`
      : `<video src="assets/previews/${p.id}.mp4" ${p.phone ? "" : `poster="${U(p.img)}"`} autoplay muted loop playsinline preload="auto" aria-hidden="true"></video>`}<span class="mono">Live preview</span></a>`}
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

// ------------------------------------------------------------------ the shelf
// Every project as a glass card with its island landmark, kind and proof number. Skill chips above filter
// the shelf; a card opens its panel underneath. "See the skill table" shows every project against every
// skill; on phones the table turns on its side so it fits.
const grid = $("shelf"), chips = $("filters"), hud = $("hud"), table = $("skill-table"), tableBtn = $("table-toggle");
const COLOR = { fine: "#FF6F9C", econ: "#FF6B6B", sorted: "#B48CFF", fifa: "#3FD6B9", store: "#FFC24A", triage: "#6EA8FF", dock: "#5EB3D6", wh: "#FF8A5C" };
const ICON = {
  econ: '<rect x="17" y="12" width="14" height="30"/><path d="M24 12V4l8 3-8 3"/><path d="M21 18h2M25 18h2M21 24h2M25 24h2M21 30h2M25 30h2"/>',
  store: '<rect x="11" y="22" width="26" height="18"/><path d="M8 22l4-9h24l4 9z"/><path d="M14 13l-2 9M20 13l-1 9M28 13l1 9M34 13l2 9"/><rect x="21" y="30" width="6" height="10"/>',
  triage: '<rect x="13" y="22" width="22" height="18"/><path d="M10 22l14-10 14 10"/><rect x="18" y="3" width="12" height="8"/><path d="M18 3l6 5 6-5"/><rect x="21" y="30" width="6" height="10"/>',
  fifa: '<ellipse cx="24" cy="28" rx="17" ry="10"/><ellipse cx="24" cy="28" rx="10" ry="5"/><path d="M24 23v10M7 26V12M41 26V12"/><path d="M4 11h6M38 11h6"/>',
  fine: '<path d="M17 42l3-26h8l3 26z"/><rect x="19" y="9" width="10" height="7"/><path d="M18 9l6-6 6 6M18 28h12M17 36h14M30 12l9-3M30 15l9 2M18 12L9 9M18 15l-9 2"/>',
  wh: '<path d="M7 40V24l10-8 10 8 10-8v24z"/><rect x="14" y="30" width="10" height="10"/><path d="M14 30l10 10M24 30L14 40"/><rect x="36" y="32" width="8" height="8"/>',
  dock: '<rect x="8" y="22" width="16" height="14"/><path d="M5 22l11-10 11 10"/><path d="M24 34h18M30 34v6M36 34v6M42 34v6M4 42q4-3 8 0t8 0"/>',
  sorted: '<path d="M6 40L20 10l14 30z"/><path d="M20 10V4l7 2-7 2M20 10v30"/><rect x="34" y="32" width="9" height="8"/><rect x="36" y="25" width="6" height="7"/>',
};
const icon = (p, cls = "lm") => `<svg class="${cls}" viewBox="0 0 48 48" style="--c:${COLOR[p.short] || "var(--accent)"}" aria-hidden="true">${ICON[p.short] || ""}</svg>`;
const uses = (sk) => P.filter((p) => p.skills.includes(sk)).length;
const SKILLS = [...new Set(P.flatMap((p) => p.skills))].sort((a, b) => uses(b) - uses(a) || a.localeCompare(b));
const VISIT_ID = Object.fromEntries(P.map((p) => [p.short, p.id]));   // the short id each project site reports, to the portfolio id
let seen = new Set();
try { seen = new Set(JSON.parse(localStorage.getItem("town-visited") || "[]").map((v) => VISIT_ID[v]).filter(Boolean)); } catch {}
let cur = 0, filter = null;

const SHOWN = 10;   // the most-used skills as chips; the rest behind "more"
chips.innerHTML = `<button type="button" class="chip on" data-sk="">All</button>` +
  SKILLS.map((sk, k) => `<button type="button" class="chip${k >= SHOWN ? " extra" : ""}" data-sk="${esc(sk)}">${esc(sk)}</button>`).join("") +
  `<button type="button" class="chip more">+${SKILLS.length - SHOWN} more</button>`;
chips.addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.classList.contains("more")) { chips.classList.add("all"); b.remove(); return; }
  filter = b.dataset.sk && b.dataset.sk !== filter ? b.dataset.sk : null;
  paintShelf();
});
grid.innerHTML = P.map((p, i) => `<button type="button" class="tile" data-i="${i}" aria-label="${esc(p.name)}, ${esc(p.kind)}: open its details">
  ${icon(p)}<b>${esc(p.name)}</b><span class="k">${esc(p.kind)}</span>
  <span class="pr"><strong>${esc(p.proof[0])}</strong><small>${esc(p.proof[1])}</small></span></button>`).join("");
grid.addEventListener("click", (e) => { const t = e.target.closest(".tile"); if (t) go(+t.dataset.i, true); });
function paintShelf() {
  chips.querySelectorAll(".chip[data-sk]").forEach((c) => c.classList.toggle("on", (c.dataset.sk || null) === filter));
  grid.querySelectorAll(".tile").forEach((t, i) => {
    t.classList.toggle("dim", !!filter && !P[i].skills.includes(filter));
    t.classList.toggle("sel", i === cur);
    t.classList.toggle("seen", seen.has(P[i].id));
  });
  table.querySelectorAll("[data-sk]").forEach((c) => c.classList.toggle("hl", c.dataset.sk === filter));
}

// the skill table: projects down the side and skills across on a wide screen; turned on its side on a phone
function drawTable() {
  const dot = (p, sk) => (p.skills.includes(sk) ? '<span class="d" role="img" aria-label="used"></span>' : '<span class="n" aria-hidden="true"></span>');
  table.innerHTML = small()
    ? `<table><thead><tr><th></th>${P.map((p, i) => `<th scope="col"><button type="button" data-i="${i}" aria-label="${esc(p.name)}">${icon(p, "lm sm")}</button></th>`).join("")}</tr></thead>
      <tbody>${SKILLS.map((sk) => `<tr data-sk="${esc(sk)}"><th scope="row">${esc(sk)}</th>${P.map((p) => `<td>${dot(p, sk)}</td>`).join("")}</tr>`).join("")}</tbody></table>`
    : `<table><thead><tr><th></th>${SKILLS.map((sk) => `<th scope="col" class="sk" data-sk="${esc(sk)}"><span>${esc(sk)}</span></th>`).join("")}<th></th></tr></thead>
      <tbody>${P.map((p, i) => `<tr><th scope="row"><button type="button" data-i="${i}">${icon(p, "lm sm")}${esc(p.name)}</button></th>${SKILLS.map((sk) => `<td data-sk="${esc(sk)}">${dot(p, sk)}</td>`).join("")}<td class="ct">${p.skills.length}</td></tr>`).join("")}</tbody></table>`;
  paintShelf();
}
table.addEventListener("click", (e) => { const b = e.target.closest("button[data-i]"); if (b) go(+b.dataset.i, true); });
table.addEventListener("pointerover", (e) => { const c = e.target.closest("[data-sk]"); if (c && e.pointerType === "mouse") { filter = c.dataset.sk; paintShelf(); } });
tableBtn.addEventListener("click", () => {
  const open = table.hidden; table.hidden = !open; tableBtn.setAttribute("aria-expanded", open);
  tableBtn.querySelector("span").textContent = open ? "Hide the skill table" : "See the skill table";
  if (open) drawTable();
});

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
// each panel plays a short silent clip of the live tool; people who ask for less motion or less data get a still
const still = reduce || !!(navigator.connection && navigator.connection.saveData);
function showProject(i) {
  const p = P[i];
  hud.innerHTML = projectBody(p, i, "h3", "shot pop");
  hud.dataset.short = p.short;
}
function go(i, jump) {
  i = (i + P.length) % P.length;
  if (i !== cur) hud.style.setProperty("--sx", (i - cur + P.length) % P.length <= P.length / 2 ? "28px" : "-28px");
  cur = i; paintShelf(); swapPanel(() => showProject(cur), !jump);
  if (jump) { const r = hud.getBoundingClientRect(); if (r.top > innerHeight * 0.6 || r.bottom < 80) hud.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }); }
}
addEventListener("keydown", (e) => {
  if (e.altKey || e.metaKey || e.ctrlKey || /input|textarea|select/i.test(e.target.tagName)) return;
  const r = hud.getBoundingClientRect();
  if (r.top > innerHeight || r.bottom < 0) return;
  if (e.key === "ArrowRight") { e.preventDefault(); go(cur + 1); }
  if (e.key === "ArrowLeft") { e.preventDefault(); go(cur - 1); }
});
// phones: swipe the panel sideways for the next or previous project
let sx = 0, sy = 0;
hud.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
hud.addEventListener("touchend", (e) => {
  const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) go(cur + (dx < 0 ? 1 : -1));
}, { passive: true });
// a link like /#economy (the "All projects" pill on each project) opens that project
{ const i = P.findIndex((p) => p.id === location.hash.slice(1)); go(i >= 0 ? i : 0); if (i >= 0) $("projects").scrollIntoView(); }
let lastW = innerWidth;
addEventListener("resize", () => { if (innerWidth !== lastW && !table.hidden) { lastW = innerWidth; drawTable(); } });

// ------------------------------------------------------------------ recently watched, from Letterboxd
// tools/letterboxd.mjs (run every few hours by a GitHub Action) keeps data/letterboxd.json fresh
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.4l2.65 5.4 5.95.86-4.3 4.2 1 5.93L12 17l-5.3 2.8 1-5.93-4.3-4.2 5.95-.86z"/></svg>';
const stars = (r) => !r ? "" : `<span class="stars" role="img" aria-label="${r} out of 5">${STAR.repeat(Math.floor(r))}${r % 1 ? `<i>${STAR}</i>` : ""}</span>`;
fetch("data/letterboxd.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).then((d) => {
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
