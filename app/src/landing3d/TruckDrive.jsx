import React, { useEffect, useRef, useState, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import TruckModel from "./TruckModel.jsx";
import { clamp01, smootherstep } from "./cinematics.js";

gsap.registerPlugin(ScrollTrigger);

/**
 * TruckDrive — pinned horizontal storytelling section.
 *
 * The outer section is 280vh tall; a sticky full-viewport stage stays pinned
 * while the user scrolls through it, and that pin-progress drives the SAME
 * procedural/GLB truck driving left → right across the stage while three
 * stat callouts fade through (scrubbed GSAP timeline, the exact pattern
 * ScrollOverlay.jsx already uses).
 *
 * ISOLATED EXCEPTION to the "truck never moves" rule: the hero truck in
 * Scene.jsx stays grounded and static (camera does all the motion there).
 * Here — and ONLY here — the truck's wrapper group translates on X to read
 * as "driving". It still never pitches, rolls, or leaves y = 0.
 *
 * Perf: this Canvas follows Scene.jsx's gating pattern — an
 * IntersectionObserver on the section flips frameloop 'always' / 'never'
 * (rootMargin 300px), so it costs nothing while off-screen. On mobile /
 * reduced-motion the section renders as a static stat block with no canvas
 * and no pin at all.
 */

const FOG_COLOR = "#0b1220";

const CALLOUTS = [
  {
    kicker: "Best-fit scheduling",
    title: "Every truck leaves full.",
    sub: "Partially loaded vehicles fill first — full ones roll out.",
  },
  {
    kicker: "Utilization",
    title: "15–20% more per trip.",
    sub: "The same volume shipped in fewer vehicles, targeted in the first quarter.",
  },
  {
    kicker: "One console",
    title: "Scan → pack → dispatch.",
    sub: "The loading dock, the engine and the fleet in a single view.",
  },
];

/* The truck, wrapped in a group whose X position is scrubbed by scroll.
   ContactShadows lives inside the group so the shadow travels with it. */
function DrivenTruck({ progressRef }) {
  const group = useRef();
  useFrame((_, delta) => {
    if (!group.current) return;
    const p = clamp01(progressRef.current?.p ?? 0);
    const targetX = THREE.MathUtils.lerp(-14, 14, smootherstep(p));
    // critically-damped chase (same trick as Scene.jsx's CameraRig) so the
    // drive stays silky even when the scrub input is steppy
    const k = 1 - Math.exp(-9 * delta);
    group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, targetX, k);
  });
  return (
    <group ref={group} position={[-14, 0, 0]}>
      <TruckModel />
      <ContactShadows position={[0, 0.012, 0]} scale={16} resolution={512} blur={2.6} opacity={0.6} far={6} color="#05070d" />
    </group>
  );
}

function DriveGround() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[240, 240]} />
        <meshStandardMaterial color="#0d1524" roughness={0.95} metalness={0} />
      </mesh>
      <gridHelper args={[240, 120, "#1b2740", "#131d31"]} position={[0, -0.01, 0]} />
    </group>
  );
}

/* Static fallback — mobile & reduced-motion users get the three claims as a
   plain dark stat band: nothing pinned, nothing animated, nothing broken. */
