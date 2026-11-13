import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, SoftShadows, ContactShadows } from '@react-three/drei';
import { EffectComposer, N8AO, Bloom, Noise, Vignette, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode, BlendFunction } from 'postprocessing';
import { projects } from './projects.js';
import { rng, woodTex, leatherTex, coverTex, tabTex, plateTex, folioTex, cardTex } from './textures.js';

const STILL = new URLSearchParams(location.search).has('still');
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = matchMedia('(pointer: fine)').matches;
const snap = (dt, speed) => (STILL || REDUCED ? 1 : 1 - Math.exp(-speed * Math.min(dt, 0.05)));
const A4 = [0.21, 0.297];
const goldMat = new THREE.MeshStandardMaterial({ color: '#D9A441', metalness: 1, roughness: 0.28 });
const blackGloss = new THREE.MeshPhysicalMaterial({ color: '#0D0C0B', roughness: 0.32, clearcoat: 0.6 });

// Ease an object toward a pose every frame; ?still jumps straight there for screenshots.
function useEase(pose, speed = 7) {
  const ref = useRef();
  useFrame((_, dt) => {
    const o = ref.current;
    if (!o) return;
    const k = snap(dt, speed);
    o.position.x += (pose.p[0] - o.position.x) * k;
    o.position.y += (pose.p[1] - o.position.y) * k;
    o.position.z += (pose.p[2] - o.position.z) * k;
    o.rotation.x += (pose.r[0] - o.rotation.x) * k;
    o.rotation.y += (pose.r[1] - o.rotation.y) * k;
    o.rotation.z += (pose.r[2] - o.rotation.z) * k;
  });
  return ref;
}

// Hover lift eases instead of jumping, so the desk feels physical.
function useLift(on, h = 0.01) {
  const ref = useRef();
  useFrame((_, dt) => { if (ref.current) ref.current.position.y += ((on ? h : 0) - ref.current.position.y) * snap(dt, 12); });
  return ref;
}

function hoverProps(set, id) {
  return {
    onPointerOver: (e) => { e.stopPropagation(); set(id); document.body.style.cursor = 'pointer'; },
    onPointerOut: () => { set(null); document.body.style.cursor = ''; }
  };
}

// Keep the same desk width in view on any screen: fix the horizontal angle, derive the vertical one.
function Camera({ portrait }) {
  const { camera, size, pointer } = useThree();
  const base = portrait ? [0, 1.05, 0.3] : [0, 0.42, 0.56];
  const look = portrait ? [0, 0, -0.08] : [0, 0, -0.12];
  const hfov = (portrait ? 35 : 58) * Math.PI / 180;
  useMemo(() => {
    const aspect = size.width / size.height;
    camera.fov = THREE.MathUtils.clamp(2 * Math.atan(Math.tan(hfov / 2) / aspect) * 180 / Math.PI, 30, 66);
    camera.position.set(...base);
    camera.lookAt(...look);
    camera.updateProjectionMatrix();
  }, [portrait, size.width, size.height, camera]);
  useFrame((_, dt) => {
    if (!FINE || REDUCED || STILL || portrait) return;
    const k = snap(dt, 2.5);
    camera.position.x += (base[0] + pointer.x * 0.018 - camera.position.x) * k;
    camera.position.y += (base[1] + pointer.y * 0.01 - camera.position.y) * k;
    camera.lookAt(...look);
  });
  return null;
}

function Surface() {
  const wood = useMemo(woodTex, []);
  const leather = useMemo(leatherTex, []);
  const stitch = [[0, -0.33, 0.86, 0.0016], [0, 0.13, 0.86, 0.0016], [-0.43, -0.1, 0.0016, 0.46], [0.43, -0.1, 0.0016, 0.46]];
  return (
    <group>
      <mesh position={[0, -0.02, -0.3]} receiveShadow>
        <boxGeometry args={[2.6, 0.04, 1.6]} />
        <meshStandardMaterial map={wood} bumpMap={wood} bumpScale={0.6} roughness={0.62} />
      </mesh>
      <mesh position={[0, 0.0015, -0.1]} receiveShadow>
        <boxGeometry args={[0.9, 0.003, 0.5]} />
        <meshStandardMaterial map={leather} bumpMap={leather} bumpScale={1.2} roughness={0.85} />
      </mesh>
      {stitch.map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, 0.0032, z]} material={goldMat}>
          <boxGeometry args={[w, 0.0004, d]} />
        </mesh>
      ))}
    </group>
  );
}

