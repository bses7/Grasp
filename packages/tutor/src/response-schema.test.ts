import { describe, it, expect } from "vitest";
import { parseTutorResponse, tutorResponseSchema } from "./response-schema";

describe("tutorResponseSchema", () => {
  it("parses a minimal valid response", () => {
    const raw = {
      kind: "explain_mistake",
      text: "You selected the left ventricle. The chamber you need sits across the septum.",
      referencedComponentIds: ["left_ventricle", "septum"],
      highlight: [],
      revealsAnswer: false,
    };
    const parsed = parseTutorResponse(raw);
    expect(parsed.kind).toBe("explain_mistake");
    expect(parsed.referencedComponentIds).toEqual(["left_ventricle", "septum"]);
    expect(parsed.revealsAnswer).toBe(false);
  });

  it("rejects a response missing a required field", () => {
    const raw = {
      kind: "hint",
      text: "Look at the lower chambers.",
      referencedComponentIds: [],
      // highlight missing
      revealsAnswer: false,
    };
    expect(tutorResponseSchema.safeParse(raw).success).toBe(false);
    expect(() => parseTutorResponse(raw)).toThrow();
  });
});
