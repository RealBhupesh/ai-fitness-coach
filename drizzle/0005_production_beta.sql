CREATE TABLE "account_deletion_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"subject" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_identities" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"subject" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"units" text DEFAULT 'metric' NOT NULL,
	"theme" text DEFAULT 'system' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD COLUMN "client_session_id" text;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD COLUMN "payload_hash" text;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD COLUMN "model_evidence" text;--> statement-breakpoint
ALTER TABLE "provider_identities" ADD CONSTRAINT "provider_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_deletion_identity_unique" ON "account_deletion_jobs" USING btree ("provider","subject");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_identity_unique" ON "provider_identities" USING btree ("provider","subject");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_identity_user_unique" ON "provider_identities" USING btree ("user_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "workout_session_client_unique" ON "workout_sessions" USING btree ("user_id","client_session_id");--> statement-breakpoint
CREATE INDEX "workout_session_user_date_idx" ON "workout_sessions" USING btree ("user_id","date");