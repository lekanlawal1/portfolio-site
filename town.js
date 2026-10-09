/* The floating town on the home page. Every building is a project; click one to open it,
   click the grass to plant a tree. Drawn as isometric SVG from simple boxes, no images. */
(() => {
  const svg = document.getElementById("town");
  if (!svg) return;
  const NS = "http://www.w3.org/2000/svg";
  const S = 30;                     // pixels per grid unit
  const C30 = Math.cos(Math.PI / 6);
  const P = (x, y, z = 0) => [(x - y) * C30 * S, (x + y) * 0.5 * S - z * S];
  const pts = (arr) => arr.map((p) => P(...p).map((n) => n.toFixed(1)).join(",")).join(" ");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function el(tag, attrs = {}, parent) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  }
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = (c) => Math.max(0, Math.min(255, Math.round(c + (amt > 0 ? (255 - c) * amt : c * amt))));
    return "#" + [n >> 16, (n >> 8) & 255, n & 255].map(f).map((c) => c.toString(16).padStart(2, "0")).join("");
  }
  const STROKE = { stroke: "#1D1535", "stroke-width": 1.6, "stroke-linejoin": "round" };

  // An isometric box: top, left (y+d plane) and right (x+w plane) faces.
  function box(g, x, y, z, w, d, h, color, opts = {}) {
    const grp = el("g", {}, g);
    el("polygon", { points: pts([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]]), fill: opts.left || shade(color, -0.12), ...STROKE }, grp);
    el("polygon", { points: pts([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]]), fill: opts.right || shade(color, -0.3), ...STROKE }, grp);
    el("polygon", { points: pts([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]]), fill: opts.top || shade(color, 0.18), ...STROKE }, grp);
    return grp;
  }
  // Windows on the left face (y + d plane), in a grid.
  function windowsLeft(g, x, y, z, w, d, h, cols, rows, cls = "win") {
    const cw = w / (cols * 2 + 1), rh = h / (rows * 2 + 1);
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
      const x0 = x + cw * (1 + c * 2), z0 = z + rh * (1 + r * 2);
      el("polygon", { points: pts([[x0, y + d, z0], [x0 + cw, y + d, z0], [x0 + cw, y + d, z0 + rh], [x0, y + d, z0 + rh]]), class: cls, ...STROKE, "stroke-width": 1 }, g);
    }
  }
  function windowsRight(g, x, y, z, w, d, h, cols, rows, cls = "win") {
    const cw = d / (cols * 2 + 1), rh = h / (rows * 2 + 1);
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
      const y0 = y + cw * (1 + c * 2), z0 = z + rh * (1 + r * 2);
      el("polygon", { points: pts([[x + w, y0, z0], [x + w, y0 + cw, z0], [x + w, y0 + cw, z0 + rh], [x + w, y0, z0 + rh]]), class: cls, ...STROKE, "stroke-width": 1 }, g);
    }
  }
  function tree(g, x, y, s = 1, color = "#2FBF71") {
    const t = el("g", {}, g);
    box(t, x - 0.08 * s, y - 0.08 * s, 0, 0.16 * s, 0.16 * s, 0.5 * s, "#8A5A3B");
    const [bx, by] = P(x, y, 0.5 * s);
    const [tx, ty] = P(x, y, 1.9 * s);
    const r = 0.62 * s * S * C30;
    el("polygon", { points: `${bx - r},${by} ${tx},${ty} ${bx + r},${by}`, fill: color, ...STROKE }, t);
    el("polygon", { points: `${tx},${ty} ${bx + r},${by} ${bx},${by + r * 0.35}`, fill: shade(color, -0.25), ...STROKE }, t);
    return t;
  }

  // ------------------------------------------------------------------ the island
  const N = 12;
  const root = el("g", { class: "bob" }, svg);
  const under = el("g", {}, root);
  // rocky underside: two faces meeting at a tip below the centre
  const tip = [N / 2 + 0.6, N / 2 + 0.6, -6.2];
  const jag = (a, b, n, axis) => {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = a.map((v, k) => v + (b[k] - v) * t);
      if (i > 0 && i < n) p[2] -= (i % 2 ? 0.55 : 0.15);
      out.push(p);
    }
    return out;
  };
  el("polygon", { points: pts([...jag([0, N, -1.4], [N, N, -1.4], 6), tip]), fill: "#B7794B", ...STROKE }, under);
  el("polygon", { points: pts([...jag([N, N, -1.4], [N, 0, -1.4], 6), tip]), fill: "#8E5734", ...STROKE }, under);
  // strata lines for texture
  for (const z of [-2.6, -3.8]) {
    const k = (z + 6.2) / (6.2 - 1.4);
    const L = (p) => p.map((v, i) => tip[i] + (v - tip[i]) * k);
    el("polyline", { points: pts([L([0, N, -1.4]), L([N, N, -1.4]), L([N, 0, -1.4])]), fill: "none", stroke: "#1D1535", "stroke-width": 1.2, opacity: 0.35 }, under);
  }
  // dirt band + grass slab
  box(under, 0, 0, -1.4, N, N, 1.0, "#C98B5B", { left: "#C98B5B", right: "#A86B42" });
  const grass = box(under, 0, 0, -0.4, N, N, 0.4, "#6FD08C", { top: "#86E09E", left: "#4FB86E", right: "#3E9C5B" });
  grass.lastChild.classList.add("ground");
  // waterfall off the front-left edge
  const defs = el("defs", {}, svg);
  const lg = el("linearGradient", { id: "fallfade", x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  el("stop", { offset: "0", "stop-color": "#7FD3FF", "stop-opacity": 1 }, lg);
  el("stop", { offset: "1", "stop-color": "#7FD3FF", "stop-opacity": 0 }, lg);
  const wf = P(1.6, N, 0), wf2 = P(2.8, N, 0);
  // water spills over the edge (on the dirt face), then falls and fades into mist
  el("polygon", { points: `${wf[0]},${wf[1]} ${wf2[0]},${wf2[1]} ${wf2[0]},${wf2[1] + 140} ${wf[0]},${wf[1] + 140}`, fill: "url(#fallfade)" }, under);
  for (const k of [0.25, 0.55, 0.8]) {
    const x = wf[0] + (wf2[0] - wf[0]) * k, y = wf[1] + (wf2[1] - wf[1]) * k;
    el("line", { x1: x, y1: y, x2: x, y2: y + 120, stroke: "#fff", "stroke-width": 2, class: "fall", opacity: 0.8 }, under);
  }
  // river to the waterfall and a pond
  el("polygon", { points: pts([[1.6, 8.4, 0.01], [2.8, 8.4, 0.01], [2.8, N, 0.01], [1.6, N, 0.01]]), fill: "#7FD3FF", ...STROKE, "stroke-width": 1.2 }, under);
  el("polygon", { points: pts([[0.8, 6.9, 0.01], [3.6, 6.9, 0.01], [3.6, 8.6, 0.01], [0.8, 8.6, 0.01]]), fill: "#7FD3FF", ...STROKE, "stroke-width": 1.2 }, under);
  // road: front L from the warehouse dock
  const road = [[6.6, 11.1], [11.1, 11.1], [11.1, 6.4]];
  el("polyline", { points: pts(road.map(([x, y]) => [x, y, 0.01])), fill: "none", stroke: "#1D1535", "stroke-width": 15, "stroke-linejoin": "round", "stroke-linecap": "round" }, under);
  el("polyline", { points: pts(road.map(([x, y]) => [x, y, 0.01])), fill: "none", stroke: "#5B5872", "stroke-width": 12, "stroke-linejoin": "round", "stroke-linecap": "round" }, under);
  el("polyline", { points: pts(road.map(([x, y]) => [x, y, 0.01])), fill: "none", stroke: "#FFD66B", "stroke-width": 1.6, "stroke-dasharray": "6 7" }, under);

  const world = el("g", {}, root);   // depth-sorted objects
  const tipLayer = el("g", {}, root); // labels always sit on top
  const objects = [];                // { g, depth, x, y, w, d }
  function place(g, x, y, w, d) {
    const depth = x + w / 2 + y + d / 2;
    const next = objects.find((o) => o.depth > depth);
    world.insertBefore(g, next ? next.g : null);
    objects.push({ g, depth, x, y, w, d });
    objects.sort((a, b) => a.depth - b.depth);
  }

  // ------------------------------------------------------------------ buildings
  const builders = {
    econ(g, x, y) { // Canada Economy: a tower with a bar chart on the roof and a flag
      box(g, x, y, 0, 2, 2, 5.2, "#F4F1EA");
      windowsLeft(g, x, y, 0.2, 2, 2, 4.8, 3, 5);
      windowsRight(g, x, y, 0.2, 2, 2, 4.8, 3, 5);
      box(g, x + 0.25, y + 1.3, 5.2, 0.35, 0.35, 0.6, "#E63946");
      box(g, x + 0.8, y + 1.3, 5.2, 0.35, 0.35, 1.1, "#E63946");
      box(g, x + 1.35, y + 1.3, 5.2, 0.35, 0.35, 0.8, "#E63946");
      const [px, py] = P(x + 0.4, y + 0.4, 5.2), [qx, qy] = P(x + 0.4, y + 0.4, 7.2);
      el("line", { x1: px, y1: py, x2: qx, y2: qy, stroke: "#1D1535", "stroke-width": 2 }, g);
      el("path", { d: `M${qx},${qy} l26,6 l-26,8 z`, fill: "#E63946", ...STROKE }, g);
      el("rect", { x: qx + 8, y: qy + 3.5, width: 6, height: 7, fill: "#fff", rx: 1 }, g);
      return 7.6;
    },
    store(g, x, y) { // Superstore: shop with a striped awning
      box(g, x, y, 0, 3, 2, 1.9, "#FFF2D6");
      box(g, x - 0.05, y - 0.05, 1.9, 3.1, 2.1, 0.25, "#FFB020");
      for (let i = 0; i < 6; i++) {
        const a = x + i * 0.5;
        el("polygon", { points: pts([[a, y + 2, 1.55], [a + 0.5, y + 2, 1.55], [a + 0.5, y + 2.55, 1.15], [a, y + 2.55, 1.15]]), fill: i % 2 ? "#fff" : "#FF5D3A", ...STROKE, "stroke-width": 1.2 }, g);
      }
      windowsLeft(g, x, y, 0.2, 3, 2, 1.0, 3, 1);
      const [sx, sy] = P(x + 1.5, y + 1, 2.6);
      el("rect", { x: sx - 26, y: sy - 12, width: 52, height: 20, rx: 6, fill: "#FFB020", ...STROKE }, g);
      el("text", { x: sx, y: sy + 3, "text-anchor": "middle", "font-size": 11, "font-weight": 800, fill: "#1D1535", "font-family": "Bricolage Grotesque, Inter, sans-serif" }, g).textContent = "SHOP";
      return 3.4;
    },
    triage(g, x, y) { // Ticket Triage: a post office with a sorting chute and a mailbox
      box(g, x, y, 0, 2.2, 2, 2.2, "#D9E8FF");
      box(g, x - 0.1, y - 0.1, 2.2, 2.4, 2.2, 0.3, "#3E8BFF");
      windowsLeft(g, x, y, 0.3, 2.2, 2, 1.5, 2, 1);
      windowsRight(g, x, y, 0.3, 2.2, 2, 1.5, 2, 1);
      const [ex, ey] = P(x + 1.1, y + 1, 3.3);
      el("rect", { x: ex - 16, y: ey - 11, width: 32, height: 22, rx: 3, fill: "#fff", ...STROKE }, g);
      el("path", { d: `M${ex - 16},${ey - 11} L${ex},${ey + 2} L${ex + 16},${ey - 11}`, fill: "none", ...STROKE }, g);
      box(g, x + 2.5, y + 1.6, 0, 0.35, 0.35, 0.7, "#3E8BFF");
      return 3.8;
    },
    fifa(g, x, y) { // Football Stats Agent: a stadium with floodlights and a SQL scoreboard
      box(g, x, y, 0, 3, 3, 0.5, "#E9E3D7");
      el("polygon", { points: pts([[x + 0.35, y + 0.35, 0.5], [x + 2.65, y + 0.35, 0.5], [x + 2.65, y + 2.65, 0.5], [x + 0.35, y + 2.65, 0.5]]), fill: "#3DBE6A", ...STROKE }, g);
      el("polyline", { points: pts([[x + 1.5, y + 0.35, 0.5], [x + 1.5, y + 2.65, 0.5]]), stroke: "#fff", "stroke-width": 1.6, fill: "none" }, g);
      const [cx, cy] = P(x + 1.5, y + 1.5, 0.5);
      el("ellipse", { cx, cy, rx: 13, ry: 7.5, fill: "none", stroke: "#fff", "stroke-width": 1.6 }, g);
      el("circle", { cx: cx + 10, cy: cy + 2, r: 3.2, fill: "#fff", ...STROKE, "stroke-width": 1 }, g);
      for (const [a, b] of [[0.1, 0.1], [2.9, 2.9]]) {
        const [lx, ly] = P(x + a, y + b, 0.5), [hx, hy] = P(x + a, y + b, 2.6);
        el("line", { x1: lx, y1: ly, x2: hx, y2: hy, stroke: "#1D1535", "stroke-width": 2 }, g);
        el("rect", { x: hx - 7, y: hy - 6, width: 14, height: 8, rx: 2, fill: "#FFE66B", ...STROKE, "stroke-width": 1.2, class: "blink" }, g);
      }
      const [sx, sy] = P(x + 1.5, y + 0.05, 1.5);
      el("rect", { x: sx - 22, y: sy - 8, width: 44, height: 15, rx: 3, fill: "#22C3A6", ...STROKE, "stroke-width": 1.2 }, g);
      el("text", { x: sx, y: sy + 3, "text-anchor": "middle", "font-size": 8, "font-weight": 800, fill: "#1D1535", "font-family": "JetBrains Mono, monospace" }, g).textContent = "SELECT";
      return 3;
    },
    fine(g, x, y) { // Fine Print: a giant phone showing a contract
      box(g, x, y, 0, 0.5, 1.7, 3.4, "#1D1535", { left: "#2A2148", right: "#140F28", top: "#3A2F63" });
      el("polygon", { points: pts([[x + 0.5, y + 0.15, 0.25], [x + 0.5, y + 1.55, 0.25], [x + 0.5, y + 1.55, 3.15], [x + 0.5, y + 0.15, 3.15]]), fill: "#FFF7EA", ...STROKE, "stroke-width": 1 }, g);
      for (let i = 0; i < 5; i++) {
        const z = 2.8 - i * 0.42;
        el("line", { x1: P(x + 0.5, y + 0.35, z)[0], y1: P(x + 0.5, y + 0.35, z)[1], x2: P(x + 0.5, y + (i === 2 ? 1.0 : 1.35), z)[0], y2: P(x + 0.5, y + (i === 2 ? 1.0 : 1.35), z)[1],
          stroke: i === 2 ? "#FF4F8B" : "#B9AFC9", "stroke-width": i === 2 ? 3.4 : 2.2, "stroke-linecap": "round" }, g);
      }
      const [cx, cy] = P(x + 0.5, y + 1.25, 1.6);
      el("circle", { cx, cy, r: 7, fill: "#FF4F8B", ...STROKE, "stroke-width": 1.2 }, g);
      el("path", { d: `M${cx - 3},${cy} l2,2.5 l4,-5`, fill: "none", stroke: "#fff", "stroke-width": 1.8, "stroke-linecap": "round" }, g);
      return 3.9;
    },
    wh(g, x, y) { // Discrepancy Checker: a warehouse with a dock door and pallets
      box(g, x, y, 0, 3, 2.6, 1.9, "#FFD7B8");
      el("polygon", { points: pts([[x, y, 1.9], [x + 3, y, 1.9], [x + 3, y + 1.3, 2.7], [x, y + 1.3, 2.7]]), fill: "#FF6B35", ...STROKE }, g);
      el("polygon", { points: pts([[x, y + 1.3, 2.7], [x + 3, y + 1.3, 2.7], [x + 3, y + 2.6, 1.9], [x, y + 2.6, 1.9]]), fill: "#E5531F", ...STROKE }, g);
      el("polygon", { points: pts([[x + 3, y, 1.9], [x + 3, y + 1.3, 2.7], [x + 3, y + 2.6, 1.9]]), fill: "#C84718", ...STROKE }, g);
      // roll-up door on the left face with stripes
      el("polygon", { points: pts([[x + 0.6, y + 2.6, 0], [x + 1.9, y + 2.6, 0], [x + 1.9, y + 2.6, 1.3], [x + 0.6, y + 2.6, 1.3]]), fill: "#8C8AA0", ...STROKE }, g);
      for (let z = 0.25; z < 1.3; z += 0.25) el("polyline", { points: pts([[x + 0.6, y + 2.6, z], [x + 1.9, y + 2.6, z]]), stroke: "#1D1535", "stroke-width": 0.8, fill: "none", opacity: 0.6 }, g);
      windowsRight(g, x, y, 0.8, 3, 2.6, 0.8, 3, 1);
      box(g, x + 2.2, y + 2.75, 0, 0.55, 0.55, 0.45, "#C9955F");
      box(g, x + 2.25, y + 2.8, 0.45, 0.45, 0.45, 0.4, "#E0AE72");
      return 3.3;
    },
  };

  const PROJECTS = [
    { id: "econ", color: "#E63946", x: 1.2, y: 1.0, w: 2, d: 2, name: "Canada Economy Platform", sub: "Live StatCan data", href: "projects/project5.html" },
    { id: "store", color: "#FFB020", x: 5.0, y: 0.8, w: 3, d: 2, name: "Superstore Margin Console", sub: "BI dashboard", href: "projects/project1.html" },
    { id: "triage", color: "#3E8BFF", x: 1.0, y: 4.0, w: 2.2, d: 2, name: "AI Ticket Triage", sub: "LLM with guardrails", href: "projects/project2.html" },
    { id: "fifa", color: "#22C3A6", x: 4.8, y: 4.6, w: 3, d: 3, name: "Football Stats Agent", sub: "Ask football in English", href: "projects/football-agent.html" },
    { id: "fine", color: "#FF4F8B", x: 4.2, y: 9.2, w: 0.5, d: 1.7, name: "Fine Print", sub: "iOS contract checker", href: "projects/fine-print.html" },
    { id: "wh", color: "#FF6B35", x: 8.4, y: 6.6, w: 3, d: 2.6, name: "Discrepancy Checker", sub: "Excel + browser tool", href: "demos/discrepancy-checker/" },
  ];

  // keep only buildings that still exist (the old robot, "agent", merged into the stadium)
  const visited = new Set(JSON.parse((() => { try { return localStorage.getItem("town-visited") || "[]"; } catch { return "[]"; } })())
    .filter((id) => PROJECTS.some((p) => p.id === id)));
  const saveVisited = () => { try { localStorage.setItem("town-visited", JSON.stringify([...visited])); } catch {} };

  for (const p of PROJECTS) {
    const a = el("a", { href: p.href, class: "bld" + (visited.has(p.id) ? " visited" : ""), "aria-label": `${p.name}: ${p.sub}` });
    a.dataset.id = p.id;
    const lift = el("g", { class: "lift" }, a);
    // soft shadow
    el("polygon", { points: pts([[p.x - 0.15, p.y - 0.15, 0.01], [p.x + p.w + 0.25, p.y - 0.15, 0.01], [p.x + p.w + 0.25, p.y + p.d + 0.25, 0.01], [p.x - 0.15, p.y + p.d + 0.25, 0.01]]), fill: "#1D1535", opacity: 0.16 }, a);
    a.insertBefore(a.lastChild, lift);
    const top = builders[p.id](lift, p.x, p.y);
    // label and "visited" star float above the building
    const [lx, ly] = P(p.x + p.w / 2, p.y + p.d / 2, top + 0.6);
    const flag = el("g", { class: "flag-done" }, lift);
    el("path", { d: starPath(lx + 2, ly - 4, 8, 3.6), fill: "#FFC23C", ...STROKE, "stroke-width": 1.4 }, flag);
    const tipG = el("g", { class: "tip" }, tipLayer);
    const show = (on) => tipG.classList.toggle("on", on);
    a.addEventListener("pointerenter", () => show(true)); a.addEventListener("pointerleave", () => show(false));
    a.addEventListener("focus", () => show(true)); a.addEventListener("blur", () => show(false));
    a._tip = tipG;
    const w = Math.max(p.name.length * 7.3, p.sub.length * 6) + 22;
    el("rect", { x: lx - w / 2, y: ly - 44, width: w, height: 36, rx: 9 }, tipG);
    el("text", { x: lx, y: ly - 29, "text-anchor": "middle" }, tipG).textContent = p.name;
    el("text", { x: lx, y: ly - 15, "text-anchor": "middle", class: "sub" }, tipG).textContent = p.sub;
    a.addEventListener("click", (e) => {
      visited.add(p.id); saveVisited();
      if (e.metaKey || e.ctrlKey || e.shiftKey || !window.Fun) return;   // new tab: leave the link alone
      e.preventDefault();
      Fun.wipeTo(p.href, { x: e.clientX || innerWidth / 2, y: e.clientY || innerHeight / 2, color: p.color, name: p.name });
    });
    place(a, p.x, p.y, p.w, p.d);
  }
  function starPath(cx, cy, R, r) {
    let d = "";
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + (i * Math.PI) / 5, rad = i % 2 ? r : R;
      d += (i ? "L" : "M") + (cx + rad * Math.cos(ang)).toFixed(1) + "," + (cy + rad * Math.sin(ang)).toFixed(1);
    }
    return d + "Z";
  }

  // scenery trees
  const TREES = [[0.6, 0.5, 0.8], [4.0, 0.6, 0.9], [8.6, 0.5, 0.7], [11.3, 0.7, 0.8], [10.2, 1.6, 0.85], [0.5, 3.2, 0.7], [3.9, 3.2, 0.8], [8.6, 3.7, 0.9],
    [11.2, 3.6, 0.7], [4.0, 6.3, 0.7], [0.6, 10.2, 0.8], [6.0, 9.2, 0.7], [7.3, 10.0, 0.9], [11.4, 11.4, 0.6], [3.4, 11.2, 0.6], [9.6, 5.0, 0.6]];
  const COLORS = ["#2FBF71", "#22A863", "#5AD17F", "#FFB020", "#FF7AA8"];
  TREES.forEach(([x, y, s], i) => { const g = el("g"); tree(g, x, y, s, COLORS[i % 3]); place(g, x - 0.3, y - 0.3, 0.6, 0.6); });

  // ------------------------------------------------------------------ the delivery truck
  const truck = el("g", { class: "truck" });
  const tX = el("g", {}, truck), tY = el("g", {}, truck);
  // facing +x (cab at the front) and facing -y
  box(tX, -0.55, -0.25, 0.08, 0.8, 0.5, 0.6, "#FFFFFF"); box(tX, 0.27, -0.25, 0.08, 0.35, 0.5, 0.45, "#FF6B35");
  box(tY, -0.25, -0.62, 0.08, 0.5, 0.35, 0.45, "#FF6B35"); box(tY, -0.25, -0.25, 0.08, 0.5, 0.8, 0.6, "#FFFFFF");
  world.appendChild(truck);
  const legs = road.slice(1).map((p, i) => ({ a: road[i], b: p, len: Math.hypot(p[0] - road[i][0], p[1] - road[i][1]) }));
  const total = legs.reduce((s, l) => s + l.len, 0);
  let t0 = null;
  function drive(ts) {
    if (t0 == null) t0 = ts;
    const cycle = 14000, u = ((ts - t0) % cycle) / cycle;
    const dist = (u < 0.5 ? u * 2 : 2 - u * 2) * total;   // out and back
    let acc = 0, pos = road[0], leg = legs[0];
    for (const l of legs) { if (dist <= acc + l.len) { const k = (dist - acc) / l.len; pos = [l.a[0] + (l.b[0] - l.a[0]) * k, l.a[1] + (l.b[1] - l.a[1]) * k]; leg = l; break; } acc += l.len; }
    const alongX = leg.a[1] === leg.b[1];
    tX.style.display = alongX ? "" : "none"; tY.style.display = alongX ? "none" : "";
    const flip = u >= 0.5;
    const [sx, sy] = P(pos[0], pos[1], 0);
    // mirroring an isometric box horizontally swaps the +x and -y orientations, which is exactly the return trip
    truck.setAttribute("transform", `translate(${sx.toFixed(1)},${sy.toFixed(1)})${flip ? " scale(-1,1)" : ""}`);
    if (flip) { tX.style.display = alongX ? "none" : ""; tY.style.display = alongX ? "" : "none"; }
    requestAnimationFrame(drive);
  }
  if (!reduced) requestAnimationFrame(drive); else { const [sx, sy] = P(...road[1], 0); truck.setAttribute("transform", `translate(${sx},${sy})`); tY.style.display = "none"; }

  // ------------------------------------------------------------------ plant trees by clicking the grass
  let planted = 0;
  svg.addEventListener("click", (e) => {
    if (e.target.closest(".bld")) return;
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const m = root.getScreenCTM(); if (!m) return;
    const { x: X, y: Y } = pt.matrixTransform(m.inverse());
    // invert the projection at z = 0
    const a = X / (C30 * S), b = (2 * Y) / S;
    const gx = (a + b) / 2, gy = (b - a) / 2;
    if (gx < 0.3 || gy < 0.3 || gx > N - 0.3 || gy > N - 0.3) return;
    const blocked = PROJECTS.some((p) => gx > p.x - 0.4 && gx < p.x + p.w + 0.4 && gy > p.y - 0.4 && gy < p.y + p.d + 0.4)
      || (gx > 0.6 && gx < 3.8 && gy > 6.7 && gy < N) || (gy > 10.5 && gx > 6.2) || (gx > 10.5 && gy > 6);
    if (blocked || planted >= 40) return;
    const g = el("g", { class: "pop" });
    tree(g, gx, gy, 0.55 + Math.random() * 0.35, COLORS[Math.floor(Math.random() * COLORS.length)]);
    place(g, gx - 0.3, gy - 0.3, 0.6, 0.6);
    planted++;
    document.dispatchEvent(new CustomEvent("tree-planted", { detail: planted }));
  });

  // ------------------------------------------------------------------ fit the viewBox, gentle parallax
  const bb = root.getBBox();
  svg.setAttribute("viewBox", `${bb.x - 20} ${bb.y - 60} ${bb.width + 40} ${bb.height + 70}`);
  if (!reduced && matchMedia("(pointer: fine)").matches) {
    const wrap = svg.parentElement;
    wrap.addEventListener("pointermove", (e) => {
      const r = wrap.getBoundingClientRect();
      const dx = (e.clientX - r.left) / r.width - 0.5, dy = (e.clientY - r.top) / r.height - 0.5;
      svg.style.transform = `perspective(900px) rotateY(${dx * 6}deg) rotateX(${-dy * 5}deg)`;
    });
    wrap.addEventListener("pointerleave", () => { svg.style.transform = ""; });
    svg.style.transition = "transform .4s ease-out";
  }

  // On touch screens there is no hover, so briefly show each building's name once.
  if (!matchMedia("(hover: hover)").matches) {
    const blds = [...svg.querySelectorAll(".bld")];
    blds.forEach((b, i) => setTimeout(() => { b._tip.classList.add("on"); setTimeout(() => b._tip.classList.remove("on"), 1400); }, 800 + i * 500));
  }

  window.Town = { visited, total: PROJECTS.length };
  document.dispatchEvent(new CustomEvent("town-ready"));
})();
