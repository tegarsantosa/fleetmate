import React, { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Edges, Text, Environment } from "@react-three/drei";

const PALETTE = [
  "#5dd6ff", "#ff7ed4", "#ffd166", "#06d6a0", "#a78bfa", "#f97316", "#38bdf8", "#f472b6",
];

function colorForBox(index) {
  return PALETTE[index % PALETTE.length];
}

function Box({ item, index }) {
  const length = Number(item.placed_length_cm) / 100;
  const width = Number(item.placed_width_cm) / 100;
  const height = Number(item.placed_height_cm) / 100;
  const x = Number(item.pos_x) / 100 + length / 2;
  const y = Number(item.pos_z) / 100 + height / 2;
  const z = Number(item.pos_y) / 100 + width / 2;

  return (
    <mesh position={[x, y, z]} castShadow receiveShadow>
      <boxGeometry args={[length, height, width]} />
      <meshStandardMaterial color={colorForBox(index)} metalness={0.1} roughness={0.5} />
      <Edges color="#0b0e14" />
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
        <meshStandardMaterial color="#1c2333" transparent opacity={0.08} side={2} />
        <Edges color="#5dd6ff" />
      </mesh>
      <mesh position={[L / 2, 0, W / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[L, W]} />
        <meshStandardMaterial color="#11151f" />
      </mesh>
    </group>
  );
}

export default function Container3D({ container, items }) {
  const cameraDistance = useMemo(() => {
    const maxDim = Math.max(
      Number(container?.length_cm || 500),
      Number(container?.width_cm || 250),
      Number(container?.height_cm || 250)
    );
    return maxDim / 60;
  }, [container]);

  if (!container) {
    return (
      <div className="viewer-wrap" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#9aa4b8" }}>Select a container to inspect its load plan</p>
      </div>
    );
  }

  return (
    <div className="viewer-wrap">
      <Canvas shadows camera={{ position: [cameraDistance, cameraDistance * 0.8, cameraDistance], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 12, 8]} intensity={1.1} castShadow />
        <Environment preset="warehouse" />
        <ContainerShell
          length={container.length_cm}
          width={container.width_cm}
          height={container.height_cm}
        />
        {items.map((item, idx) => (
          <Box key={item.id} item={item} index={idx} />
        ))}
        <OrbitControls enableDamping dampingFactor={0.08} />
      </Canvas>
    </div>
  );
}
