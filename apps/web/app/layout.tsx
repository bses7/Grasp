import type { Metadata } from "next";
import { Cinzel, Fraunces, Inter } from "next/font/google";
import { connection } from "next/server";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grasp",
  description:
    "Learn by manipulating 3D educational models with webcam hand gestures.",
};

// Self-hosted at build time: the browser never contacts Google (doc 11 type scale; CSP stays same-origin).
const fraunces = Fraunces({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-fraunces" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const cinzel = Cinzel({ subsets: ["latin"], weight: ["600", "800"], variable: "--font-cinzel" }); // easter-egg tour theme only

/**
 * Root layout. One light "Heart studio" theme on every screen (docs/11).
 * Every page renders per request: the CSP nonce from proxy.ts only exists at request time, and a
 * statically prerendered page would ship un-nonced inline scripts that the CSP blocks (docs/15).
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  await connection();
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${cinzel.variable}`}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
