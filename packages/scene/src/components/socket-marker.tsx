/**
 * Socket visual at the socket transform (M5): a ring whose radius is the snap radius.
 * "ghost" (transparent copy of the expected component) needs GLB nodes and renders as a ring until M9.
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
      <mesh>
        <torusGeometry args={[socket.radius, 0.12, 8, 48]} />
        <meshBasicMaterial color="#a0aec0" transparent opacity={0.7} />
      </mesh>
    </group>
  );
}
