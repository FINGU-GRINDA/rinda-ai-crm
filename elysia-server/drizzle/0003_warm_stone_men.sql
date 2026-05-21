CREATE TYPE "public"."crm_backfill_status_enum" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."buyer_type_enum" AS ENUM('buyer', 'distributor', 'reseller', 'oem', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."company_size_enum" AS ENUM('1_10', '11_50', '51_200', '201_500', '501_1000', '1000_plus');--> statement-breakpoint
CREATE TYPE "public"."crm_contact_kind_enum" AS ENUM('email', 'phone', 'linkedin', 'other');--> statement-breakpoint
CREATE TYPE "public"."crm_message_channel_enum" AS ENUM('email', 'linkedin_dm', 'linkedin_inmail', 'web_form', 'meeting_note', 'sms', 'system');--> statement-breakpoint
CREATE TYPE "public"."crm_message_direction_enum" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."deal_account_role_enum" AS ENUM('buyer', 'partner', 'distributor', 'end_customer', 'other');--> statement-breakpoint
CREATE TYPE "public"."deal_person_role_enum" AS ENUM('champion', 'decision_maker', 'influencer', 'gatekeeper', 'user', 'other');--> statement-breakpoint
CREATE TYPE "public"."deal_stage_enum" AS ENUM('engaged', 'in_conversation', 'negotiating', 'confirmed', 'contract');--> statement-breakpoint
CREATE TYPE "public"."crm_object_event_type_enum" AS ENUM('account_created', 'account_merged_into', 'person_created', 'person_merged_into', 'person_contact_added', 'account_contact_added', 'contact_added', 'deal_created', 'deal_stage_changed', 'deal_lost_changed', 'lead_converted');--> statement-breakpoint
CREATE TYPE "public"."crm_object_source_type_enum" AS ENUM('lead', 'unipile_webhook', 'classifier', 'manual', 'api', 'csv_import');--> statement-breakpoint
CREATE TYPE "public"."crm_object_target_type_enum" AS ENUM('account', 'person', 'person_contact', 'account_contact', 'contact', 'deal');--> statement-breakpoint
CREATE TABLE "crm_backfill_progress" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"email_account_id" uuid NOT NULL,
	"status" "crm_backfill_status_enum" DEFAULT 'pending' NOT NULL,
	"cursor" text,
	"months_back" integer DEFAULT 12 NOT NULL,
	"pages_processed" integer DEFAULT 0 NOT NULL,
	"messages_processed" integer DEFAULT 0 NOT NULL,
	"messages_ingested" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"reclassified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_accounts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"domain" text,
	"country" text,
	"industry" text,
	"legal_name" text,
	"address_line1" text,
	"address_line2" text,
	"city" text,
	"state_region" text,
	"postal_code" text,
	"tax_id" text,
	"default_currency" text,
	"website_url" text,
	"description" text,
	"company_size" "company_size_enum",
	"buyer_type" "buyer_type_enum",
	"timezone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_contacts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"kind" "crm_contact_kind_enum" NOT NULL,
	"value" text NOT NULL,
	"label" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"last_verified_at" timestamp with time zone,
	"sources" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"do_not_contact" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_persons" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"account_id" uuid,
	"full_name" text NOT NULL,
	"title" text,
	"department" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_deal_accounts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"role" "deal_account_role_enum",
	"is_primary" boolean DEFAULT false NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_deal_persons" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"role" "deal_person_role_enum",
	"is_primary" boolean DEFAULT false NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_deals" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"deal_stage" "deal_stage_enum" DEFAULT 'engaged' NOT NULL,
	"deal_size" numeric(14, 2),
	"currency" text,
	"expected_close_date" date,
	"lost_at" timestamp with time zone,
	"incoterms" text,
	"payment_terms" text,
	"field_overrides" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_backfilled" boolean DEFAULT false NOT NULL,
	"thread_external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_messages" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"contact_id" uuid,
	"channel" "crm_message_channel_enum" NOT NULL,
	"direction" "crm_message_direction_enum" NOT NULL,
	"external_message_id" text,
	"thread_external_id" text,
	"subject" text,
	"body" text NOT NULL,
	"extraction_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	"opened_at" timestamp with time zone,
	"clicked_at" timestamp with time zone,
	"replied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crm_messages_contact_required_check" CHECK ((
        ("crm_messages"."channel" IN ('email', 'linkedin_dm', 'linkedin_inmail', 'web_form', 'sms')
          AND "crm_messages"."contact_id" IS NOT NULL)
        OR ("crm_messages"."channel" IN ('system', 'meeting_note'))
      ))
);
--> statement-breakpoint
CREATE TABLE "crm_email_connections" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"external_account_id" text NOT NULL,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_object_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"event_type" "crm_object_event_type_enum" NOT NULL,
	"target_type" "crm_object_target_type_enum" NOT NULL,
	"target_id" uuid NOT NULL,
	"source_type" "crm_object_source_type_enum",
	"source_ref_id" uuid,
	"source_ref_text" text,
	"triggered_by_user_id" uuid,
	"classifier_confidence" numeric(3, 2),
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crm_backfill_progress" ADD CONSTRAINT "crm_backfill_progress_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_backfill_progress" ADD CONSTRAINT "crm_backfill_progress_email_account_id_crm_email_connections_id_fk" FOREIGN KEY ("email_account_id") REFERENCES "public"."crm_email_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_accounts" ADD CONSTRAINT "crm_accounts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_person_id_crm_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."crm_persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_persons" ADD CONSTRAINT "crm_persons_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_persons" ADD CONSTRAINT "crm_persons_account_id_crm_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."crm_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_deal_accounts" ADD CONSTRAINT "crm_deal_accounts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_deal_accounts" ADD CONSTRAINT "crm_deal_accounts_deal_id_crm_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."crm_deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_deal_accounts" ADD CONSTRAINT "crm_deal_accounts_account_id_crm_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."crm_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_deal_persons" ADD CONSTRAINT "crm_deal_persons_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_deal_persons" ADD CONSTRAINT "crm_deal_persons_deal_id_crm_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."crm_deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_deal_persons" ADD CONSTRAINT "crm_deal_persons_person_id_crm_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."crm_persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_messages" ADD CONSTRAINT "crm_messages_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_messages" ADD CONSTRAINT "crm_messages_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_email_connections" ADD CONSTRAINT "crm_email_connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_object_events" ADD CONSTRAINT "crm_object_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_object_events" ADD CONSTRAINT "crm_object_events_triggered_by_user_id_users_id_fk" FOREIGN KEY ("triggered_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "crm_backfill_progress_workspace_email_account_uidx" ON "crm_backfill_progress" USING btree ("workspace_id","email_account_id");--> statement-breakpoint
CREATE INDEX "crm_backfill_progress_workspace_status_idx" ON "crm_backfill_progress" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "crm_accounts_workspace_name_idx" ON "crm_accounts" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_accounts_workspace_domain_lower_uidx" ON "crm_accounts" USING btree ("workspace_id",lower("domain")) WHERE "crm_accounts"."domain" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "crm_contacts_workspace_person_idx" ON "crm_contacts" USING btree ("workspace_id","person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_contacts_workspace_kind_value_uidx" ON "crm_contacts" USING btree ("workspace_id","kind",lower("value"));--> statement-breakpoint
CREATE INDEX "crm_persons_workspace_account_idx" ON "crm_persons" USING btree ("workspace_id","account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_deal_accounts_workspace_deal_account_uidx" ON "crm_deal_accounts" USING btree ("workspace_id","deal_id","account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_deal_accounts_workspace_deal_primary_uidx" ON "crm_deal_accounts" USING btree ("workspace_id","deal_id") WHERE "crm_deal_accounts"."is_primary";--> statement-breakpoint
CREATE INDEX "crm_deal_accounts_workspace_deal_idx" ON "crm_deal_accounts" USING btree ("workspace_id","deal_id");--> statement-breakpoint
CREATE INDEX "crm_deal_accounts_workspace_account_idx" ON "crm_deal_accounts" USING btree ("workspace_id","account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_deal_persons_workspace_deal_person_uidx" ON "crm_deal_persons" USING btree ("workspace_id","deal_id","person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_deal_persons_workspace_deal_primary_uidx" ON "crm_deal_persons" USING btree ("workspace_id","deal_id") WHERE "crm_deal_persons"."is_primary";--> statement-breakpoint
CREATE INDEX "crm_deal_persons_workspace_deal_idx" ON "crm_deal_persons" USING btree ("workspace_id","deal_id");--> statement-breakpoint
CREATE INDEX "crm_deal_persons_workspace_person_idx" ON "crm_deal_persons" USING btree ("workspace_id","person_id");--> statement-breakpoint
CREATE INDEX "crm_deals_workspace_stage_idx" ON "crm_deals" USING btree ("workspace_id","deal_stage");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_deals_workspace_thread_uidx" ON "crm_deals" USING btree ("workspace_id","thread_external_id") WHERE "crm_deals"."thread_external_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "crm_messages_workspace_contact_sent_idx" ON "crm_messages" USING btree ("workspace_id","contact_id","sent_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "crm_messages_workspace_thread_external_idx" ON "crm_messages" USING btree ("workspace_id","thread_external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_messages_workspace_external_message_uidx" ON "crm_messages" USING btree ("workspace_id","external_message_id") WHERE "crm_messages"."external_message_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "crm_email_connections_ws_provider_account_uidx" ON "crm_email_connections" USING btree ("workspace_id","provider","external_account_id");--> statement-breakpoint
CREATE INDEX "crm_email_connections_workspace_idx" ON "crm_email_connections" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "crm_object_events_workspace_target_idx" ON "crm_object_events" USING btree ("workspace_id","target_type","target_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "crm_object_events_workspace_source_idx" ON "crm_object_events" USING btree ("workspace_id","source_type","source_ref_id");--> statement-breakpoint
CREATE INDEX "crm_object_events_workspace_event_type_idx" ON "crm_object_events" USING btree ("workspace_id","event_type","created_at" DESC NULLS LAST);