import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, ContactShadows } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import TruckModel from "./TruckModel.jsx";
import { cameraPose } from "./cinematics.js";

/**
 * Cinematic background scene. Renders into a fixed, full-viewport canvas
 * that sits behind the UI overlay (z-0, pointer-events: none) — the DOM
 * above it owns scrolling and clicks.
 *
 * progressRef.current.p ∈ [0,1] is written by the GSAP ScrollTrigger in
 * ScrollOverlay and read here every frame — no React re-renders on scroll.
 */

const FOG_COLOR = "#0b1220";

function CameraRig({ progressRef, reduced }) {
  const { camera } = useThree();
  const lookAt = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    const p = reduced ? 0.82 : progressRef?.current?.p ?? 0;
    const pose = cameraPose(p);
    // critically-damped chase for extra silkiness on top of the scrub
    const k = 1 - Math.exp(-9 * delta);
    camera.position.lerp(new THREE.Vector3(...pose.pos), reduced ? 1 : k);
    lookAt.current.lerp(new THREE.Vector3(...pose.look), reduced ? 1 : k);
    camera.lookAt(lookAt.current);
    if (Math.abs(camera.fov - pose.fov) > 0.01) {
      camera.fov = THREE.MathUtils.lerp(camera.fov, pose.fov, reduced ? 1 : k);
      camera.updateProjectionMatrix();
    }
  });

  return null;
}

function Ground() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[240, 240]} />
        <meshStandardMaterial color="#0d1524" roughness={0.95} metalness={0} />
      </mesh>
      <gridHelper args={[240, 120, "#1b2740", "#131d31"]} position={[0, -0.01, 0]} />
    </group>
  );
}

export default function Scene({ progressRef }) {
  const reduced = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );
  // Cap resolution harder on phones/low-power GPUs where this scene is heaviest.
  const coarse = useMemo(
    () => window.matchMedia("(pointer: coarse)").matches,
    []
  );

  // ── Render only while the cinematic act is actually on screen ──────────
  // R3F's default frameloop renders EVERY frame for the component's whole
  // life — so once you scroll down to the cards/login the GPU is still
  // drawing this bloom+shadow scene behind a hidden canvas, stealing frames
  // from the scroll. We watch the flow element that spans the act and switch
  // the loop off the moment it leaves the viewport (and back on before it
  // returns), which is the single biggest smoothness win on this page.
  const [active, setActive] = useState(true);
  useEffect(() => {
    if (reduced) {
      // Nothing animates under reduced-motion: let it settle, then freeze.
      const t = setTimeout(() => setActive(false), 900);
      return () => clearTimeout(t);
    }
    const act = document.getElementById("cine-act");
    if (!act) return;
    const io = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting),
      { rootMargin: "300px 0px 300px 0px" } // resume just before it re-enters
    );
    io.observe(act);
    return () => io.disconnect();
  }, [reduced]);

  return (
    <div
      id="cine-canvas"
      className="fixed inset-0 w-screen h-screen z-0 pointer-events-none"
      aria-hidden="true"
    >
      <Canvas
        shadows
        frameloop={active ? "always" : "never"}
        dpr={coarse ? [1, 1.25] : [1, 1.75]}
        camera={{ position: cameraPose(reduced ? 0.82 : 0).pos, fov: 32, near: 0.1, far: 260 }}
        gl={{ antialias: false, powerPreference: "high-performance" }}
      >
        <color attach="background" args={[FOG_COLOR]} />
        <fog attach="fog" args={[FOG_COLOR, 26, 90]} />

        {/* image-based lighting — realistic city reflections on the truck's
            paint & metal. Suspends while the HDR loads, hence the wrapper. */}
        <Suspense fallback={null}>
          <Environment preset="city" />
        </Suspense>

        {/* key light — warm, adds directional self-shadowing on top of the IBL */}
        <directionalLight
          position={[8, 14, 6]}
          intensity={1.7}
          color="#ffffff"
          castShadow
          shadow-mapSize={1024}
          shadow-bias={-0.0002}
        />
        {/* brand rims — lime kick from behind, purple wash from the flank */}
        <spotLight position={[-14, 7, -9]} intensity={90} color="#84D12A" angle={0.5} penumbra={1} distance={60} />
        <spotLight position={[6, 9, 14]} intensity={70} color="#8b5cf6" angle={0.55} penumbra={1} distance={60} />
        <hemisphereLight intensity={0.3} color="#9db4d8" groundColor="#0b1220" />
        <ambientLight intensity={0.18} />

        <Ground />
        <TruckModel />
        {/* soft contact shadow pooled directly under the grounded truck */}
        <ContactShadows
          position={[0, 0.012, 0]}
          scale={16}
          resolution={1024}
          blur={2.6}
          opacity={0.62}
          far={6}
          color="#05070d"
        />
        <CameraRig progressRef={progressRef} reduced={reduced} />

        <EffectComposer multisampling={coarse ? 0 : 2}>
          {/* subtle glow on headlights / speculars */}
          <Bloom intensity={0.85} luminanceThreshold={0.85} luminanceSmoothing={0.2} mipmapBlur />
          {/* dramatic edge falloff */}
          <Vignette eskil={false} offset={0.24} darkness={0.78} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
