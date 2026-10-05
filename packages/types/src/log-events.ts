/**
 * Research event-log contract. Source: research-protocol skill section 4, extended by doc 14 section 6.1.
 * Rules: no landmark coordinates anywhere; grab_move is summarised per drag; tutor text never enters the log;
 * drop carries no position.
 */

export type StudyCondition = "gesture" | "mouse";

export type LogEventType =
  // engine
  | "activity_start" | "activity_end" | "task_start" | "task_attempt" | "task_end"
  | "hint_shown" | "mastery_computed" | "time_prompt"
  // scene (both conditions)
  | "select" | "grab_start" | "grab_move_summary" | "grab_end" | "place" | "drop" | "scene_reset"
  // vision (gesture condition only)
  | "gesture_emit" | "calibration_prompt" | "tracking_lost" | "tracking_regained"
  | "hand_count" | "misfire_report"
  // tutor
  | "tutor_message"
  // performance (both conditions; inference fields null for mouse)
  | "perf_sample" | "device_info";

export type LogPayloadValue = string | number | boolean | null;

export type LogPayload = Record<string, LogPayloadValue>;

export type LogEvent = {
  /** Random client-generated v4 UUID; identity link only via the offline consent key. */
  sessionId: string;
  condition: StudyCondition;
  /** Monotonic per session; detects loss and reordering. Unique with sessionId in event_logs. */
  seq: number;
  /** ms since session start (performance.now based), never server time. */
  t: number;
  type: LogEventType;
  payload: LogPayload;
};

/*
 * Payload contracts (doc 14 section 6.1). Enforced by Zod strict() in the /api/events route handler.
 *
 * task_start        { taskId, taskType, objectiveId, activityId, activityKind }
 * task_attempt      { taskId, taskType, attemptNo, correct, partial, score, hintsUsed, componentId, socketId }
 * task_end          { taskId, outcome: "correct" | "incorrect" | "skipped" }
 * hint_shown        { taskId, level, source: "static" | "tutor" }
 * mastery_computed  { objectiveId, mastery, threshold }
 * time_prompt       { lessonMs, activityId, taskId, choice: "continue" | "assess" }   // once, at 15 min
 * select            { componentId, hotspotId, method: "grab" | "dwell" | "click" }
 * grab_start        { componentId }            // null when orbiting empty space
 * grab_move_summary { componentId, durationMs, pathLengthNorm, zHintAbsSum }   // one per drag, on grab_end
 * grab_end          { componentId, reason: "release" | "lost" }
 * place             { componentId, socketId }
 * drop              { componentId, cause: "release" | "lost" }   // cause:"lost" drops are logged, never graded
 * scene_reset       { taskId }
 * gesture_emit      { gesture, confidence }    // state-machine transitions only, never per frame
 * calibration_prompt{ promptNo, expectedGesture, windowMs }
 * tracking_regained { durationMs }
 * hand_count        { n }
 * tutor_message     { role: "user" | "assistant", taskId, chars, latencyMs, cached }   // never the text
 * perf_sample (5 s) { fps, frameMsP95, inferenceMsP50, inferenceMsP95, e2eMsP50, jitterNorm, delegate }
 * device_info (once){ ua, gpuTier, cameraWidth, cameraHeight, workerPath: boolean }
 */
