/**
 * Seeds a local database for development: two research_sessions rows with study_phase = 'dev', one per condition,
 * matching consent_records, and a replay of the recorded LogEvent fixture from the learning-engine tests into
 * event_logs and lesson_attempts, so the metrics script and the mastery query have real rows.
 * Content is never seeded; it is files. The randomisation list is never seeded; it stays offline.
 * Doc 09 "Seed and migration strategy"; Phase D after M11.
 */
console.log("TODO Phase D: seed dev sessions, consent, and the LogEvent fixture (doc 09)");
process.exit(0);
