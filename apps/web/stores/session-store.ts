import { create } from "zustand";

/**
 * sessionStore (docs/03 "State management"): sessionId, condition, consent
 * flags, camera permission state. Updated rarely; read by HUD, logger, API
 * clients. Unused so far: the lesson page reads consent from its POST /api/session response (boot.consentLogging),
 * which gates the logger (doc 03 "State management").
 */
export type StudyCondition = "gesture" | "mouse";

export type SessionState = {
  sessionId: string | null;
  condition: StudyCondition | null;
  consent: { study: boolean; logging: boolean; version: string | null };
  cameraPermission: "unknown" | "granted" | "denied";
  setSession: (sessionId: string, condition: StudyCondition) => void;
  setCameraPermission: (state: SessionState["cameraPermission"]) => void;
};

export const useSessionStore = create<SessionState>()((set) => ({
  sessionId: null,
  condition: null,
  consent: { study: false, logging: false, version: null },
  cameraPermission: "unknown",
  setSession: (sessionId, condition) => set({ sessionId, condition }),
  setCameraPermission: (cameraPermission) => set({ cameraPermission }),
}));
