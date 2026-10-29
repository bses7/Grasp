ALTER TABLE "research_sessions" ADD COLUMN "skipped_task_ids" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
-- Backfill: skips recorded before this column existed lived only in the event log.
UPDATE "research_sessions" s SET "skipped_task_ids" = sub.ids FROM (
  SELECT session_id, array_agg(DISTINCT payload->>'taskId') AS ids FROM "event_logs"
  WHERE type = 'task_end' AND payload->>'outcome' = 'skipped' GROUP BY session_id
) sub WHERE sub.session_id = s.id;
