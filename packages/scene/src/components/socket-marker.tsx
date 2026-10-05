/**
 * Socket visual at the socket transform (M5): ghost (transparent copy of the
 * expected component), ring, or none. Not interactable; sockets only matter on grab_end.
 */
import type { Socket } from "@grasp/types";

export type SocketMarkerProps = {
  socket: Socket;
  visual: Socket["visual"];
  /** Occupying component id, or null when empty. */
  occupant: string | null;
  /** Ghost source node when visual is "ghost". */
  ghostNode?: unknown;
};

export function SocketMarker(_props: SocketMarkerProps) {
  throw new Error("TODO Phase D: SocketMarker (doc 05, M5)");
}
