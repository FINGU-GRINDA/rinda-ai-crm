-- Create users table
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL UNIQUE,
	"password_hash" text,
	"name" text NOT NULL,
	"picture" text,
	"google_id" text UNIQUE,
	"token_version" integer DEFAULT 0 NOT NULL,
	"email_verified" integer DEFAULT 0 NOT NULL,
	"email_verification_token" text,
	"email_verification_expiry" timestamp with time zone,
	"password_reset_token" text,
	"password_reset_expiry" timestamp with time zone,
	"is_active" integer DEFAULT 1 NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX "idx_users_email" ON "users" ("email");--> statement-breakpoint
CREATE INDEX "idx_users_google_id" ON "users" ("google_id");--> statement-breakpoint
CREATE INDEX "idx_users_token_version" ON "users" ("token_version");--> statement-breakpoint

-- Create sessions table
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL UNIQUE,
	"ip_address" text,
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);--> statement-breakpoint

CREATE INDEX "idx_sessions_token" ON "sessions" ("token");--> statement-breakpoint
CREATE INDEX "idx_sessions_user_id" ON "sessions" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_expires_at" ON "sessions" ("expires_at");--> statement-breakpoint

-- Create oauth_states table
CREATE TABLE "oauth_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state" text NOT NULL UNIQUE,
	"provider" text NOT NULL,
	"flow_type" text NOT NULL,
	"user_id" uuid,
	"redirect_uri" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_states_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);--> statement-breakpoint

CREATE INDEX "idx_oauth_states_state" ON "oauth_states" ("state");--> statement-breakpoint
CREATE INDEX "idx_oauth_states_expires_at" ON "oauth_states" ("expires_at");--> statement-breakpoint

-- Drop existing oauth_tokens unique constraint
ALTER TABLE "oauth_tokens" DROP CONSTRAINT IF EXISTS "oauth_tokens_provider_unique";--> statement-breakpoint

-- Update oauth_tokens table to add user_id and encryption fields
ALTER TABLE "oauth_tokens" ADD COLUMN "user_id" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD COLUMN "encrypted_access_token" text;--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD COLUMN "encrypted_refresh_token" text;--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD COLUMN "encryption_iv" text;--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD COLUMN "auth_tag" text;--> statement-breakpoint

-- Make access_token nullable (will use encrypted version)
ALTER TABLE "oauth_tokens" ALTER COLUMN "access_token" DROP NOT NULL;--> statement-breakpoint

-- Add foreign key to users
ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint

-- Create indexes
CREATE INDEX "idx_oauth_user_provider" ON "oauth_tokens" ("user_id", "provider");--> statement-breakpoint
CREATE INDEX "idx_oauth_user_id" ON "oauth_tokens" ("user_id");--> statement-breakpoint

-- Create system user for existing data
INSERT INTO "users" (id, email, password_hash, name, email_verified, is_active, created_at, updated_at)
VALUES (
	'00000000-0000-0000-0000-000000000001',
	'system@rinda-crm.local',
	NULL,
	'System',
	1,
	1,
	now(),
	now()
) ON CONFLICT DO NOTHING;--> statement-breakpoint

-- Add user_id to all data tables and backfill with system user
ALTER TABLE "customers" ADD COLUMN "user_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001';--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN "user_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001';--> statement-breakpoint
ALTER TABLE "customer_contacts" ADD COLUMN "user_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001';--> statement-breakpoint
ALTER TABLE "meeting_summaries" ADD COLUMN "user_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001';--> statement-breakpoint
ALTER TABLE "icp_profiles" ADD COLUMN "user_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001';--> statement-breakpoint
ALTER TABLE "follow_up_history" ADD COLUMN "user_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001';--> statement-breakpoint
ALTER TABLE "scheduled_follow_ups" ADD COLUMN "user_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001';--> statement-breakpoint
ALTER TABLE "email_messages" ADD COLUMN "user_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001';--> statement-breakpoint
ALTER TABLE "mixpanel_events" ADD COLUMN "user_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001';--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "user_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001';--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "user_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001';--> statement-breakpoint

-- Make user_id NOT NULL
ALTER TABLE "customers" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "prospects" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "customer_contacts" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "meeting_summaries" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "icp_profiles" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "follow_up_history" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "scheduled_follow_ups" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "email_messages" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "mixpanel_events" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "attachments" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint

-- Add foreign key constraints
ALTER TABLE "customers" ADD CONSTRAINT "customers_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "customer_contacts" ADD CONSTRAINT "customer_contacts_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "meeting_summaries" ADD CONSTRAINT "meeting_summaries_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "icp_profiles" ADD CONSTRAINT "icp_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "follow_up_history" ADD CONSTRAINT "follow_up_history_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scheduled_follow_ups" ADD CONSTRAINT "scheduled_follow_ups_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mixpanel_events" ADD CONSTRAINT "mixpanel_events_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint

-- Add indexes for user_id on all tables for query performance
CREATE INDEX "idx_customers_user_id" ON "customers" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_prospects_user_id" ON "prospects" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_customer_contacts_user_id" ON "customer_contacts" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_meeting_summaries_user_id" ON "meeting_summaries" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_icp_profiles_user_id" ON "icp_profiles" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_follow_up_history_user_id" ON "follow_up_history" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_scheduled_follow_ups_user_id" ON "scheduled_follow_ups" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_email_messages_user_id" ON "email_messages" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_mixpanel_events_user_id" ON "mixpanel_events" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_id" ON "notifications" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_attachments_user_id" ON "attachments" ("user_id");--> statement-breakpoint
