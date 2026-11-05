/* The side piece: the four-step story in a small card in the About section. 2,000 points go from a
   messy cloud, to rows, to a real store's monthly sales, to a ring. It plays by itself while it's on
   screen, and the steps underneath can be picked. It never takes over the page's scrolling. */
const SALES = [14237, 4520, 55691, 28014, 23648, 34595, 33946, 27909, 81777, 31453, 78629, 69546, 18174, 11951, 38726, 34195, 30132, 24797, 28765, 36898, 64596, 31405, 75973, 74920,
  18542, 22979, 51716, 38750, 56988, 40345, 39262, 31115, 73410, 59688, 79412, 96999, 43971, 20301, 58872, 36522, 44261, 52982, 45264, 63121, 87867, 77777, 118448, 83829];

export function makeStory(THREE, { box, onStep }) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const COLS = 48, ROWS = innerWidth <= 900 ? 26 : 40, N = COLS * ROWS;
  const A = new Float32Array(N * 3), B = new Float32Array(N * 3), C = new Float32Array(N * 3), D = new Float32Array(N * 3), seed = new Float32Array(N);
  const W = 8, H = 4.4, max = Math.max(...SALES), rnd = (a, b) => a + Math.random() * (b - a);
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    const i = c * ROWS + r, k = i * 3; seed[i] = Math.random();
    const th = Math.random() * 6.283, ph = Math.acos(2 * Math.random() - 1), rad = Math.cbrt(Math.random()) * 2.6;
    A[k] = rad * Math.sin(ph) * Math.cos(th) * 1.5 + rnd(-.2, .2); A[k + 1] = rad * Math.cos(ph) * 0.8; A[k + 2] = rad * Math.sin(ph) * Math.sin(th);
    B[k] = (c / (COLS - 1) - 0.5) * W; B[k + 1] = (r / (ROWS - 1) - 0.5) * H * 0.75; B[k + 2] = 0;
    C[k] = B[k]; C[k + 1] = -H / 2 + (r / (ROWS - 1)) * (SALES[c] / max * H); C[k + 2] = 0;
    const t = (i / N) * 6.283, R = 1.9 + Math.sin(i * 0.37) * 0.2 + rnd(-.08, .08);
    D[k] = Math.cos(t) * R; D[k + 1] = Math.sin(t) * R; D[k + 2] = Math.sin(t * 7 + seed[i]) * 0.25;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(A), 3));
  for (const [n, a] of [["aA", A], ["aB", B], ["aC", C], ["aD", D]]) geo.setAttribute(n, new THREE.BufferAttribute(a, 3));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uP: { value: 0 }, uT: { value: 0 }, uSize: { value: 3.6 * Math.min(devicePixelRatio, 2) } },
    vertexShader: `attribute vec3 aA, aB, aC, aD; attribute float aSeed; uniform float uP, uT, uSize; varying float vG;
      void main() {
        float d = aSeed * .35;
        float s1 = smoothstep(0., 1., clamp((uP - d) * 1.55, 0., 1.));
        float s2 = smoothstep(0., 1., clamp((uP - 1. - d) * 1.55, 0., 1.));
        float s3 = smoothstep(0., 1., clamp((uP - 2. - d) * 1.55, 0., 1.));
        vec3 p = mix(aA, aB, s1); p = mix(p, aC, s2); p = mix(p, aD, s3);
        p += vec3(sin(uT * .6 + aSeed * 40.), cos(uT * .5 + aSeed * 31.), sin(uT * .4 + aSeed * 17.)) * .06 * ((1. - s1) + s3 * .5);
        vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
        vG = .55 + .45 * sin(uT * 1.4 + aSeed * 60.);
        gl_PointSize = uSize * (.7 + aSeed * .7) * (8. / -mv.z);
      }`,
    fragmentShader: `varying float vG; void main() { vec2 c = gl_PointCoord - .5; float d = length(c); if (d > .5) discard;
      float a = smoothstep(.5, 0., d); vec3 col = mix(vec3(1., .62, .22), vec3(1., .93, .78), a * a); gl_FragColor = vec4(col, min(1., a * vG * 1.3)); }` });
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  box.appendChild(renderer.domElement);
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  const pts = new THREE.Points(geo, mat); scene.add(pts);
  let w = 0;
  const size = () => { const r = box.getBoundingClientRect(); if (!r.width || r.width === w) return; w = r.width;
    renderer.setSize(r.width, r.height, false); cam.aspect = r.width / r.height; cam.position.z = cam.aspect < 1.3 ? 11 : 8.6; cam.updateProjectionMatrix(); };
  size(); addEventListener("resize", size);

  // plays by itself: each shape holds, then the next change starts. Picking a step jumps to it and
  // gives the visitor a moment before it carries on.
  let step = 0, shown = 0, holdUntil = 0, visible = false, next = 0;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.2 }).observe(box);
  const go = (s, manual) => { step = (s + 4) % 4; onStep && onStep(step); next = performance.now() + (manual ? 7000 : 3200); };
  const t0 = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible) return;
    if (!reduce && now > next) go(step + 1);
    // the ring closes back into the cloud by running the shapes backwards quickly
    const want = step;
    shown += (want - shown) * (reduce ? 1 : 0.05);
    mat.uniforms.uP.value = shown; mat.uniforms.uT.value = reduce ? 0 : (now - t0) / 1000;
    pts.rotation.y = shown < 1 ? (1 - shown) * Math.sin((now - t0) / 4000) * 0.6 : 0;
    pts.rotation.z = Math.max(0, shown - 2) * 0.12;
    renderer.render(scene, cam);
  }
  next = performance.now() + 2600;
  requestAnimationFrame(frame);
  return { go: (s) => go(s, true) };
}
