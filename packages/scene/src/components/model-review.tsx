/**
 * Dev-only model review canvas (doc 10 "Authoring workflow", doc 17 M9): shows a parsed GLB with orbit
 * controls, tints the selected part and fades the rest, and reports clicks on parts. Not a learner view;
 * the lesson scene is <LessonScene>.
 */
import { Bounds, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect } from "react";
import type { Group, Material, MeshStandardMaterial } from "three";
import type { GlbPart } from "../model-loader";

export type ModelReviewCanvasProps = {
  scene: Group;
  parts: GlbPart[];
  /** Selected part name, or null for none. */
  selected: string | null;
  onSelect: (name: string | null) => void;
};

function styleParts(parts: GlbPart[], selected: string | null) {
  for (const p of parts) {
    for (const m of ([] as Material[]).concat(p.object.material)) {
      const std = m as MeshStandardMaterial;
      const isSel = p.name === selected;
      std.emissive?.setHex(isSel ? 0x2f6f4a : 0x000000);
      std.transparent = selected !== null && !isSel;
      std.opacity = std.transparent ? 0.15 : 1;
      std.depthWrite = !std.transparent;
      std.needsUpdate = true;
    }
  }
}

export function ModelReviewCanvas({ scene, parts, selected, onSelect }: ModelReviewCanvasProps) {
  useEffect(() => styleParts(parts, selected), [parts, selected]);
  return (
    <Canvas frameloop="demand" camera={{ fov: 45, near: 0.01, far: 5000, position: [0, 0, 10] }} onPointerMissed={() => onSelect(null)}>
      <hemisphereLight intensity={0.9} />
      <directionalLight position={[10, 20, 30]} intensity={1.8} />
      <Bounds fit clip observe margin={1.2}>
        <primitive
          object={scene}
          onClick={(e: { stopPropagation(): void; object: { uuid: string } }) => {
            e.stopPropagation();
            const hit = parts.find((p) => p.object.uuid === e.object.uuid);
            onSelect(hit ? hit.name : null);
          }}
        />
      </Bounds>
      <OrbitControls makeDefault />
    </Canvas>
  );
}
