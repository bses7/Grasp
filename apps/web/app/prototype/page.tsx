import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrototypeClient } from "./prototype-client";

export const metadata: Metadata = { title: "Prototype · Grasp" };

/**
 * Smallest viable prototype route (locked position 10, doc 17). Development only: it opens the camera without the
 * consent screen, so production builds answer 404 (doc 14 section 7, consent before camera).
 */
export default function PrototypePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <PrototypeClient />;
}