function StaticDrive() {
  return (
    <section className="ld-drive-static">
      <div className="ld-container">
        <div className="ld-kicker" style={{ color: "#a3e635" }}>The fleet in motion</div>
        <div className="ld-drive-static-grid">
          {CALLOUTS.map((c) => (
            <div key={c.title} className="ld-drive-static-card">
              <div className="k">{c.kicker}</div>
              <h3>{c.title}</h3>
              <p>{c.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function TruckDrive() {
  const sectionRef = useRef(null);
  const progressRef = useRef({ p: 0 });
  // mirrors Landing.jsx's desktop/reduced gates — re-evaluated on resize so a
  // window that starts small (or an embedded pane that opens collapsed) and
  // then grows still upgrades to the live pinned experience
  const evalLive = () => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const desktop = window.matchMedia("(min-width: 769px)").matches && !("ontouchstart" in window);
    return desktop && !reduced;
  };
  const [live, setLive] = useState(evalLive);
  useEffect(() => {
    const onChange = () => setLive(evalLive());
    // MediaQueryList change fires even when the environment doesn't deliver a
    // window resize event (embedded panes, some zoom/DPR switches).
    const mq = window.matchMedia("(min-width: 769px)");
    mq.addEventListener("change", onChange);
    window.addEventListener("resize", onChange);
    return () => {
      mq.removeEventListener("change", onChange);
      window.removeEventListener("resize", onChange);
    };
  }, []);

  // frameloop gate — Scene.jsx's exact pattern, scoped to this section
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!live || !sectionRef.current) return;
    const io = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting),
      { rootMargin: "300px 0px 300px 0px" }
    );
    io.observe(sectionRef.current);
    return () => io.disconnect();
  }, [live]);

  // pin progress + scrubbed callout timeline (ScrollOverlay's pattern)
  useEffect(() => {
    if (!live || !sectionRef.current) return;
    const section = sectionRef.current;
    const callouts = gsap.utils.toArray(section.querySelectorAll("[data-drive-callout]"));
    const triggers = [];

    triggers.push(
      ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => { progressRef.current.p = self.progress; },
      })
    );

    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: { trigger: section, start: "top top", end: "bottom bottom", scrub: 0.5 },
    });
    callouts.forEach((el, i) => {
      const at = 0.12 + i * 0.28; // checkpoints along the pin
      tl.fromTo(el, { autoAlpha: 0, y: 46 }, { autoAlpha: 1, y: 0, duration: 0.09 }, at)
        .to(el, { autoAlpha: 1, y: -6, duration: 0.1 }, at + 0.09)
        .to(el, { autoAlpha: 0, y: -44, duration: 0.09 }, at + 0.19);
    });
    triggers.push(tl.scrollTrigger);

    return () => triggers.forEach((t) => t && t.kill());
  }, [live]);

  if (!live) return <StaticDrive />;

  return (
    <section ref={sectionRef} className="ld-drive" aria-label="FleetMate fleet in motion">
      <div className="ld-drive-stage">
        <div className="ld-drive-canvas">
          <Canvas
            frameloop={active ? "always" : "never"}
            dpr={[1, 1.75]}
            camera={{ position: [0, 3.0, 13], fov: 36, near: 0.1, far: 260 }}
            gl={{ antialias: false, powerPreference: "high-performance" }}
            onCreated={({ camera }) => camera.lookAt(0, 1.5, 0)}
          >
            <color attach="background" args={[FOG_COLOR]} />
            <fog attach="fog" args={[FOG_COLOR, 24, 80]} />
            <Suspense fallback={null}>
              <Environment preset="city" />
            </Suspense>
            <directionalLight position={[8, 14, 6]} intensity={1.5} color="#ffffff" />
            <spotLight position={[-14, 7, -9]} intensity={80} color="#84D12A" angle={0.5} penumbra={1} distance={60} />
            <spotLight position={[6, 9, 14]} intensity={60} color="#8b5cf6" angle={0.55} penumbra={1} distance={60} />
            <hemisphereLight intensity={0.3} color="#9db4d8" groundColor="#0b1220" />
            <ambientLight intensity={0.18} />
            <DriveGround />
            <DrivenTruck progressRef={progressRef} />
          </Canvas>
        </div>

        <div className="ld-drive-kicker">The fleet in motion — keep scrolling</div>

        {CALLOUTS.map((c) => (
          <div key={c.title} className="ld-drive-callout" data-drive-callout>
            <div className="k">{c.kicker}</div>
            <h3>{c.title}</h3>
            <p>{c.sub}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
