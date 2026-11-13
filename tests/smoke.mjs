// Browser checks for the parts of the site that more than one page, or more than one site, depends on.
//
//   npm install --no-save playwright && npx playwright install chromium && node tests/smoke.mjs
//   (or point PLAYWRIGHT_MODULE at an installed copy, as tools/build_resume.mjs does)
//
// 1. every page loads with no uncaught error, and has window.PFWarp exactly when it loads warp.js
// 2. a spreadsheet with HTML in its date cells does not run that HTML, and numbers typed as text ("1,250") are read
// 3. the warp does not leave the page covered when the browser blocks site data
// 4. a project clip the browser won't autoplay becomes its screenshot, and Fine Print's keeps the phone style
// 5. every proof number opens a receipt   6. ?for=role links and the three-stop tour   7. the toolkit
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".mp4": "video/mp4", ".pdf": "application/pdf",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".txt": "text/plain" };
const server = createServer((req, res) => {
  let p = normalize(join(root, decodeURIComponent(new URL(req.url, "http://x").pathname)));
  if (!p.startsWith(root)) { res.writeHead(403).end(); return; }
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, "index.html");
  if (!existsSync(p)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { "Content-Type": TYPES[extname(p)] || "application/octet-stream" }).end(readFileSync(p));
}).listen(0);
const base = `http://localhost:${server.address().port}`;

