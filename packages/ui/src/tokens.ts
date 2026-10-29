/**
 * Design tokens from docs/11-ui-ux.md ("Heart studio"). The CSS custom properties in
 * apps/web/app/globals.css are the source for DOM styling; this export carries
 * the same values into the R3F scene (emissive tints, cursor, labels) where CSS
 * variables are not readable.
 */
export type Theme = "studio";

export type ColorRole =
  | "bg" | "surface" | "text" | "textMuted" | "accent"
  | "success" | "partial" | "error" | "warnTracking" | "gold" | "ghost";

export const tokens = {
  color: {
    /** The one "Heart studio" theme (doc 11), palette sampled from heart_v1. */
    studio: {
      bg: "#EEF2EA",
      surface: "#FBF8F1",
      text: "#3A1F2B",
      textMuted: "#6E5A62",
      accent: "#8E3B3A",
      success: "#4F8A5A",
      partial: "#B8862F",
      error: "#B5523F",
      warnTracking: "#B8862F",
      gold: "#C9A14A",
      ghost: "rgb(201 161 74 / 0.15)",
    },
    /** prefers-contrast: more. The scene keeps its tints; outlines are V1 (doc 05). */
    highContrast: { bg: "#FFFFFF", text: "#000000", accent: "#5E2224" },
  },
  /**
   * Emissive tints for the R3F scene (doc 05 section 3.4): dimmed versions of the doc 11 roles, because emissive
   * adds to the base colour. Hover and the hint pulse are the gold `highlight`; focus and grab are distinct from it.
   * ponytail: hover on heart_v1's gold fat may need a stronger emissive; tune on the reference monitor.
   */
  sceneTint: {
    none: 0x000000,
    hovered: 0x6a5020,
    pulse: 0x6a5020,
    focused: 0x3a3060,
    grabbed: 0x6b4423,
    correct: 0x2a5c33,
    partial: 0x7a5a1f,
    incorrect: 0x7a3020,
  },
  /** DOM pieces the scene draws itself (cursor ring, dwell fill, hotspot label). */
  sceneDom: {
    ink: "#3A1F2B",
    cursorFill: "rgb(251 248 241 / 0.7)",
    cursorGrab: "#8E3B3A",
    dwellFill: "rgb(58 31 43 / 0.55)",
    labelBg: "#FBF8F1",
    font: "600 14px var(--font-inter), system-ui, sans-serif",
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
