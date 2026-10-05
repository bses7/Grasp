/**
 * Design tokens from docs/11-ui-ux.md. The CSS custom properties in
 * apps/web/app/globals.css are the source for DOM styling; this export carries
 * the same values into the R3F scene (emissive highlight, ring, ghost socket
 * colours) where CSS variables are not readable.
 */
export type Theme = "dark" | "light";

export type ColorRole =
  | "bg" | "surface" | "text" | "textMuted" | "accent"
  | "success" | "partial" | "error" | "warnTracking" | "ghost";

export const tokens = {
  color: {
    dark: {
      bg: "#0B1020",
      surface: "rgb(20 26 46 / 0.92)",
      text: "#E8ECF8",
      textMuted: "#9AA3BF",
      accent: "#4FD1FF",
      success: "#2ED47A",
      partial: "#FFB547",
      error: "#FF5C7A",
      warnTracking: "#FFB547",
      ghost: "rgb(79 209 255 / 0.25)",
    },
    light: {
      bg: "#F6F7FB",
      surface: "#FFFFFF",
      text: "#141A2E",
      textMuted: "#5B637A",
      accent: "#0E7CFF",
      success: "#118A4A",
      partial: "#B36B00",
      error: "#C62846",
      warnTracking: "#FFB547",
      ghost: "transparent",
    },
    /** prefers-contrast: more. Accent on dark becomes yellow; outlines replace emissive. */
    highContrast: { darkBg: "#000000", lightBg: "#FFFFFF", darkAccent: "#FFE400" },
  },
  /** Size / line height in px. */
  type: {
    display: { size: 40, lineHeight: 48 },
    h1: { size: 28, lineHeight: 36 },
    instruction: { size: 22, lineHeight: 30 },
    body: { size: 16, lineHeight: 24 },
    hud: { size: 14, lineHeight: 20, weight: 500, tracking: 0.02 },
    caption: { size: 13, lineHeight: 18 },
  },
  /** Duration in ms and CSS easing; the scene reads the same numbers. */
  motion: {
    micro: { duration: 120, easing: "ease-out" },
    standard: { duration: 200, easing: "cubic-bezier(0.33, 1, 0.68, 1)" },
    snap: { duration: 150, easing: "ease-out" },
    reset: { duration: 400, easing: "ease-in-out" },
    dwell: { duration: 600, easing: "linear" },
    pulse: { duration: 1200, easing: "linear", opacityRange: [0.6, 1.0] as const },
    reducedMotionFade: { duration: 100, easing: "linear" },
  },
  /** 4 px grid; doc 11 fixes the interaction sizes, the scale is the default. */
  spacing: { 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32, 12: 48 },
  /** Interaction cue sizes in px from docs/11 consideration 9 and cursor states. */
  size: {
    cursorRing: 28,
    hoverRing: 20,
    dwellRing: 36,
    socketRingMin: 48,
    hitTargetMin: 44,
    trackingChipCollapsed: 32,
    highContrastOutline: 3,
  },
} as const;

export type Tokens = typeof tokens;
