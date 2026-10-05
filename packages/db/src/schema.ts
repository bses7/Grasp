/**
 * Drizzle schema for the six MVP tables (doc 09 "MVP tables") plus `progress`, which is V1 and deliberately
 * not exported so drizzle-kit leaves it out of the MVP migration. The V1 content and account tables
 * (users, subjects, topics, courses, models, components, lessons, activities, tasks, assessments, achievements)
 * are designed in doc 09 and arrive with the V1 content migration; in MVP every reference to them is a text id.
 *
 * Conventions (doc 09): plural snake_case tables, `id uuid` PK, `created_at timestamptz`, `t integer` is ms since
 * session start as emitted by the client, every MVP table cascades from research_sessions, no identity columns.
 */
import { sql } from "drizzle-orm";
import {
  boolean, check, index, integer, jsonb, numeric, pgTable, smallint, text, timestamp, uniqueIndex, uuid,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("created_at").notNull().defaultNow();
/** Inlines a quoted list for check constraints so drizzle-kit emits literals, not bind parameters. */
const inList = (values: readonly string[]) => sql.raw(values.map((v) => `'${v}'`).join(", "));

/** Kept in step with LogEventType in @grasp/types; doc 09 says a script regenerates this list at Phase D. */
export const LOG_EVENT_TYPES = [
  "activity_start", "activity_end", "task_start", "task_attempt", "task_end", "hint_shown", "mastery_computed",
  "time_prompt", "select", "grab_start", "grab_move_summary", "grab_end", "place", "drop", "scene_reset",
  "gesture_emit", "calibration_prompt", "tracking_lost", "tracking_regained", "hand_count", "misfire_report",
  "tutor_message", "perf_sample", "device_info",
] as const;

/** One row per participant-session. In MVP a session runs exactly one lesson. */
export const researchSessions = pgTable(
  "research_sessions",
  {
    /** Client-generated v4 UUID validated by the server; the default is a safety net for the seed script. */
    id: uuid("id").primaryKey().defaultRandom(),
    /** V1: references users.id on delete set null. Null in MVP. */
    userId: uuid("user_id"),
    /** 6-character code printed for the participant; resolves the S2 retention page and deletion requests. */
    participantCode: text("participant_code").unique(),
    /** Pre-assigned code from the researcher's offline blocked-randomisation list; encodes condition. */
    assignmentCode: text("assignment_code").notNull().unique(),
    condition: text("condition").notNull(),
    studyPhase: text("study_phase").notNull(),
    consentVersion: text("consent_version").notNull(),
    lessonId: text("lesson_id").notNull(),
    lessonHash: text("lesson_hash").notNull(),
    appVersion: text("app_version").notNull(),
    startedAt: ts("started_at").notNull(),
    endedAt: ts("ended_at"),
    calibrationAccuracy: numeric("calibration_accuracy", { precision: 4, scale: 3 }),
    s2Completed: boolean("s2_completed").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index("research_sessions_phase_condition_started_idx").on(t.studyPhase, t.condition, t.startedAt),
    check("research_sessions_condition_check", sql`${t.condition} in (${inList(["gesture", "mouse"])})`),
    check("research_sessions_study_phase_check", sql`${t.studyPhase} in (${inList(["pilot", "main", "dev"])})`),
  ],
);

/** Proof of consent without identity; retained with withdrawn_at after a cascade delete. */
export const consentRecords = pgTable(
  "consent_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id").notNull().references(() => researchSessions.id, { onDelete: "cascade" }),
    consentVersion: text("consent_version").notNull(),
    /** Gates event_logs writes; the client logger drops events when false. */
    consentLogging: boolean("consent_logging").notNull(),
    /** Gates ai_interactions.request_json, response_json, delivered_text. */
    consentTutorPayloads: boolean("consent_tutor_payloads").notNull(),
    agreedAt: ts("agreed_at").notNull(),
    withdrawnAt: ts("withdrawn_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("consent_records_session_version_uidx").on(t.sessionId, t.consentVersion)],
);

/** Append-only system of record for the study (doc 14 section 6.3). Never landmarks, never text. */
export const eventLogs = pgTable(
  "event_logs",
  {
    /** Client-generated so a retried batch is idempotent via on conflict do nothing. */
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id").notNull().references(() => researchSessions.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    t: integer("t").notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, string | number | boolean | null>>().notNull(),
    receivedAt: ts("received_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("event_logs_session_seq_uidx").on(t.sessionId, t.seq),
    index("event_logs_session_t_idx").on(t.sessionId, t.t),
    index("event_logs_session_type_idx").on(t.sessionId, t.type),
    index("event_logs_type_partial_idx").on(t.type).where(sql`${t.type} in ('task_attempt', 'mastery_computed')`),
    check("event_logs_type_check", sql`${t.type} in (${inList(LOG_EVENT_TYPES)})`),
  ],
);

/** Knowledge tests, SUS, TLX, satisfaction, open questions, demographics (doc 14). */
export const instrumentResponses = pgTable(
  "instrument_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id").notNull().references(() => researchSessions.id, { onDelete: "cascade" }),
    instrument: text("instrument").notNull(),
    /** Knowledge tests only; the Latin-square assignment. */
    form: text("form"),
    itemNo: smallint("item_no").notNull(),
    /** The chosen option, scale value as text, or open-question text. */
    response: text("response").notNull(),
    /** Knowledge items only; scored at insert from the form file's key. */
    correct: boolean("correct"),
    answeredAt: ts("answered_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("instrument_responses_session_instrument_item_uidx").on(t.sessionId, t.instrument, t.itemNo),
    check(
      "instrument_responses_instrument_check",
      sql`${t.instrument} in (${inList(["pre", "post", "retention", "sus", "tlx", "satisfaction", "open", "demographics"])})`,
    ),
    check("instrument_responses_form_check", sql`${t.form} is null or ${t.form} in (${inList(["A", "B", "C"])})`),
  ],
);

/** One row per task_attempt; the attempt record from doc 06 plus the denormalised facts mastery needs. */
export const lessonAttempts = pgTable(
  "lesson_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id").notNull().references(() => researchSessions.id, { onDelete: "cascade" }),
    /** V1: references users.id on delete set null. */
    userId: uuid("user_id"),
    lessonId: text("lesson_id").notNull(),
    lessonHash: text("lesson_hash").notNull(),
    activityId: text("activity_id").notNull(),
    activityKind: text("activity_kind").notNull(),
    taskId: text("task_id").notNull(),
    taskType: text("task_type").notNull(),
    objectiveId: text("objective_id").notNull(),
    /** Resets after remediation (doc 06), so (task_id, attempt_no) legitimately repeats; t disambiguates. */
    attemptNo: smallint("attempt_no").notNull(),
    /** True for the synthesised prerequisite micro-task; excluded from mastery. */
    microTask: boolean("micro_task").notNull().default(false),
    remediated: boolean("remediated").notNull().default(false),
    outcome: text("outcome").notNull(),
    /** After hint penalty. */
    score: numeric("score", { precision: 6, scale: 2 }).notNull(),
    /** The task's scoring.correct, for normalisation. */
    scoreMax: numeric("score_max", { precision: 6, scale: 2 }).notNull(),
    hintsUsed: smallint("hints_used").notNull(),
    durationMs: integer("duration_ms").notNull(),
    /** Event summary { type, componentId, socketId? }. */
    actual: jsonb("actual").$type<{ type: string; componentId?: string; socketId?: string; hotspotId?: string }>().notNull(),
    t: integer("t").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("lesson_attempts_latest_per_task_idx").on(t.sessionId, t.lessonId, t.taskId, t.t.desc()),
    index("lesson_attempts_session_lesson_objective_idx").on(t.sessionId, t.lessonId, t.objectiveId),
    check("lesson_attempts_activity_kind_check", sql`${t.activityKind} in (${inList(["guided", "challenge", "assessment"])})`),
    check("lesson_attempts_task_type_check", sql`${t.taskType} in (${inList(["identify", "place", "remove", "sequence", "compare"])})`),
    check("lesson_attempts_outcome_check", sql`${t.outcome} in (${inList(["correct", "partial", "incorrect"])})`),
  ],
);

