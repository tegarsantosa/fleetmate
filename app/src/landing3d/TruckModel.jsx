import React, { useMemo, useRef, useState, useEffect, Suspense } from "react";
import { useFrame, useGraph } from "@react-three/fiber";
import { useGLTF, RoundedBox, Edges } from "@react-three/drei";
import * as THREE from "three";
import { truckAttitude, CABIN_GREEN } from "./cinematics.js";

/**
 * Cargo-truck hero model.
 *
 * Primary path: a low-poly GLB at /models/truck.glb (drop the asset into
 * app/public/models/truck.glb — the folder is volume-mounted, no rebuild
 * needed). Its cabin meshes are located via useGraph and repainted with the
 * brand green while preserving each material's roughness/metalness.
 *
 * Fallback path: if the GLB is absent, a fully procedural truck renders the
 * same silhouette so the cinematic never breaks.
 *
 * Convention: centered at origin, resting on y = 0, grille facing -X.
 */

const TRUCK_GLB_URL = "/models/truck.glb";

/* Names that mark cabin/body meshes across common low-poly truck exports. */
const CABIN_NAME_HINTS = ["cab", "cabin", "body", "chassis_cab", "truck_body"];

function isCabinNode(name = "") {
  const n = name.toLowerCase();
  return CABIN_NAME_HINTS.some((hint) => n.includes(hint));
}

function GltfTruck({ progressRef }) {
  const group = useRef();
  const { scene } = useGLTF(TRUCK_GLB_URL);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const { nodes } = useGraph(cloned);

  /* Normalize + repaint once per clone. */
  useMemo(() => {
    // --- dynamic material modification: find cabin meshes, keep PBR props ---
    const cabinColor = new THREE.Color(CABIN_GREEN);
    const repaint = (mesh) => {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((mat) => {
        if (!mat || !mat.color) return;
        // clone so the cached GLTF isn't mutated for other consumers,
        // then change ONLY the color — roughness/metalness/maps stay intact
        const painted = mat.clone();
        painted.color.copy(cabinColor);
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((m) => (m === mat ? painted : m));
        } else {
          mesh.material = painted;
        }
      });
    };

    let repainted = 0;
    Object.values(nodes).forEach((node) => {
      if (node.isMesh && isCabinNode(node.name)) {
        repaint(node);
        repainted++;
      }
    });
    // no recognizable cabin names → paint the largest mesh (typical for
    // single-mesh low-poly exports)
    if (repainted === 0) {
      let largest = null;
      let volume = 0;
      cloned.traverse((n) => {
        if (!n.isMesh) return;
        const box = new THREE.Box3().setFromObject(n);
        const s = box.getSize(new THREE.Vector3());
        const v = s.x * s.y * s.z;
        if (v > volume) { volume = v; largest = n; }
      });
      if (largest) repaint(largest);
    }

    cloned.traverse((n) => {
      if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; }
    });

    // --- normalize footprint: ~9.2 m long, grounded, centered, nose to -X ---
    const bounds = new THREE.Box3().setFromObject(cloned);
    const size = bounds.getSize(new THREE.Vector3());
    const longest = Math.max(size.x, size.z) || 1;
    const scale = 9.2 / longest;
    cloned.scale.setScalar(scale);
    // most vehicle exports run along +Z; rotate the long axis onto X
    if (size.z > size.x) cloned.rotation.y = Math.PI / 2;
    const after = new THREE.Box3().setFromObject(cloned);
    const center = after.getCenter(new THREE.Vector3());
    cloned.position.x -= center.x;
    cloned.position.z -= center.z;
    cloned.position.y -= after.min.y;
    return cloned;
  }, [cloned, nodes]);

  useFrame((state) => {
    applyAttitude(group.current, progressRef, state.clock.elapsedTime);
  });

  return (
    <group ref={group}>
      <primitive object={cloned} />
    </group>
  );
}

/* ---------- procedural fallback (no external asset required) ---------- */

function makeCorrugatedTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#334155";
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = "#28354a";
  for (let x = 0; x < 128; x += 16) ctx.fillRect(x, 0, 7, 128);
  ctx.fillStyle = "#3e4d66";
  for (let x = 10; x < 128; x += 16) ctx.fillRect(x, 0, 2, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(12, 1);
  return tex;
}

function Wheel({ position }) {
  return (
    <group position={position}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.55, 0.55, 0.38, 28]} />
        <meshStandardMaterial color="#12151c" roughness={0.9} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.4, 20]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.25} />
      </mesh>
    </group>
  );
}

