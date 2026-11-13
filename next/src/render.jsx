// Dev-only page that renders one state of the 3D desk and reports where each object lands on screen.
// tools/render-shots.cjs drives it; visitors never load this or three.js.
import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Desk } from './Desk.jsx';
import { fontsReady } from './fonts.js';

const q = new URLSearchParams(location.search);
const NAMES = ['mug', 'globe', 'folio', 'card', ...Array.from({ length: 8 }, (_, i) => `file-${i}`)];

function Report() {
  const { scene, camera, invalidate } = useThree();
  let n = 0;
  // Draw three frames (shadows and effects settle), then stop so the page is free to be captured.
  useFrame(() => {
    n++;
    if (n < 3) invalidate();
    if (n !== 2) return;
    const rects = {};
    const box = new THREE.Box3(), v = new THREE.Vector3();
    for (const name of NAMES) {
      const o = scene.getObjectByName(name);
      if (!o) continue;
      box.setFromObject(o);
      let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
      for (let k = 0; k < 8; k++) {
        v.set(k & 1 ? box.max.x : box.min.x, k & 2 ? box.max.y : box.min.y, k & 4 ? box.max.z : box.min.z).project(camera);
        const x = (v.x + 1) / 2, y = (1 - v.y) / 2;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      // percentages of the frame, clamped to it
      const c = (t) => Math.round(Math.min(1, Math.max(0, t)) * 10000) / 100;
      rects[name] = [c(x0), c(y0), +(c(x1) - c(x0)).toFixed(2), +(c(y1) - c(y0)).toFixed(2)];
    }
    window.SHOT = rects;
  });
  return null;
}

function Render() {
  useEffect(() => document.getElementById('loader')?.remove(), []);
  return (
    <Canvas shadows dpr={Number(q.get('dpr') || 2)} frameloop="demand" camera={{ near: 0.01, far: 10 }} gl={{ preserveDrawingBuffer: true }}
      style={{ position: 'fixed', inset: 0 }}>
      <Desk mode={q.get('s') || 'desk'} open={Number(q.get('open') || 0)} portrait={q.get('o') === 'port'} quality="high"
        setMode={() => {}} setOpen={() => {}} onObject={() => {}} />
      <Report />
    </Canvas>
  );
}
fontsReady.then(() => createRoot(document.getElementById('root')).render(<Render />));
