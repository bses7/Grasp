/**
 * One interactable component (M5 primitives, M9 GLB nodes).
 * Sets userData.componentId and joins INTERACTABLE_LAYER. Its pose is set once when the object is
 * registered and afterwards lives only on the Object3D (never in props or state), so a re-render
 * can never snap a dragged component back. Highlights are emissive swaps done by LessonScene.
 */
import type { Component } from "@grasp/types";
import type { Mesh, Object3D } from "three";
import { INTERACTABLE_LAYER } from "../raycast";

export type PrimitiveShape = "cylinder" | "bent_tube" | "flattened_sphere";

/** M5 stand-ins (doc 17), keyed by component id; replaced by GLB nodes at M9. */
export const PROTO_PRIMITIVES: Record<string, { shape: PrimitiveShape; color: string }> = {
  aorta: { shape: "cylinder", color: "#c53030" },
  pulmonary_artery: { shape: "bent_tube", color: "#2b6cb0" },
  left_ventricle: { shape: "flattened_sphere", color: "#9b2c2c" },
};

export type ComponentMeshProps = {
  component: Component;
  /** Called once per mount with the component's root; LessonScene applies the initial pose. */
  register: (id: string, object: Object3D | null) => void;
};

const joinInteractable = (m: Mesh) => m.layers.enable(INTERACTABLE_LAYER);

export function ComponentMesh({ component, register }: ComponentMeshProps) {
  const proto = PROTO_PRIMITIVES[component.id] ?? { shape: "flattened_sphere", color: "#718096" };
  return (
    <group
      ref={(g) => register(component.id, g)}
      userData={{ componentId: component.id, grabbable: component.grabbable }}
    >
      <mesh onUpdate={joinInteractable} scale={proto.shape === "flattened_sphere" ? [1.1, 0.7, 1] : 1}>
        {proto.shape === "cylinder" && <cylinderGeometry args={[1.2, 1.2, 8, 24]} />}
        {proto.shape === "bent_tube" && <torusGeometry args={[3, 0.9, 12, 32, Math.PI]} />}
        {proto.shape === "flattened_sphere" && <sphereGeometry args={[3.2, 32, 16]} />}
        <meshStandardMaterial color={proto.color} roughness={0.6} />
      </mesh>
    </group>
  );
}
