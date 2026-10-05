import type { Metadata } from "next";
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
 * TODO Phase D M0: add the providers from components/providers once stores exist.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
