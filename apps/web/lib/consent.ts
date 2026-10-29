/**
 * The consent text participants see, versioned (doc 15: the exact wording a participant saw must be reproducible;
 * a wording change means a new CONSENT_VERSION). Baseline from the research-protocol skeleton; the approving
 * institution sets the final wording. Also the assignment-code format, shared by the consent form and the route.
 */
import type { StudyCondition } from "@grasp/types";

export const CONSENT_VERSION = "pilot-v1";

export const CONSENT_TITLE = "Learning heart anatomy with a 3D model controlled by hand gestures";

export const CONSENT_TEXT = [
  "You are invited to take part in a study comparing two ways of controlling a 3D heart model: hand gestures seen by your webcam, or a mouse.",
  "What happens: a short knowledge quiz, a lesson of about 12 minutes, a second quiz, two short questionnaires, and a 5-minute online quiz one week later.",
  "Webcam: if you are in the gesture group, your webcam detects the position of your hand. The video is processed only on this computer and is never recorded, stored, or sent anywhere. The camera preview stays on screen, and you can turn the camera off at any time.",
  "What we record: your quiz answers, questionnaire responses, your answers in the lesson, and, if you agree below, a log of your actions in the lesson (for example, which part you selected and when). No video, no images, no hand positions.",
  "Your data is labelled with a random code, not your name. At the end you get a participant code: quote it to the researcher to see or delete your data. You may stop at any time without giving a reason. Deletion is complete within 7 days.",
  "Your data is kept for 5 years after the study is published, then deleted.",
];

/**
 * The researcher's pre-assigned code from the offline blocked-randomisation list (doc 14): study phase letter
 * (P pilot, S main study, D developer), condition letter (G gesture, M mouse), then the list number, e.g. PG-014.
 * Dev codes need no number; the route makes them unique. The app never randomises.
 */
export type AssignmentCode = { code: string; studyPhase: "pilot" | "main" | "dev"; condition: StudyCondition };

const PHASE = { P: "pilot", S: "main", D: "dev" } as const;

export function parseAssignmentCode(raw: string): AssignmentCode | null {
  const m = /^([PSD])([GM])(?:-?(\d{1,4}))?$/.exec(raw.trim().toUpperCase());
  if (!m || (!m[3] && m[1] !== "D")) return null;
  return {
    code: m[3] ? `${m[1]}${m[2]}-${m[3].padStart(3, "0")}` : `${m[1]}${m[2]}`,
    studyPhase: PHASE[m[1] as keyof typeof PHASE],
    condition: m[2] === "G" ? "gesture" : "mouse",
  };
}
