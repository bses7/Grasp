import type { ReactNode } from "react";

/**
 * Visible focus ring wrapper for keyboard users (docs/11 accessibility:
 * every interactive element has a 2 px accent ring, 3 px in high contrast).
 * TODO Phase D M5 (keyboard/mouse adapter path): style with the accent token
 * and :focus-visible; until then it renders children unchanged.
 */
export function FocusRing({ children }: { children: ReactNode }) {
  return <div data-todo="ui/focus-ring: Phase D M5">{children}</div>;
}
