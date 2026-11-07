/* "Back to all projects": a small pill in the corner of every live project and demo, shown only to
   people who came from the portfolio. Someone who opens a project from a résumé, LinkedIn or a
   bookmark sees the project and nothing else.

   Load it from any page on lekanlawal1.github.io:
     <script src="https://lekanlawal1.github.io/portfolio-site/portfolio-bar.js" data-project="econ" defer></script>
   data-project is the project's short id (fine, dock, econ, wh, store, triage, fifa, sorted). Opening the page
   marks that project as seen, and the portfolio's project map shows a filled dot for it.

   "Came from the portfolio" means the portfolio set a flag in this tab's sessionStorage (all projects
   share its origin, and a tab opened from it gets a copy), or the page was opened straight from it. */
(() => {
  const PORTFOLIO = "https://lekanlawal1.github.io/portfolio-site/";
  const TOUR = ["fine", "dock", "econ", "wh", "store", "triage", "fifa", "sorted"];
  const CARD = { fine: "fine-print", econ: "economy", wh: "discrepancy", store: "superstore", triage: "triage", fifa: "football", dock: "docket", sorted: "sorted" };
  // the tour's stops, in the portfolio's order: id, name, where the stop opens
  // and the one thing worth trying at each stop
  let STOPS = [
    ["fine", "Fine Print", PORTFOLIO + "demos/fine-print/", "Open the lease with problems: every void clause comes with the law that voids it."],
    ["econ", "Canada Economy", "https://lekanlawal1.github.io/project5-canada-economy-platform/", "Scroll to Your inflation rate and put in what you actually spend."],
    ["sorted", "Sorted", "https://lekanlawal1.github.io/project2-ai-ticket-triage/", "Press Random real message, then filter the inbox to the mistakes."],
    ["fifa", "The Gaffer", "https://lekanlawal1.github.io/football-agent/", "Tap a suggested question, then open The play to see the SQL it ran."],
    ["store", "Money Snitch", "https://lekanlawal1.github.io/project1-bi-dashboard/", "Load the sample data and find which discounts lose money."],
    ["triage", "App Review Insights", "https://lekanlawal1.github.io/app-review-insights/", "Search an app you use and read what its users complain about."],
    ["dock", "Docket", "https://lekanlawal1.github.io/docket/", "Drop in any PDF. Nothing leaves your device, so try a real one."],
    ["wh", "Discrepancy Checker", PORTFOLIO + "demos/discrepancy-checker/", "Change a blue number in the sheet and watch every check update."],
  ];
  // the portfolio can reorder the tour for the role a visitor is hiring for
  try { const order = JSON.parse(sessionStorage.getItem("pf-order") || "null");
    if (Array.isArray(order)) STOPS = order.map((id) => STOPS.find((s) => s[0] === id)).filter(Boolean).concat(STOPS.filter((s) => !order.includes(s[0]))); } catch {}
  const me = document.currentScript;
  // a page that loads this without data-project is recognised by its address
  const project = (me && me.dataset.project) || (STOPS.find(([, , url]) => location.href.startsWith(url)) || [])[0]
    || (location.href.startsWith("https://lekanlawal1.github.io/docket/") ? "dock" : undefined);
  const base = (me && me.dataset.portfolio) || PORTFOLIO;   // a relative path when served from the portfolio itself

  let fromPortfolio = !!(me && me.dataset.portfolio) || document.referrer.startsWith(PORTFOLIO);
  try {
    if (fromPortfolio) sessionStorage.setItem("pf-from", "1");
    else fromPortfolio = sessionStorage.getItem("pf-from") === "1";
  } catch { /* private mode */ }

  // a visit counts as seen however people arrive
  let visited = [];
  try { visited = JSON.parse(localStorage.getItem("town-visited") || "[]"); } catch {}
  if (project && TOUR.includes(project) && !visited.includes(project)) {
    visited.push(project);
    try { localStorage.setItem("town-visited", JSON.stringify(visited)); } catch {}
  }
  try { if (sessionStorage.getItem("pf-tour") === "1") fromPortfolio = true; } catch {}
  if (!fromPortfolio) return;

  // the warp transition lives in warp.js; pages that don't load it themselves get it here
  if (!window.PFWarp) document.head.appendChild(Object.assign(document.createElement("script"), { src: PORTFOLIO + "warp.js" }));
  const warp = (href, label) => (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
    if (!window.PFWarp) return;
    e.preventDefault(); window.PFWarp.out(href, { label });
  };

  const css = `
.pf-pill { position: fixed; left: 14px; bottom: 14px; z-index: 2147483000; display: flex; align-items: center; gap: 2px; padding: 4px;
  background: rgba(14, 13, 12, .88); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); color: #F2EEE7;
  border: 1px solid rgba(255, 181, 71, .28); border-radius: 999px; box-shadow: 0 10px 30px rgba(0, 0, 0, .28);
  font: 600 13px/1 "Inter Tight", Inter, system-ui, -apple-system, "Segoe UI", sans-serif; transition: opacity .25s, transform .25s; }
.pf-pill a { color: inherit; text-decoration: none; display: inline-flex; align-items: center; gap: 7px; padding: 9px 12px; border-radius: 999px; white-space: nowrap; }
.pf-pill a:hover, .pf-pill a:focus-visible { background: rgba(255, 255, 255, .08); outline: none; }
.pf-pill .pf-con { display: inline-flex; align-items: center; padding: 0 8px; border-left: 1px solid rgba(255, 255, 255, .12); }
.pf-pill .pf-con svg { display: block; overflow: visible; }
.pf-pill .pf-next { background: #FFB547; color: #1A1510; }
.pf-pill .pf-next:hover, .pf-pill .pf-next:focus-visible { background: #FFC266; }
.pf-pill .pf-next b { font-weight: 700; }
.pf-pill .pf-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.pf-pill.away { opacity: 0; transform: translateY(10px); pointer-events: none; }
@keyframes pf-pulse { 0%, 100% { r: 3.2; opacity: 1; } 50% { r: 4.4; opacity: .7; } }
.pf-con .on-now { animation: pf-pulse 1.6s ease-in-out infinite; }
.pf-card { position: fixed; left: 14px; bottom: 68px; z-index: 2147483000; width: min(340px, calc(100vw - 28px)); padding: 16px 16px 14px;
  background: rgba(14, 13, 12, .94); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); color: #F2EEE7;
  border: 1px solid rgba(255, 181, 71, .3); font: 15px/1.45 "Inter Tight", Inter, system-ui, sans-serif; box-shadow: 0 16px 40px rgba(0, 0, 0, .35);
  opacity: 0; transform: translateY(12px); transition: opacity .45s ease, transform .45s cubic-bezier(.2, .8, .2, 1); }
.pf-card.show { opacity: 1; transform: none; }
.pf-card::before { content: ""; position: absolute; top: -1px; right: -1px; width: 18px; height: 18px; border: 2px solid #FFB547; border-left: 0; border-bottom: 0; }
.pf-card small { display: block; font: 600 11px/1.4 "JetBrains Mono", ui-monospace, monospace; letter-spacing: .12em; text-transform: uppercase; color: #FFB547; }
.pf-card b { display: block; font-size: 22px; font-weight: 500; letter-spacing: -.02em; margin: 4px 0 6px; }
.pf-card p { margin: 0; color: #C3BCB0; }
.pf-card p::before { content: "Try this: "; color: #F2EEE7; font-weight: 600; }
.pf-card button { position: absolute; top: 8px; right: 10px; background: none; border: 0; color: #8E877B; font: 18px/1 system-ui; cursor: pointer; padding: 4px; }
.pf-card button:hover { color: #F2EEE7; }
@media (max-width: 480px) { .pf-pill .pf-con { display: none; } .pf-pill a { padding: 9px 10px; } }
@media (prefers-reduced-motion: reduce) { .pf-pill, .pf-card { transition: none; } .pf-con .on-now { animation: none; } }
@media print { .pf-pill, .pf-card { display: none; } }`;
  const style = document.createElement("style");
  style.textContent = css;
  let touring = false;
  try { touring = sessionStorage.getItem("pf-tour") === "1"; } catch {}
  const at = STOPS.findIndex(([id]) => id === project);
  const pill = document.createElement("nav");
  pill.className = "pf-pill";
  pill.setAttribute("aria-label", "Portfolio");
  const back = base + "index.html" + (CARD[project] ? `#${CARD[project]}` : "#work");
  const backA = document.createElement("a");
  backA.href = back; backA.innerHTML = `<span aria-hidden="true">&larr;</span>All projects`;
  backA.addEventListener("click", warp(back, `Back to the map|${at >= 0 ? STOPS[at][1] : "All projects"}`));
  pill.appendChild(backA);
  let card = null;
  // on the tour: a small constellation of the eight stops, and the way to the next one
  if (touring && at >= 0) {
    const n = STOPS.length, w = 76, pts = STOPS.map((_, i) => [4 + (i * (w - 8)) / (n - 1), i % 2 ? 5 : 13]);
    const con = document.createElement("span");
    con.className = "pf-con";
    con.innerHTML = `<svg width="${w}" height="18" viewBox="0 0 ${w} 18" aria-hidden="true">
      <polyline points="${pts.map((p) => p.join(",")).join(" ")}" fill="none" stroke="rgba(255,181,71,.35)" stroke-width="1"/>
      <polyline points="${pts.slice(0, at + 1).map((p) => p.join(",")).join(" ")}" fill="none" stroke="#FFB547" stroke-width="1.4"/>
      ${pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="${i === at ? 3.2 : 2.1}" class="${i === at ? "on-now" : ""}"
        fill="${i <= at ? "#FFB547" : "#0E0D0C"}" stroke="#FFB547" stroke-width="1"/>`).join("")}</svg>
      <span class="pf-sr">Stop ${at + 1} of ${n}</span>`;
    const next = STOPS[at + 1];
    const go = document.createElement("a");
    go.className = "pf-next";
    if (next) {
      go.href = next[2]; go.innerHTML = `Next: <b></b> <span aria-hidden="true">&rarr;</span>`; go.querySelector("b").textContent = next[1];
      go.addEventListener("click", warp(next[2], `Stop ${at + 2} of ${n}|${next[1]}`));
    } else {
      const home = base + "index.html#contact";
      go.href = home; go.innerHTML = `Finish the tour <span aria-hidden="true">&rarr;</span>`;
      go.addEventListener("click", (e) => {
        try { sessionStorage.removeItem("pf-tour"); sessionStorage.setItem("pf-finale", "1"); } catch {}
        warp(home, "Tour complete|Thanks for coming along")(e);
      });
    }
    pill.append(con, go);
    // the stop card: where you are and the one thing to try here
    card = document.createElement("aside");
    card.className = "pf-card"; card.setAttribute("aria-label", `Tour stop ${at + 1} of ${n}`);
    card.innerHTML = `<button type="button" aria-label="Close">&times;</button><small>Stop ${at + 1} of ${n}</small><b></b><p></p>`;
    card.querySelector("b").textContent = STOPS[at][1];
    card.querySelector("p").textContent = STOPS[at][3];
    let timer;
    const hide = () => { card.classList.remove("show"); setTimeout(() => card.remove(), 500); };
    card.querySelector("button").addEventListener("click", hide);
    card.addEventListener("pointerenter", () => clearTimeout(timer));
    card.addEventListener("pointerleave", () => { timer = setTimeout(hide, 2500); });
    card.show = () => { requestAnimationFrame(() => card.classList.add("show")); timer = setTimeout(hide, 9000); };
  }
  // keep out of the way: hide while scrolling down, come back when scrolling up or at rest near the top
  let lastY = scrollY;
  addEventListener("scroll", () => { const y = scrollY; pill.classList.toggle("away", y > lastY && y > 200); lastY = y; }, { passive: true });
  const mount = () => {
    document.head.appendChild(style); document.body.appendChild(pill);
    if (card) { document.body.appendChild(card); setTimeout(card.show, window.PFWarp && window.PFWarp.arriving ? 700 : 300); }
  };
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
})();
