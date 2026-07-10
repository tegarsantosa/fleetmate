import React, { useMemo, useRef, useState, useEffect, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Edges, ContactShadows, Html, RoundedBox, useGLTF } from "@react-three/drei";
import * as THREE from "three";

const PALETTE = [
  "#3e6ba8", "#0d9488", "#b47818", "#a84a3e", "#6d5aa8", "#3e8aa8", "#7a8f3d", "#a8653e",
];

// Height of the container floor above the ground (truck chassis).
const FLOOR_Y = 1.05;
const WHEEL_R = 0.52;
const CAB_GLB_URL = "/media/models/truck-cab.glb";

const SCENES = {
  light: {
    bg: "#e8edf5",
    ground: "#dde3ee",
    grid1: "#c3cddd",
    grid2: "#d2dae8",
    road: "#b8c0ce",
    roadLine: "#f1f5f9",
    ambient: 0.85,
    key: 1.6,
    rim: 0.5,
  },
  dark: {
    bg: "#0b1220",
    ground: "#0e1524",
    grid1: "#1c2740",
    grid2: "#151f33",
    road: "#131b2c",
    roadLine: "#31415f",
    ambient: 0.4,
    key: 1.1,
    rim: 0.9,
  },
};

function useUiTheme() {
  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute("data-theme") || "light"
  );
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setTheme(document.documentElement.getAttribute("data-theme") || "light")
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return theme;
}

function colorForBox(index) {
  return PALETTE[index % PALETTE.length];
}

function makeCorrugatedTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#5a6578";
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = "#4a5468";
  for (let x = 0; x < 128; x += 16) ctx.fillRect(x, 0, 7, 128);
  ctx.fillStyle = "#68748a";
  for (let x = 10; x < 128; x += 16) ctx.fillRect(x, 0, 2, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/* ============ Wheels ============ */
function Wheel({ position, spinRef }) {
  const groupRef = useRef();

  useFrame((_, delta) => {
    if (!groupRef.current || !spinRef?.current) return;
    groupRef.current.rotation.z += (spinRef.current * delta) / WHEEL_R;
  });

  return (
    <group position={position}>
      <group ref={groupRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[WHEEL_R, WHEEL_R, 0.34, 28]} />
          <meshStandardMaterial color="#181a1f" roughness={0.92} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[WHEEL_R * 0.55, WHEEL_R * 0.55, 0.36, 20]} />
          <meshStandardMaterial color="#aab4c4" metalness={0.85} roughness={0.25} />
        </mesh>
        {/* lug spokes make rotation readable */}
        {[0, Math.PI / 3, (2 * Math.PI) / 3].map((a) => (
          <mesh key={a} rotation={[0, 0, a]}>
            <boxGeometry args={[WHEEL_R * 0.95, 0.07, 0.37]} />
            <meshStandardMaterial color="#2a2f3a" metalness={0.6} roughness={0.4} />
          </mesh>
        ))}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.4, 12]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>
    </group>
  );
}

