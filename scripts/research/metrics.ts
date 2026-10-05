/**
 * Per-session research metrics from event_logs joined to research_sessions (doc 14 sections 2 and 6):
 * CV (inference p50/p95, tracking-lost count and seconds, false-start rate), interaction (selection accuracy,
 * placement success, time and attempts per task), learning (per-objective mastery via the doc 09 DISTINCT ON query),
 * UX (hint requests, tutor messages). Imports @grasp/learning for mastery and @grasp/db for the schema.
 * Usage: pnpm research:metrics --phase pilot|main [--session <id>]. Phase D at M10 (event log) and after M11 (database).
 */
console.log("TODO Phase D: compute per-session metrics from event_logs and lesson_attempts (doc 14)");
process.exit(0);
