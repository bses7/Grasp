/**
 * Hotspot marker (doc 05 section 3.7): a small sphere parented to its component's node at `localPosition`,
 * so it moves with the part, on INTERACTABLE_LAYER with userData.hotspotId. It is selectable like a
 * component (dwell, pinch, click, Enter) and emits { type: "select", hotspotId }.
 * ponytail: the label is one DOM element LessonScene positions on hover or focus, not Drei <Html occlude>
 * (whose unmount warned at M6). The marker is depth-tested, so parts in front hide it; the label is not.
 */
import type { Hotspot as HotspotData } from "@grasp/types";
import { createPortal } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import type { Mesh, Object3D } from "three";
import { INTERACTABLE_LAYER } from "../raycast";

export type HotspotProps = {
  hotspot: HotspotData;
  /** The GLB node of `hotspot.componentId`. */
  node: Object3D;
  register: (id: string, marker: Mesh | null) => void;
};

/** Gold marker (3.9:1 on the heart muscle, doc 11), cream while hovered or focused. */
export const HOTSPOT_COLOR = { idle: 0xc9a14a, active: 0xfbf8f1 };

export function Hotspot({ hotspot, node, register }: HotspotProps) {
  const ref = useRef<Mesh>(null);
  useEffect(() => {
    const m = ref.current!;
    m.layers.enable(INTERACTABLE_LAYER);
    register(hotspot.id, m);
    return () => register(hotspot.id, null);
  }, [hotspot.id, register]);
  return createPortal(
    <mesh ref={ref} position={hotspot.localPosition} userData={{ hotspotId: hotspot.id }}>
      <sphereGeometry args={[0.35, 16, 12]} />
      <meshBasicMaterial color={HOTSPOT_COLOR.idle} />
    </mesh>,
    node,
  );
}
