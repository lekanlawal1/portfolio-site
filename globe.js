/* The globe: the home page's centerpiece. A cloud of points assembles into a globe of data; eight
   bright points on it are the projects. Drag to turn it; pick a point and it turns that project to
   face you and zooms in while the project's file opens.

   makeGlobe(THREE, { hero, stage, projects, onPick }) returns { focus(i), release(), refresh(), dim(ids) }
   The page owns the file panel; the globe only turns, zooms and lights up. */
const SALES = [14237, 4520, 55691, 28014, 23648, 34595, 33946, 27909, 81777, 31453, 78629, 69546, 18174, 11951, 38726, 34195, 30132, 24797, 28765, 36898, 64596, 31405, 75973, 74920,
  18542, 22979, 51716, 38750, 56988, 40345, 39262, 31115, 73410, 59688, 79412, 96999, 43971, 20301, 58872, 36522, 44261, 52982, 45264, 63121, 87867, 77777, 118448, 83829];
const LAT = [28, -18, 44, -40, 8, -6, 52, -30];

export function makeGlobe(THREE, { hero, stage, projects: P, onPick, keepClear }) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const small = () => innerWidth <= 900;
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pad = (i) => String(i + 1).padStart(2, "0");
  const R = 2.6, F = small() ? 0.55 : 1;

  // ---------------------------------------------------------------- built from points
  const pos = [], from = [], kind = [], seed = [];
  const rnd = (a, b) => a + Math.random() * (b - a);
  function add(x, y, z, k) {
    pos.push(x, y, z); kind.push(k); seed.push(Math.random());
    // every point starts in a messy cloud; the globe assembles out of it
    const th = Math.random() * 6.283, ph = Math.acos(2 * Math.random() - 1), r = Math.cbrt(Math.random()) * 7;
    from.push(r * Math.sin(ph) * Math.cos(th) * 1.4, r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th));
  }
  const NS = Math.round(2600 * F), ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < NS; i++) { const y = 1 - (i / (NS - 1)) * 2, r = Math.sqrt(1 - y * y), t = ga * i; add(Math.cos(t) * r * R, y * R, Math.sin(t) * r * R, 0); }
  for (const lat of [-62, -38, -14, 14, 38, 62]) {   // broken latitude bands, like scan lines
    const y = Math.sin(lat * Math.PI / 180) * R, rr = Math.cos(lat * Math.PI / 180) * R, n = Math.round(rr * 150 * F);
    for (let i = 0; i < n; i++) { const t = (i / n) * 6.283; if (Math.sin(t * 9 + lat) > 0.75) continue; add(Math.cos(t) * rr, y + rnd(-.02, .02), Math.sin(t) * rr, 1); }
  }
  for (let m = 0; m < 48; m++) {   // the equator: a real store's 48 months of sales, as bars off the surface
    const t = (m / 48) * 6.283, h = 0.15 + (SALES[m] / 118448) * 0.95, n = Math.round(26 * F);
    for (let j = 0; j < n; j++) { const rr = R + (j / n) * h; add(Math.cos(t) * rr, rnd(-.025, .025), Math.sin(t) * rr, 2); }
  }
  for (const [rr, tilt] of [[R * 1.32, 0.42], [R * 1.5, -0.3]]) {   // two orbit rings with ticks
    const n = Math.round(700 * F);
    for (let i = 0; i < n; i++) { const t = (i / n) * 6.283, tick = i % 35 === 0;
      for (let q = 0; q < (tick ? 6 : 1); q++) { const r2 = rr + (tick ? q * 0.03 : 0), x = Math.cos(t) * r2, z = Math.sin(t) * r2; add(x, z * Math.sin(tilt), z * Math.cos(tilt), 3); } }
  }
  for (let i = 0; i < Math.round(900 * F); i++) { const th = Math.random() * 6.283, ph = Math.acos(2 * Math.random() - 1), r = Math.pow(Math.random(), 2) * 0.9;
    add(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th), 4); }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("aFrom", new THREE.Float32BufferAttribute(from, 3));
  geo.setAttribute("aKind", new THREE.Float32BufferAttribute(kind, 1));
  geo.setAttribute("aSeed", new THREE.Float32BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uT: { value: 0 }, uIn: { value: reduce ? 1 : 0 }, uSize: { value: (small() ? 3.4 : 4.2) * Math.min(devicePixelRatio, 2) },
      uFocus: { value: new THREE.Vector3(0, 0, 1) }, uLit: { value: 0 }, uM: { value: new THREE.Vector3(0, 0, 0) } },
    vertexShader: `attribute vec3 aFrom; attribute float aKind, aSeed; uniform float uT, uIn, uSize, uLit; uniform vec3 uFocus, uM; varying float vA; varying float vK;
      void main() {
        float e = smoothstep(0., 1., clamp(uIn * 1.6 - aSeed * .6, 0., 1.));
        vec3 p = mix(aFrom, position, e);
        if (aKind < .5) p *= 1. + .012 * sin(uT * 1.3 + aSeed * 40.);
        vec3 wp = (modelMatrix * vec4(p, 1.)).xyz;
        // the pointer (or a finger) gives nearby points the faintest nudge
        vec2 d = wp.xy - uM.xy; float r = length(d);
        wp.xy += d / max(r, .001) * uM.z * smoothstep(.55, 0., r) * .06 * step(wp.z, 9.);
        vec4 mv = viewMatrix * vec4(wp, 1.);
        gl_Position = projectionMatrix * mv;
        vec3 c = (modelMatrix * vec4(0., 0., 0., 1.)).xyz;
        float front = smoothstep(c.z - 2.6, c.z + 1.4, wp.z);
        float near = uLit * smoothstep(1.3, 0., distance(normalize(wp - c), uFocus)) * step(aKind, 1.5);
        float tw = .6 + .4 * sin(uT * 2. + aSeed * 50.);
        vA = (aKind > 3.5 ? .9 : aKind > 2.5 ? .45 : aKind > 1.5 ? .95 : aKind > .5 ? .7 : .38) * (.25 + .75 * front) * tw + near * .9;
        vK = aKind;
        gl_PointSize = min(uSize * 2.6, uSize * (aKind > 3.5 ? 1.2 : aKind > 1.5 ? 1. : .8) * (1. + near * .9) * (10. / -mv.z));
      }`,
    fragmentShader: `varying float vA; varying float vK; void main() { vec2 c = gl_PointCoord - .5; float d = length(c); if (d > .5) discard;
      float a = smoothstep(.5, 0., d); vec3 col = mix(vec3(1., .5, .12), vec3(1., .9, .7), a * a * (vK > 3.5 ? 1. : .6)); gl_FragColor = vec4(col, a * vA); }` });

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  stage.appendChild(renderer.domElement);
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  const globe = new THREE.Group(); scene.add(globe);
  globe.add(new THREE.Points(geo, mat));
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
    vertexShader: `varying vec2 vU; void main() { vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `varying vec2 vU; void main() { float d = distance(vU, vec2(.5)); gl_FragColor = vec4(1., .5, .12, smoothstep(.36, 0., d) * .22); }` }));
  glow.position.z = -3; scene.add(glow);

  // ---------------------------------------------------------------- the projects' points and labels
  let spots = [], marks = [];
  function refresh() {
    marks.forEach((m) => m.remove());
    spots = P.map((p, i) => {
      const lat = LAT[i % LAT.length] * Math.PI / 180, lon = (i / P.length) * Math.PI * 2 + 0.3;
      return new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)).multiplyScalar(R);
    });
    marks = P.map((p, i) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "mk";
      b.innerHTML = `<i></i><span>${esc(p.name)}</span><small>${pad(i)}</small>`;
      b.setAttribute("aria-label", `${p.name}: open project ${i + 1} of ${P.length}`);
      b.addEventListener("click", () => onPick(i)); hero.appendChild(b); return b;
    });
  }
  refresh();

  // ---------------------------------------------------------------- turning, with momentum
  let yaw = 0.4, pitch = 0.18, vy = 0, dragging = false, lx = 0, ly = 0, lastInput = 0, target = null, cur = -1, moved = 0;
  stage.addEventListener("pointerdown", (e) => { dragging = true; moved = 0; lx = e.clientX; ly = e.clientY; stage.classList.add("dragging"); lastInput = performance.now(); });
  addEventListener("pointermove", (e) => {
    const r = hero.getBoundingClientRect();
    mx = (e.clientX - r.left) / r.width; my = (e.clientY - r.top) / r.height; pushAt = performance.now();
    if (!dragging) return;
    const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
    target = null; vy = dx * 0.0055;
    yaw += vy; if (e.pointerType !== "touch") pitch = Math.max(-0.9, Math.min(0.9, pitch + dy * 0.004));
    lastInput = performance.now();
  });
  const end = () => { dragging = false; stage.classList.remove("dragging"); };
  addEventListener("pointerup", end); addEventListener("pointercancel", end);
  let mx = 0.5, my = 0.5, pushAt = 0;
  stage.addEventListener("touchmove", (e) => { const r = hero.getBoundingClientRect(), t = e.touches[0]; mx = (t.clientX - r.left) / r.width; my = (t.clientY - r.top) / r.height; pushAt = performance.now(); }, { passive: true });

  function angleFor(i) {
    // turn about the vertical axis until the point is straight ahead, then tip it level
    const v = spots[i].clone().normalize(), yw = Math.atan2(-v.x, v.z), zr = Math.hypot(v.x, v.z);
    return { yaw: yw, pitch: Math.atan2(v.y, zr) };
  }
  function focus(i) {
    cur = i;
    const a = angleFor(i);
    let d = a.yaw - yaw; d = Math.atan2(Math.sin(d), Math.cos(d));   // the shortest way round
    target = { yaw: yaw + d, pitch: a.pitch, from: Math.abs(d) + Math.abs(a.pitch - pitch) };
    vy = 0;
    marks.forEach((m, k) => m.classList.toggle("on", k === i));
  }
  // turn a project round to face you without opening it (no zoom): used by "Hiring for"
  function turn(i) {
    if (!spots[i]) return;
    const a = angleFor(i); let d = a.yaw - yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    target = { yaw: yaw + d, pitch: a.pitch * 0.6 }; vy = 0; lastInput = performance.now();
  }
  function release() { cur = -1; target = null; marks.forEach((m) => m.classList.remove("on")); }
  function dim(ids) { marks.forEach((m, k) => m.classList.toggle("dim", !!ids && !ids.includes(P[k].id))); }

  // ---------------------------------------------------------------- every frame
  let W = 0, H = 0, lastW = 0;
  const size = () => { W = hero.clientWidth; H = hero.clientHeight; renderer.setSize(W, H, false); cam.aspect = W / H; cam.updateProjectionMatrix(); lastW = innerWidth; };
  size();
  addEventListener("resize", () => { if (small() && innerWidth === lastW) return; size(); });
  const t0 = performance.now(), v = new THREE.Vector3(), fv = new THREE.Vector3();
  let camZ = small() ? 15.5 : 9.6, push = 0, gx = 0, gy = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const r = hero.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;   // off screen: don't draw
    const t = (now - t0) / 1000, open = cur >= 0, S = small();
    mat.uniforms.uT.value = reduce ? 0 : t;
    if (!reduce) mat.uniforms.uIn.value = Math.min(1, t / 2.4);
    let remain = 0;
    if (target) {
      const k = reduce ? 1 : 0.075;
      yaw += (target.yaw - yaw) * k; pitch += (target.pitch - pitch) * k;
      remain = Math.abs(target.yaw - yaw) + Math.abs(target.pitch - pitch);
      if (remain < 0.002) target = null;
    } else if (!dragging) {
      yaw += vy; vy *= 0.94;
      if (now - lastInput > 2500 && !open && !reduce) yaw += 0.0016;   // idle: a slow turn
    }
    globe.rotation.set(pitch, yaw, 0, "XYZ");
    // the zoom: in close on the chosen project, easing back out a little while it turns to the next
    const base = S ? 15.5 : 9.6, close = S ? 11.8 : 7.3;
    const wantZ = open ? close + Math.min(S ? 4 : 2.6, remain * (S ? 3 : 2)) : base;
    camZ += (wantZ - camZ) * (reduce ? 1 : 0.06);
    cam.position.set(0, 0, camZ);
    // where the globe sits: right of the intro on a laptop, left of the open file; higher on a phone
    const wx = S ? 0 : open ? -1.15 * (camZ / base) : 1.0, wy = S ? (open ? 2.0 * (camZ / base) + 0.5 : -1.9) : 0;
    gx += (wx - gx) * 0.06; gy += (wy - gy) * 0.06;
    globe.position.set(gx, gy, 0); glow.position.set(gx, gy, -3);
    // the push: strongest while the pointer moves, fading when it stops
    const half = Math.tan((cam.fov / 2) * Math.PI / 180) * camZ;
    push += ((now - pushAt < 900 && !reduce && !open ? 1 : 0) - push) * 0.08;
    mat.uniforms.uM.value.set((mx - 0.5) * 2 * half * cam.aspect, -(my - 0.5) * 2 * half, push);
    globe.updateMatrixWorld();
    if (open) { fv.copy(spots[cur]).applyMatrix4(globe.matrixWorld).sub(globe.position).normalize(); mat.uniforms.uFocus.value.copy(fv); }
    mat.uniforms.uLit.value += ((open ? 1 : 0) - mat.uniforms.uLit.value) * 0.08;
    // pin each label to its point; hide the ones round the back or under the page's own furniture
    const bottomLimit = S && open ? H * 0.36 : H - 76;
    const clearBelow = !open && keepClear ? keepClear() : 64;   // labels stay out from behind the intro text
    spots.forEach((s, i) => {
      v.copy(s).applyMatrix4(globe.matrixWorld);
      const back = v.z < gz() - 0.3 || mat.uniforms.uIn.value < 0.9;
      v.project(cam);
      const sx = (v.x + 1) / 2 * W, sy = (1 - v.y) / 2 * H;
      const off = sy < 64 || (S && sy < clearBelow) || sy > bottomLimit || sx < 6 || sx > W - (S ? 96 : 120) || (!S && open && sx > W - 480) || (open && camZ < base * 0.8 && i !== cur && !S);
      marks[i].style.transform = `translate(${(sx - 12).toFixed(1)}px, ${(sy - 14).toFixed(1)}px)`;
      marks[i].classList.toggle("back", back);
      marks[i].classList.toggle("off", off);
    });
    renderer.render(scene, cam);
  }
  const gz = () => globe.position.z;
  requestAnimationFrame(frame);
  return { focus, turn, release, refresh, dim, wasDrag: () => moved > 6 };
}