function Nameplate() {
  const tex = useMemo(plateTex, []);
  const face = useMemo(() => new THREE.MeshStandardMaterial({ map: tex, metalness: 0.45, roughness: 0.38 }), [tex]);
  const mats = [goldMat, goldMat, goldMat, goldMat, face, goldMat];
  return (
    <group position={[0.03, 0, -0.43]}>
      <mesh position={[0, 0.008, 0]} material={blackGloss} castShadow receiveShadow>
        <boxGeometry args={[0.36, 0.016, 0.075]} />
      </mesh>
      <mesh position={[0, 0.052, 0.004]} rotation={[-0.32, 0, 0]} material={mats} castShadow>
        <boxGeometry args={[0.34, 0.08, 0.007]} />
      </mesh>
    </group>
  );
}

// One project: a folder (or the loose top sheet) with paper inside and a gold tab on the side.
function File({ p, i, pose, onClick, hover, setHover, lit }) {
  const ref = useEase(pose, 6);
  const cover = useMemo(() => coverTex(p, i), [p, i]);
  const tab = useMemo(() => tabTex(p.name), [p.name]);
  const loose = p.cover === 'paper';
  const size = loose ? A4 : [0.235, 0.31];
  const top = useMemo(() => new THREE.MeshStandardMaterial({ map: cover, roughness: loose ? 0.9 : 0.75 }), [cover, loose]);
  const edge = useMemo(() => new THREE.MeshStandardMaterial({ color: loose ? '#E9E4D9' : '#2A2622', roughness: 0.9 }), [loose]);
  const tabTop = useMemo(() => new THREE.MeshStandardMaterial({ map: tab, metalness: 0.35, roughness: 0.45 }), [tab]);
  const paper = useMemo(() => new THREE.MeshStandardMaterial({ color: '#F2EEE6', roughness: 0.92 }), []);
  const r = rng(40 + i);
  const sheets = useMemo(() => loose ? [] : [0, 1].map(() => [(r() - 0.5) * 0.02, (r() - 0.5) * 0.016, (r() - 0.5) * 0.05]), [loose]);
  const liftRef = useLift(hover === p.id, 0.012);
  // A lifted page leaves the lamp's pool, so it glows a little instead of going dark.
  top.emissive.set('#ffffff'); top.emissiveMap = cover; top.emissiveIntensity = lit ? 0.55 : 0;
  return (
    <group ref={ref} name={`file-${i}`} onClick={(e) => { e.stopPropagation(); onClick(i); }} {...hoverProps(setHover, p.id)}>
      <group ref={liftRef}>
        {sheets.map(([x, z, ry], k) => (
          <mesh key={k} position={[x, 0.0008 + k * 0.0009, z]} rotation={[0, ry, 0]} material={paper} castShadow receiveShadow>
            <boxGeometry args={[A4[0], 0.0007, A4[1]]} />
          </mesh>
        ))}
        <mesh position={[0, loose ? 0.0005 : 0.003, 0]} material={[edge, edge, top, edge, edge, edge]} castShadow receiveShadow>
          <boxGeometry args={[size[0], loose ? 0.0007 : 0.0016, size[1]]} />
        </mesh>
        <mesh position={[size[0] / 2 + 0.016, loose ? 0.0006 : 0.0028, -0.13 + (7 - i) * 0.037]} material={[edge, edge, tabTop, edge, edge, edge]} castShadow>
          <boxGeometry args={[0.05, 0.0009, 0.026]} />
        </mesh>
      </group>
    </group>
  );
}