const pages = [];
(function walk(dir) {
  for (const f of readdirSync(join(root, dir))) {
    const rel = join(dir, f);
    if (f === "vendor" || f === "node_modules" || f.startsWith(".") || f === "tests") continue;
    if (statSync(join(root, rel)).isDirectory()) walk(rel); else if (f.endsWith(".html")) pages.push(rel);
  }
})("");

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
let failed = 0;
const check = (name, ok, detail = "") => { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? "  " + detail : ""}`); };
async function open(init, width = 1280) {
  const page = await (await browser.newContext({ viewport: { width, height: 800 } })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  if (init) await page.addInitScript(init);
  return { page, errors };
}

// 1. every page
for (const rel of pages) {
  const loadsWarp = /warp\.js/.test(readFileSync(join(root, rel), "utf8"));
  const { page, errors } = await open();
  await page.goto(`${base}/${rel}`, { waitUntil: "load" });
  await page.waitForTimeout(800);
  const warp = await page.evaluate(() => typeof (window.PFWarp && window.PFWarp.out));
  check(`${rel} loads cleanly`, errors.length === 0, errors.join(" | "));
  check(`${rel} has PFWarp exactly when it loads warp.js`, (warp === "function") === loadsWarp, `loads warp.js: ${loadsWarp}, PFWarp: ${warp}`);
  await page.context().close();
}

// 2. hostile dates and text numbers
{
  const { page, errors } = await open();
  await page.goto(`${base}/demos/discrepancy-checker/`, { waitUntil: "load" });
  await page.click('.seg button[data-src="own"]');
  await page.setInputFiles("#file", join(root, "tests/hostile.xlsx"));
  await page.waitForFunction(() => /Read/.test(document.getElementById("status").textContent));
  for (const tab of ["inventory", "receiving", "billing"]) { await page.click(`.tab[data-tab="${tab}"]`); await page.waitForTimeout(300); }
  await page.waitForTimeout(500);
  check("hostile date cells are shown as text, not run", (await page.evaluate(() => window.__pwned)) === undefined, `ran: ${await page.evaluate(() => window.__pwned)}`);
  await page.click('.tab[data-tab="inventory"]');
  const grid = await page.textContent("#grid");
  check("the hostile text is visible as text", grid.includes("<img src=x"));
  check('"1,250" typed as text is read as a number', !/NaN/.test(grid) && (await page.$$eval("#kpis .kpi .v", (e) => e.map((x) => x.textContent)))[1] === "1", "count discrepancies should be 1");
  check("the demo page has no errors", errors.length === 0, errors.join(" | "));
  await page.context().close();
}

// 3. blocked site data must not leave the warp's dark cover on the page
{
  const { page, errors } = await open(() => {
    Object.defineProperty(window, "sessionStorage", { configurable: true, get() { throw new DOMException("denied", "SecurityError"); } });
    Object.defineProperty(window, "localStorage", { configurable: true, get() { throw new DOMException("denied", "SecurityError"); } });
  });
  await page.goto(`${base}/index.html`, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  const before = await page.evaluate(() => scrollY);
  await page.click('.nav a[href="#contact"]');
  await page.waitForTimeout(2500);
  const covered = await page.evaluate(() => !!document.querySelector(".pf-warp"));
  const moved = (await page.evaluate(() => scrollY)) > before + 500;
  check("far jump with site data blocked: no cover left, page moved", !covered && moved, `cover left: ${covered}, moved: ${moved}`);
  check("no errors with site data blocked", errors.length === 0, errors.join(" | "));
  await page.context().close();
}

// 4. autoplay blocked: the clip becomes its screenshot, and the phone screenshot keeps its style
{
  const { page, errors } = await open(() => { HTMLMediaElement.prototype.play = () => Promise.reject(new Error("autoplay blocked")); });
  await page.goto(`${base}/index.html`, { waitUntil: "load" });
  await page.waitForTimeout(1000);
  await page.click('#gnames button[data-i="0"]');
  await page.waitForTimeout(1500);
  const globe = await page.evaluate(() => { const i = document.querySelector("#gfile .shot img"); return i ? i.className : null; });
  check("globe file: Fine Print falls back to its screenshot with the phone style", globe === "phone", `class: ${globe}`);
  check("no errors when autoplay is blocked", errors.length === 0, errors.join(" | "));
  await page.context().close();
}

// 5. receipts: every proof number opens how it was measured and a link to check it
{
  const { page, errors } = await open();
  await page.goto(`${base}/index.html`, { waitUntil: "load" });
  await page.waitForTimeout(1000);
  await page.evaluate(() => document.querySelector('#gnames button[data-i="0"]').click());
  await page.waitForTimeout(1500);
  await page.evaluate(() => document.querySelector("#gfile .proof summary").click());
  const panel = await page.evaluate(() => { const d = document.querySelector("#gfile .proof"); return { open: d.open, text: d.querySelector(".receipt p").textContent.length, links: d.querySelectorAll(".receipt a").length }; });
  check("a project's proof number opens a receipt with a link", panel.open && panel.text > 80 && panel.links >= 1, JSON.stringify(panel));
  const strip = await page.evaluate(() => [...document.querySelectorAll(".nums details[data-p]")].map((d) => d.querySelectorAll(".receipt a").length));
  check("every number in the receipts strip has a receipt", strip.length === 4 && strip.every((n) => n >= 1), strip.join(","));
  const bad = await page.evaluate(() => window.PROJECTS.filter((p) => !p.receipt || !p.receipt.see.every(([, u]) => /^(https:\/\/|demos\/)/.test(u))).map((p) => p.id));
  check("all eight projects carry a receipt with an https or local link", bad.length === 0, bad.join(","));
  check("no errors on the receipts", errors.length === 0, errors.join(" | "));
  await page.context().close();
}

// 6. a link per application, and a three-stop tour
{
  const { page, errors } = await open();
  await page.goto(`${base}/index.html?for=ai`, { waitUntil: "load" });
  await page.waitForTimeout(1200);
  const set = await page.evaluate(() => ({ pressed: document.querySelector('[data-role="ai"]').getAttribute("aria-pressed"), first: window.PROJECTS[0].id, search: location.search }));
  check("?for=ai opens the page set to that role", set.pressed === "true" && set.first === "fine-print" && set.search === "?for=ai", JSON.stringify(set));
  await page.click('[data-role="bi"]');
  check("picking another role updates the address", (await page.evaluate(() => location.search)) === "?for=bi");
  await page.click("#role-clear");
  check("Show all clears the role and the address", (await page.evaluate(() => location.search)) === "" && (await page.evaluate(() => document.querySelector('[data-role="bi"]').getAttribute("aria-pressed"))) === "false");
  await page.goto(`${base}/index.html?for=analyst`, { waitUntil: "load" });
  await page.waitForTimeout(1000);
  await page.click(".go-tour");
  const tour = await page.evaluate(() => ({ order: JSON.parse(sessionStorage.getItem("pf-order")), on: sessionStorage.getItem("pf-tour") }));
  check("the tour is three stops, starting with the best fit for the role", tour.on === "1" && tour.order.length === 3 && tour.order[0] === "econ", JSON.stringify(tour));
  check("no errors on the role link or tour", errors.length === 0, errors.join(" | "));
  await page.context().close();
}

// 7. the toolkit: skills wired to projects, and a project opens in one place, its file on the globe
for (const [width, label] of [[1280, "laptop"], [390, "phone"]]) {
  const { page, errors } = await open(undefined, width);
  await page.goto(`${base}/index.html`, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  const start = await page.evaluate(() => ({ title: document.querySelector("#hud h3").textContent, projects: document.querySelectorAll("#hud [data-open]").length,
    map: getComputedStyle(document.getElementById("map")).display, chips: getComputedStyle(document.getElementById("chips")).display }));
  check(`${label}: the toolkit opens on the skill behind the whole site`, start.title === "AI output checks" && start.projects === 5, JSON.stringify(start));
  check(`${label}: ${width > 900 ? "the map is shown, not the buttons" : "skill buttons replace the map"}`,
    width > 900 ? start.map !== "none" && start.chips === "none" : start.map === "none" && start.chips !== "none");
  await page.evaluate(() => (getComputedStyle(document.getElementById("chips")).display !== "none"
    ? document.querySelector('#chips button[data-skill="Python"]') : [...document.querySelectorAll("#map .node.s")].find((n) => n.textContent === "Python")).click());
  check(`${label}: picking a skill lists the projects that use it`, (await page.evaluate(() => document.querySelector("#hud h3").textContent)) === "Python");
  await page.evaluate(() => document.querySelector("#hud [data-open]").click());
  await page.waitForTimeout(2800);
  const file = await page.evaluate(() => ({ y: scrollY, shown: document.getElementById("gfile").classList.contains("show"), name: document.querySelector("#gfile h2")?.textContent }));
  check(`${label}: a project from the list opens its file on the globe`, file.shown && file.y < 5 && file.name === "Canada Economy", JSON.stringify(file));
  check(`${label}: no errors in the toolkit`, errors.length === 0, errors.join(" | "));
  await page.context().close();
}

await browser.close();
server.close();
console.log(failed ? `\n${failed} check(s) failed` : "\nall checks passed");
process.exit(failed ? 1 : 0);
