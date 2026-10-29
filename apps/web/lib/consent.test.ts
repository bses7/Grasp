import { describe, expect, it } from "vitest";
import { parseAssignmentCode } from "./consent";

describe("parseAssignmentCode", () => {
  it("decodes phase and condition and normalises the number", () => {
    expect(parseAssignmentCode(" pg14 ")).toEqual({ code: "PG-014", studyPhase: "pilot", condition: "gesture" });
    expect(parseAssignmentCode("SM-102")).toEqual({ code: "SM-102", studyPhase: "main", condition: "mouse" });
    expect(parseAssignmentCode("dm")).toEqual({ code: "DM", studyPhase: "dev", condition: "mouse" });
  });

  it("rejects unknown letters and study codes without a number", () => {
    for (const bad of ["", "PX-1", "XG-1", "PG", "SM", "PG-12345", "PG-1a"]) expect(parseAssignmentCode(bad)).toBeNull();
  });
});
