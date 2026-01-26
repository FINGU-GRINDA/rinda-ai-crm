ALTER TABLE "meeting_summaries" ADD COLUMN "sales_proposal" text;--> statement-breakpoint
ALTER TABLE "meeting_summaries" ADD COLUMN "customer_match_confidence" text;--> statement-breakpoint
CREATE INDEX "idx_slack_thread_ts" ON "slack_messages" USING btree ("thread_ts");