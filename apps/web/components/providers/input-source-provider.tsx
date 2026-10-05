"use client";

import type { ReactNode } from "react";

/**
 * Selects the InputSource adapter: gesture (vision worker) or mouse, from the
 * session condition or `?input=mouse` in development (docs/17 mouse path;
 * docs/03 InteractionEvent). Both adapters emit the identical event stream so
 * the scene and engine never know which condition is running.
 * TODO Phase D M5 (mouse adapter) and M4 (worker).
 */
export function InputSourceProvider({ children }: { children: ReactNode }) {
  return (
    <div data-todo="providers/input-source-provider: Phase D M4-M5">
      {children}
    </div>
  );
}
