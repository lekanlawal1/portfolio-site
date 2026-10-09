/* Shared behaviour for every page: day/night theme, scroll reveals, the town quest, confetti. */
(() => {
  const root = document.documentElement;
  let saved = null;
  try { saved = localStorage.getItem("theme"); } catch {}
  const dark = saved ? saved === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = dark ? "dark" : "light";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const ICONS = `<svg class="sun" viewBox="0 0 24 24" fill="none" stroke="#1D1535" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="4.2" fill="#fff"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg>`
    + `<svg class="moon" viewBox="0 0 24 24"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" fill="#FFE9A8" stroke="#1D1535" stroke-width="2.2" stroke-linejoin="round"/></svg>`;

  function confetti(x, y, n = 60) {
    if (reduced) return;
    const colors = ["#FF5D3A", "#FFC23C", "#22C3A6", "#3E8BFF", "#FF4F8B", "#8A4DFF"];
    for (let i = 0; i < n; i++) {
      const c = document.createElement("div");
      c.className = "confetti";
      c.style.background = colors[i % colors.length];
      document.body.appendChild(c);
      const ang = Math.random() * Math.PI * 2, v = 6 + Math.random() * 9;
      let vx = Math.cos(ang) * v, vy = Math.sin(ang) * v - 7, px = x, py = y, rot = Math.random() * 360, life = 0;
      const step = () => {
        vy += 0.42; vx *= 0.985; px += vx; py += vy; rot += vx * 3; life++;
        c.style.transform = `translate(${px}px, ${py}px) rotate(${rot}deg)`;
        c.style.opacity = String(Math.max(0, 1 - life / 90));
        if (life < 90) requestAnimationFrame(step); else c.remove();
      };
      requestAnimationFrame(step);
    }
  }
  let toastEl, toastTimer;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "toast"; toastEl.setAttribute("role", "status"); document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2600);
  }
  // ---- page transition: a circle in the project's colour bursts out from where you clicked,
  // carries the project's name across the page change, then shrinks away on the next page.
  const WIPE_KEY = "page-wipe";
  function wipeTo(href, { x = innerWidth / 2, y = innerHeight / 2, color = "#FF5D3A", name = "" } = {}) {
    if (reduced) { location.href = href; return; }
    const w = document.createElement("div");
    w.className = "wipe";
    w.style.setProperty("--wx", x + "px"); w.style.setProperty("--wy", y + "px"); w.style.background = color;
    w.innerHTML = name ? `<span>${name.replace(/[<>&]/g, "")}</span>` : "";
    document.body.appendChild(w);
    try { sessionStorage.setItem(WIPE_KEY, JSON.stringify({ color, name, t: Date.now() })); } catch {}
    requestAnimationFrame(() => requestAnimationFrame(() => w.classList.add("grow")));
    setTimeout(() => { location.href = href; }, 620);
  }
  // Arriving after a wipe: cover the page in the same colour before it paints, then reveal it.
  let arriving = null;
  try {
    const a = JSON.parse(sessionStorage.getItem(WIPE_KEY) || "null");
    sessionStorage.removeItem(WIPE_KEY);
    if (a && Date.now() - a.t < 5000 && !reduced) arriving = a;
  } catch {}
  if (arriving) { root.classList.add("arriving"); root.style.setProperty("--arrive", arriving.color); }
  // Back/forward cache restores the old page exactly as it was left, wipe and all: clear it.
  addEventListener("pageshow", (e) => { if (e.persisted) document.querySelectorAll(".wipe").forEach((w) => w.remove()); });

  window.Fun = { confetti, toast, wipeTo };

  document.addEventListener("DOMContentLoaded", () => {
    if (arriving) {
      const cover = document.createElement("div");
      cover.className = "wipe arrive"; cover.style.background = arriving.color;
      cover.innerHTML = arriving.name ? `<span>${arriving.name.replace(/[<>&]/g, "")}</span>` : "";
      document.body.appendChild(cover);
      root.classList.remove("arriving");
      setTimeout(() => cover.classList.add("shrink"), 180);
      setTimeout(() => cover.remove(), 1000);
    }
    // theme toggle in the header
    const nav = document.querySelector("nav.top");
    if (nav) {
      const b = document.createElement("button");
      b.className = "theme-toggle"; b.type = "button"; b.innerHTML = ICONS;
      const label = () => b.setAttribute("aria-label", root.dataset.theme === "dark" ? "Switch to day" : "Switch to night");
      label();
      b.addEventListener("click", () => {
        root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
        try { localStorage.setItem("theme", root.dataset.theme); } catch {}
        label();
      });
      nav.appendChild(b);
    }

    // reveal on scroll
    const io = "IntersectionObserver" in window && !reduced ? new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }, { rootMargin: "0px 0px -8% 0px" }) : null;
    document.querySelectorAll(".card, .stat, .num, .skill-groups > div, article.case h2, .big-shot, .contact-card, .reveal-me").forEach((el, i) => {
      if (!io) return;
      el.classList.add("reveal");
      el.style.transitionDelay = `${(i % 3) * 70}ms`;
      io.observe(el);
    });

    // count-up numbers
    document.querySelectorAll("[data-count]").forEach((el) => {
      const end = Number(el.dataset.count), suffix = el.dataset.suffix || "";
      if (reduced || !("IntersectionObserver" in window)) { el.textContent = end + suffix; return; }
      el.textContent = "0" + suffix;
      const ob = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return; ob.disconnect();
        const t0 = performance.now();
        const tick = (t) => { const k = Math.min(1, (t - t0) / 1200); el.textContent = Math.round(end * (1 - Math.pow(1 - k, 3))) + suffix; if (k < 1) requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
      });
      ob.observe(el);
    });

    // copy email
    document.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", async (e) => {
      try { await navigator.clipboard.writeText(b.dataset.copy); toast("Email copied. Talk soon!"); }
      catch { location.href = "mailto:" + b.dataset.copy; return; }
      confetti(e.clientX, e.clientY, 40);
    }));

    // the town quest on the home page
    const quest = document.getElementById("quest");
    const update = () => {
      if (!quest || !window.Town) return;
      const n = window.Town.visited.size, total = window.Town.total;
      quest.querySelector(".stars").innerHTML = Array.from({ length: total }, (_, i) => `<i class="${i < n ? "on" : ""}"></i>`).join("");
      quest.querySelector(".count").textContent = n >= total ? "Whole town explored!" : `${n}/${total} explored`;
      if (n >= total) {
        let shown = false; try { shown = sessionStorage.getItem("quest-done") === "1"; sessionStorage.setItem("quest-done", "1"); } catch {}
        if (!shown) setTimeout(() => { const r = quest.getBoundingClientRect(); confetti(r.left + r.width / 2, r.top, 90); toast("You've seen every project. Say hi below!"); }, 600);
      }
    };
    if (window.Town) update(); else document.addEventListener("town-ready", update);
    let treeToasts = 0;
    document.addEventListener("tree-planted", (e) => {
      if (e.detail === 1) toast("You planted a tree. Keep going!");
      else if (e.detail === 10 && treeToasts++ === 0) toast("10 trees. This town owes you one.");
    });

    // "All projects" links on project pages wipe back home in the page's colour
    document.querySelectorAll("a.backlink").forEach((a) => a.addEventListener("click", (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      const c = getComputedStyle(document.body).getPropertyValue("--c").trim() || "#FF5D3A";
      wipeTo(a.href, { x: e.clientX, y: e.clientY, color: c, name: "All projects" });
    }));

    // arriving from a building: flash the matching card
    if (location.hash) {
      const card = document.querySelector(location.hash);
      if (card && card.classList.contains("card")) setTimeout(() => card.classList.add("flash"), 400);
    }
  });
})();
