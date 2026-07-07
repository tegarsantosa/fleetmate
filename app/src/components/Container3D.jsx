import React, { useMemo, useRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Edges, Environment, ContactShadows, Html } from "@react-three/drei";
import * as THREE from "three";

const PALETTE = [
  "#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#ec4899", "#14b8a6", "#f97316",
];

function colorForBox(index) {
  return PALETTE[index % PALETTE.length];
}

function AnimatedBox({ item, index }) {
  const meshRef = useRef();
  const [phase, setPhase] = useState("waiting");
  const [hovered, setHovered] = useState(false);

  const length = Number(item.placed_length_cm) / 100;
  const width = Number(item.placed_width_cm) / 100;
  const height = Number(item.placed_height_cm) / 100;

  const targetX = Number(item.pos_x) / 100 + length / 2;
  const targetY = Number(item.pos_z) / 100 + height / 2;
  const targetZ = Number(item.pos_y) / 100 + width / 2;

  const dropHeight = 8;
  const delay = index * 150;

  useEffect(() => {
    const timer = setTimeout(() => setPhase("dropping"), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    if (phase === "dropping") {
      const currentY = meshRef.current.position.y;
      const newY = THREE.MathUtils.lerp(currentY, targetY, 8 * delta);
      meshRef.current.position.y = newY;

      meshRef.current.scale.x = THREE.MathUtils.lerp(meshRef.current.scale.x, 1, 6 * delta);
      meshRef.current.scale.y = THREE.MathUtils.lerp(meshRef.current.scale.y, 1, 6 * delta);
      meshRef.current.scale.z = THREE.MathUtils.lerp(meshRef.current.scale.z, 1, 6 * delta);

      if (Math.abs(currentY - targetY) < 0.01) {
        meshRef.current.position.y = targetY;
        setPhase("landed");
      }
    }

    if (phase === "landed" && hovered) {
      meshRef.current.position.y = targetY + Math.sin(state.clock.elapsedTime * 3) * 0.02;
    }
  });

  if (phase === "waiting") return null;

  const color = colorForBox(item.colorIndex ?? index);

  return (
    <mesh
      ref={meshRef}
      position={[targetX, targetY + dropHeight, targetZ]}
      scale={[0.3, 0.3, 0.3]}
      castShadow
      receiveShadow
      onPointerOver={() => { setHovered(true); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = "auto"; }}
    >
      <boxGeometry args={[length, height, width]} />
      <meshPhysicalMaterial
        color={hovered ? "#ffffff" : color}
        metalness={0.15}
        roughness={0.35}
        clearcoat={0.8}
        clearcoatRoughness={0.15}
        emissive={hovered ? color : "#000000"}
        emissiveIntensity={hovered ? 0.3 : 0}
      />
      <Edges color={hovered ? color : "rgba(255,255,255,0.08)"} lineWidth={hovered ? 2 : 1} />
      {hovered && (
        <Html center distanceFactor={8} style={{ pointerEvents: "none" }}>
          <div style={{
            background: "rgba(15,17,21,0.92)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 11,
            color: "#eef0f4",
            whiteSpace: "nowrap",
            fontFamily: "'Poppins', sans-serif",
          }}>
            <div style={{ fontWeight: 700, marginBottom: 4, color }}>Box #{index + 1}</div>
            <div>{item.placed_length_cm} × {item.placed_width_cm} × {item.placed_height_cm} cm</div>
          </div>
        </Html>
      )}
    </mesh>
  );
}

function ContainerShell({ length, width, height }) {
  const L = length / 100;
  const W = width / 100;
  const H = height / 100;

  return (
    <group>
      <mesh position={[L / 2, H / 2, W / 2]}>
        <boxGeometry args={[L, H, W]} />
        <meshStandardMaterial color="#3b82f6" transparent opacity={0.04} side={THREE.DoubleSide} depthWrite={false} />
        <Edges color="rgba(59, 130, 246, 0.3)" />
      </mesh>

      <mesh position={[L / 2, 0, W / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[L, W]} />
        <meshStandardMaterial color="#12151e" />
      </mesh>

      <gridHelper args={[Math.max(L, W) * 2, 20, "#1a1f2e", "#1a1f2e"]} position={[L / 2, -0.005, W / 2]} />
    </group>
  );
}

function DispatchScene({ container, items, onFinished }) {
  const groupRef = useRef();
  const [phase, setPhase] = useState("idle");
  const speed = useRef(0);

  const L = container.length_cm / 100;
  const W = container.width_cm / 100;
  const H = container.height_cm / 100;

  useEffect(() => {
    const t = setTimeout(() => setPhase("moving"), 400);
    return () => clearTimeout(t);
  }, []);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    if (phase === "moving") {
      speed.current = THREE.MathUtils.lerp(speed.current, 14, 1.5 * delta);
      groupRef.current.position.x += speed.current * delta;
      if (groupRef.current.position.x > 30) {
        onFinished();
      }
    }
  });

  const sortedItems = [...items].sort((a, b) => Number(a.pos_z) - Number(b.pos_z));

  return (
    <group ref={groupRef}>
      <mesh position={[L / 2, H / 2, W / 2]}>
        <boxGeometry args={[L, H, W]} />
        <meshStandardMaterial color="#3b82f6" transparent opacity={0.06} side={THREE.DoubleSide} depthWrite={false} />
        <Edges color="rgba(59, 130, 246, 0.4)" />
      </mesh>
      <mesh position={[L / 2, 0, W / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[L, W]} />
        <meshStandardMaterial color="#12151e" />
      </mesh>

      {sortedItems.map((item, idx) => {
        const pl = Number(item.placed_length_cm) / 100;
        const pw = Number(item.placed_width_cm) / 100;
        const ph = Number(item.placed_height_cm) / 100;
        const px = Number(item.pos_x) / 100 + pl / 2;
        const py = Number(item.pos_z) / 100 + ph / 2;
        const pz = Number(item.pos_y) / 100 + pw / 2;
        return (
          <mesh key={item.id || idx} position={[px, py, pz]} castShadow>
            <boxGeometry args={[pl, ph, pw]} />
            <meshPhysicalMaterial color={colorForBox(idx)} metalness={0.15} roughness={0.35} clearcoat={0.5} />
            <Edges color="rgba(255,255,255,0.08)" />
          </mesh>
        );
      })}
    </group>
  );
}

function Road() {
  return (
    <group>
      <mesh position={[15, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 6]} />
        <meshStandardMaterial color="#181c28" />
      </mesh>
      {Array.from({ length: 15 }).map((_, i) => (
        <mesh key={i} position={[-5 + i * 4, -0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.5, 0.08]} />
          <meshStandardMaterial color="#2a3040" />
        </mesh>
      ))}
    </group>
  );
}

export default function Container3D({ container, items, isDispatching }) {
  const [dispatchDone, setDispatchDone] = useState(false);

  const cameraDistance = useMemo(() => {
    const maxDim = Math.max(
      Number(container?.length_cm || 500),
      Number(container?.width_cm || 250),
      Number(container?.height_cm || 250)
    );
    return maxDim / 45;
  }, [container]);

  if (!container) {
    return (
      <div className="viewer-wrap" style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: 32, opacity: 0.3 }}>📦</span>
        <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Select a container to view its load plan</p>
      </div>
    );
  }

  if (dispatchDone) {
    return (
      <div className="viewer-wrap" style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
        <span style={{ fontSize: 40 }}>🚛 Ngenggg....</span>
        <p style={{ color: "var(--success)", fontSize: 15, fontWeight: 600 }}>Shipment Released!</p>
        <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Container has been shipped successfully</p>
      </div>
    );
  }

  const sortedItems = [...items].sort((a, b) => Number(a.pos_z) - Number(b.pos_z));

  return (
    <div className="viewer-wrap">
      <Canvas
        shadows
        camera={{
          position: [cameraDistance * 0.9, cameraDistance * 0.7, cameraDistance * 1.1],
          fov: 42,
          near: 0.1,
          far: 200,
        }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
      >
        <fog attach="fog" args={["#0a0c10", cameraDistance * 2, cameraDistance * 6]} />

        <ambientLight intensity={0.4} />
        <directionalLight
          position={[10, 20, 10]}
          intensity={1.2}
          castShadow
          shadow-mapSize={2048}
          shadow-bias={-0.0001}
        />
        <spotLight position={[-5, 12, -5]} intensity={2} color="#0bc5ea" angle={0.6} penumbra={0.8} castShadow />
        <spotLight position={[5, 15, 8]} intensity={1.5} color="#8a81ff" angle={0.5} penumbra={1} castShadow />
        <spotLight position={[0, 10, -8]} intensity={1} color="#ff8709" angle={0.8} penumbra={0.5} />

        <Environment preset="night" />

        {isDispatching ? (
          <>
            <Road />
            <DispatchScene
              container={container}
              items={sortedItems}
              onFinished={() => setDispatchDone(true)}
            />
          </>
        ) : (
          <>
            <ContainerShell
              length={container.length_cm}
              width={container.width_cm}
              height={container.height_cm}
            />
            {sortedItems.map((item, idx) => (
              <AnimatedBox key={item.id} item={item} index={idx} />
            ))}
          </>
        )}

        <ContactShadows
          position={[container.length_cm / 200, -0.01, container.width_cm / 200]}
          scale={20}
          blur={2.5}
          far={4}
          opacity={0.5}
          color="#000000"
        />

        <OrbitControls
          enableDamping
          dampingFactor={0.04}
          maxPolarAngle={Math.PI / 2 - 0.05}
          minDistance={1}
          maxDistance={cameraDistance * 4}
        />
      </Canvas>
    </div>
  );
}
