CREATE TABLE "coach_memories" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"weak_metrics" text,
	"strong_metrics" text,
	"recurring_issues" text,
	"recommended_focus" text,
	"preferred_next_action" text,
	"last_decision" text,
	"weekly_summary" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coach_memories_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "coach_memories" ADD CONSTRAINT "coach_memories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;