CREATE TABLE "ai_interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid,
	"lesson_id" text NOT NULL,
	"activity_id" text NOT NULL,
	"task_id" text,
	"attempt_no" smallint,
	"kind" text NOT NULL,
	"hint_level" smallint,
	"engine" text NOT NULL,
	"template_version" text,
	"status" text NOT NULL,
	"latency_ms" integer NOT NULL,
	"usage_json" jsonb,
	"request_json" jsonb,
	"response_json" jsonb,
	"delivered_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_interactions_kind_check" CHECK ("ai_interactions"."kind" in ('hint', 'explain_mistake', 'question', 'summary')),
	CONSTRAINT "ai_interactions_hint_level_check" CHECK ("ai_interactions"."hint_level" is null or "ai_interactions"."hint_level" between 1 and 3),
	CONSTRAINT "ai_interactions_status_check" CHECK ("ai_interactions"."status" in ('ok', 'fallback_timeout', 'fallback_error', 'fallback_invalid', 'capped'))
);
--> statement-breakpoint
CREATE TABLE "consent_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"consent_version" text NOT NULL,
	"consent_logging" boolean NOT NULL,
	"consent_tutor_payloads" boolean NOT NULL,
	"agreed_at" timestamp with time zone NOT NULL,
	"withdrawn_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"t" integer NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_logs_type_check" CHECK ("event_logs"."type" in ('activity_start', 'activity_end', 'task_start', 'task_attempt', 'task_end', 'hint_shown', 'mastery_computed', 'time_prompt', 'select', 'grab_start', 'grab_move_summary', 'grab_end', 'place', 'drop', 'scene_reset', 'gesture_emit', 'calibration_prompt', 'tracking_lost', 'tracking_regained', 'hand_count', 'misfire_report', 'tutor_message', 'perf_sample', 'device_info'))
);
--> statement-breakpoint
CREATE TABLE "instrument_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"instrument" text NOT NULL,
	"form" text,
	"item_no" smallint NOT NULL,
	"response" text NOT NULL,
	"correct" boolean,
	"answered_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instrument_responses_instrument_check" CHECK ("instrument_responses"."instrument" in ('pre', 'post', 'retention', 'sus', 'tlx', 'satisfaction', 'open', 'demographics')),
	CONSTRAINT "instrument_responses_form_check" CHECK ("instrument_responses"."form" is null or "instrument_responses"."form" in ('A', 'B', 'C'))
);
--> statement-breakpoint
CREATE TABLE "lesson_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid,
	"lesson_id" text NOT NULL,
	"lesson_hash" text NOT NULL,
	"activity_id" text NOT NULL,
	"activity_kind" text NOT NULL,
	"task_id" text NOT NULL,
	"task_type" text NOT NULL,
	"objective_id" text NOT NULL,
	"attempt_no" smallint NOT NULL,
	"micro_task" boolean DEFAULT false NOT NULL,
	"remediated" boolean DEFAULT false NOT NULL,
	"outcome" text NOT NULL,
	"score" numeric(6, 2) NOT NULL,
	"score_max" numeric(6, 2) NOT NULL,
	"hints_used" smallint NOT NULL,
	"duration_ms" integer NOT NULL,
	"actual" jsonb NOT NULL,
	"t" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_attempts_activity_kind_check" CHECK ("lesson_attempts"."activity_kind" in ('guided', 'challenge', 'assessment')),
	CONSTRAINT "lesson_attempts_task_type_check" CHECK ("lesson_attempts"."task_type" in ('identify', 'place', 'remove', 'sequence', 'compare')),
	CONSTRAINT "lesson_attempts_outcome_check" CHECK ("lesson_attempts"."outcome" in ('correct', 'partial', 'incorrect'))
);
--> statement-breakpoint
CREATE TABLE "research_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"participant_code" text,
	"assignment_code" text NOT NULL,
	"condition" text NOT NULL,
	"study_phase" text NOT NULL,
	"consent_version" text NOT NULL,
	"lesson_id" text NOT NULL,
	"lesson_hash" text NOT NULL,
	"app_version" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"calibration_accuracy" numeric(4, 3),
	"s2_completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "research_sessions_participant_code_unique" UNIQUE("participant_code"),
	CONSTRAINT "research_sessions_assignment_code_unique" UNIQUE("assignment_code"),
	CONSTRAINT "research_sessions_condition_check" CHECK ("research_sessions"."condition" in ('gesture', 'mouse')),
	CONSTRAINT "research_sessions_study_phase_check" CHECK ("research_sessions"."study_phase" in ('pilot', 'main', 'dev'))
);
--> statement-breakpoint
ALTER TABLE "ai_interactions" ADD CONSTRAINT "ai_interactions_session_id_research_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."research_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_session_id_research_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."research_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_logs" ADD CONSTRAINT "event_logs_session_id_research_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."research_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instrument_responses" ADD CONSTRAINT "instrument_responses_session_id_research_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."research_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_attempts" ADD CONSTRAINT "lesson_attempts_session_id_research_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."research_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_interactions_session_created_idx" ON "ai_interactions" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_interactions_lesson_status_idx" ON "ai_interactions" USING btree ("lesson_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "consent_records_session_version_uidx" ON "consent_records" USING btree ("session_id","consent_version");--> statement-breakpoint
CREATE UNIQUE INDEX "event_logs_session_seq_uidx" ON "event_logs" USING btree ("session_id","seq");--> statement-breakpoint
CREATE INDEX "event_logs_session_t_idx" ON "event_logs" USING btree ("session_id","t");--> statement-breakpoint
CREATE INDEX "event_logs_session_type_idx" ON "event_logs" USING btree ("session_id","type");--> statement-breakpoint
CREATE INDEX "event_logs_type_partial_idx" ON "event_logs" USING btree ("type") WHERE "event_logs"."type" in ('task_attempt', 'mastery_computed');--> statement-breakpoint
CREATE UNIQUE INDEX "instrument_responses_session_instrument_item_uidx" ON "instrument_responses" USING btree ("session_id","instrument","item_no");--> statement-breakpoint
CREATE INDEX "lesson_attempts_latest_per_task_idx" ON "lesson_attempts" USING btree ("session_id","lesson_id","task_id","t" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "lesson_attempts_session_lesson_objective_idx" ON "lesson_attempts" USING btree ("session_id","lesson_id","objective_id");--> statement-breakpoint
CREATE INDEX "research_sessions_phase_condition_started_idx" ON "research_sessions" USING btree ("study_phase","condition","started_at");