/* ============ Cab (procedural) ============ */
function ProceduralCab({ W }) {
  const glass = { color: "#0d1521", metalness: 0.9, roughness: 0.08 };
  const paint = { color: "#1e293b", metalness: 0.55, roughness: 0.32 };

  return (
    <group>
      {/* main body */}
      <RoundedBox args={[2.1, 1.9, W * 0.98]} radius={0.09} smoothness={3} position={[-1.35, 1.98, W / 2]} castShadow>
        <meshStandardMaterial {...paint} />
      </RoundedBox>
      {/* lower skirt / fender */}
      <RoundedBox args={[2.2, 0.55, W * 1.0]} radius={0.06} smoothness={3} position={[-1.38, 1.05, W / 2]} castShadow>
        <meshStandardMaterial color="#141c2b" metalness={0.5} roughness={0.45} />
      </RoundedBox>
      {/* roof deflector */}
      <RoundedBox args={[1.15, 0.55, W * 0.9]} radius={0.08} smoothness={3} position={[-0.95, 3.06, W / 2]} rotation={[0, 0, -0.28]} castShadow>
        <meshStandardMaterial {...paint} />
      </RoundedBox>
      {/* windshield */}
      <RoundedBox args={[0.06, 0.78, W * 0.82]} radius={0.02} smoothness={2} position={[-2.4, 2.42, W / 2]} rotation={[0, 0, 0.12]}>
        <meshStandardMaterial {...glass} />
      </RoundedBox>
      {/* side windows */}
      {[0.015, W - 0.015].map((z, i) => (
        <RoundedBox key={i} args={[0.95, 0.52, 0.03]} radius={0.015} smoothness={2} position={[-1.55, 2.42, z]}>
          <meshStandardMaterial {...glass} />
        </RoundedBox>
      ))}
      {/* teal livery stripe */}
      <mesh position={[-1.35, 1.52, W / 2]}>
        <boxGeometry args={[2.12, 0.12, W * 0.99]} />
        <meshStandardMaterial color="#0d9488" metalness={0.4} roughness={0.35} />
      </mesh>
      {/* grille */}
      {[1.28, 1.42, 1.56].map((y) => (
        <mesh key={y} position={[-2.46, y, W / 2]}>
          <boxGeometry args={[0.04, 0.07, W * 0.66]} />
          <meshStandardMaterial color="#0b0f16" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}
      {/* bumper */}
      <RoundedBox args={[0.3, 0.3, W * 1.02]} radius={0.05} smoothness={2} position={[-2.44, 0.72, W / 2]}>
        <meshStandardMaterial color="#2b3546" metalness={0.7} roughness={0.35} />
      </RoundedBox>
      {/* headlights */}
      {[W * 0.14, W * 0.86].map((z, i) => (
        <mesh key={i} position={[-2.48, 0.98, z]}>
          <boxGeometry args={[0.05, 0.12, 0.3]} />
          <meshStandardMaterial color="#fff8dd" emissive="#ffedb0" emissiveIntensity={1.8} />
        </mesh>
      ))}
      {/* mirrors */}
      {[-0.14, W + 0.14].map((z, i) => (
        <group key={i} position={[-2.15, 2.5, z]}>
          <mesh>
            <boxGeometry args={[0.04, 0.34, 0.16]} />
            <meshStandardMaterial {...glass} />
          </mesh>
          <mesh position={[0.1, 0.18, i === 0 ? 0.08 : -0.08]}>
            <boxGeometry args={[0.22, 0.03, 0.03]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
        </group>
      ))}
      {/* exhaust stacks behind cab */}
      {[W * 0.12, W * 0.88].map((z, i) => (
        <mesh key={i} position={[-0.32, 2.35, z]}>
          <cylinderGeometry args={[0.06, 0.06, 1.5, 12]} />
          <meshStandardMaterial color="#8b96a8" metalness={0.9} roughness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

/* Optional artist-made cab: drop a GLB at media/models/truck-cab.glb and it
   replaces the procedural cab automatically, scaled into the cab slot. */
function GltfCab({ W }) {
  const { scene } = useGLTF(CAB_GLB_URL);
  const model = useMemo(() => {
    const cloned = scene.clone(true);
    const bounds = new THREE.Box3().setFromObject(cloned);
    const size = bounds.getSize(new THREE.Vector3());
    const scale = Math.min(2.4 / size.x, 2.9 / size.y, (W * 1.05) / size.z) || 1;
    cloned.scale.setScalar(scale);
    const scaled = new THREE.Box3().setFromObject(cloned);
    const center = scaled.getCenter(new THREE.Vector3());
    cloned.position.sub(center).add(new THREE.Vector3(-1.35, (scaled.max.y - scaled.min.y) / 2 + 0.35, W / 2));
    return cloned;
  }, [scene, W]);
  return <primitive object={model} />;
}

function Cab({ W, cabAvailable }) {
  if (!cabAvailable) return <ProceduralCab W={W} />;
  return (
    <Suspense fallback={<ProceduralCab W={W} />}>
      <GltfCab W={W} />
    </Suspense>
  );
}

/* ============ Truck ============ */
function Truck({ length, width, height, doorsOpen, spinRef, xray, cabAvailable, children }) {
  const L = length / 100;
  const W = width / 100;
  const H = height / 100;

  const wallTex = useMemo(() => makeCorrugatedTexture(), []);
  const sideTex = useMemo(() => {
    const t = wallTex.clone();
    t.needsUpdate = true;
    t.repeat.set(Math.max(1, Math.round(L / 0.4)), 1);
    return t;
  }, [wallTex, L]);
  const endTex = useMemo(() => {
    const t = wallTex.clone();
    t.needsUpdate = true;
    t.repeat.set(Math.max(1, Math.round(W / 0.4)), 1);
    return t;
  }, [wallTex, W]);

  const wallOpacity = xray ? 0.3 : 0.96;
  const roofOpacity = xray ? 0.06 : 0.5;

  const wallProps = {
    transparent: true,
    opacity: wallOpacity,
    side: THREE.DoubleSide,
    metalness: 0.5,
    roughness: 0.55,
    depthWrite: !xray,
  };

  const doorAngle = doorsOpen ? 2.1 : 0.02;
  const wheelXs = [-1.75, L * 0.62, L * 0.62 + 1.2];

  return (
    <group>
      {/* chassis frame */}
      <mesh position={[L / 2 - 1.45, 0.84, W / 2]} castShadow>
        <boxGeometry args={[L + 3.6, 0.3, W * 0.8]} />
        <meshStandardMaterial color="#141c2b" metalness={0.65} roughness={0.4} />
      </mesh>

      <Cab W={W} cabAvailable={cabAvailable} />

      {/* fuel tanks */}
      {[-0.06, W + 0.06].map((z, i) => (
        <mesh key={i} position={[0.9, 0.72, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.26, 0.26, 1.15, 18]} />
          <meshStandardMaterial color="#9aa5b5" metalness={0.85} roughness={0.25} />
        </mesh>
      ))}

      {/* side skirts between axles */}
      {[-0.03, W + 0.03].map((z, i) => (
        <mesh key={i} position={[L * 0.32, 0.7, z]}>
          <boxGeometry args={[L * 0.45, 0.42, 0.05]} />
          <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.4} />
        </mesh>
      ))}

      {/* wheels */}
      {wheelXs.map((x) =>
        [W * 0.05, W * 0.95].map((z) => (
          <Wheel key={`${x}-${z}`} position={[x, WHEEL_R, z]} spinRef={spinRef} />
        ))
      )}

      {/* container floor */}
      <mesh position={[L / 2, FLOOR_Y - 0.04, W / 2]} receiveShadow>
        <boxGeometry args={[L, 0.08, W]} />
        <meshStandardMaterial color="#3d4658" roughness={0.85} />
      </mesh>

      {/* teal base rail */}
      <mesh position={[L / 2, FLOOR_Y + 0.06, W / 2]}>
        <boxGeometry args={[L + 0.04, 0.12, W + 0.08]} />
        <meshStandardMaterial color="#0d9488" metalness={0.4} roughness={0.4} />
      </mesh>

      {/* corrugated walls */}
      <mesh position={[L / 2, FLOOR_Y + H / 2, -0.028]} castShadow={!xray}>
        <boxGeometry args={[L, H, 0.05]} />
        <meshStandardMaterial map={sideTex} {...wallProps} />
        <Edges color={xray ? "rgba(100,116,139,0.55)" : "rgba(30,41,59,0.5)"} />
      </mesh>
      <mesh position={[L / 2, FLOOR_Y + H / 2, W + 0.028]} castShadow={!xray}>
        <boxGeometry args={[L, H, 0.05]} />
        <meshStandardMaterial map={sideTex} {...wallProps} />
        <Edges color={xray ? "rgba(100,116,139,0.55)" : "rgba(30,41,59,0.5)"} />
      </mesh>
      <mesh position={[-0.028, FLOOR_Y + H / 2, W / 2]}>
        <boxGeometry args={[0.05, H, W]} />
        <meshStandardMaterial map={endTex} {...wallProps} />
        <Edges color={xray ? "rgba(100,116,139,0.55)" : "rgba(30,41,59,0.5)"} />
      </mesh>
      {/* roof */}
      <mesh position={[L / 2, FLOOR_Y + H + 0.028, W / 2]}>
        <boxGeometry args={[L, 0.05, W]} />
        <meshStandardMaterial color="#5a6578" transparent opacity={roofOpacity} side={THREE.DoubleSide} depthWrite={false} />
        <Edges color="rgba(100,116,139,0.45)" />
      </mesh>

      {/* rear doors on corner hinges */}
      <group position={[L, FLOOR_Y, 0]} rotation={[0, doorAngle, 0]}>
        <mesh position={[0.028, H / 2, W / 4]}>
          <boxGeometry args={[0.05, H, W / 2]} />
          <meshStandardMaterial map={endTex} transparent opacity={0.75} side={THREE.DoubleSide} metalness={0.5} roughness={0.55} />
          <Edges color="rgba(30,41,59,0.5)" />
        </mesh>
      </group>
      <group position={[L, FLOOR_Y, W]} rotation={[0, -doorAngle, 0]}>
        <mesh position={[0.028, H / 2, -W / 4]}>
          <boxGeometry args={[0.05, H, W / 2]} />
          <meshStandardMaterial map={endTex} transparent opacity={0.75} side={THREE.DoubleSide} metalness={0.5} roughness={0.55} />
          <Edges color="rgba(30,41,59,0.5)" />
        </mesh>
      </group>

      {/* load, in container-local coordinates */}
      <group position={[0, FLOOR_Y, 0]}>{children}</group>
    </group>
  );
}

/* ============ Animated cargo ============ */
function AnimatedBox({ item, index, sequence, onLand }) {
  const meshRef = useRef();
  const [phase, setPhase] = useState(() =>
    document.visibilityState === "hidden" ? "landed" : "waiting"
  );
  const [hovered, setHovered] = useState(false);
  const squashT = useRef(0);
  const landedNotified = useRef(false);

  const length = Number(item.placed_length_cm) / 100;
  const width = Number(item.placed_width_cm) / 100;
  const height = Number(item.placed_height_cm) / 100;

  const targetX = Number(item.pos_x) / 100 + length / 2;
  const targetY = Number(item.pos_z) / 100 + height / 2;
  const targetZ = Number(item.pos_y) / 100 + width / 2;

  const dropHeight = 6;
  const delay = Math.min(index * 130, 4500);

  useEffect(() => {
    if (phase !== "waiting") return;
    const timer = setTimeout(() => setPhase("dropping"), delay);
    return () => clearTimeout(timer);
  }, [delay, phase]);

  useEffect(() => {
    if (phase === "landed" && !landedNotified.current) {
      landedNotified.current = true;
      onLand?.(sequence ?? index);
    }
  }, [phase, onLand, sequence, index]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    if (phase === "dropping") {
      const currentY = meshRef.current.position.y;
      const newY = THREE.MathUtils.lerp(currentY, targetY, 9 * delta);
      meshRef.current.position.y = newY;
      const s = THREE.MathUtils.lerp(meshRef.current.scale.x, 1, 7 * delta);
      meshRef.current.scale.setScalar(s);

      if (Math.abs(currentY - targetY) < 0.015) {
        meshRef.current.position.y = targetY;
        meshRef.current.scale.setScalar(1);
        squashT.current = 0;
        setPhase("squash");
      }
    }

    if (phase === "squash") {
      squashT.current += delta * 7;
      const t = Math.min(squashT.current, Math.PI);
      const squash = 1 - Math.sin(t) * 0.12;
      meshRef.current.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
      if (t >= Math.PI) {
        meshRef.current.scale.setScalar(1);
        setPhase("landed");
      }
    }

    if (phase === "landed" && hovered) {
      meshRef.current.position.y = targetY + Math.sin(state.clock.elapsedTime * 3) * 0.02;
    } else if (phase === "landed") {
      meshRef.current.position.y = targetY;
    }
  });

  if (phase === "waiting") return null;

  const color = colorForBox(item.colorIndex ?? index);

  return (
    <mesh
      ref={meshRef}
      position={[targetX, phase === "landed" ? targetY : targetY + dropHeight, targetZ]}
      scale={phase === "landed" ? 1 : 0.35}
      castShadow
      receiveShadow
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = "auto"; }}
    >
      <boxGeometry args={[length, height, width]} />
      <meshStandardMaterial
        color={color}
        metalness={0.05}
        roughness={0.6}
        emissive={hovered ? color : "#000000"}
        emissiveIntensity={hovered ? 0.3 : 0}
      />
      <Edges color={hovered ? "#ffffff" : "rgba(255,255,255,0.16)"} />
      {hovered && (
        <Html center distanceFactor={7} style={{ pointerEvents: "none" }}>
          <div style={{
            background: "rgba(9,20,38,0.94)",
            border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: 6,
            padding: "8px 12px",
            fontSize: 11,
            color: "#eef0f4",
            whiteSpace: "nowrap",
            fontFamily: "'Inter', sans-serif",
          }}>
            <div style={{ fontWeight: 700, marginBottom: 3, color: "#5eead4" }}>
              #{(sequence ?? index) + 1} {item.boxLabel || "Box"}
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {Number(item.placed_length_cm)} × {Number(item.placed_width_cm)} × {Number(item.placed_height_cm)} cm
            </div>
          </div>
        </Html>
      )}
    </mesh>
  );
}

/* ============ Environment props ============ */
function Ground({ palette, size = 110 }) {
  return (
    <group>
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color={palette.ground} roughness={0.95} />
      </mesh>
      <gridHelper args={[size, 70, palette.grid1, palette.grid2]} position={[0, -0.01, 0]} />
    </group>
  );
}

function Road({ width, palette }) {
  const W = width / 100;
  return (
    <group position={[0, 0, W / 2]}>
      <mesh position={[-24, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, W + 4]} />
        <meshStandardMaterial color={palette.road} roughness={0.9} />
      </mesh>
      {Array.from({ length: 16 }).map((_, i) => (
        <mesh key={i} position={[2 - i * 4.5, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.7, 0.12]} />
          <meshStandardMaterial color={palette.roadLine} />
        </mesh>
      ))}
    </group>
  );
}

function LoadingDock({ length, width }) {
  const L = length / 100;
  const W = width / 100;
  const dockX = L + 2.6;
  return (
    <group>
      {/* raised concrete apron the truck backs onto */}
      <mesh position={[dockX + 2, FLOOR_Y / 2 - 0.02, W / 2]} castShadow receiveShadow>
        <boxGeometry args={[4.6, FLOOR_Y - 0.04, W + 7]} />
        <meshStandardMaterial color="#8d99ab" roughness={0.9} />
      </mesh>
      {/* safety edge stripe */}
      <mesh position={[dockX - 0.28, FLOOR_Y - 0.03, W / 2]}>
        <boxGeometry args={[0.16, 0.045, W + 7]} />
        <meshStandardMaterial color="#d9a441" roughness={0.6} />
      </mesh>
      {/* dock bumpers */}
      {[W * 0.2, W * 0.8].map((z, i) => (
        <mesh key={i} position={[dockX - 0.32, FLOOR_Y - 0.35, z]}>
          <boxGeometry args={[0.18, 0.4, 0.5]} />
          <meshStandardMaterial color="#1f2937" roughness={0.95} />
        </mesh>
      ))}
      {/* prop pallet with kraft boxes on the apron */}
      <group position={[dockX + 2.4, FLOOR_Y - 0.02, W + 2.1]}>
        <mesh position={[0, 0.07, 0]} castShadow>
          <boxGeometry args={[1.2, 0.14, 1.0]} />
          <meshStandardMaterial color="#8f6b45" roughness={0.9} />
        </mesh>
        {[[0.35, 0.42, 0.3, "-0.2", "0.15"], [0.42, 0.36, 0.38, "0.22", "-0.12"], [0.3, 0.3, 0.3, "-0.05", "-0.25"]].map(([w, h, d, x, z], i) => (
          <mesh key={i} position={[Number(x), 0.14 + Number(h) / 2, Number(z)]} rotation={[0, i * 0.4, 0]} castShadow>
            <boxGeometry args={[Number(w), Number(h), Number(d)]} />
            <meshStandardMaterial color={["#c2a179", "#b08d5f", "#cbab84"][i]} roughness={0.85} />
          </mesh>
        ))}
      </group>
      {/* second pallet, empty */}
      <mesh position={[dockX + 3.1, FLOOR_Y + 0.05, -1.6 + W / 2]} rotation={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[1.2, 0.14, 1.0]} />
        <meshStandardMaterial color="#7d5c3a" roughness={0.9} />
      </mesh>
    </group>
  );
}

/* ============ Dispatch (drive away, cab first) ============ */
function DispatchRig({ container, items, cabAvailable, onFinished }) {
  const groupRef = useRef();
  const speedRef = useRef(0);
  const [rolling, setRolling] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setRolling(true), 700);
    return () => clearTimeout(t);
  }, []);

  useFrame((_, delta) => {
    if (!groupRef.current || !rolling) return;
    speedRef.current = THREE.MathUtils.lerp(speedRef.current, 13, 1.3 * delta);
    groupRef.current.position.x -= speedRef.current * delta;
    if (groupRef.current.position.x < -48) onFinished();
  });

  return (
    <group ref={groupRef}>
      <Truck
        length={container.length_cm}
        width={container.width_cm}
        height={container.height_cm}
        doorsOpen={false}
        spinRef={speedRef}
        xray={false}
        cabAvailable={cabAvailable}
      >
        {items.map((item, idx) => {
          const pl = Number(item.placed_length_cm) / 100;
          const pw = Number(item.placed_width_cm) / 100;
          const ph = Number(item.placed_height_cm) / 100;
          return (
            <mesh
              key={item.id || idx}
              position={[
                Number(item.pos_x) / 100 + pl / 2,
                Number(item.pos_z) / 100 + ph / 2,
                Number(item.pos_y) / 100 + pw / 2,
              ]}
              castShadow
            >
              <boxGeometry args={[pl, ph, pw]} />
              <meshStandardMaterial color={colorForBox(item.colorIndex ?? idx)} metalness={0.05} roughness={0.6} />
              <Edges color="rgba(255,255,255,0.14)" />
            </mesh>
          );
        })}
      </Truck>
    </group>
  );
}

/* ============ Camera presets ============ */
const PRESETS = {
  iso: (d, c) => [c[0] - d * 0.7, d * 0.72, c[2] + d * 1.1],
  top: (d, c) => [c[0], d * 1.6, c[2] + 0.01],
  side: (d, c) => [c[0], d * 0.35, c[2] + d * 1.5],
  rear: (d, c) => [c[0] + d * 1.6, d * 0.5, c[2]],
  cab: (d, c) => [c[0] - d * 1.5, d * 0.35, c[2] + d * 0.55],
};

function CameraRig({ preset, distance, center, controlsRef }) {
  const goal = useRef(null);
  const { camera } = useThree();

  useEffect(() => {
    if (!preset) return;
    goal.current = new THREE.Vector3(...PRESETS[preset](distance, center));
  }, [preset, distance, center]);

  useFrame((_, delta) => {
    if (!goal.current) return;
    camera.position.lerp(goal.current, Math.min(5 * delta, 1));
    if (controlsRef.current) {
      controlsRef.current.target.lerp(new THREE.Vector3(...center), Math.min(5 * delta, 1));
      controlsRef.current.update();
    }
    if (camera.position.distanceTo(goal.current) < 0.05) goal.current = null;
  });

  return null;
}

/* ============ Root ============ */
export default function Container3D({
  container, items, isDispatching, onDispatchDone, viewPreset, presetKey, xray = true, onBoxLanded,
}) {
  const [dispatchDone, setDispatchDone] = useState(false);
  const [cabAvailable, setCabAvailable] = useState(false);
  const controlsRef = useRef();
  const theme = useUiTheme();
  const palette = SCENES[theme] || SCENES.light;

  useEffect(() => {
    setDispatchDone(false);
  }, [container?.id]);

  // Use an artist GLB cab if one has been dropped into media/models/.
  useEffect(() => {
    fetch(CAB_GLB_URL, { method: "HEAD" })
      .then((r) => {
        const type = r.headers.get("content-type") || "";
        if (r.ok && !type.includes("html")) setCabAvailable(true);
      })
      .catch(() => {});
  }, []);

  const dims = useMemo(() => {
    const L = Number(container?.length_cm || 600) / 100;
    const W = Number(container?.width_cm || 240) / 100;
    const H = Number(container?.height_cm || 260) / 100;
    return { L, W, H };
  }, [container]);

  const distance = Math.max(dims.L, dims.W, dims.H) * 2.1;
  const center = useMemo(() => [dims.L / 2, dims.H / 2 + FLOOR_Y / 2, dims.W / 2], [dims]);

  if (!container) {
    return (
      <div className="viewer-wrap" style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: 32, opacity: 0.3 }}>📦</span>
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Select a vehicle to view its load plan</p>
      </div>
    );
  }

  if (dispatchDone) {
    return (
      <div className="viewer-wrap" style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
        <span style={{ fontSize: 40 }}>🚛</span>
        <p style={{ color: "var(--success-ink)", fontSize: 15, fontWeight: 600 }}>Shipment Released!</p>
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>The vehicle has left the dock</p>
      </div>
    );
  }

  return (
    <div className="viewer-wrap">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{
          position: [dims.L / 2 - distance * 0.7, distance * 0.72, dims.W / 2 + distance * 1.1],
          fov: 42,
          near: 0.1,
          far: 320,
        }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
      >
        <color attach="background" args={[palette.bg]} />
        <fog attach="fog" args={[palette.bg, distance * 2.4, distance * 8]} />

        <ambientLight intensity={palette.ambient} />
        <hemisphereLight intensity={0.35} color="#dbe6f5" groundColor="#3c4759" />
        <directionalLight
          position={[10, 24, 14]}
          intensity={palette.key}
          castShadow
          shadow-mapSize={2048}
          shadow-bias={-0.0001}
        />
        <spotLight position={[-8, 14, -6]} intensity={palette.rim} color="#5eead4" angle={0.6} penumbra={0.9} />

        <Ground palette={palette} />
        <Road width={container.width_cm} palette={palette} />
        <LoadingDock length={container.length_cm} width={container.width_cm} />

        {isDispatching ? (
          <DispatchRig
            container={container}
            items={items}
            cabAvailable={cabAvailable}
            onFinished={() => { setDispatchDone(true); onDispatchDone?.(); }}
          />
        ) : (
          <Truck
            length={container.length_cm}
            width={container.width_cm}
            height={container.height_cm}
            doorsOpen
            spinRef={null}
            xray={xray}
            cabAvailable={cabAvailable}
          >
            {items.map((item, idx) => (
              <AnimatedBox key={item.id ?? idx} item={item} index={idx} sequence={item.colorIndex} onLand={onBoxLanded} />
            ))}
          </Truck>
        )}

        <ContactShadows
          position={[dims.L / 2, 0, dims.W / 2]}
          scale={Math.max(dims.L, dims.W) * 3}
          blur={2.4}
          far={5}
          opacity={theme === "light" ? 0.35 : 0.55}
          color="#0b1c30"
        />

        <CameraRig key={presetKey} preset={viewPreset} distance={distance} center={center} controlsRef={controlsRef} />

        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.05}
          maxPolarAngle={Math.PI / 2 - 0.04}
          minDistance={2}
          maxDistance={distance * 3.2}
          target={center}
        />
      </Canvas>
    </div>
  );
}