function Mug({ pose, lifted, onClick, hover, setHover }) {
  const ref = useEase(pose, 5);
  const geo = useMemo(() => new THREE.LatheGeometry(
    [[0, 0.001], [0.036, 0.001], [0.04, 0.006], [0.042, 0.03], [0.043, 0.096], [0.0395, 0.096], [0.0385, 0.03], [0.034, 0.009], [0, 0.009]]
      .map(([x, y]) => new THREE.Vector2(x, y)), 96), []);
  const ceramic = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#0E0D0C', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 }), []);
  const liftRef = useLift(hover === 'mug', 0.008);
  const glow = useRef();
  // Picked up, the mug leaves the lamp: a soft warm light travels with it so the glaze and gold still read.
  useFrame((_, dt) => { if (glow.current) glow.current.intensity += ((lifted ? 0.05 : 0) - glow.current.intensity) * snap(dt, 6); });
  return (
    <group ref={ref} name="mug" onClick={(e) => { e.stopPropagation(); onClick(); }} {...hoverProps(setHover, 'mug')}>
      <pointLight ref={glow} position={[0.02, 0.11, 0.1]} intensity={0} distance={0.6} decay={2} color="#FFE9C8" />
      <group ref={liftRef}>
        <mesh geometry={geo} material={ceramic} castShadow receiveShadow />
        <mesh position={[0, 0.096, 0]} rotation={[Math.PI / 2, 0, 0]} material={goldMat}>
          <torusGeometry args={[0.0412, 0.0017, 12, 96]} />
        </mesh>
        <mesh position={[0.042, 0.05, 0]} rotation={[0, 0, -Math.PI / 2]} material={ceramic} castShadow>
          <torusGeometry args={[0.024, 0.0065, 20, 48, Math.PI]} />
        </mesh>
        <mesh position={[0, 0.084, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.0385, 64]} />
          <meshPhysicalMaterial color="#2A1409" roughness={0.12} clearcoat={1} />
        </mesh>
      </group>
    </group>
  );
}

// A nod to the globe site: gold meridians around a black orb.
function Globe({ onClick, hover, setHover }) {
  const ref = useRef();
  useFrame((_, dt) => { if (ref.current && !STILL && !REDUCED) ref.current.rotation.y += dt * 0.25; });
  const liftRef = useLift(hover === 'globe', 0.006);
  return (
    <group name="globe" position={[0.21, 0, -0.36]} onClick={(e) => { e.stopPropagation(); onClick(); }} {...hoverProps(setHover, 'globe')}>
     <group ref={liftRef}>
      <mesh position={[0, 0.007, 0]} material={blackGloss} castShadow receiveShadow>
        <cylinderGeometry args={[0.03, 0.035, 0.014, 64]} />
      </mesh>
      <group ref={ref} position={[0, 0.06, 0]} rotation={[0.41, 0, 0]}>
        <mesh material={blackGloss} castShadow><sphereGeometry args={[0.043, 48, 32]} /></mesh>
        {[0, 1, 2, 3, 4, 5].map((k) => (
          <mesh key={'m' + k} rotation={[0, (k * Math.PI) / 6, 0]} material={goldMat}>
            <torusGeometry args={[0.0445, 0.0008, 8, 96]} />
          </mesh>
        ))}
        {[-0.6, -0.25, 0.25, 0.6].map((t, k) => (
          <mesh key={'p' + k} position={[0, Math.sin(t) * 0.0445, 0]} rotation={[Math.PI / 2, 0, 0]} material={goldMat}>
            <torusGeometry args={[Math.cos(t) * 0.0445, 0.0008, 8, 96]} />
          </mesh>
        ))}
        <mesh rotation={[Math.PI / 2, 0, 0]} material={goldMat}><torusGeometry args={[0.0445, 0.0012, 8, 96]} /></mesh>
      </group>
     </group>
    </group>
  );
}

function Folio({ onClick, hover, setHover }) {
  const tex = useMemo(folioTex, []);
  const top = useMemo(() => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, metalness: 0.15 }), [tex]);
  const side = useMemo(() => new THREE.MeshStandardMaterial({ color: '#12100E', roughness: 0.75 }), []);
  const liftRef = useLift(hover === 'folio', 0.008);
  return (
    <group name="folio" position={[0.07, 0, -0.13]} rotation={[0, -0.22, 0]} onClick={(e) => { e.stopPropagation(); onClick(); }} {...hoverProps(setHover, 'folio')}>
     <group ref={liftRef}>
      <mesh position={[0, 0.007, 0]} material={[side, side, top, side, side, side]} castShadow receiveShadow>
        <boxGeometry args={[0.15, 0.014, 0.21]} />
      </mesh>
      <mesh position={[0.11, 0.0045, 0.02]} rotation={[0, 0.2, Math.PI / 2]} material={goldMat} castShadow>
        <cylinderGeometry args={[0.0045, 0.0045, 0.14, 24]} />
      </mesh>
     </group>
    </group>
  );
}

