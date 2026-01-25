CREATE TYPE "public"."attachment_entity_type" AS ENUM('customer', 'proposal', 'email', 'meeting', 'slack_message', 'contact', 'prospect', 'enrichment');--> statement-breakpoint
CREATE TYPE "public"."contact_source" AS ENUM('manual', 'business_card', 'import');--> statement-breakpoint
CREATE TYPE "public"."customer_status" AS ENUM('prospect', 'new', 'contact', 'negotiation', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."follow_up_status" AS ENUM('planned', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."follow_up_type" AS ENUM('email', 'call', 'meeting', 'message');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."scheduled_status" AS ENUM('pending', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('news', 'followup', 'lost_deal', 'prospect', 'meeting', 'email', 'risk', 'slack');--> statement-breakpoint
CREATE TYPE "public"."signal_strength" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" text NOT NULL,
	"file_type" text,
	"file_size" integer,
	"file_url" text NOT NULL,
	"entity_type" "attachment_entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"uploaded_by" text,
	"metadata" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"name" text NOT NULL,
	"title" text,
	"email" text,
	"phone" text,
	"is_primary" integer DEFAULT 0,
	"source" "contact_source" DEFAULT 'manual',
	"business_card_image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_enrichments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "customer_enrichments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"customer_id" uuid NOT NULL,
	"summary" text,
	"ceo" text,
	"founded_year" text,
	"recent_news" text,
	"competitors" text,
	"sales_opportunity" text,
	"sources" text,
	"followup_recommended_timing" text,
	"followup_approach" text,
	"followup_message_tone" text,
	"followup_key_points" text,
	"followup_probability" text,
	"followup_reasoning" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"website" text,
	"industry" text,
	"notes" text,
	"status" "customer_status" DEFAULT 'new',
	"lost_reason" text,
	"lost_at" timestamp with time zone,
	"last_follow_up_at" timestamp with time zone,
	"last_enriched_at" timestamp with time zone,
	"lead_source" text,
	"initial_inquiry" text,
	"source_of_inquiry" text,
	"landing_page_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"image_url" text,
	"proposal_status" text,
	"feedback" text,
	"feedback_received_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gmail_message_id" text,
	"thread_id" text,
	"subject" text,
	"from_address" text,
	"to_address" text,
	"body" text,
	"date" timestamp with time zone,
	"customer_id" uuid,
	"email_type" text,
	"related_proposal_id" uuid,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_messages_gmail_message_id_unique" UNIQUE("gmail_message_id")
);
--> statement-breakpoint
CREATE TABLE "follow_up_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"type" "follow_up_type" NOT NULL,
	"content" text,
	"status" "follow_up_status" DEFAULT 'planned',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_follow_ups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"type" "follow_up_type" NOT NULL,
	"content" text,
	"status" "scheduled_status" DEFAULT 'pending',
	"priority" "priority" DEFAULT 'medium',
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "icp_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"industries" text,
	"keywords" text,
	"company_size" text,
	"target_regions" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"title" text NOT NULL,
	"meeting_date" timestamp with time zone NOT NULL,
	"audio_file_url" text,
	"duration" integer,
	"summary" text,
	"key_discussions" text,
	"action_items" text,
	"customer_needs" text,
	"budget_mentions" text,
	"timeline_mentions" text,
	"next_steps" text,
	"transcription" text,
	"source" text DEFAULT 'manual',
	"slack_ts" text,
	"slack_channel_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mixpanel_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_name" text NOT NULL,
	"distinct_id" text,
	"properties" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed" integer DEFAULT 0,
	"customer_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"customer_id" uuid,
	"prospect_id" uuid,
	"priority" "priority" DEFAULT 'medium',
	"read" integer DEFAULT 0,
	"action_url" text,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_tokens" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "oauth_tokens_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"encrypted_access_token" text,
	"encrypted_refresh_token" text,
	"encryption_iv" text,
	"auth_tag" text,
	"expires_at" timestamp with time zone,
	"scope" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state" text NOT NULL,
	"provider" text NOT NULL,
	"flow_type" text NOT NULL,
	"user_id" uuid,
	"redirect_uri" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_states_state_unique" UNIQUE("state")
);
--> statement-breakpoint
CREATE TABLE "prospects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" text NOT NULL,
	"website" text,
	"industry" text,
	"source_title" text,
	"source_uri" text,
	"source_published_at" text,
	"signal_strength" "signal_strength" DEFAULT 'medium',
	"icp_match" text,
	"notes" text,
	"contact_name" text,
	"contact_title" text,
	"contact_phone" text,
	"contact_email" text,
	"landing_page_url" text,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"converted_to_customer_id" uuid,
	"dismissed" boolean DEFAULT false NOT NULL,
	"dismissed_at" timestamp with time zone,
	"dismiss_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slack_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slack_ts" text,
	"channel_id" text,
	"user_id" text,
	"user_name" text,
	"text" text,
	"thread_ts" text,
	"customer_id" uuid,
	"prospect_id" uuid,
	"processed" integer DEFAULT 0,
	"deleted" integer DEFAULT 0,
	"deleted_at" timestamp with time zone,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processing_error" text,
	"retry_count" integer DEFAULT 0,
	"last_error_at" timestamp with time zone,
	CONSTRAINT "slack_messages_slack_ts_unique" UNIQUE("slack_ts")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"name" text NOT NULL,
	"picture" text,
	"google_id" text,
	"token_version" integer DEFAULT 0 NOT NULL,
	"email_verified" integer DEFAULT 0 NOT NULL,
	"email_verification_token" text,
	"email_verification_expiry" timestamp with time zone,
	"password_reset_token" text,
	"password_reset_expiry" timestamp with time zone,
	"is_active" integer DEFAULT 1 NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id")
);
--> statement-breakpoint
ALTER TABLE "customer_contacts" ADD CONSTRAINT "customer_contacts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_enrichments" ADD CONSTRAINT "customer_enrichments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_related_proposal_id_proposals_id_fk" FOREIGN KEY ("related_proposal_id") REFERENCES "public"."proposals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_history" ADD CONSTRAINT "follow_up_history_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_follow_ups" ADD CONSTRAINT "scheduled_follow_ups_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_summaries" ADD CONSTRAINT "meeting_summaries_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mixpanel_events" ADD CONSTRAINT "mixpanel_events_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_states" ADD CONSTRAINT "oauth_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_converted_to_customer_id_customers_id_fk" FOREIGN KEY ("converted_to_customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slack_messages" ADD CONSTRAINT "slack_messages_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slack_messages" ADD CONSTRAINT "slack_messages_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_attachments_entity" ON "attachments" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_attachments_entity_id" ON "attachments" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "idx_attachments_created_at" ON "attachments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_contacts_customer" ON "customer_contacts" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_contacts_email" ON "customer_contacts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_contacts_primary" ON "customer_contacts" USING btree ("is_primary");--> statement-breakpoint
CREATE INDEX "idx_enrichments_customer" ON "customer_enrichments" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_customers_status" ON "customers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_customers_name" ON "customers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_customers_industry" ON "customers" USING btree ("industry");--> statement-breakpoint
CREATE INDEX "idx_customers_created_at" ON "customers" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_proposals_customer" ON "proposals" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_emails_customer" ON "email_messages" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_emails_gmail_id" ON "email_messages" USING btree ("gmail_message_id");--> statement-breakpoint
CREATE INDEX "idx_emails_date" ON "email_messages" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_followup_customer" ON "follow_up_history" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_followup_status" ON "follow_up_history" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_scheduled_customer" ON "scheduled_follow_ups" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_scheduled_status" ON "scheduled_follow_ups" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_scheduled_for" ON "scheduled_follow_ups" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "idx_meetings_customer" ON "meeting_summaries" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_meetings_date" ON "meeting_summaries" USING btree ("meeting_date");--> statement-breakpoint
CREATE INDEX "idx_meetings_slack_ts" ON "meeting_summaries" USING btree ("slack_ts");--> statement-breakpoint
CREATE INDEX "idx_mixpanel_events_distinct_id" ON "mixpanel_events" USING btree ("distinct_id");--> statement-breakpoint
CREATE INDEX "idx_mixpanel_events_processed" ON "mixpanel_events" USING btree ("processed");--> statement-breakpoint
CREATE INDEX "idx_mixpanel_events_event_name" ON "mixpanel_events" USING btree ("event_name");--> statement-breakpoint
CREATE INDEX "idx_notifications_read" ON "notifications" USING btree ("read");--> statement-breakpoint
CREATE INDEX "idx_notifications_created" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_notifications_type" ON "notifications" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_oauth_user_provider" ON "oauth_tokens" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "idx_oauth_user_id" ON "oauth_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_oauth_states_state" ON "oauth_states" USING btree ("state");--> statement-breakpoint
CREATE INDEX "idx_oauth_states_expires_at" ON "oauth_states" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_prospects_company" ON "prospects" USING btree ("company_name");--> statement-breakpoint
CREATE INDEX "idx_prospects_signal" ON "prospects" USING btree ("signal_strength");--> statement-breakpoint
CREATE INDEX "idx_prospects_detected" ON "prospects" USING btree ("detected_at");--> statement-breakpoint
CREATE INDEX "idx_prospects_email" ON "prospects" USING btree ("contact_email");--> statement-breakpoint
CREATE INDEX "idx_sessions_token" ON "sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_sessions_user_id" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_expires_at" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_slack_customer" ON "slack_messages" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_slack_prospect" ON "slack_messages" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "idx_slack_processed" ON "slack_messages" USING btree ("processed");--> statement-breakpoint
CREATE INDEX "idx_slack_deleted" ON "slack_messages" USING btree ("deleted");--> statement-breakpoint
CREATE INDEX "idx_slack_received" ON "slack_messages" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_google_id" ON "users" USING btree ("google_id");--> statement-breakpoint
CREATE INDEX "idx_users_token_version" ON "users" USING btree ("token_version");