/**
 * One row per tutor call, including capped calls and fallbacks where the engine produced nothing and the
 * static hint was shown (doc 07, doc 09). The MVP engine is the deterministic template tutor; usage_json is
 * nullable and unused until a V1 local open-weights engine fills it with diagnostics (never cost).
 */
export const aiInteractions = pgTable(
  "ai_interactions",
  {
    /** Returned to the client as interactionId. */
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id").notNull().references(() => researchSessions.id, { onDelete: "cascade" }),
    /** V1: references users.id on delete set null. */
    userId: uuid("user_id"),
    lessonId: text("lesson_id").notNull(),
    activityId: text("activity_id").notNull(),
    /** Null for summary. */
    taskId: text("task_id"),
    attemptNo: smallint("attempt_no"),
    kind: text("kind").notNull(),
    hintLevel: smallint("hint_level"),
    /** "template" in MVP; "local:<name>" for a V1 local open-weights engine. Never a hosted vendor or model id. */
    engine: text("engine").notNull(),
    /** Version of @grasp/tutor that produced the text; null for V1 local-model rows. */
    templateVersion: text("template_version"),
    status: text("status").notNull(),
    latencyMs: integer("latency_ms").notNull(),
    /** Null in MVP; a V1 local engine may store engine-specific diagnostics (context size, generation time). */
    usageJson: jsonb("usage_json").$type<Record<string, unknown>>(),
    /** Null unless consent_tutor_payloads. */
    requestJson: jsonb("request_json").$type<Record<string, unknown>>(),
    responseJson: jsonb("response_json").$type<Record<string, unknown>>(),
    deliveredText: text("delivered_text"),
    createdAt: createdAt(),
  },
  (t) => [
    index("ai_interactions_session_created_idx").on(t.sessionId, t.createdAt),
    index("ai_interactions_lesson_status_idx").on(t.lessonId, t.status),
    check("ai_interactions_kind_check", sql`${t.kind} in (${inList(["hint", "explain_mistake", "question", "summary"])})`),
    check("ai_interactions_hint_level_check", sql`${t.hintLevel} is null or ${t.hintLevel} between 1 and 3`),
    check(
      "ai_interactions_status_check",
      sql`${t.status} in (${inList(["ok", "fallback_timeout", "fallback_error", "fallback_invalid", "capped"])})`,
    ),
  ],
);