// Business cards in a stand; the front card comes up to you as the contact section.
function CardStand({ mode, portrait, onClick, hover, setHover }) {
  const tex = useMemo(cardTex, []);
  const face = useMemo(() => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 }), [tex]);
  const back = useMemo(() => new THREE.MeshStandardMaterial({ color: '#E6DFD0', roughness: 0.8 }), []);
  const walnut = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3A2416', roughness: 0.55 }), []);
  const at = portrait ? [0.07, 0, 0.09] : [0.22, 0, 0.1];
  const lean = { r: [-0.35, -0.3, 0] };
  const top = mode === 'card'
    ? (portrait ? { p: [0, 0.55, 0.0], r: [-1.0, 0, 0] } : { p: [0.1, 0.27, 0.3], r: [-0.53, -0.05, 0] })
    : { p: [at[0] + 0.002, 0.04, at[2] + 0.004], ...lean };
  const ref = useEase(top, 6);
  const liftRef = useLift(hover === 'card', 0.008);
  // shortcut: the lifted card does not leave the lamp, it gets a glow instead (same trick as the open file)
  face.emissive.set('#ffffff'); face.emissiveMap = tex; face.emissiveIntensity = mode === 'card' ? 0.35 : 0;
  const cardMats = [back, back, back, back, face, back];
  const handlers = { onClick: (e) => { e.stopPropagation(); onClick(); }, ...hoverProps(setHover, 'card') };
  return (
    <>
      <group name="card" position={at} rotation={[0, -0.3, 0]} {...handlers}>
       <group ref={liftRef}>
        <mesh position={[0, 0.006, 0]} material={walnut} castShadow receiveShadow>
          <boxGeometry args={[0.105, 0.012, 0.045]} />
        </mesh>
        <mesh position={[0, 0.03, -0.012]} rotation={[-0.35, 0, 0]} material={walnut} castShadow>
          <boxGeometry args={[0.095, 0.05, 0.003]} />
        </mesh>
        {[0, 1].map((k) => (
          <mesh key={k} position={[0, 0.038, -0.006 - k * 0.0012]} rotation={[-0.35, 0, 0]} material={cardMats} castShadow>
            <boxGeometry args={[0.089, 0.051, 0.0006]} />
          </mesh>
        ))}
       </group>
      </group>
      <group ref={ref} {...handlers}>
        <mesh material={cardMats} castShadow><boxGeometry args={[0.089, 0.051, 0.0006]} /></mesh>
      </group>
    </>
  );
}

// Poses for each file: stacked in a pile, spread so every label shows, or lifted to your eyes.
function filePose(i, mode, open, portrait) {
  const r = rng(90 + i);
  const j = 7 - i;
  if (mode === 'open' && open === i) {
    return portrait ? { p: [0, 0.62, -0.05], r: [1.3, 0, 0] } : { p: [-0.15, 0.12, 0.045], r: [1.04, 0, 0.02] };
  }
  if (mode === 'fan' || mode === 'open') {
    return { p: [-0.27 + j * 0.042, 0.002 + j * 0.0042, -0.3 + j * 0.046], r: [0, 0.05 - j * 0.012 + (r() - 0.5) * 0.04, 0] };
  }
  return { p: [-0.2 + (r() - 0.5) * 0.014, j * 0.0042, -0.12 + (r() - 0.5) * 0.014], r: [0, 0.1 + (r() - 0.5) * 0.12, 0] };
}

