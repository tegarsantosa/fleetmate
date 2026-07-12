import React, { useMemo, useRef, useState, useEffect, Suspense } from "react";
import { useGLTF, RoundedBox, Edges } from "@react-three/drei";
import * as THREE from "three";
import { CABIN_GREEN } from "./cinematics.js";

/**
 * Cargo-truck hero model.
 *
 * Primary path: a low-poly GLB — the "Cargo Truck – Low poly" by LagzDesign —
 * placed at app/public/models/cargo_truck.glb. That folder is volume-mounted
 * into the dev container, so dropping the file in needs no rebuild/restart.
 * Its CABIN meshes are located and repainted vivid lime (#84D12A) while every
 * material's roughness / metalness / maps are preserved. Tyres and the cargo
 * box are never touched.
 *
 * Fallback path: if the GLB is absent, a fully procedural truck renders the
 * same silhouette so the hero never breaks.
 *
 * GROUNDED PHYSICS (hard rule): the truck is always planted flat on y = 0 with
 * every wheel on the ground. It never pitches or rolls — all cinematic motion
 * comes from the camera (see Scene.jsx), not from tilting the vehicle.
 *
 * Convention: centred at the origin, resting on y = 0, grille facing -X.
 */

const TRUCK_GLB_URL = "/models/cargo_truck.glb";

/* If auto-detection ever misses your model's cab, set this to the exact mesh
   name (case-insensitive substring) and it wins over the heuristics below. */
const CABIN_MESH_OVERRIDE = "";

/* Names that mark cabin/body meshes across common low-poly truck exports. */
const CABIN_HINTS = ["cab", "cabin", "driver", "head", "front", "truck_body", "chassis_cab", "body"];
/* Names that must NEVER be recoloured (tyres, the cargo box, glass, etc.). */
const EXCLUDE_HINTS = [
  "wheel", "tire", "tyre", "rim", "hub",
  "cargo", "box", "container", "trailer", "bed", "crate", "pallet",
  "glass", "window", "windshield", "light", "lamp", "head_light", "headlight",
  "ground", "shadow", "plane", "floor",
];

function classify(name = "") {
  const n = name.toLowerCase();
  if (CABIN_MESH_OVERRIDE && n.includes(CABIN_MESH_OVERRIDE.toLowerCase())) return "cabin";
  if (EXCLUDE_HINTS.some((h) => n.includes(h))) return "exclude";
  if (CABIN_HINTS.some((h) => n.includes(h))) return "cabin";
  return "unknown";
}

/* Recolour a mesh's material(s) to the brand green, cloning first so the cached
   GLTF isn't mutated for other consumers, and changing ONLY `.color`. */
function repaintCabin(mesh, color) {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const painted = mats.map((mat) => {
    if (!mat || !mat.color) return mat;
    const clone = mat.clone();
    clone.color.copy(color); // roughness / metalness / maps stay intact
    return clone;
  });
  mesh.material = Array.isArray(mesh.material) ? painted : painted[0];
}

function GltfTruck() {
  const { scene } = useGLTF(TRUCK_GLB_URL);

  const model = useMemo(() => {
    const root = scene.clone(true);
    const cabinColor = new THREE.Color(CABIN_GREEN);

    // Gather meshes with their classification.
    const meshes = [];
    root.traverse((n) => {
      if (n.isMesh) {
        n.castShadow = true;
        n.receiveShadow = true;
        meshes.push({ mesh: n, kind: classify(n.name) });
      }
    });

    // 1) Repaint every explicitly-named cabin mesh.
    let painted = 0;
    meshes.forEach(({ mesh, kind }) => {
      if (kind === "cabin") { repaintCabin(mesh, cabinColor); painted++; }
    });

    // 2) Nothing named a cabin? Pick the front-most substantial mesh that is
    //    NOT on the exclude list — for a box truck that's the cab, at the
    //    grille end. We measure in the model's own space, then normalise below.
    if (painted === 0) {
      const bounds = new THREE.Box3().setFromObject(root);
      const size = bounds.getSize(new THREE.Vector3());
      const axis = size.x >= size.z ? "x" : "z"; // long axis = truck length
      let best = null;
      let bestFront = Infinity;
      meshes.forEach(({ mesh, kind }) => {
        if (kind === "exclude") return;
        const b = new THREE.Box3().setFromObject(mesh);
        const s = b.getSize(new THREE.Vector3());
        if (s.x * s.y * s.z < (size.x * size.y * size.z) * 0.02) return; // skip tiny detail meshes
        const front = b.min[axis]; // most negative = front end
        if (front < bestFront) { bestFront = front; best = mesh; }
      });
      if (best) repaintCabin(best, cabinColor);
    }

    // --- normalise footprint: ~9.2 m long, grounded, centred, nose to -X ---
    const bounds = new THREE.Box3().setFromObject(root);
    const size = bounds.getSize(new THREE.Vector3());
    const longest = Math.max(size.x, size.z) || 1;
    root.scale.setScalar(9.2 / longest);
    if (size.z > size.x) root.rotation.y = Math.PI / 2; // long axis onto X
    const after = new THREE.Box3().setFromObject(root);
    const center = after.getCenter(new THREE.Vector3());
    root.position.x -= center.x;
    root.position.z -= center.z;
    root.position.y -= after.min.y; // plant on the ground
    return root;
  }, [scene]);

  // Grounded & still — no per-frame rotation. Camera owns the motion.
  return <primitive object={model} />;
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

function ProceduralTruck() {
  const wallTex = useMemo(() => makeCorrugatedTexture(), []);
  const paint = { color: CABIN_GREEN, metalness: 0.45, roughness: 0.35 };
  const glass = { color: "#0b1120", metalness: 0.9, roughness: 0.08 };

  // layout: total ≈ 9.2 m on X, front grille at -4.6, resting on y = 0
  const W = 2.5;
  const cabX = -3.4; // cab centre
  const boxX = 1.15; // container centre

  return (
    <group>
      {/* chassis */}
      <mesh position={[0, 0.85, 0]} castShadow>
        <boxGeometry args={[9.0, 0.32, W * 0.8]} />
        <meshStandardMaterial color="#111827" metalness={0.6} roughness={0.45} />
      </mesh>

      {/* cab — brand green (#84D12A) */}
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

      {/* cargo box — untouched neutral corrugated material */}
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

      {/* wheels — front axle + rear tandem, both sides, all planted on y≈0.55 */}
      {[-3.6, 1.6, 2.9].map((x) =>
        [W / 2, -W / 2].map((z) => <Wheel key={`${x}${z}`} position={[x, 0.55, z]} />)
      )}
    </group>
  );
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

export default function TruckModel() {
  const [glbAvailable, setGlbAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(TRUCK_GLB_URL, { method: "HEAD" })
      .then((r) => {
        const type = r.headers.get("content-type") || "";
        // Vite's SPA fallback answers 200 text/html for a missing file — treat
        // only a real binary response as "present".
        if (!cancelled && r.ok && !type.includes("html")) {
          setGlbAvailable(true);
          useGLTF.preload(TRUCK_GLB_URL);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const fallback = <ProceduralTruck />;
  if (!glbAvailable) return fallback;
  return (
    <GltfBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <GltfTruck />
      </Suspense>
    </GltfBoundary>
  );
}
