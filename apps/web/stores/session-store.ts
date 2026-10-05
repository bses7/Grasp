import { create } from "zustand";

/**
 * sessionStore (docs/03 "State management"): sessionId, condition, consent
 * flags, camera permission state. Updated rarely; read by HUD, logger, API
 * clients. The logger drops everything while consent.logging is false.
 * TODO Phase D, doc 13 Phase 4: populate from POST /api/session.
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