export function Desk({ mode, open, setMode, setOpen, onObject, portrait, quality }) {
  const high = quality === 'high';
  const [hover, setHover] = useState(null);
  const mugPose = mode === 'mug'
    ? (portrait ? { p: [0.06, 0.5, -0.02], r: [0.7, -0.5, 0.1] } : { p: [0.2, 0.14, 0.08], r: [0.35, -0.55, 0.08] })
    : { p: portrait ? [0.25, 0, 0.0] : [0.28, 0, -0.07], r: [0, -0.7, 0] };
  return (
    <>
      <Camera portrait={portrait} />
      {/* a lit study, not a lamp in the dark: neutral key light from the side, soft daylight fill from above */}
      <color attach="background" args={['#1E1B18']} />
      <fog attach="fog" args={['#1E1B18', 1.5, 3.2]} />
      <hemisphereLight args={['#FFE7C8', '#1E1B18', 0.38]} />
      <spotLight position={[-0.85, 0.6, -0.15]} angle={0.8} penumbra={1} intensity={6} decay={2} color="#FFD9A8"
        castShadow shadow-mapSize={high ? [4096, 4096] : [1024, 1024]} shadow-bias={-0.0002} shadow-normalBias={0.002} />
      <spotLight position={[0.25, 1.3, 0.7]} angle={0.9} penumbra={1} intensity={1.3} decay={2} color="#FFE6C4" />
      <pointLight position={[0.7, 0.35, -0.7]} intensity={0.25} color="#FFB547" />
      <Environment resolution={256} frames={1} environmentIntensity={0.55}>
        <Lightformer intensity={1.2} color="#FFE2BC" position={[-3, 4, -2]} scale={[4, 2, 1]} />
        <Lightformer intensity={0.7} color="#F5E6D2" position={[3, 3, 2]} scale={[3, 3, 1]} />
        <Lightformer intensity={0.6} position={[0, 5, 3]} scale={[5, 1, 1]} />
      </Environment>
      <mesh position={[0, 0.45, -0.9]} receiveShadow>
        <planeGeometry args={[4, 1.4]} />
        <meshStandardMaterial color="#3A332C" roughness={0.95} />
      </mesh>

      {high && <SoftShadows size={18} samples={14} focus={0.5} />}
      <Surface />
      <Nameplate />
      {projects.map((p, i) => (
        <File key={p.id} p={p} i={i} lit={mode === 'open' && open === i} pose={filePose(i, mode, open, portrait)} hover={hover} setHover={setHover}
          onClick={(k) => { if (mode !== 'fan' && mode !== 'open') setMode('fan'); else { setOpen(k); setMode('open'); } }} />
      ))}
      <Mug pose={mugPose} lifted={mode === 'mug'} hover={hover} setHover={setHover} onClick={() => setMode(mode === 'mug' ? 'desk' : 'mug')} />
      <Globe hover={hover} setHover={setHover} onClick={() => onObject('skills')} />
      <Folio hover={hover} setHover={setHover} onClick={() => onObject('resume')} />
      <CardStand mode={mode} portrait={portrait} hover={hover} setHover={setHover} onClick={() => setMode(mode === 'card' ? 'desk' : 'card')} />
      {/* grounding: soft dark contact where things touch the desk, then real ambient occlusion in the creases */}
      <ContactShadows position={[0, 0.0034, -0.1]} scale={[1.6, 1]} far={0.25} blur={1.6} opacity={0.9} resolution={high ? 1024 : 512} color="#000000" />
      {/* phones and slow machines skip the costly passes (AO, bloom, soft shadows); the look holds, the frame rate stays smooth */}
      {high ? (
        <EffectComposer multisampling={4}>
          <N8AO aoRadius={0.09} distanceFalloff={0.5} intensity={3.5} quality="high" halfRes={false} />
          <Bloom luminanceThreshold={1.4} intensity={0.2} mipmapBlur />
          {/* the composer switches off the renderer's tone mapping, so it has to come back here */}
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          <Vignette offset={0.3} darkness={0.45} />
          <Noise opacity={0.035} blendFunction={BlendFunction.OVERLAY} />
        </EffectComposer>
      ) : (
        <EffectComposer multisampling={0}>
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          <Vignette offset={0.3} darkness={0.45} />
        </EffectComposer>
      )}
    </>
  );
}
