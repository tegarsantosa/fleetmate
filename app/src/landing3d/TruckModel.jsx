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

/** Brand wordmark drawn on a canvas — no external font/asset needed.
 *  Lime box icon + "FLEET" (white) + "MATE" (lime) on transparency. */
function makeWordmarkTexture() {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 256;
  const ctx = c.getContext("2d");
  // icon: lime rounded square with a dark "box" punched in
  ctx.fillStyle = "#84D12A";
  ctx.beginPath();
  ctx.roundRect(28, 46, 164, 164, 30);
  ctx.fill();
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.roundRect(72, 90, 76, 76, 14);
  ctx.fill();
  // wordmark
  ctx.textBaseline = "middle";
  ctx.font = "800 148px -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
  ctx.fillStyle = "#f8fafc";
  ctx.fillText("FLEET", 236, 136);
  const w = ctx.measureText("FLEET").width;
  ctx.fillStyle = "#84D12A";
  ctx.fillText("MATE", 236 + w, 136);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

/* Tire tread — alternating dark tread blocks wrapped around the cylinder's
 * circumference (U axis) instead of a smooth black rubber cylinder. Created
 * once and shared by every Wheel instance (10 wheels use this truck-wide). */
let _tireTreadTex = null;
function getTireTreadTexture() {
  if (_tireTreadTex) return _tireTreadTex;
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 32;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#1c2027";
  ctx.fillRect(0, 0, 128, 32);
  ctx.fillStyle = "#0a0c10";
  for (let x = 0; x < 128; x += 16) ctx.fillRect(x, 0, 8, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(11, 1);
  _tireTreadTex = tex;
  return tex;
}

/* Wheel — EV-truck aero design (Tesla Semi language): a TORUS tire with real
 * rounded shoulders + a closed polished aero disc cover + a glowing lime hub
 * ring. Reads "futuristic electric fleet", not "toy cylinder". */
function Wheel({ position }) {
  const treadTex = useMemo(() => {
    const t = getTireTreadTexture().clone();
    t.needsUpdate = true;
    t.repeat.set(26, 1); // tread blocks around the torus circumference
    return t;
  }, []);
  return (
    <group position={position}>
      {/* tire — torus: round sidewall shoulders like a real tire carcass */}
      <mesh castShadow>
        <torusGeometry args={[0.4, 0.16, 14, 36]} />
        <meshStandardMaterial map={treadTex} color="#c9ced6" roughness={0.92} />
      </mesh>
      {/* closed aero disc cover (both faces), gunmetal polished */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.395, 0.395, 0.24, 28]} />
        <meshStandardMaterial color="#2a313c" metalness={0.9} roughness={0.22} />
      </mesh>
      {/* concentric machining groove on each face */}
      {[0.125, -0.125].map((z) => (
        <mesh key={`gr${z}`} position={[0, 0, z]}>
          <torusGeometry args={[0.27, 0.012, 6, 28]} />
          <meshStandardMaterial color="#111722" metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
      {/* glowing lime hub ring — the EV signature, catches Bloom */}
      {[0.128, -0.128].map((z) => (
        <mesh key={`hub${z}`} position={[0, 0, z]}>
          <torusGeometry args={[0.11, 0.016, 6, 24]} />
          <meshStandardMaterial color={CABIN_GREEN} emissive={CABIN_GREEN} emissiveIntensity={1.3} toneMapped={false} />
        </mesh>
      ))}
      {/* centre cap */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.055, 0.055, 0.27, 12]} />
        <meshStandardMaterial color="#0f172a" metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  );
}

function ProceduralTruck() {
  const wallTex = useMemo(() => makeCorrugatedTexture(), []);
  // Rear-door texture: same corrugation, but re-tiled so the stripe pitch on a
  // ~1.1 m door leaf matches the pitch on the 6.4 m wall (shared image, own repeat).
  const doorTex = useMemo(() => {
    const t = wallTex.clone();
    t.needsUpdate = true;
    t.repeat.set(2, 1);
    return t;
  }, [wallTex]);
  const wordmarkTex = useMemo(() => makeWordmarkTexture(), []);
  // Clearcoat automotive paint — crisp secondary speculars from the city IBL.
  const paint = { color: CABIN_GREEN, metalness: 0.45, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.15 };
  // Slightly transparent glass so the cab interior reads as a silhouette —
  // an occupied machine, not a painted-on black decal.
  const glass = { color: "#101b2e", metalness: 0.6, roughness: 0.1, transparent: true, opacity: 0.78 };
  const mirrorGlass = { color: "#0b1120", metalness: 0.9, roughness: 0.12 };
  const rubber = { color: "#0b0e13", metalness: 0.05, roughness: 0.95 };

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

      {/* ---- cab, modern cab-over: ONE continuous body (not stacked boxes —
           that was the "boxes on boxes" look). No hood wedge, no roof fairing
           — both read as disconnected floating flaps at this scale and were
           removed; a visible cab-to-box gap is exactly what real box trucks
           (Isuzu NPR etc.) look like, so leaving it open is more authentic
           than a badly-shaped filler panel. Bigger corner radius throughout
           so surfaces read as molded, not slab-sided. */}
      {/* main body: beltline through greenhouse in a single volume */}
      <RoundedBox args={[2.2, 2.05, W]} radius={0.17} smoothness={4} position={[cabX, 2.02, 0]} castShadow>
        <meshPhysicalMaterial {...paint} />
      </RoundedBox>
      {/* beltline trim — a deliberate character line at the body's midpoint,
          not an accidental seam */}
      <mesh position={[cabX, 2.02, 0]}>
        <boxGeometry args={[2.24, 0.05, W + 0.02]} />
        <meshStandardMaterial color="#0a0f18" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* roof cap — low and clean, sits flush on the main body */}
      <RoundedBox args={[1.9, 0.16, W - 0.3]} radius={0.07} smoothness={3} position={[cabX + 0.05, 3.13, 0]} castShadow>
        <meshPhysicalMaterial {...paint} />
      </RoundedBox>
      {/* dark rocker band under the doors */}
      <RoundedBox args={[2.4, 0.6, W * 1.02]} radius={0.07} smoothness={3} position={[cabX, 1.05, 0]} castShadow>
        <meshStandardMaterial color="#0f172a" metalness={0.5} roughness={0.5} />
      </RoundedBox>
      {/* windshield — flush with the greenhouse front, gently raked */}
      <RoundedBox args={[0.05, 0.82, 1.98]} radius={0.03} position={[cabX - 1.04, 2.56, 0]} rotation={[0, 0, 0.1]}>
        <meshStandardMaterial {...glass} />
      </RoundedBox>
      {/* wraparound side windows, flush on the merged body's full width */}
      {[W / 2 + 0.012, -(W / 2 + 0.012)].map((z, i) => (
        <RoundedBox key={i} args={[1.6, 0.6, 0.03]} radius={0.02} position={[cabX - 0.05, 2.62, z]}>
          <meshStandardMaterial {...glass} />
        </RoundedBox>
      ))}
      {/* face: dark grille panel + full-width LED DRL bar + brand mark */}
      <RoundedBox args={[0.1, 0.62, 1.9]} radius={0.03} smoothness={2} position={[cabX - 1.19, 1.42, 0]}>
        <meshStandardMaterial color="#0a0f18" metalness={0.7} roughness={0.3} />
      </RoundedBox>
      <mesh position={[cabX - 1.23, 1.86, 0]}>
        <boxGeometry args={[0.03, 0.05, 1.9]} />
        <meshStandardMaterial color="#e8f6ff" emissive="#dff1ff" emissiveIntensity={2.4} toneMapped={false} />
      </mesh>
      <mesh position={[cabX - 1.25, 1.28, 0]}>
        <boxGeometry args={[0.02, 0.03, 1.6]} />
        <meshStandardMaterial color={CABIN_GREEN} emissive={CABIN_GREEN} emissiveIntensity={0.6} />
      </mesh>
      {/* FLEETMATE mark on the grille */}
      <mesh position={[cabX - 1.255, 1.6, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[0.72, 0.18]} />
        <meshBasicMaterial map={wordmarkTex} transparent toneMapped={false} />
      </mesh>
      {/* bumper */}
      <RoundedBox args={[0.3, 0.32, W * 1.04]} radius={0.05} position={[cabX - 1.2, 0.72, 0]}>
        <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.35} />
      </RoundedBox>
      {/* amber turn signals on the bumper corners */}
      {[W * 0.44, -W * 0.44].map((z, i) => (
        <mesh key={`fsig${i}`} position={[cabX - 1.34, 0.78, z]}>
          <boxGeometry args={[0.05, 0.1, 0.18]} />
          <meshStandardMaterial color="#7c4a03" emissive="#ffb020" emissiveIntensity={2.2} toneMapped={false} />
        </mesh>
      ))}
      {/* (bull bar removed — its "rugged offroad" language fought the
          EV-fleet/LIDAR/aero-wheel story everywhere else on this truck) */}
      {/* brushed skid plate — tucked flush against the bumper's bottom edge
          (bumper bottom = 0.56), barely raked so it reads as bolted-on, not
          a detached plank on the ground */}
      <RoundedBox args={[0.4, 0.09, 1.75]} radius={0.02} smoothness={2} position={[-4.6, 0.53, 0]} rotation={[0, 0, 0.05]}>
        <meshStandardMaterial color="#9aa5b4" metalness={0.85} roughness={0.35} />
      </RoundedBox>
      {/* headlights — emissive so Bloom catches them */}
      {[W * 0.36, -W * 0.36].map((z, i) => (
        <mesh key={i} position={[cabX - 1.24, 1.0, z]}>
          <boxGeometry args={[0.06, 0.14, 0.34]} />
          <meshStandardMaterial color="#fffbe8" emissive="#ffe9a8" emissiveIntensity={4} toneMapped={false} />
        </mesh>
      ))}
      {/* cab interior silhouette — visible through the tinted glass */}
      <mesh position={[cabX - 0.82, 2.18, 0]}>
        <boxGeometry args={[0.45, 0.22, 1.9]} />
        <meshStandardMaterial color="#131a26" roughness={0.9} />
      </mesh>
      {[0.55, -0.55].map((z, i) => (
        <group key={`seat${i}`}>
          <RoundedBox args={[0.42, 0.6, 0.5]} radius={0.06} smoothness={2} position={[cabX - 0.1, 2.3, z]}>
            <meshStandardMaterial color="#1a2230" roughness={0.85} />
          </RoundedBox>
          <RoundedBox args={[0.3, 0.18, 0.34]} radius={0.05} smoothness={2} position={[cabX - 0.12, 2.72, z]}>
            <meshStandardMaterial color="#151c28" roughness={0.85} />
          </RoundedBox>
        </group>
      ))}
      {/* steering wheel hint (driver side) */}
      <mesh position={[cabX - 0.62, 2.28, 0.55]} rotation={[0, 0, 1.1]}>
        <torusGeometry args={[0.14, 0.02, 6, 18]} />
        <meshStandardMaterial color="#0d131d" roughness={0.8} />
      </mesh>
      {/* mirrors */}
      {[W / 2 + 0.14, -W / 2 - 0.14].map((z, i) => (
        <mesh key={i} position={[cabX - 1.0, 2.55, z]}>
          <boxGeometry args={[0.05, 0.36, 0.16]} />
          <meshStandardMaterial {...mirrorGlass} />
        </mesh>
      ))}
      {/* mirror-mounted camera pods (modern hybrid mirror-cam look) */}
      {[W / 2 + 0.16, -W / 2 - 0.16].map((z, i) => (
        <mesh key={`campod${i}`} position={[cabX - 1.0, 2.3, z]}>
          <boxGeometry args={[0.06, 0.09, 0.06]} />
          <meshStandardMaterial color="#0f172a" metalness={0.6} roughness={0.35} />
        </mesh>
      ))}
      {/* puddle lights: the FLEETMATE mark "projected" onto the tarmac under
          each mirror (additive, luxury-car welcome-light trick) */}
      {[1.75, -1.75].map((z, i) => (
        <mesh key={`puddle${i}`} position={[cabX - 1.0, 0.02, z]} rotation={[-Math.PI / 2, 0, z > 0 ? 0 : Math.PI]}>
          <planeGeometry args={[1.0, 0.25]} />
          <meshBasicMaterial map={wordmarkTex} transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
      {/* cab door seams + handles — reads as driver/passenger doors, not a slab */}
      {[W / 2 + 0.006, -(W / 2 + 0.006)].map((z, side) => (
        <group key={`door${side}`}>
          <mesh position={[cabX - 0.62, 1.6, z]}>
            <boxGeometry args={[0.025, 0.95, 0.015]} />
            <meshStandardMaterial color="#0e1420" roughness={0.6} />
          </mesh>
          <mesh position={[cabX + 0.66, 1.6, z]}>
            <boxGeometry args={[0.025, 0.95, 0.015]} />
            <meshStandardMaterial color="#0e1420" roughness={0.6} />
          </mesh>
          <mesh position={[cabX + 0.42, 1.95, z > 0 ? z + 0.012 : z - 0.012]}>
            <boxGeometry args={[0.2, 0.05, 0.03]} />
            <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      ))}
      {/* whip antenna on the roof cap */}
      <mesh position={[cabX - 0.4, 3.55, 0.85]} rotation={[0, 0, -0.14]}>
        <cylinderGeometry args={[0.012, 0.012, 0.62, 6]} />
        <meshStandardMaterial color="#0f172a" roughness={0.5} />
      </mesh>
      {/* roof sensor suite — centre LIDAR dome with a lime scan ring + two
          corner perception pods: the truck visibly "thinks" (AI fleet story) */}
      <group position={[cabX + 0.1, 3.24, 0]}>
        <mesh>
          <cylinderGeometry args={[0.11, 0.13, 0.1, 18]} />
          <meshStandardMaterial color="#0f172a" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.07, 0]}>
          <sphereGeometry args={[0.09, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#161f2e" metalness={0.8} roughness={0.25} />
        </mesh>
        <mesh position={[0, 0.03, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.115, 0.012, 6, 24]} />
          <meshStandardMaterial color={CABIN_GREEN} emissive={CABIN_GREEN} emissiveIntensity={1.6} toneMapped={false} />
        </mesh>
      </group>
      {[0.85, -0.85].map((z, i) => (
        <group key={`pod${i}`} position={[cabX - 0.8, 3.22, z]}>
          <RoundedBox args={[0.16, 0.09, 0.12]} radius={0.03} smoothness={2}>
            <meshStandardMaterial color="#0f172a" metalness={0.7} roughness={0.3} />
          </RoundedBox>
          <mesh position={[-0.085, 0, 0]}>
            <boxGeometry args={[0.01, 0.04, 0.06]} />
            <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={1.4} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {/* body crease lines + lime accent slash — sculpted, not slab-sided */}
      {[W / 2 + 0.004, -(W / 2 + 0.004)].map((z, side) => (
        <group key={`crease${side}`}>
          <mesh position={[cabX, 1.42, z]}>
            <boxGeometry args={[2.1, 0.02, 0.012]} />
            <meshStandardMaterial color="#0a0f18" roughness={0.6} />
          </mesh>
          <mesh position={[cabX + 0.92, 1.5, z]} rotation={[0, 0, 0.6]}>
            <boxGeometry args={[0.4, 0.045, 0.015]} />
            <meshStandardMaterial color={CABIN_GREEN} emissive={CABIN_GREEN} emissiveIntensity={0.5} />
          </mesh>
        </group>
      ))}
      {/* (wipers removed — at hero-shot scale they read as loose broken
          sticks poking off the glass, not wipers resting flat) */}
      {/* exhaust stacks — chunkier, with perforated heat shields + flared tips */}
      {[W * 0.34, -W * 0.34].map((z, i) => (
        <group key={i}>
          <mesh position={[cabX + 1.05, 2.35, z]}>
            <cylinderGeometry args={[0.075, 0.075, 1.7, 14]} />
            <meshStandardMaterial color="#8b96a8" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[cabX + 1.05, 2.1, z]}>
            <cylinderGeometry args={[0.105, 0.105, 1.0, 14]} />
            <meshStandardMaterial color="#3d4655" metalness={0.85} roughness={0.35} />
          </mesh>
          <mesh position={[cabX + 1.05, 3.28, z]}>
            <cylinderGeometry args={[0.11, 0.08, 0.2, 14]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.95} roughness={0.12} />
          </mesh>
        </group>
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
      {/* continuous lime LED beltline strip along both box flanks — one clean
          light signature instead of scattered marker dots (EV-truck look) */}
      {[W / 2 + 0.008, -(W / 2 + 0.008)].map((z, side) => (
        <mesh key={`beltled${side}`} position={[boxX, 1.35, z]}>
          <boxGeometry args={[6.35, 0.035, 0.02]} />
          <meshStandardMaterial color={CABIN_GREEN} emissive={CABIN_GREEN} emissiveIntensity={1.2} toneMapped={false} />
        </mesh>
      ))}
      {/* FLEETMATE wordmark on both box flanks: dark plate + canvas logo */}
      {[1, -1].map((side) => (
        <group key={`badge${side}`}>
          <RoundedBox args={[2.3, 0.68, 0.03]} radius={0.05} smoothness={2} position={[boxX, 2.55, side * (W / 2 + 0.01)]}>
            <meshStandardMaterial color="#0f172a" metalness={0.3} roughness={0.5} />
          </RoundedBox>
          <mesh position={[boxX, 2.55, side * (W / 2 + 0.032)]} rotation={[0, side > 0 ? 0 : Math.PI, 0]}>
            <planeGeometry args={[2.0, 0.5]} />
            <meshBasicMaterial map={wordmarkTex} transparent toneMapped={false} />
          </mesh>
        </group>
      ))}
      {/* roof clearance lights — amber row on the front top edge, red on the rear */}
      {[-0.8, -0.4, 0, 0.4, 0.8].map((z) => (
        <mesh key={`clf${z}`} position={[-2.07, 3.5, z]}>
          <boxGeometry args={[0.03, 0.07, 0.12]} />
          <meshStandardMaterial color="#7c4a03" emissive="#ffb020" emissiveIntensity={2} toneMapped={false} />
        </mesh>
      ))}
      {[-0.6, 0, 0.6].map((z) => (
        <mesh key={`clr${z}`} position={[4.36, 3.5, z]}>
          <boxGeometry args={[0.03, 0.07, 0.12]} />
          <meshStandardMaterial color="#3d0a0a" emissive="#ff2d2d" emissiveIntensity={1.6} toneMapped={false} />
        </mesh>
      ))}

      {/* ---- rear cargo doors (box rear face is at x = boxX + 3.2 = 4.35) ---- */}
      {/* two door leaves, slightly proud of the rear face, corrugated like the walls */}
      {[0.59, -0.59].map((z, i) => (
        <mesh key={`leaf${i}`} position={[4.37, 2.2, z]} castShadow>
          <boxGeometry args={[0.06, 2.55, 1.12]} />
          <meshStandardMaterial map={doorTex} metalness={0.4} roughness={0.6} />
        </mesh>
      ))}
      {/* vertical centre seam between the leaves */}
      <mesh position={[4.375, 2.2, 0]}>
        <boxGeometry args={[0.07, 2.55, 0.06]} />
        <meshStandardMaterial color="#161d29" metalness={0.5} roughness={0.6} />
      </mesh>
      {/* lock rods + handles — one vertical rod per leaf with a grab handle */}
      {[0.38, -0.38].map((z, i) => (
        <group key={`rod${i}`}>
          <mesh position={[4.42, 2.2, z]}>
            <cylinderGeometry args={[0.028, 0.028, 2.3, 10]} />
            <meshStandardMaterial color="#8b96a8" metalness={0.85} roughness={0.3} />
          </mesh>
          <mesh position={[4.45, 1.7, z]}>
            <boxGeometry args={[0.05, 0.1, 0.3]} />
            <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.4} />
          </mesh>
        </group>
      ))}
      {/* FLEETMATE mark on the right door leaf */}
      <mesh position={[4.405, 2.95, 0.59]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.8, 0.2]} />
        <meshBasicMaterial map={wordmarkTex} transparent toneMapped={false} />
      </mesh>
      {/* hinge barrels down each outer door edge */}
      {[1.19, -1.19].map((z) =>
        [1.3, 2.2, 3.1].map((y) => (
          <mesh key={`hinge${z}${y}`} position={[4.37, y, z]}>
            <cylinderGeometry args={[0.035, 0.035, 0.22, 8]} />
            <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.35} />
          </mesh>
        ))
      )}
      {/* taillights — emissive red so Bloom catches them like the headlights */}
      {[0.95, -0.95].map((z, i) => (
        <mesh key={`tail${i}`} position={[4.38, 1.02, z]}>
          <boxGeometry args={[0.05, 0.12, 0.32]} />
          <meshStandardMaterial color="#3d0a0a" emissive="#ff2d2d" emissiveIntensity={3} toneMapped={false} />
        </mesh>
      ))}
      {/* license plate on the chassis tail (chassis rear face is at x = 4.5) */}
      <mesh position={[4.52, 0.85, 0]}>
        <boxGeometry args={[0.04, 0.26, 0.55]} />
        <meshStandardMaterial color="#1a202c" metalness={0.3} roughness={0.6} />
      </mesh>
      {/* mud flaps hanging behind each rear wheel pair */}
      {[1.04, -1.04].map((z, i) => (
        <RoundedBox key={`flap${i}`} args={[0.06, 0.55, 0.5]} radius={0.02} smoothness={2} position={[3.55, 0.32, z]}>
          <meshStandardMaterial {...rubber} />
        </RoundedBox>
      ))}
      {/* amber rear turn signals inboard of the taillights */}
      {[0.6, -0.6].map((z, i) => (
        <mesh key={`rsig${i}`} position={[4.38, 1.02, z]}>
          <boxGeometry args={[0.05, 0.12, 0.2]} />
          <meshStandardMaterial color="#7c4a03" emissive="#ffb020" emissiveIntensity={2} toneMapped={false} />
        </mesh>
      ))}
      {/* red/white reflective chevron band across the rear underride */}
      {[-0.84, -0.6, -0.36, -0.12, 0.12, 0.36, 0.6, 0.84].map((z, i) => (
        <mesh key={`chev${i}`} position={[4.52, 0.58, z]} rotation={[0.785, 0, 0]}>
          <boxGeometry args={[0.03, 0.3, 0.1]} />
          <meshStandardMaterial
            color={i % 2 === 0 ? "#b91c1c" : "#e2e8f0"}
            emissive={i % 2 === 0 ? "#7f1d1d" : "#64748b"}
            emissiveIntensity={0.25}
            roughness={0.4}
          />
        </mesh>
      ))}
      {/* rear step bumper under the doors — the dock-loading step */}
      <RoundedBox args={[0.55, 0.09, 2.2]} radius={0.03} smoothness={2} position={[4.6, 0.42, 0]} castShadow>
        <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.35} />
      </RoundedBox>
      {[0.85, -0.85].map((z, i) => (
        <mesh key={`stepbrace${i}`} position={[4.45, 0.58, z]}>
          <boxGeometry args={[0.06, 0.26, 0.1]} />
          <meshStandardMaterial color="#111827" metalness={0.6} roughness={0.45} />
        </mesh>
      ))}
      {/* spare tire racked against the left frame rail between the axles */}
      <group position={[-0.9, 0.62, -1.06]} scale={0.9}>
        <Wheel position={[0, 0, 0]} />
      </group>

      {/* ---- stance & running gear: the truck sits ON hardware, not in air ---- */}
      {/* fender arches hugging every axle (kills the "wheels taped on" look) */}
      {[
        { x: -3.6, r: 0.68 },
        { x: 1.6, r: 0.66 },
        { x: 2.9, r: 0.66 },
      ].map(({ x, r }) =>
        [W / 2 + 0.05, -(W / 2 + 0.05)].map((z) => (
          <mesh key={`arch${x}${z}`} position={[x, 0.55, z]}>
            <torusGeometry args={[r, 0.075, 8, 20, Math.PI]} />
            <meshStandardMaterial color="#0b1120" metalness={0.4} roughness={0.6} />
          </mesh>
        ))
      )}
      {/* undercarriage: fuel tank, battery box, driveshaft, air tanks */}
      <group>
        <mesh position={[-1.9, 0.48, 0.92]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.26, 0.26, 1.15, 18]} />
          <meshStandardMaterial color="#aeb8c6" metalness={0.85} roughness={0.3} />
        </mesh>
        {[-2.25, -1.55].map((x) => (
          <mesh key={`strap${x}`} position={[x, 0.48, 0.92]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.275, 0.275, 0.05, 18]} />
            <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.4} />
          </mesh>
        ))}
        <RoundedBox args={[0.95, 0.42, 0.5]} radius={0.04} smoothness={2} position={[-1.85, 0.46, -0.9]}>
          <meshStandardMaterial color="#151c28" metalness={0.5} roughness={0.5} />
        </RoundedBox>
        <mesh position={[0.4, 0.45, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.05, 0.05, 4.4, 10]} />
          <meshStandardMaterial color="#3d4655" metalness={0.8} roughness={0.35} />
        </mesh>
        {[0.15, -0.15].map((z, i) => (
          <mesh key={`airtank${i}`} position={[3.6, 0.4, z * 4]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.12, 0.12, 0.7, 14]} />
            <meshStandardMaterial color="#8b96a8" metalness={0.85} roughness={0.3} />
          </mesh>
        ))}
      </group>
      {/* lime underglow strips — hero-shot stance lighting */}
      {[1.0, -1.0].map((z, i) => (
        <mesh key={`glow${i}`} position={[0, 0.42, z]}>
          <boxGeometry args={[8.4, 0.03, 0.04]} />
          <meshStandardMaterial color={CABIN_GREEN} emissive={CABIN_GREEN} emissiveIntensity={1.5} toneMapped={false} />
        </mesh>
      ))}
      {/* aero side skirts between the axles, with a lime pinstripe */}
      {[W / 2 - 0.02, -(W / 2 - 0.02)].map((z, i) => (
        <group key={`skirt${i}`}>
          <RoundedBox args={[2.9, 0.55, 0.06]} radius={0.03} smoothness={2} position={[0.05, 0.6, z]}>
            <meshStandardMaterial color="#0f172a" metalness={0.5} roughness={0.5} />
          </RoundedBox>
          <mesh position={[0.05, 0.36, z]}>
            <boxGeometry args={[2.9, 0.025, 0.065]} />
            <meshStandardMaterial color={CABIN_GREEN} emissive={CABIN_GREEN} emissiveIntensity={0.8} toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* wheels — single front axle, DUAL rear tandem (paired wheels per side,
          the box-truck signature), all planted on y≈0.55 */}
      {[W / 2, -W / 2].map((z) => <Wheel key={`f${z}`} position={[-3.6, 0.55, z]} />)}
      {[1.6, 2.9].map((x) =>
        [1, -1].map((side) => (
          <group key={`r${x}${side}`}>
            <Wheel position={[x, 0.55, side * (W / 2)]} />
            <Wheel position={[x, 0.55, side * (W / 2 - 0.42)]} />
          </group>
        ))
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
