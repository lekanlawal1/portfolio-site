/* "Back to all projects": a small pill in the corner of every live project and demo, shown only to
   people who came from the portfolio. Someone who opens a project from a résumé, LinkedIn or a
   bookmark sees the project and nothing else.

   Load it from any page on lekanlawal1.github.io:
     <script src="https://lekanlawal1.github.io/portfolio-site/portfolio-bar.js" data-project="econ" defer></script>
   data-project is the island building's id (econ, store, triage, fifa, fine, wh, dock). Opening the page
   counts as visiting that project for the island tour, whose progress shows as dots in the pill.

   "Came from the portfolio" means the portfolio set a flag in this tab's sessionStorage (all projects
   share its origin, and a tab opened from it gets a copy), or the page was opened straight from it. */
(() => {
  const PORTFOLIO = "https://lekanlawal1.github.io/portfolio-site/";
  const TOUR = ["fine", "dock", "econ", "wh", "store", "triage", "fifa"];
  const CARD = { fine: "fine-print", econ: "economy", wh: "discrepancy", store: "superstore", triage: "triage", fifa: "football", dock: "docket" };
  const me = document.currentScript;
  const project = me && me.dataset.project;
  const base = (me && me.dataset.portfolio) || PORTFOLIO;   // a relative path when served from the portfolio itself

  let fromPortfolio = !!(me && me.dataset.portfolio) || document.referrer.startsWith(PORTFOLIO);
  try {
    if (fromPortfolio) sessionStorage.setItem("pf-from", "1");
    else fromPortfolio = sessionStorage.getItem("pf-from") === "1";
  } catch { /* private mode */ }

  // a visit still counts for the tour however people arrive
  let visited = [];
  try { visited = JSON.parse(localStorage.getItem("town-visited") || "[]"); } catch {}
  if (project && TOUR.includes(project) && !visited.includes(project)) {
    visited.push(project);
    try { localStorage.setItem("town-visited", JSON.stringify(visited)); } catch {}
  }
  if (!fromPortfolio) return;

  const n = TOUR.filter((id) => visited.includes(id)).length;
  const done = n >= TOUR.length;
  const css = `
.pf-pill { position: fixed; left: 14px; bottom: 14px; z-index: 2147483000; display: flex; align-items: center; gap: 2px; padding: 4px;
  background: rgba(255, 255, 255, .86); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); color: #18181B;
  border: 1px solid rgba(0, 0, 0, .1); border-radius: 999px; box-shadow: 0 6px 24px rgba(0, 0, 0, .12);
  font: 600 13px/1 Inter, system-ui, -apple-system, "Segoe UI", sans-serif; transition: opacity .2s, transform .2s; }
.pf-pill a { color: inherit; text-decoration: none; display: inline-flex; align-items: center; gap: 7px; padding: 8px 11px; border-radius: 999px; white-space: nowrap; }
.pf-pill a:hover, .pf-pill a:focus-visible { background: rgba(0, 0, 0, .06); outline: none; }
.pf-pill .pf-dots { display: inline-flex; gap: 3px; }
.pf-pill .pf-dots i { width: 6px; height: 6px; border-radius: 50%; background: rgba(0, 0, 0, .18); }
.pf-pill .pf-dots i.on { background: #FFB020; }
.pf-pill .pf-sep { width: 1px; height: 18px; background: rgba(0, 0, 0, .12); }
.pf-pill.done .pf-tour { color: #8A5A00; }
.pf-pill.away { opacity: 0; transform: translateY(8px); pointer-events: none; }
@media (prefers-color-scheme: dark) { .pf-pill { background: rgba(24, 24, 27, .82); color: #F4F4F5; border-color: rgba(255, 255, 255, .14); }
  .pf-pill a:hover { background: rgba(255, 255, 255, .1); } .pf-pill .pf-dots i { background: rgba(255, 255, 255, .25); } .pf-pill .pf-sep { background: rgba(255, 255, 255, .16); } }
@media (prefers-reduced-motion: reduce) { .pf-pill { transition: none; } }
@media print { .pf-pill { display: none; } }`;
  const style = document.createElement("style");
  style.textContent = css;
  const pill = document.createElement("nav");
  pill.className = `pf-pill${done ? " done" : ""}`;
  pill.setAttribute("aria-label", "Portfolio");
  const back = base + "index.html" + (project ? `#${CARD[project]}` : "#projects");
  pill.innerHTML = `<a href="${back}"><span aria-hidden="true">&larr;</span>All projects</a><span class="pf-sep" aria-hidden="true"></span>
    <a class="pf-tour" href="${base}index.html#${done ? "reward" : "tour"}" aria-label="Island tour: ${n} of ${TOUR.length} projects explored${done ? ", reward unlocked" : ""}">
      <span class="pf-dots" aria-hidden="true">${TOUR.map((_, i) => `<i class="${i < n ? "on" : ""}"></i>`).join("")}</span>${done ? "Reward" : `${n}/${TOUR.length}`}</a>`;
  // keep out of the way: hide while scrolling down, come back when scrolling up or at rest near the top
  let lastY = scrollY;
  addEventListener("scroll", () => { const y = scrollY; pill.classList.toggle("away", y > lastY && y > 200); lastY = y; }, { passive: true });
  const mount = () => { document.head.appendChild(style); document.body.appendChild(pill); };
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
})();
