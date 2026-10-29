/**
 * Socket visual at the socket transform: a ring whose radius is the snap radius, drawn on top of the model
 * (no depth test) because a socket sits inside the assembled model where its part belongs.
 * ponytail: "ghost" (a transparent copy of the expected part) renders as a ring too; a ghost needs a clone of
 * the GLB node and only matters for the guided activities of the full lesson (doc 13 Phase 4).
 * Not interactable; sockets only matter on grab_end.
 */
import type { Socket } from "@grasp/types";
import type { Mesh } from "three";

export type SocketMarkerProps = {
  socket: Socket;
  visual: Socket["visual"];
  /** The ring mesh, so LessonScene can light it while a held part is in range without a React commit. */
  register?: (socketId: string, ring: Mesh | null) => void;
};

/** Gold ring (doc 11 `socket-ring`), brighter while a held part is in range; a plum keyline keeps it visible on sage. */
export const RING_COLOR = { idle: 0xc9a14a, inRange: 0xf0c860, keyline: 0x3a1f2b };

export function SocketMarker({ socket, visual, register }: SocketMarkerProps) {
  if (visual === "none") return null;
  return (
    <group position={socket.transform.position} rotation={socket.transform.rotation}>
      <mesh renderOrder={10} ref={(m) => register?.(socket.id, m)}>
        <torusGeometry args={[socket.radius, socket.radius * 0.04, 8, 48]} />
        <meshBasicMaterial color={RING_COLOR.idle} depthTest={false} depthWrite={false} />
      </mesh>
      {/* ponytail: solid ring with a keyline, not doc 11's dashed one; dashes need a shader or segments. */}
      <mesh renderOrder={9}>
        <torusGeometry args={[socket.radius, socket.radius * 0.075, 8, 48]} />
        <meshBasicMaterial color={RING_COLOR.keyline} depthTest={false} depthWrite={false} />
      </mesh>
    </group>
  );
}
