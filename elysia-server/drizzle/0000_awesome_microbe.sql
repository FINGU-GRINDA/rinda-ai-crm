CREATE TYPE "public"."customer_status" AS ENUM('prospect', 'new', 'contact', 'negotiation', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."follow_up_status" AS ENUM('planned', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."follow_up_type" AS ENUM('email', 'call', 'meeting', 'message');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."scheduled_status" AS ENUM('pending', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."signal_strength" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."contact_source" AS ENUM('manual', 'business_card', 'import');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('news', 'followup', 'lost_deal', 'prospect', 'meeting', 'email', 'risk', 'slack');--> statement-breakpoint
CREATE TABLE "customer_enrichments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "customer_enrichments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"customer_id" text NOT NULL,
	"summary" text,
	"ceo" text,
	"founded_year" text,
	"recent_news" text,
	"competitors" text,
	"sales_opportunity" text,
	"sources" text,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"website" text,
	"industry" text,
	"notes" text,
	"status" "customer_status" DEFAULT 'new',
	"lost_reason" text,
	"lost_at" bigint,
	"last_follow_up_at" bigint,
	"last_enriched_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"image_url" text,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "follow_up_history" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"type" "follow_up_type" NOT NULL,
	"content" text,
	"status" "follow_up_status" DEFAULT 'planned',
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_follow_ups" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"scheduled_for" bigint NOT NULL,
	"type" "follow_up_type" NOT NULL,
	"content" text,
	"status" "scheduled_status" DEFAULT 'pending',
	"priority" "priority" DEFAULT 'medium',
	"reason" text,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prospects" (
	"id" text PRIMARY KEY NOT NULL,
	"company_name" text NOT NULL,
	"website" text,
	"industry" text,
	"source_title" text,
	"source_uri" text,
	"source_published_at" text,
	"signal_strength" "signal_strength" DEFAULT 'medium',
	"icp_match" text,
	"notes" text,
	"detected_at" bigint NOT NULL,
	"converted_to_customer_id" text,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"name" text NOT NULL,
	"title" text,
	"email" text,
	"phone" text,
	"is_primary" integer DEFAULT 0,
	"source" "contact_source" DEFAULT 'manual',
	"business_card_image_url" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_summaries" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"title" text NOT NULL,
	"meeting_date" bigint NOT NULL,
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
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"gmail_message_id" text,
	"thread_id" text,
	"subject" text,
	"from_address" text,
	"to_address" text,
	"body" text,
	"date" bigint,
	"customer_id" text,
	"synced_at" bigint NOT NULL,
	CONSTRAINT "email_messages_gmail_message_id_unique" UNIQUE("gmail_message_id")
);
--> statement-breakpoint
CREATE TABLE "slack_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"slack_ts" text,
	"channel_id" text,
	"user_id" text,
	"user_name" text,
	"text" text,
	"thread_ts" text,
	"customer_id" text,
	"prospect_id" text,
	"processed" integer DEFAULT 0,
	"deleted" integer DEFAULT 0,
	"deleted_at" text,
	"received_at" bigint NOT NULL,
	CONSTRAINT "slack_messages_slack_ts_unique" UNIQUE("slack_ts")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"customer_id" text,
	"prospect_id" text,
	"priority" "priority" DEFAULT 'medium',
	"read" integer DEFAULT 0,
	"action_url" text,
	"metadata" text,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_tokens" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "oauth_tokens_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"provider" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"expires_at" bigint,
	"scope" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "oauth_tokens_provider_unique" UNIQUE("provider")
);
--> statement-breakpoint
CREATE TABLE "icp_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"industries" text,
	"keywords" text,
	"company_size" text,
	"target_regions" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mixpanel_events" (
	"id" text PRIMARY KEY NOT NULL,
	"event_name" text NOT NULL,
	"distinct_id" text,
	"properties" text,
	"received_at" bigint NOT NULL,
	"processed" integer DEFAULT 0,
	"customer_id" text,
	"created_at" bigint
);
--> statement-breakpoint
ALTER TABLE "customer_enrichments" ADD CONSTRAINT "customer_enrichments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_history" ADD CONSTRAINT "follow_up_history_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_follow_ups" ADD CONSTRAINT "scheduled_follow_ups_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_converted_to_customer_id_customers_id_fk" FOREIGN KEY ("converted_to_customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_contacts" ADD CONSTRAINT "customer_contacts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_summaries" ADD CONSTRAINT "meeting_summaries_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slack_messages" ADD CONSTRAINT "slack_messages_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slack_messages" ADD CONSTRAINT "slack_messages_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mixpanel_events" ADD CONSTRAINT "mixpanel_events_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_enrichments_customer" ON "customer_enrichments" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_customers_status" ON "customers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_customers_name" ON "customers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_customers_industry" ON "customers" USING btree ("industry");--> statement-breakpoint
CREATE INDEX "idx_customers_created_at" ON "customers" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_proposals_customer" ON "proposals" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_followup_customer" ON "follow_up_history" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_followup_status" ON "follow_up_history" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_scheduled_customer" ON "scheduled_follow_ups" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_scheduled_status" ON "scheduled_follow_ups" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_scheduled_for" ON "scheduled_follow_ups" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "idx_prospects_company" ON "prospects" USING btree ("company_name");--> statement-breakpoint
CREATE INDEX "idx_prospects_signal" ON "prospects" USING btree ("signal_strength");--> statement-breakpoint
CREATE INDEX "idx_prospects_detected" ON "prospects" USING btree ("detected_at");--> statement-breakpoint
CREATE INDEX "idx_contacts_customer" ON "customer_contacts" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_contacts_email" ON "customer_contacts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_contacts_primary" ON "customer_contacts" USING btree ("is_primary");--> statement-breakpoint
CREATE INDEX "idx_meetings_customer" ON "meeting_summaries" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_meetings_date" ON "meeting_summaries" USING btree ("meeting_date");--> statement-breakpoint
CREATE INDEX "idx_emails_customer" ON "email_messages" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_emails_gmail_id" ON "email_messages" USING btree ("gmail_message_id");--> statement-breakpoint
CREATE INDEX "idx_emails_date" ON "email_messages" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_slack_customer" ON "slack_messages" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_slack_prospect" ON "slack_messages" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "idx_slack_processed" ON "slack_messages" USING btree ("processed");--> statement-breakpoint
CREATE INDEX "idx_slack_deleted" ON "slack_messages" USING btree ("deleted");--> statement-breakpoint
CREATE INDEX "idx_slack_received" ON "slack_messages" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "idx_notifications_read" ON "notifications" USING btree ("read");--> statement-breakpoint
CREATE INDEX "idx_notifications_created" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_notifications_type" ON "notifications" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_oauth_provider" ON "oauth_tokens" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "idx_mixpanel_events_distinct_id" ON "mixpanel_events" USING btree ("distinct_id");--> statement-breakpoint
CREATE INDEX "idx_mixpanel_events_processed" ON "mixpanel_events" USING btree ("processed");--> statement-breakpoint
CREATE INDEX "idx_mixpanel_events_event_name" ON "mixpanel_events" USING btree ("event_name");