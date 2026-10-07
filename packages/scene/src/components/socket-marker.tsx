/**
 * Socket visual at the socket transform: a ring whose radius is the snap radius, drawn on top of the model
 * (no depth test) because a socket sits inside the assembled model where its part belongs.
 * ponytail: "ghost" (a transparent copy of the expected part) renders as a ring too; a ghost needs a clone of
 * the GLB node and only matters for the guided activities of the full lesson (doc 13 Phase 4).
 * Not interactable; sockets only matter on grab_end.
 */
import type { Socket } from "@grasp/types";

export type SocketMarkerProps = {
  socket: Socket;
  visual: Socket["visual"];
};

export function SocketMarker({ socket, visual }: SocketMarkerProps) {
  if (visual === "none") return null;
  return (
    <group position={socket.transform.position} rotation={socket.transform.rotation}>
      <mesh renderOrder={10}>
        <torusGeometry args={[socket.radius, socket.radius * 0.04, 8, 48]} />
        <meshBasicMaterial color="#e2e8f0" transparent opacity={0.6} depthTest={false} depthWrite={false} />
      </mesh>
    </group>
  );
}
