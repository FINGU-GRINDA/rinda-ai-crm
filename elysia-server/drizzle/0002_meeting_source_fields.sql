-- Add source tracking fields to meeting_summaries
ALTER TABLE "meeting_summaries" ADD COLUMN "source" text DEFAULT 'manual';
ALTER TABLE "meeting_summaries" ADD COLUMN "slack_ts" text;
ALTER TABLE "meeting_summaries" ADD COLUMN "slack_channel_id" text;

-- Index for fast lookup by slack_ts
CREATE INDEX IF NOT EXISTS "idx_meetings_slack_ts" ON "meeting_summaries" ("slack_ts");
