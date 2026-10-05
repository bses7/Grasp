import type { Metadata } from "next";
import { PrototypeClient } from "./prototype-client";

export const metadata: Metadata = { title: "Prototype · Grasp" };

/** Smallest viable prototype route (locked position 10, doc 17). M0: toolchain checks only. */
export default function PrototypePage() {
  return <PrototypeClient />;
}
