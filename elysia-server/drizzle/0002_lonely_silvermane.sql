CREATE TYPE "public"."deal_contact_role" AS ENUM('champion', 'economic_buyer', 'decision_maker', 'user', 'blocker', 'influencer');--> statement-breakpoint
CREATE TYPE "public"."deal_forecast_category" AS ENUM('pipeline', 'best_case', 'commit', 'closed', 'omitted');--> statement-breakpoint
CREATE TYPE "public"."pipeline_stage_type" AS ENUM('open', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."workspace_member_role" AS ENUM('owner', 'admin', 'manager', 'member', 'viewer');--> statement-breakpoint
ALTER TYPE "public"."attachment_entity_type" ADD VALUE 'deal';--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"actor_id" uuid,
	"actor_type" text DEFAULT 'user' NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"before" jsonb,
	"after" jsonb,
	"metadata" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_contacts" (
	"deal_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"role" "deal_contact_role" DEFAULT 'user' NOT NULL,
	"is_primary" numeric(1, 0) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deal_contacts_deal_id_contact_id_pk" PRIMARY KEY("deal_id","contact_id")
);
--> statement-breakpoint
CREATE TABLE "deal_stage_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"from_stage_id" uuid,
	"to_stage_id" uuid NOT NULL,
	"changed_by" uuid,
	"duration_in_from_stage_seconds" bigint,
	"note" text,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"pipeline_id" uuid NOT NULL,
	"stage_id" uuid NOT NULL,
	"customer_id" uuid,
	"owner_id" uuid NOT NULL,
	"human_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"amount_minor" bigint DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"base_amount_minor" bigint DEFAULT 0 NOT NULL,
	"fx_rate_at_close" numeric(18, 8),
	"probability" numeric(5, 2),
	"forecast_category" "deal_forecast_category" DEFAULT 'pipeline' NOT NULL,
	"expected_close_date" date,
	"actual_close_date" date,
	"stage_entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lost_reason" text,
	"source" text,
	"external_id" text,
	"custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deals_probability_range" CHECK ("deals"."probability" IS NULL OR ("deals"."probability" >= 0 AND "deals"."probability" <= 100)),
	CONSTRAINT "deals_currency_iso" CHECK (char_length("deals"."currency") = 3),
	CONSTRAINT "deals_amount_positive" CHECK ("deals"."amount_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "pipeline_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"pipeline_id" uuid NOT NULL,
	"name" text NOT NULL,
	"stage_type" "pipeline_stage_type" DEFAULT 'open' NOT NULL,
	"display_order" integer NOT NULL,
	"default_probability" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"rotting_days" integer,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pipeline_stages_probability_range" CHECK ("pipeline_stages"."default_probability" >= 0 AND "pipeline_stages"."default_probability" <= 100)
);
--> statement-breakpoint
CREATE TABLE "pipelines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_default" integer DEFAULT 0 NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"product_id" uuid,
	"name" text NOT NULL,
	"quantity" numeric(12, 4) DEFAULT '1.0000' NOT NULL,
	"unit_price_minor" bigint NOT NULL,
	"discount_pct" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "line_items_discount_range" CHECK ("deal_line_items"."discount_pct" >= 0 AND "deal_line_items"."discount_pct" <= 100),
	CONSTRAINT "line_items_currency_iso" CHECK (char_length("deal_line_items"."currency") = 3)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sku" text,
	"description" text,
	"default_unit_price_minor" bigint DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_currency_iso" CHECK (char_length("products"."currency") = 3)
);
--> statement-breakpoint
CREATE TABLE "sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"key" text NOT NULL,
	"scope" text,
	"next_value" bigint DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"default_locale" text DEFAULT 'en-US' NOT NULL,
	"default_currency" text DEFAULT 'USD' NOT NULL,
	"default_timezone" text DEFAULT 'UTC' NOT NULL,
	"region" text DEFAULT 'global' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "workspace_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "workspace_member_role" DEFAULT 'member' NOT NULL,
	"token" text NOT NULL,
	"invited_by" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "workspace_member_role" DEFAULT 'member' NOT NULL,
	"locale" text,
	"timezone" text,
	"is_default" integer DEFAULT 0 NOT NULL,
	"invited_by" uuid,
	"invited_at" timestamp with time zone,
	"joined_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"locale" text DEFAULT 'en-US' NOT NULL,
	"base_currency" text DEFAULT 'USD' NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"is_sandbox" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "customer_contacts" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "customer_enrichments" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "email_messages" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "follow_up_history" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "scheduled_follow_ups" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "icp_profiles" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "meeting_summaries" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "mixpanel_events" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "slack_messages" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_contacts" ADD CONSTRAINT "deal_contacts_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_contacts" ADD CONSTRAINT "deal_contacts_contact_id_customer_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."customer_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_contacts" ADD CONSTRAINT "deal_contacts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_stage_history" ADD CONSTRAINT "deal_stage_history_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_stage_history" ADD CONSTRAINT "deal_stage_history_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_stage_history" ADD CONSTRAINT "deal_stage_history_from_stage_id_pipeline_stages_id_fk" FOREIGN KEY ("from_stage_id") REFERENCES "public"."pipeline_stages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_stage_history" ADD CONSTRAINT "deal_stage_history_to_stage_id_pipeline_stages_id_fk" FOREIGN KEY ("to_stage_id") REFERENCES "public"."pipeline_stages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_stage_history" ADD CONSTRAINT "deal_stage_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_stage_id_pipeline_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."pipeline_stages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_line_items" ADD CONSTRAINT "deal_line_items_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_line_items" ADD CONSTRAINT "deal_line_items_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_line_items" ADD CONSTRAINT "deal_line_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequences" ADD CONSTRAINT "sequences_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_log_workspace_created" ON "audit_log" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_log_entity" ON "audit_log" USING btree ("workspace_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_audit_log_actor" ON "audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "idx_deal_contacts_workspace" ON "deal_contacts" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_deal_contacts_contact" ON "deal_contacts" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_deal_stage_history_deal" ON "deal_stage_history" USING btree ("workspace_id","deal_id","changed_at");--> statement-breakpoint
CREATE INDEX "idx_deal_stage_history_workspace_changed" ON "deal_stage_history" USING btree ("workspace_id","changed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_deals_workspace_human_id" ON "deals" USING btree ("workspace_id","human_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_deals_workspace_external_id" ON "deals" USING btree ("workspace_id","external_id") WHERE "deals"."external_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_deals_workspace_stage_open" ON "deals" USING btree ("workspace_id","stage_id") WHERE "deals"."actual_close_date" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_deals_workspace_owner_close" ON "deals" USING btree ("workspace_id","owner_id","expected_close_date");--> statement-breakpoint
CREATE INDEX "idx_deals_workspace_customer" ON "deals" USING btree ("workspace_id","customer_id");--> statement-breakpoint
CREATE INDEX "idx_deals_workspace_pipeline" ON "deals" USING btree ("workspace_id","pipeline_id");--> statement-breakpoint
CREATE INDEX "idx_deals_stage_entered" ON "deals" USING btree ("workspace_id","stage_entered_at");--> statement-breakpoint
CREATE INDEX "idx_pipeline_stages_pipeline" ON "pipeline_stages" USING btree ("pipeline_id","display_order");--> statement-breakpoint
CREATE INDEX "idx_pipeline_stages_workspace" ON "pipeline_stages" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_pipelines_workspace" ON "pipelines" USING btree ("workspace_id","display_order");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pipelines_workspace_name" ON "pipelines" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE INDEX "idx_pipelines_workspace_default" ON "pipelines" USING btree ("workspace_id","is_default") WHERE "pipelines"."archived_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_line_items_deal" ON "deal_line_items" USING btree ("deal_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_line_items_workspace" ON "deal_line_items" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_products_workspace" ON "products" USING btree ("workspace_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_products_workspace_sku" ON "products" USING btree ("workspace_id","sku") WHERE "products"."sku" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_sequences_workspace_key_scope" ON "sequences" USING btree ("workspace_id","key","scope");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_organizations_slug" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_organizations_region" ON "organizations" USING btree ("region");--> statement-breakpoint
CREATE INDEX "idx_workspace_invitations_workspace" ON "workspace_invitations" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_workspace_invitations_email" ON "workspace_invitations" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_workspace_invitations_token" ON "workspace_invitations" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_workspace_invitations_expires" ON "workspace_invitations" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_workspace_members_unique" ON "workspace_members" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_workspace_members_user" ON "workspace_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_workspace_members_workspace" ON "workspace_members" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_workspace_members_default" ON "workspace_members" USING btree ("user_id","is_default");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_workspaces_org_slug" ON "workspaces" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "idx_workspaces_org" ON "workspaces" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_workspaces_archived" ON "workspaces" USING btree ("archived_at");--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_contacts" ADD CONSTRAINT "customer_contacts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_enrichments" ADD CONSTRAINT "customer_enrichments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_history" ADD CONSTRAINT "follow_up_history_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_follow_ups" ADD CONSTRAINT "scheduled_follow_ups_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "icp_profiles" ADD CONSTRAINT "icp_profiles_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_summaries" ADD CONSTRAINT "meeting_summaries_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mixpanel_events" ADD CONSTRAINT "mixpanel_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slack_messages" ADD CONSTRAINT "slack_messages_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_attachments_workspace" ON "attachments" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_contacts_workspace" ON "customer_contacts" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_enrichments_workspace" ON "customer_enrichments" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_customers_workspace" ON "customers" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_customers_workspace_status" ON "customers" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "idx_customers_workspace_industry" ON "customers" USING btree ("workspace_id","industry");--> statement-breakpoint
CREATE INDEX "idx_customers_workspace_created" ON "customers" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_proposals_workspace" ON "proposals" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_emails_workspace" ON "email_messages" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_followup_workspace" ON "follow_up_history" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_scheduled_workspace" ON "scheduled_follow_ups" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_icp_profiles_workspace" ON "icp_profiles" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_meetings_workspace" ON "meeting_summaries" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_meetings_workspace_date" ON "meeting_summaries" USING btree ("workspace_id","meeting_date");--> statement-breakpoint
CREATE INDEX "idx_mixpanel_events_workspace" ON "mixpanel_events" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_workspace" ON "notifications" USING btree ("workspace_id","read");--> statement-breakpoint
CREATE INDEX "idx_notifications_workspace_created" ON "notifications" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_prospects_workspace" ON "prospects" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_prospects_workspace_signal" ON "prospects" USING btree ("workspace_id","signal_strength");--> statement-breakpoint
CREATE INDEX "idx_settings_workspace" ON "settings" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_slack_workspace" ON "slack_messages" USING btree ("workspace_id");