import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { Desk } from './Desk.jsx';

// Tells the page the desk has actually been drawn (shaders compiled, first frame on screen), not just downloaded.
function Ready({ onReady, still }) {
  const n = useRef(0);
  useFrame(() => { if (++n.current === (still ? 1 : 2)) onReady(); });
  return null;
}

export default function Scene({ quality, onDecline, putBack, still, onReady, ...desk }) {
  return (
    <Canvas shadows dpr={quality === 'high' ? [1, 2] : [1, 1.5]} frameloop={still ? 'demand' : 'always'}
      camera={{ near: 0.01, far: 10 }} onPointerMissed={putBack} aria-hidden="true">
      {onDecline && <PerformanceMonitor onDecline={onDecline} />}
      <Desk quality={quality} {...desk} />
      <Ready onReady={onReady} still={still} />
    </Canvas>
  );
}
