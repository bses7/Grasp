import type { Metadata } from "next";
import { connection } from "next/server";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grasp",
  description:
    "Learn by manipulating 3D educational models with webcam hand gestures.",
};

/**
 * Root layout. Dark theme is the default because the lesson environment is a
 * 3D scene (docs/11); text screens switch to data-theme="light" per page.
 * Every page renders per request: the CSP nonce from proxy.ts only exists at request time, and a
 * statically prerendered page would ship un-nonced inline scripts that the CSP blocks (docs/15).
 * TODO Phase D M5: add the providers from components/providers once stores exist.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  await connection();
  return (
    <html lang="en" data-theme="dark">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
