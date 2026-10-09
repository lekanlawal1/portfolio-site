/* The 3D version of the home page town (Three.js). It loads after the page, replaces the SVG
   town only if WebGL works, and keeps the same rules: every building is a project, click one to
   open it, click the grass to plant a tree. Drag sideways to spin the island. */
let THREE;

const wrap = document.querySelector(".town-wrap");
const svgTown = document.getElementById("town");
const params = new URLSearchParams(location.search);
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

function webglOK() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
}

// Three.js (about 170 KB compressed) is only downloaded when the 3D town will actually run,
// and only after the page has loaded, so it never delays the first paint.
if (wrap && svgTown && !reduced && !params.has("flat") && webglOK()) {
  const go = async () => {
    try {
      THREE = await import("./vendor/three.module.min.js");
      await document.fonts.ready;
      start();
    } catch (err) { console.warn("3D town unavailable, keeping the SVG town.", err); }
  };
  if (document.readyState === "complete") go(); else addEventListener("load", go, { once: true });
}

function start() {
  const INK = 0x1d1535;
  const coarse = matchMedia("(pointer: coarse)").matches;
  const N = 12;                                   // island is N x N grid units, centred on the origin
  const gx = (x) => x - N / 2, gz = (y) => y - N / 2;

  // ------------------------------------------------------------------ renderer, scene, camera
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.75 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  const canvas = renderer.domElement;
  canvas.className = "town3d";
  canvas.setAttribute("aria-hidden", "true");

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  camera.layers.enable(1);
  const target = new THREE.Vector3(0, -0.3, 0);
  const view = { az: Math.PI / 4, el: 0.5, dist: 34 };   // azimuth, elevation (radians), distance
  const intro = { t: 0 };

  const hemi = new THREE.HemisphereLight(0xdff3ff, 0x8a6a4a, 1.5);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
  sun.position.set(-10, 18, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 50 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);

  // ------------------------------------------------------------------ helpers
  const mats = new Map();
  function mat(color, extra = {}) {
    const key = color + JSON.stringify(extra);
    if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.82, metalness: 0, ...extra }));
    return mats.get(key);
  }
  const edgeMat = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.85 });
  function outline(mesh, angle = 30) {
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, angle), edgeMat);
    e.layers.set(1);   // drawn, but ignored by the click raycaster
    mesh.add(e);
    return mesh;
  }
  function mesh(geo, material, parent, { shadow = true, edges = false } = {}) {
    const m = new THREE.Mesh(geo, material);
    m.castShadow = shadow; m.receiveShadow = true;
    if (edges) outline(m);
    if (parent) parent.add(m);
    return m;
  }
  // a box given its footprint corner (x, z in grid units), size, and base height
  function box(parent, x, z, w, d, h, color, y0 = 0, opts = {}) {
    const m = mesh(new THREE.BoxGeometry(w, h, d), typeof color === "number" ? mat(color) : color, parent, { edges: opts.edges !== false, shadow: opts.shadow !== false });
    m.position.set(gx(x + w / 2), y0 + h / 2, gz(z + d / 2));
    return m;
  }
  function textTexture(draw, w = 256, h = 128) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  }
  const FONT = '"Bricolage Grotesque", Inter, system-ui, sans-serif';

  // windows: one instanced mesh for the whole town, lit up at night
  const winMat = new THREE.MeshStandardMaterial({ color: 0xcfefff, emissive: 0xffd66b, emissiveIntensity: 0, flatShading: true, roughness: 0.3 });
  const winSpots = [];
  // windows on all four walls of a box: cols across, rows up
  function windows(x, z, w, d, y0, h, cols, rows, sides = "nsew") {
    const ww = 0.22, wh = Math.min(0.32, h / (rows * 2 + 0.5));
    for (let r = 0; r < rows; r++) {
      const y = y0 + (h / rows) * (r + 0.5);
      for (let c = 0; c < cols; c++) {
        const fx = (c + 0.5) / cols;
        if (sides.includes("s")) winSpots.push([gx(x + w * fx), y, gz(z + d) + 0.02, 0, ww, wh]);
        if (sides.includes("n")) winSpots.push([gx(x + w * fx), y, gz(z) - 0.02, 0, ww, wh]);
        if (sides.includes("e")) winSpots.push([gx(x + w) + 0.02, y, gz(z + d * fx), Math.PI / 2, ww, wh]);
        if (sides.includes("w")) winSpots.push([gx(x) - 0.02, y, gz(z + d * fx), Math.PI / 2, ww, wh]);
      }
    }
  }

  // ------------------------------------------------------------------ the island
  const world = new THREE.Group();     // spins when dragged
  const island = new THREE.Group();    // bobs gently
  world.add(island);
  scene.add(world);

  const grass = mesh(new THREE.BoxGeometry(N, 0.5, N), [mat(0x4fb86e), mat(0x4fb86e), mat(0x86e09e), mat(0x4fb86e), mat(0x4fb86e), mat(0x4fb86e)], island, { edges: true, shadow: false });
  grass.position.y = -0.25;
  grass.name = "grass";
  const dirt = mesh(new THREE.BoxGeometry(N, 1.0, N), mat(0xc98b5b), island, { edges: true, shadow: false });
  dirt.position.y = -1.0;
  // rocky underside: a square pyramid with jittered inner vertices
  const rockGeo = new THREE.ConeGeometry(N / Math.SQRT2, 8.5, 4, 5);
  rockGeo.rotateY(Math.PI / 4); rockGeo.rotateX(Math.PI);
  const pos = rockGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y > -4.2 && y < 4.2) {
      const k = 1 + (Math.sin(i * 12.9898) * 43758.5453 % 1) * 0.14;
      pos.setX(i, pos.getX(i) * k); pos.setZ(i, pos.getZ(i) * k); pos.setY(i, y + (Math.cos(i * 7.1) * 0.25));
    }
  }
  rockGeo.computeVertexNormals();
  const rock = mesh(rockGeo, mat(0xa86b42), island, { edges: true, shadow: false });
  rock.position.y = -1.5 - 4.25;
  // strata ring
  const ring = mesh(new THREE.BoxGeometry(N + 0.02, 0.12, N + 0.02), mat(0xe0a874), island, { shadow: false });
  ring.position.y = -0.75;

  // water: pond, river and a waterfall over the front edge
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x6fcfff, roughness: 0.15, metalness: 0.1, emissive: 0x1b6fa8, emissiveIntensity: 0.15 });
  box(island, 0.8, 6.9, 2.8, 1.7, 0.04, waterMat, 0.005, { shadow: false });
  box(island, 1.6, 8.4, 1.2, 3.6, 0.04, waterMat, 0.005, { shadow: false });
  const fallTex = textTexture((g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, "rgba(127,211,255,1)"); grd.addColorStop(1, "rgba(127,211,255,0)");
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = 5;
    for (let i = 0; i < 7; i++) { g.beginPath(); const x = 18 + i * 36; g.setLineDash([22, 30]); g.lineDashOffset = i * 13; g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  }, 256, 512);
  fallTex.wrapT = THREE.RepeatWrapping;
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 6), new THREE.MeshBasicMaterial({ map: fallTex, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  fall.position.set(gx(2.2), -3, gz(N) + 0.06);
  island.add(fall);
  // mist particles at the bottom of the fall
  const mistN = 70, mistGeo = new THREE.BufferGeometry(), mistPos = new Float32Array(mistN * 3), mistV = [];
  for (let i = 0; i < mistN; i++) { mistV.push(Math.random()); }
  mistGeo.setAttribute("position", new THREE.BufferAttribute(mistPos, 3));
  const mist = new THREE.Points(mistGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.14, transparent: true, opacity: 0.8, depthWrite: false }));
  island.add(mist);

  // road: a ring around the island, with a bridge over the river
  const RIN = 0.3, ROUT = 0.9;
  function roundRect(s, inset, r) {
    const a = gx(inset), b = gx(N - inset);
    s.moveTo(a + r, a); s.lineTo(b - r, a); s.quadraticCurveTo(b, a, b, a + r); s.lineTo(b, b - r);
    s.quadraticCurveTo(b, b, b - r, b); s.lineTo(a + r, b); s.quadraticCurveTo(a, b, a, b - r); s.lineTo(a, a + r); s.quadraticCurveTo(a, a, a + r, a);
  }
  const roadShape = new THREE.Shape(); roundRect(roadShape, RIN, 0.9);
  const hole = new THREE.Path(); roundRect(hole, ROUT, 0.4); roadShape.holes.push(hole);
  const roadGeo = new THREE.ShapeGeometry(roadShape, 12); roadGeo.rotateX(-Math.PI / 2);
  const road = mesh(roadGeo, new THREE.MeshStandardMaterial({ color: 0x5b5872, roughness: 0.95, side: THREE.DoubleSide }), island, { shadow: false });
  road.position.y = 0.02;
  // centre line dashes
  const lineShape = new THREE.Shape(); roundRect(lineShape, 0.58, 0.65);
  const linePts = lineShape.getSpacedPoints(160);
  const dashMat = mat(0xffd66b);
  for (let i = 0; i < linePts.length - 1; i += 2) {
    const p = linePts[i], q = linePts[i + 1];
    const dash = mesh(new THREE.BoxGeometry(Math.hypot(q.x - p.x, q.y - p.y) * 0.9, 0.02, 0.05), dashMat, island, { shadow: false });
    dash.position.set((p.x + q.x) / 2, 0.035, (p.y + q.y) / 2);
    dash.rotation.y = -Math.atan2(q.y - p.y, q.x - p.x);
  }
  box(island, 1.45, N - ROUT - 0.05, 1.5, ROUT - RIN + 0.1, 0.12, 0x8c8aa0, 0.02);   // bridge

  // ------------------------------------------------------------------ trees
  const TREE_COLORS = [0x2fbf71, 0x22a863, 0x5ad17f, 0xffb020, 0xff7aa8];
  const treeGeo = { trunk: new THREE.CylinderGeometry(0.07, 0.09, 0.45, 6), cone: new THREE.ConeGeometry(0.42, 1.0, 7), ball: new THREE.IcosahedronGeometry(0.42, 0) };
  function makeTree(x, z, s = 1, color = TREE_COLORS[0], round = false) {
    const t = new THREE.Group();
    const trunk = mesh(treeGeo.trunk, mat(0x8a5a3b), t); trunk.position.y = 0.22;
    const top = mesh(round ? treeGeo.ball : treeGeo.cone, mat(color), t, { edges: true });
    top.position.y = round ? 0.75 : 0.9;
    t.position.set(gx(x), 0, gz(z)); t.scale.setScalar(s);
    t.rotation.y = Math.random() * Math.PI;
    island.add(t);
    return t;
  }
  const TREES = [[3.9, 1.3, 0.9], [8.6, 1.1, 1], [10.0, 1.5, 0.85], [9.3, 2.4, 0.65], [3.9, 3.4, 0.8], [8.6, 3.6, 0.9], [10.3, 3.9, 0.8], [4.0, 6.6, 0.75],
    [1.3, 9.6, 0.9], [3.5, 10.4, 0.7], [6.4, 9.0, 0.8], [7.3, 10.4, 1], [10.4, 10.4, 0.8], [9.8, 5.6, 0.7], [6.6, 3.7, 0.7], [10.5, 9.4, 0.6]];
  const treeSpots = [];
  TREES.forEach(([x, z, s], i) => { makeTree(x, z, s, TREE_COLORS[i % 3], i % 4 === 1); treeSpots.push([x, z]); });

  // ------------------------------------------------------------------ buildings
  const PROJECTS = [
    { id: "econ", color: "#E63946", x: 1.2, z: 1.2, w: 2, d: 2, name: "Canada Economy Platform", sub: "Live StatCan data", href: "projects/project5.html" },
    { id: "store", color: "#FFB020", x: 5.0, z: 1.0, w: 3, d: 2, name: "Superstore Margin Console", sub: "BI dashboard", href: "projects/project1.html" },
    { id: "triage", color: "#3E8BFF", x: 1.2, z: 3.9, w: 2.2, d: 2, name: "AI Ticket Triage", sub: "LLM with guardrails", href: "projects/project2.html" },
    { id: "fifa", color: "#22C3A6", x: 4.8, z: 4.6, w: 3, d: 3, name: "Football Stats Agent", sub: "Ask football in English", href: "projects/football-agent.html" },
    { id: "fine", color: "#FF4F8B", x: 4.0, z: 9.6, w: 1.7, d: 0.5, name: "Fine Print", sub: "iOS contract checker", href: "projects/fine-print.html" },
    { id: "wh", color: "#FF6B35", x: 8.0, z: 6.6, w: 3, d: 2.6, name: "Discrepancy Checker", sub: "Excel + browser tool", href: "demos/discrepancy-checker/" },
  ];
  const animated = [];   // per-frame callbacks for small motions
  const BUILD = {
    econ(g, p) {
      box(g, p.x, p.z, 2, 2, 5.2, 0xf4f1ea);
      windows(p.x, p.z, 2, 2, 0.2, 4.8, 3, 6);
      for (const [i, h] of [[0, 0.6], [1, 1.1], [2, 0.8]]) box(g, p.x + 0.25 + i * 0.55, p.z + 0.8, 0.38, 0.38, h, 0xe63946, 5.2);
      const pole = mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.0, 6), mat(INK), g);
      pole.position.set(gx(p.x + 0.4), 6.2, gz(p.z + 0.4));
      const flagGeo = new THREE.PlaneGeometry(0.9, 0.5, 8, 2);
      const flagTex = textTexture((c, w, h) => {
        c.fillStyle = "#E63946"; c.fillRect(0, 0, w, h); c.fillStyle = "#fff"; c.fillRect(w * 0.25, 0, w * 0.5, h);
        c.fillStyle = "#E63946"; c.font = `800 ${h * 0.62}px ${FONT}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("✦", w / 2, h / 2 + 2);
      }, 128, 64);
      const flag = mesh(flagGeo, new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.9 }), g);
      flag.position.set(gx(p.x + 0.4) + 0.45, 6.95, gz(p.z + 0.4));
      const base = flagGeo.attributes.position.array.slice();
      animated.push((t) => {
        const a = flagGeo.attributes.position;
        for (let i = 0; i < a.count; i++) { const x = base[i * 3]; a.setZ(i, Math.sin(t * 4 + x * 5) * 0.08 * (x + 0.45)); }
        a.needsUpdate = true;
      });
      return 7.4;
    },
    store(g, p) {
      box(g, p.x, p.z, 3, 2, 1.9, 0xfff2d6);
      box(g, p.x - 0.05, p.z - 0.05, 3.1, 2.1, 0.25, 0xffb020, 1.9);
      windows(p.x, p.z, 3, 2, 0.25, 1.0, 3, 1, "sew");
      for (let i = 0; i < 6; i++) {
        const s = mesh(new THREE.BoxGeometry(0.5, 0.05, 0.62), mat(i % 2 ? 0xffffff : 0xff5d3a), g, { edges: true });
        s.position.set(gx(p.x + 0.25 + i * 0.5), 1.5, gz(p.z + 2) + 0.27); s.rotation.x = 0.55;
      }
      const sign = mesh(new THREE.BoxGeometry(1.4, 0.5, 0.08), [mat(0xffb020), mat(0xffb020), mat(0xffb020), mat(0xffb020),
        new THREE.MeshStandardMaterial({ map: textTexture((c, w, h) => { c.fillStyle = "#FFB020"; c.fillRect(0, 0, w, h); c.fillStyle = "#1D1535"; c.font = `800 ${h * 0.62}px ${FONT}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("SHOP", w / 2, h / 2 + 4); }) }), mat(0xffb020)], g, { edges: true });
      sign.position.set(gx(p.x + 1.5), 2.45, gz(p.z + 1.6));
      return 2.9;
    },
    triage(g, p) {
      box(g, p.x, p.z, 2.2, 2, 2.2, 0xd9e8ff);
      box(g, p.x - 0.1, p.z - 0.1, 2.4, 2.2, 0.3, 0x3e8bff, 2.2);
      windows(p.x, p.z, 2.2, 2, 0.3, 1.5, 2, 1);
      const env = mesh(new THREE.BoxGeometry(0.9, 0.6, 0.08), [mat(0xffffff), mat(0xffffff), mat(0xffffff), mat(0xffffff),
        new THREE.MeshStandardMaterial({ map: textTexture((c, w, h) => { c.fillStyle = "#fff"; c.fillRect(0, 0, w, h); c.strokeStyle = "#1D1535"; c.lineWidth = 9; c.strokeRect(5, 5, w - 10, h - 10); c.beginPath(); c.moveTo(5, 5); c.lineTo(w / 2, h * 0.62); c.lineTo(w - 5, 5); c.stroke(); }, 192, 128) }), mat(0xffffff)], g, { edges: true });
      env.position.set(gx(p.x + 1.1), 2.95, gz(p.z + 1));
      animated.push((t) => { env.position.y = 2.95 + Math.sin(t * 2) * 0.08; env.rotation.y = Math.sin(t * 0.8) * 0.5; });
      box(g, p.x + 2.4, p.z + 1.5, 0.35, 0.35, 0.7, 0x3e8bff);
      return 3.5;
    },
    fifa(g, p) {
      box(g, p.x, p.z, 3, 3, 0.5, 0xe9e3d7);
      const fieldTex = textTexture((c, w, h) => {
        c.fillStyle = "#3DBE6A"; c.fillRect(0, 0, w, h);
        for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? "#36AE60" : "#3DBE6A"; c.fillRect(0, (h / 6) * i, w, h / 6); }
        c.strokeStyle = "#fff"; c.lineWidth = 5; c.strokeRect(8, 8, w - 16, h - 16);
        c.beginPath(); c.moveTo(8, h / 2); c.lineTo(w - 8, h / 2); c.stroke(); c.beginPath(); c.arc(w / 2, h / 2, w * 0.14, 0, Math.PI * 2); c.stroke();
      }, 256, 256);
      const field = mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshStandardMaterial({ map: fieldTex, roughness: 1 }), g);
      field.rotation.x = -Math.PI / 2; field.position.set(gx(p.x + 1.5), 0.51, gz(p.z + 1.5));
      const ball = mesh(new THREE.IcosahedronGeometry(0.11, 1), mat(0xffffff), g, { edges: true });
      animated.push((t) => { const a = t * 0.9; ball.position.set(gx(p.x + 1.5) + Math.cos(a) * 0.7, 0.62 + Math.abs(Math.sin(t * 5)) * 0.25, gz(p.z + 1.5) + Math.sin(a * 1.3) * 0.6); });
      for (const [a, b] of [[0.1, 0.1], [2.9, 2.9], [0.1, 2.9], [2.9, 0.1]]) {
        const pole = mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.1, 6), mat(INK), g);
        pole.position.set(gx(p.x + a), 1.55, gz(p.z + b));
        const lamp = mesh(new THREE.BoxGeometry(0.42, 0.24, 0.12), new THREE.MeshStandardMaterial({ color: 0xffe66b, emissive: 0xffe66b, emissiveIntensity: 0.4 }), g, { edges: true });
        lamp.position.set(gx(p.x + a), 2.65, gz(p.z + b)); lamp.lookAt(gx(p.x + 1.5), 0, gz(p.z + 1.5));
        lamps.push(lamp);
      }
      const board = new THREE.Group(); board.position.set(gx(p.x + 1.5), 0.5, gz(p.z + 0.05)); g.add(board);
      for (const dx of [-0.5, 0.5]) { const leg = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 6), mat(INK), board); leg.position.set(dx, 0.45, 0); }
      mesh(new THREE.BoxGeometry(1.5, 0.62, 0.12), mat(INK), board, { edges: true }).position.y = 1.2;
      const sqlM = new THREE.MeshStandardMaterial({ map: textTexture((c, w, h) => { c.fillStyle = "#22C3A6"; c.fillRect(0, 0, w, h); c.fillStyle = "#1D1535"; c.font = `800 ${h * 0.5}px "JetBrains Mono", monospace`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("SELECT", w / 2, h / 2 + 3); }, 256, 96), emissive: 0x22c3a6, emissiveIntensity: 0.25 });
      const scr = mesh(new THREE.PlaneGeometry(1.36, 0.5), sqlM, board); scr.position.set(0, 1.2, 0.065);
      animated.push((t) => { sqlM.emissiveIntensity = 0.2 + (Math.sin(t * 2.2) > 0.6 ? 0.35 : 0); });
      return 3.0;
    },
    fine(g, p) {
      const body = box(g, p.x, p.z, 1.7, 0.5, 3.4, 0x2a2148);
      const scr = textTexture((c, w, h) => {
        c.fillStyle = "#FFF7EA"; c.fillRect(0, 0, w, h);
        for (let i = 0; i < 6; i++) { const y = 70 + i * 62; c.fillStyle = i === 2 ? "#FF4F8B" : "#C9BFD9"; c.fillRect(30, y, i === 2 ? 130 : 190, i === 2 ? 22 : 15); }
        c.fillStyle = "#FF4F8B"; c.beginPath(); c.arc(w - 60, h - 70, 34, 0, Math.PI * 2); c.fill();
        c.strokeStyle = "#fff"; c.lineWidth = 9; c.lineCap = "round"; c.beginPath(); c.moveTo(w - 76, h - 70); c.lineTo(w - 64, h - 56); c.lineTo(w - 42, h - 86); c.stroke();
      }, 256, 480);
      const screen = mesh(new THREE.PlaneGeometry(1.42, 3.0), new THREE.MeshStandardMaterial({ map: scr, emissive: 0xffffff, emissiveMap: scr, emissiveIntensity: 0.15 }), g);
      screen.position.set(gx(p.x + 0.85), 1.7, gz(p.z + 0.5) + 0.012);
      screens.push(screen.material);
      return 3.9;
    },
    wh(g, p) {
      box(g, p.x, p.z, 3, 2.6, 1.9, 0xffd7b8);
      // a triangular prism: ridge along x, apex up, base exactly the wall's depth (1.732 x 1.5 = 2.6)
      const roofGeo = new THREE.CylinderGeometry(1.5, 1.5, 3.2, 3, 1);
      roofGeo.rotateZ(Math.PI / 2); roofGeo.rotateX(-Math.PI / 2);
      const roof = mesh(roofGeo, mat(0xff6b35), g, { edges: true });
      roof.scale.set(1, 0.42, 1);
      roof.position.set(gx(p.x + 1.5), 1.9 + 0.75 * 0.42, gz(p.z + 1.3));
      const door = mesh(new THREE.PlaneGeometry(1.3, 1.3), new THREE.MeshStandardMaterial({ map: textTexture((c, w, h) => { c.fillStyle = "#8C8AA0"; c.fillRect(0, 0, w, h); c.strokeStyle = "rgba(29,21,53,.55)"; c.lineWidth = 4; for (let y = 18; y < h; y += 22) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } }, 128, 128) }), g);
      door.position.set(gx(p.x + 1.1), 0.65, gz(p.z + 2.6) + 0.012);
      windows(p.x, p.z, 3, 2.6, 0.8, 0.8, 3, 1, "e");
      box(g, p.x + 2.2, p.z + 2.75, 0.55, 0.55, 0.45, 0xc9955f);
      box(g, p.x + 2.25, p.z + 2.8, 0.45, 0.45, 0.4, 0xe0ae72, 0.45);
      return 3.3;
    },
  };
  const lamps = [], screens = [];
  const buildings = [];
  const visited = (window.Town && window.Town.visited) || new Set();
  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.16 : 0.36; const fn = i ? "lineTo" : "moveTo"; starShape[fn](Math.cos(a) * r, -Math.sin(a) * r); }
  const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: 0.1, bevelEnabled: false }); starGeo.center();
  for (const p of PROJECTS) {
    const g = new THREE.Group();
    const inner = new THREE.Group(); g.add(inner);
    const top = BUILD[p.id](inner, p);
    const cx = gx(p.x + p.w / 2), cz = gz(p.z + p.d / 2);
    // scale around the building's own base centre
    inner.position.set(cx, 0, cz); inner.children.forEach((c) => c.position.x -= cx); inner.children.forEach((c) => c.position.z -= cz);
    g.userData = { p, top, lift: 0, targetLift: 0 };
    g.traverse((o) => { if (o.isMesh) o.userData.building = g; });
    const star = mesh(starGeo, new THREE.MeshStandardMaterial({ color: 0xffc23c, emissive: 0xffa000, emissiveIntensity: 0.35 }), g, { edges: true });
    star.position.set(cx, top + 0.6, cz); star.visible = visited.has(p.id);
    g.userData.star = star;
    island.add(g);
    buildings.push(g);
  }
  // windows as one instanced mesh
  const winGeo = new THREE.PlaneGeometry(1, 1);
  const wins = new THREE.InstancedMesh(winGeo, winMat, winSpots.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
  winSpots.forEach(([x, y, z, ry, w, h], i) => { q.setFromEuler(new THREE.Euler(0, ry, 0)); m4.compose(ps.set(x, y, z), q, sc.set(w, h, 1)); wins.setMatrixAt(i, m4); });
  winMat.side = THREE.DoubleSide;
  island.add(wins);
  // windows belong to buildings that move when hovered, so they're rebuilt per building on lift (cheap: only y changes)
  const winOwner = winSpots.map(([x, , z]) => buildings.find((b) => { const p = b.userData.p; return x >= gx(p.x) - 0.1 && x <= gx(p.x + p.w) + 0.1 && z >= gz(p.z) - 0.1 && z <= gz(p.z + p.d) + 0.1; }));

  // ------------------------------------------------------------------ truck on the ring road
  const truck = new THREE.Group();
  box(truck, 0, 0, 0.8, 0.46, 0.55, 0xffffff, 0.12).position.set(-0.15, 0.4, 0);
  box(truck, 0, 0, 0.36, 0.46, 0.42, 0xff6b35, 0.12).position.set(0.45, 0.33, 0);
  const wheelGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.5, 10); wheelGeo.rotateX(Math.PI / 2);
  for (const x of [-0.35, 0.05, 0.45]) { const w = mesh(wheelGeo, mat(INK), truck); w.position.set(x, 0.12, 0); }
  island.add(truck);
  const pathShape = new THREE.Shape(); roundRect(pathShape, 0.6, 0.65);
  const pathPts = pathShape.getSpacedPoints(240).map((v) => new THREE.Vector3(v.x, 0.03, v.y));
  const path = new THREE.CatmullRomCurve3(pathPts.slice(0, -1), true);

  // ------------------------------------------------------------------ clouds and fireflies
  const clouds = [];
  const cloudGeo = new THREE.SphereGeometry(1, 16, 12);
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.25 });
  for (let i = 0; i < 5; i++) {
    const c = new THREE.Group();
    for (let k = 0; k < 4; k++) { const s = mesh(cloudGeo, cloudMat, c, { shadow: true }); s.scale.setScalar(0.34 + Math.random() * 0.18 + (k === 1 || k === 2 ? 0.14 : 0)); s.position.set(k * 0.38 - 0.57, (k === 1 || k === 2 ? 0.14 : 0), Math.random() * 0.2); }
    c.userData = { r: 5.6 + Math.random() * 1.4, a: (i / 5) * Math.PI * 2, y: 6.4 + Math.random() * 1.6, v: 0.03 + Math.random() * 0.03 };
    world.add(c); clouds.push(c);
  }
  const fireN = 40, fireGeo = new THREE.BufferGeometry(), firePos = new Float32Array(fireN * 3), fireSeed = [];
  for (let i = 0; i < fireN; i++) fireSeed.push([Math.random() * N - N / 2, Math.random() * N - N / 2, Math.random() * 6.28]);
  fireGeo.setAttribute("position", new THREE.BufferAttribute(firePos, 3));
  const fireMat = new THREE.PointsMaterial({ color: 0xffe66b, size: 0.12, transparent: true, opacity: 0, depthWrite: false });
  island.add(new THREE.Points(fireGeo, fireMat));

  // ------------------------------------------------------------------ day / night
  const DAY = { hemiSky: new THREE.Color(0xdff3ff), hemiGround: new THREE.Color(0x8a6a4a), hemi: 1.5, sun: new THREE.Color(0xfff1d6), sunI: 2.6, win: 0, lamp: 0.4, cloud: new THREE.Color(0xffffff), fire: 0 };
  const NIGHT = { hemiSky: new THREE.Color(0x5a63b8), hemiGround: new THREE.Color(0x2a1e45), hemi: 1.0, sun: new THREE.Color(0xaab8ff), sunI: 1.1, win: 1.6, lamp: 2.2, cloud: new THREE.Color(0x7a70c8), fire: 0.95 };
  let night = document.documentElement.dataset.theme === "dark" ? 1 : 0, nightTarget = night;
  new MutationObserver(() => { nightTarget = document.documentElement.dataset.theme === "dark" ? 1 : 0; wake(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  function applyNight(k) {
    hemi.color.copy(DAY.hemiSky).lerp(NIGHT.hemiSky, k); hemi.groundColor.copy(DAY.hemiGround).lerp(NIGHT.hemiGround, k);
    hemi.intensity = DAY.hemi + (NIGHT.hemi - DAY.hemi) * k;
    sun.color.copy(DAY.sun).lerp(NIGHT.sun, k); sun.intensity = DAY.sunI + (NIGHT.sunI - DAY.sunI) * k;
    winMat.emissiveIntensity = DAY.win + (NIGHT.win - DAY.win) * k;
    winMat.color.setHex(k > 0.5 ? 0xffd66b : 0xcfefff);
    for (const l of lamps) l.material.emissiveIntensity = DAY.lamp + (NIGHT.lamp - DAY.lamp) * k;
    for (const s of screens) s.emissiveIntensity = 0.15 + 0.5 * k;
    cloudMat.color.copy(DAY.cloud).lerp(NIGHT.cloud, k); cloudMat.emissiveIntensity = 0.25 * (1 - k);
    fireMat.opacity = NIGHT.fire * k;
  }
  applyNight(night);

  // ------------------------------------------------------------------ labels (HTML, positioned over the canvas)
  const label = document.createElement("div");
  label.className = "t3-label"; label.setAttribute("aria-hidden", "true");
  label.innerHTML = "<b></b><span></span>";
  wrap.appendChild(label);
  const hintEl = document.createElement("div");
  hintEl.className = "t3-hint"; hintEl.textContent = coarse ? "Swipe sideways to spin" : "Drag to spin";
  wrap.appendChild(hintEl);

  // The canvas is decorative for assistive tech; every project is also a normal link in the cards below.

  // ------------------------------------------------------------------ interaction
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let hovered = null, drag = null, lastInteract = 0, spinV = 0;
  const rot = { y: 0, target: 0 };
  function pick(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects([...buildings, grass], true).find((h) => h.object.isMesh);
  }
  function setHover(b) {
    if (hovered === b) return;
    if (hovered) hovered.userData.targetLift = 0;
    hovered = b;
    canvas.style.cursor = b ? "pointer" : (drag ? "grabbing" : "grab");
    if (b) {
      b.userData.targetLift = 0.45;
      label.querySelector("b").textContent = b.userData.p.name;
      label.querySelector("span").textContent = b.userData.p.sub;
      label.classList.add("on");
    } else label.classList.remove("on");
    wake();
  }
  // Flying into a building: the camera swoops down to it, then the page wipes to the project.
  let fly = null;
  const flyTarget = new THREE.Vector3(), flyPoint = new THREE.Vector3();
  function startFly(b) {
    fly = { b, t0: performance.now(), wiped: false };
    spinV = 0; canvas.style.cursor = "default";
    // keep the name on screen during the zoom, so a single tap still tells you where you're going
    hovered = b;
    label.querySelector("b").textContent = b.userData.p.name;
    label.querySelector("span").textContent = b.userData.p.sub;
    label.classList.add("on");
    b.userData.targetLift = 0.3;
    wake();
  }
  addEventListener("pageshow", (e) => { if (e.persisted && fly) { fly.b.userData.targetLift = 0; fly = null; hovered = null; label.classList.remove("on"); wake(); } });

  canvas.addEventListener("pointerdown", (e) => {
    if (fly) return;
    drag = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId, lastX: e.clientX, t: performance.now() };
    lastInteract = performance.now();
    if (e.pointerType === "mouse") canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (fly) return;
    if (drag && drag.id === e.pointerId) {
      const dx = e.clientX - drag.lastX;
      const slop = e.pointerType === "mouse" ? 6 : 12;   // fingers wobble during a tap
      if (Math.abs(e.clientX - drag.x) > slop || Math.abs(e.clientY - drag.y) > slop) drag.moved = true;
      if (drag.moved) {
        rot.target += dx * 0.009; spinV = dx * 0.009;
        if (e.pointerType === "mouse") view.el = Math.min(0.95, Math.max(0.28, view.el + e.movementY * 0.004));
        setHover(null);
      }
      drag.lastX = e.clientX; lastInteract = performance.now(); wake();
      return;
    }
    if (e.pointerType === "mouse") { const h = pick(e); setHover(h && h.object.userData.building ? h.object.userData.building : null); }
  });
  const end = (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const wasDrag = drag.moved; drag = null;
    canvas.style.cursor = hovered ? "pointer" : "grab";
    if (wasDrag) return;
    const h = pick(e);
    if (!h) return;
    const b = h.object.userData.building;
    if (b) {
      const p = b.userData.p;
      visited.add(p.id);
      try { localStorage.setItem("town-visited", JSON.stringify([...visited])); } catch {}
      if (e.metaKey || e.ctrlKey || e.shiftKey) { open(p.href, "_blank"); return; }
      startFly(b);
      return;
    }
    if (h.object === grass && h.face && h.face.normal.y > 0.5) plant(h.point);
    else setHover(null);
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", (e) => { if (drag && drag.id === e.pointerId) drag = null; });
  // Touch screens fire pointerleave after every tap; only a mouse can actually leave.
  canvas.addEventListener("pointerleave", (e) => { if (!drag && e.pointerType === "mouse") setHover(null); });

  // planting trees
  let planted = 0;
  const growing = [];
  function plant(worldPoint) {
    const local = island.worldToLocal(worldPoint.clone());
    const x = local.x + N / 2, z = local.z + N / 2;
    if (x < 1.0 || z < 1.0 || x > N - 1.0 || z > N - 1.0) return;                         // road ring
    if (PROJECTS.some((p) => x > p.x - 0.35 && x < p.x + p.w + 0.35 && z > p.z - 0.35 && z < p.z + p.d + 0.35)) return;
    if ((x > 0.6 && x < 3.8 && z > 6.7 && z < 8.8) || (x > 1.4 && x < 3.0 && z > 8.2)) return;  // water
    if (treeSpots.some(([a, b]) => Math.hypot(a - x, b - z) < 0.55) || planted >= 40) return;
    const t = makeTree(x, z, 0.6 + Math.random() * 0.35, TREE_COLORS[Math.floor(Math.random() * TREE_COLORS.length)], Math.random() < 0.35);
    t.userData.s = t.scale.x; t.scale.setScalar(0.001); t.userData.t0 = performance.now();
    growing.push(t); treeSpots.push([x, z]); planted++;
    document.dispatchEvent(new CustomEvent("tree-planted", { detail: planted }));
    wake();
  }

  // ------------------------------------------------------------------ layout and the render loop
  function resize() {
    const r = wrap.getBoundingClientRect();
    const w = Math.max(1, r.width), h = Math.max(1, r.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the whole island in view whatever the aspect ratio
    const vh = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), hh = vh * camera.aspect;
    view.dist = Math.max(10 / hh, 10.4 / vh);
    camera.updateProjectionMatrix();
    wake();
  }
  new ResizeObserver(resize).observe(wrap);

  const tmp = new THREE.Vector3();
  function positionLabel() {
    if (!hovered) return;
    const p = hovered.userData.p;
    tmp.set(gx(p.x + p.w / 2), hovered.userData.top + hovered.userData.lift + 0.9, gz(p.z + p.d / 2));
    island.localToWorld(tmp); tmp.project(camera);
    const r = canvas.getBoundingClientRect();
    label.style.transform = `translate(${((tmp.x + 1) / 2) * r.width}px, ${((1 - tmp.y) / 2) * r.height}px) translate(-50%, -100%)`;
  }

  let running = false, visible = true, lastT = performance.now(), frames = 0, slowFrames = 0, quality = 1;
  const clock = new THREE.Clock();
  function wake() { if (!running && visible && !document.hidden) { running = true; lastT = performance.now(); requestAnimationFrame(loop); } }
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) wake(); }).observe(wrap);
  document.addEventListener("visibilitychange", wake);

  function loop(now) {
    if (!visible || document.hidden) { running = false; return; }
    const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    const t = clock.getElapsedTime();

    // adaptive quality: if the first frames are slow, drop shadows and resolution
    frames++;
    if (frames < 120 && dt > 1 / 28) slowFrames++;
    if (frames === 120 && slowFrames > 50 && quality === 1) {
      quality = 0; renderer.shadowMap.enabled = false; renderer.setPixelRatio(1); scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); resize();
    }

    // intro: rise and swing in
    intro.t = Math.min(1, intro.t + dt / 1.8);
    const ease = 1 - Math.pow(1 - intro.t, 3);

    // idle spin, drag momentum
    const idle = now - lastInteract > 2500 && !hovered && !drag;
    if (!drag && !fly) { rot.target += spinV; spinV *= 0.92; if (idle) rot.target += dt * 0.12; }
    rot.y += (rot.target - rot.y) * Math.min(1, dt * 8);
    world.rotation.y = rot.y + (1 - ease) * -1.2;
    island.position.y = Math.sin(t * 0.9) * 0.18 - (1 - ease) * 3;

    // camera
    const az = view.az; let el = view.el, d = view.dist * (1 + (1 - ease) * 0.35), tgt = target;
    if (fly) {
      const k = Math.min(1, (now - fly.t0) / 1150);
      const e2 = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;   // ease in and out
      const p = fly.b.userData.p;
      flyPoint.set(gx(p.x + p.w / 2), fly.b.userData.top * 0.42 + fly.b.userData.lift, gz(p.z + p.d / 2));
      island.localToWorld(flyPoint);
      tgt = flyTarget.copy(target).lerp(flyPoint, e2);
      d += (Math.max(6, fly.b.userData.top * 1.9) - d) * e2;
      el += (0.3 - el) * e2;
      if (k > 0.58 && !fly.wiped) {
        fly.wiped = true;
        const v = flyPoint.clone().project(camera), r = canvas.getBoundingClientRect();
        const at = { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height, color: p.color, name: p.name };
        if (window.Fun && Fun.wipeTo) Fun.wipeTo(p.href, at); else location.href = p.href;
      }
    }
    camera.position.set(tgt.x + Math.cos(el) * Math.sin(az) * d, tgt.y + Math.sin(el) * d, tgt.z + Math.cos(el) * Math.cos(az) * d);
    camera.lookAt(tgt);

    // night transition
    if (Math.abs(nightTarget - night) > 0.001) { night += (nightTarget - night) * Math.min(1, dt * 3); applyNight(night); }

    // building hover lift (springy)
    let winDirty = false;
    for (const b of buildings) {
      const u = b.userData; const prev = u.lift;
      u.v = (u.v || 0) + ((u.targetLift - u.lift) * 140 - (u.v || 0) * 12) * dt;
      u.lift += u.v * dt;
      b.position.y = u.lift;
      b.children[0].scale.setScalar(1 + u.lift * 0.08);
      if (Math.abs(prev - u.lift) > 1e-4) winDirty = true;
      u.star.rotation.y = t * 2; u.star.position.y = u.top + 0.6 + Math.sin(t * 3) * 0.08;
      u.star.visible = visited.has(u.p.id);
    }
    if (winDirty) {
      winSpots.forEach(([x, y, z, ry, w, h], i) => {
        const b = winOwner[i]; const lift = b ? b.userData.lift : 0, s = 1 + lift * 0.08;
        const p = b ? b.userData.p : null, cx = p ? gx(p.x + p.w / 2) : 0, cz = p ? gz(p.z + p.d / 2) : 0;
        q.setFromEuler(new THREE.Euler(0, ry, 0));
        m4.compose(ps.set(cx + (x - cx) * s, y * s + lift, cz + (z - cz) * s), q, sc.set(w * s, h * s, 1)); wins.setMatrixAt(i, m4);
      });
      wins.instanceMatrix.needsUpdate = true;
    }

    // truck
    const u = (t * 0.022) % 1;
    path.getPointAt(u, tmp); truck.position.copy(tmp);
    const tan = path.getTangentAt(u); truck.rotation.y = Math.atan2(-tan.z, tan.x);

    // waterfall, mist, clouds, fireflies, little animations
    fallTex.offset.y = (fallTex.offset.y + dt * 0.9) % 1;
    for (let i = 0; i < mistN; i++) {
      mistV[i] = (mistV[i] + dt * 0.35) % 1; const k = mistV[i];
      mistPos[i * 3] = gx(2.2) + Math.sin(i * 3.1) * 0.6 * k; mistPos[i * 3 + 1] = -6 + k * 1.2; mistPos[i * 3 + 2] = gz(N) + 0.2 + Math.cos(i * 1.7) * 0.5 * k;
    }
    mistGeo.attributes.position.needsUpdate = true;
    for (const c of clouds) { const cu = c.userData; cu.a += cu.v * dt; c.position.set(Math.cos(cu.a) * cu.r, cu.y + Math.sin(t * 0.5 + cu.r) * 0.2, Math.sin(cu.a) * cu.r); c.rotation.y = -cu.a; }
    if (night > 0.01) {
      fireSeed.forEach(([x, z, ph], i) => { firePos[i * 3] = x + Math.sin(t * 0.6 + ph) * 0.5; firePos[i * 3 + 1] = 0.6 + Math.sin(t * 1.3 + ph * 2) * 0.35; firePos[i * 3 + 2] = z + Math.cos(t * 0.5 + ph) * 0.5; });
      fireGeo.attributes.position.needsUpdate = true;
    }
    for (const f of animated) f(t);
    for (let i = growing.length - 1; i >= 0; i--) {
      const g = growing[i], k = Math.min(1, (now - g.userData.t0) / 600);
      const s = g.userData.s * (1 + Math.sin(k * Math.PI) * 0.25) * (1 - Math.pow(1 - k, 3));
      g.scale.setScalar(Math.max(0.001, s)); if (k >= 1) { g.scale.setScalar(g.userData.s); growing.splice(i, 1); }
    }

    positionLabel();
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------------ swap in
  wrap.classList.add("is3d");
  wrap.prepend(canvas);
  resize();
  wake();
  requestAnimationFrame(() => wrap.classList.add("ready3d"));
  const hint = document.querySelector(".hero .hint > span:last-child");
  if (hint) hint.textContent = coarse
    ? "This is my town. Each building is a project: tap one to visit it. Swipe sideways to spin the island, tap the grass to plant a tree."
    : "This is my town. Each building is a project: click one to visit it. Drag to spin the island, click the grass to plant a tree.";
  window.Town3D = { renderer, scene, camera, quality: () => quality,
    screenOf(id) { const b = buildings.find((x) => x.userData.p.id === id); const p = b.userData.p; const v = new THREE.Vector3(gx(p.x + p.w / 2), b.userData.top * 0.5, gz(p.z + p.d / 2)); island.localToWorld(v); v.project(camera); const r = canvas.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; },
    groundAt(x, z) { const v = new THREE.Vector3(gx(x), 0, gz(z)); island.localToWorld(v); v.project(camera); const r = canvas.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; },
    trees: () => planted, rotation: () => rot.y,
    hit(x, y) { const h = pick({ clientX: x, clientY: y }); return !h ? null : h.object.userData.building ? h.object.userData.building.userData.p.id : h.object === grass ? "grass" : "other"; } };
}
