CREATE TABLE "dance_course_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"routine_id" text NOT NULL,
	"segment_id" text NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"best_score" integer DEFAULT 0,
	"best_reliability" integer DEFAULT 0,
	"attempts" integer DEFAULT 0,
	"completed_at" timestamp,
	"last_attempt_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dance_course_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"routine_id" text NOT NULL,
	"segment_id" text NOT NULL,
	"mode" text DEFAULT 'full_routine' NOT NULL,
	"source_session_id" text,
	"score" integer NOT NULL,
	"reliability" integer NOT NULL,
	"timing_score" integer DEFAULT 0,
	"transition_score" integer DEFAULT 0,
	"duration_seconds" integer DEFAULT 0,
	"completed" boolean DEFAULT false,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dance_course_progress" ADD CONSTRAINT "dance_course_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dance_course_attempts" ADD CONSTRAINT "dance_course_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dance_course_attempts" ADD CONSTRAINT "dance_course_attempts_source_session_id_workout_sessions_id_fk" FOREIGN KEY ("source_session_id") REFERENCES "public"."workout_sessions"("id") ON DELETE set null ON UPDATE no action;
