/**
 * M0 toolchain check (doc 17): one lit cube under frameloop="demand". Nothing animates on its own;
 * a pointer move over the canvas tilts the cube and invalidates one frame, so an idle canvas renders
 * 0 fps (locked position 6). `onFrame` fires once per rendered frame for the page's frame counter.
 * Replaced by <LessonScene> at M5.
 */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import type { Mesh } from "three";

export type PrototypeCanvasProps = { onFrame?: () => void };

function Cube({ onFrame }: PrototypeCanvasProps) {
  const mesh = useRef<Mesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  const pointer = useThree((s) => s.pointer);

  useFrame(() => {
    if (mesh.current) {
      mesh.current.rotation.set(-pointer.y * 0.8, pointer.x * 0.8, 0);
    }
    onFrame?.();
  });

  const canvas = useThree((s) => s.gl.domElement);

  // R3F tracks the pointer, but demand mode does not redraw for it; ask for one frame per move.
  useEffect(() => {
    const redraw = () => invalidate();
    canvas.addEventListener("pointermove", redraw);
    return () => canvas.removeEventListener("pointermove", redraw);
  }, [canvas, invalidate]);

  return (
    <mesh ref={mesh}>
      <boxGeometry args={[1.4, 1.4, 1.4]} />
      <meshStandardMaterial color="#c0392b" />
    </mesh>
  );
}

export function PrototypeCanvas({ onFrame }: PrototypeCanvasProps) {
  return (
    <Canvas frameloop="demand" camera={{ position: [0, 0, 4], fov: 45 }} dpr={[1, 2]}>
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 4, 5]} intensity={2} />
      <Cube onFrame={onFrame} />
    </Canvas>
  );
}