function ProceduralTruck({ progressRef }) {
  const group = useRef();
  const wallTex = useMemo(() => makeCorrugatedTexture(), []);
  const paint = { color: CABIN_GREEN, metalness: 0.45, roughness: 0.35 };
  const glass = { color: "#0b1120", metalness: 0.9, roughness: 0.08 };

  // layout: total ≈ 9.2 m on X, front at -4.6
  const W = 2.5;
  const cabX = -3.4; // cab center
  const boxX = 1.15; // container center

  useFrame((state) => {
    applyAttitude(group.current, progressRef, state.clock.elapsedTime);
  });

  return (
    <group ref={group}>
      {/* chassis */}
      <mesh position={[0, 0.85, 0]} castShadow>
        <boxGeometry args={[9.0, 0.32, W * 0.8]} />
        <meshStandardMaterial color="#111827" metalness={0.6} roughness={0.45} />
      </mesh>

      {/* cab — brand green */}
      <RoundedBox args={[2.3, 2.0, W]} radius={0.1} smoothness={3} position={[cabX, 2.0, 0]} castShadow>
        <meshStandardMaterial {...paint} />
      </RoundedBox>
      <RoundedBox args={[2.4, 0.6, W * 1.02]} radius={0.07} smoothness={3} position={[cabX, 1.05, 0]} castShadow>
        <meshStandardMaterial color="#0f172a" metalness={0.5} roughness={0.5} />
      </RoundedBox>
      {/* roof deflector */}
      <RoundedBox args={[1.2, 0.6, W * 0.9]} radius={0.08} smoothness={3} position={[cabX + 0.5, 3.12, 0]} rotation={[0, 0, -0.3]} castShadow>
        <meshStandardMaterial {...paint} />
      </RoundedBox>
      {/* windshield & side glass */}
      <RoundedBox args={[0.06, 0.85, W * 0.84]} radius={0.02} position={[cabX - 1.16, 2.45, 0]} rotation={[0, 0, 0.13]}>
        <meshStandardMaterial {...glass} />
      </RoundedBox>
      {[W / 2, -W / 2].map((z, i) => (
        <RoundedBox key={i} args={[1.0, 0.55, 0.03]} radius={0.015} position={[cabX - 0.25, 2.45, z]}>
          <meshStandardMaterial {...glass} />
        </RoundedBox>
      ))}
      {/* grille */}
      {[1.35, 1.52, 1.69].map((y) => (
        <mesh key={y} position={[cabX - 1.22, y, 0]}>
          <boxGeometry args={[0.05, 0.08, W * 0.62]} />
          <meshStandardMaterial color="#0a0f18" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}
      {/* bumper */}
      <RoundedBox args={[0.3, 0.32, W * 1.04]} radius={0.05} position={[cabX - 1.2, 0.72, 0]}>
        <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.35} />
      </RoundedBox>
      {/* headlights — emissive so Bloom catches them */}
      {[W * 0.36, -W * 0.36].map((z, i) => (
        <mesh key={i} position={[cabX - 1.24, 1.0, z]}>
          <boxGeometry args={[0.06, 0.14, 0.34]} />
          <meshStandardMaterial color="#fffbe8" emissive="#ffe9a8" emissiveIntensity={4} toneMapped={false} />
        </mesh>
      ))}
      {/* mirrors */}
      {[W / 2 + 0.14, -W / 2 - 0.14].map((z, i) => (
        <mesh key={i} position={[cabX - 1.0, 2.55, z]}>
          <boxGeometry args={[0.05, 0.36, 0.16]} />
          <meshStandardMaterial {...glass} />
        </mesh>
      ))}
      {/* exhaust stacks */}
      {[W * 0.34, -W * 0.34].map((z, i) => (
        <mesh key={i} position={[cabX + 1.05, 2.4, z]}>
          <cylinderGeometry args={[0.06, 0.06, 1.6, 12]} />
          <meshStandardMaterial color="#8b96a8" metalness={0.9} roughness={0.2} />
        </mesh>
      ))}

      {/* cargo box */}
      <mesh position={[boxX, 2.25, 0]} castShadow>
        <boxGeometry args={[6.4, 2.75, W]} />
        <meshStandardMaterial map={wallTex} metalness={0.4} roughness={0.6} />
        <Edges color="rgba(148,163,184,0.35)" />
      </mesh>
      {/* brand stripe along the box */}
      <mesh position={[boxX, 1.05, 0]}>
        <boxGeometry args={[6.42, 0.16, W + 0.02]} />
        <meshStandardMaterial color={CABIN_GREEN} metalness={0.4} roughness={0.4} />
      </mesh>

      {/* wheels — front axle + rear tandem, both sides */}
      {[-3.6, 1.6, 2.9].map((x) =>
        [W / 2, -W / 2].map((z) => <Wheel key={`${x}${z}`} position={[x, 0.55, z]} />)
      )}
    </group>
  );
}

/* ---------- shared attitude driver ---------- */

function applyAttitude(obj, progressRef, time) {
  if (!obj) return;
  const p = progressRef?.current?.p ?? 0;
  const { roll, pitch, yaw, bob } = truckAttitude(p, time);
  // rotation order ZXY: roll (z) and pitch (x) read as true banking under yaw
  obj.rotation.set(pitch, yaw, roll, "YXZ");
  obj.position.y = bob;
}

/* ---------- availability probe + error boundary ---------- */

class GltfBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

export default function TruckModel({ progressRef }) {
  const [glbAvailable, setGlbAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(TRUCK_GLB_URL, { method: "HEAD" })
      .then((r) => {
        const type = r.headers.get("content-type") || "";
        // vite's SPA fallback answers 200 text/html for missing files
        if (!cancelled && r.ok && !type.includes("html")) {
          setGlbAvailable(true);
          useGLTF.preload(TRUCK_GLB_URL);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const fallback = <ProceduralTruck progressRef={progressRef} />;
  if (!glbAvailable) return fallback;
  return (
    <GltfBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <GltfTruck progressRef={progressRef} />
      </Suspense>
    </GltfBoundary>
  );
}
