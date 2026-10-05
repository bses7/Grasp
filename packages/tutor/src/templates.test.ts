import { describe, it, expect } from "vitest";
import {
  ALLOWED_PLACEHOLDERS,
  EXPLAIN_OUTCOMES,
  HINT_FALLBACK,
  MISTAKE_TEMPLATES,
  NARROW_CLAUSES,
  PLACEHOLDER_RE,
  REVEAL_PLACEHOLDERS,
  REVEAL_TEMPLATES,
  SEQUENCE_START_TEMPLATE,
  TASK_TYPES,
  fillTemplate,
} from "./templates.js";

function placeholders(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER_RE)].map((m) => m[1] as string);
}

const allowed = new Set<string>(ALLOWED_PLACEHOLDERS);
const reveal = new Set<string>(REVEAL_PLACEHOLDERS);

const safeTexts = [
  ...TASK_TYPES.flatMap((t) => EXPLAIN_OUTCOMES.map((o) => MISTAKE_TEMPLATES[t][o])),
  ...Object.values(NARROW_CLAUSES),
  SEQUENCE_START_TEMPLATE,
  HINT_FALLBACK,
];
const allTexts = [...safeTexts, ...TASK_TYPES.map((t) => REVEAL_TEMPLATES[t])];

describe("templates", () => {
  it("has a non-empty mistake template for every (taskType, outcome) key", () => {
    for (const t of TASK_TYPES) {
      for (const o of EXPLAIN_OUTCOMES) {
        expect(typeof MISTAKE_TEMPLATES[t][o]).toBe("string");
        expect(MISTAKE_TEMPLATES[t][o].length).toBeGreaterThan(0);
      }
      expect(REVEAL_TEMPLATES[t].length).toBeGreaterThan(0);
    }
  });

  it("uses only placeholders from the allowed set", () => {
    for (const text of allTexts) {
      for (const p of placeholders(text)) expect(allowed.has(p), `${p} in "${text}"`).toBe(true);
    }
  });

  it("never reveals the answer below level 3 by construction", () => {
    for (const text of safeTexts) {
      for (const p of placeholders(text)) expect(reveal.has(p), `${p} in "${text}"`).toBe(false);
    }
    for (const t of TASK_TYPES) expect(placeholders(REVEAL_TEMPLATES[t])).toContain("expectedName");
  });

  it("never uses the engine's outcome words", () => {
    for (const text of allTexts) expect(text.toLowerCase()).not.toMatch(/\b(correct|incorrect)\b/);
  });

  it("fills every placeholder and leaves missing ones unresolved", () => {
    const filled = fillTemplate(MISTAKE_TEMPLATES.identify.incorrect, {
      selectedName: "Left Ventricle",
      selectedDescription: "Thick-walled chamber that pumps oxygenated blood into the aorta.",
    });
    expect(filled).toBe(
      "You selected the Left Ventricle: Thick-walled chamber that pumps oxygenated blood into the aorta. That is not the part the task asks for.",
    );
    expect(fillTemplate(HINT_FALLBACK, {})).toBe(HINT_FALLBACK);
  });
});