/**
 * V1 ONLY. Per-objective mastery write-through cache, one row per (session, lesson, objective).
 * MVP recomputes mastery from lesson_attempts with the DISTINCT ON query in doc 09 and does not create this table.
 * Not exported: drizzle-kit reads exports, so this stays out of the MVP migration. Export it with the V1 migration
 * that also adds users and the content tables.
 */
const progress = pgTable(
  "progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id").notNull().references(() => researchSessions.id, { onDelete: "cascade" }),
    /** V1: references users.id on delete set null; becomes the row key when mastery persists across sessions. */
    userId: uuid("user_id"),
    lessonId: text("lesson_id").notNull(),
    lessonHash: text("lesson_hash").notNull(),
    objectiveId: text("objective_id").notNull(),
    /** Null means not started. */
    mastery: numeric("mastery", { precision: 4, scale: 3 }),
    masteryThreshold: numeric("mastery_threshold", { precision: 4, scale: 3 }).notNull(),
    /** Stored, not generated, so a threshold change in a new lesson version does not rewrite history. */
    mastered: boolean("mastered").notNull(),
    attemptsCount: integer("attempts_count").notNull(),
    lastAttemptAt: ts("last_attempt_at"),
    updatedAt: ts("updated_at").notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("progress_session_lesson_objective_uidx").on(t.sessionId, t.lessonId, t.objectiveId),
    check("progress_mastery_check", sql`${t.mastery} is null or (${t.mastery} >= 0 and ${t.mastery} <= 1)`),
  ],
);
void progress;
