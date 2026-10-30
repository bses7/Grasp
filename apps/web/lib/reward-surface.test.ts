/**
 * Roadmap Phase 6 checks (doc 08 "The one rule" and "Research consideration"):
 * 1. Nothing in the mastery or unlock path reads a reward value: mastery is a function of attempts only, so no
 *    XP, level, badge, achievement, quest or reward identifier may appear in it.
 * 2. Both study conditions see the identical reward surface: the components that show mastery and correct
 *    feedback never read the input condition.
 * 3. No log event is a reward event, so nothing in the event stream can pair a reward with speed or task count.
 * ponytail: source-text checks, like the A20 static test; a rendered gesture-vs-mouse comparison is V1 with the
 * Playwright suite.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LOG_EVENT_TYPES } from "@grasp/db";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "../../..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");
const REWARD = /\b(xp|level(?!s?\s*[1-3])|levels|badges?|achievements?|quests?|rewards?|streaks?|points)\b/i;
/** Comments may name rewards to say they are excluded; only code counts. */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("reward layer (roadmap Phase 6)", () => {
  it("keeps the mastery and unlock path free of reward values", () => {
    for (const f of ["packages/learning/src/mastery.ts", "packages/learning/src/sequencing.ts"]) {
      const src = code(read(f));
      const hit = src.match(REWARD);
      expect(hit, `${f}: ${hit?.[0]}`).toBeNull();
      // Mastery imports only types and the sequencing constants, never a reward module.
      for (const [, from] of src.matchAll(/from "([^"]+)"/g)) expect(["@grasp/types", "./sequencing"], f).toContain(from);
    }
  });

  it("renders the same reward surface in both conditions", () => {
    const page = read("apps/web/app/(study)/lesson/[lessonId]/lesson-client.tsx");
    for (const name of ["Results", "band", "Burst", "LevelPath", "FeedbackLine", "partsOf"]) {
      const body = page.match(new RegExp(`\\nfunction ${name}\\b[\\s\\S]*?\\n}\\n`))?.[0];
      expect(body, `${name} not found`).toBeTruthy();
      expect(code(body!), name).not.toMatch(/\b(input|condition)\b/);
    }
  });

  it("logs no reward events", () => {
    for (const t of LOG_EVENT_TYPES) expect(t).not.toMatch(REWARD);
  });
});
