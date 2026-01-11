-- RINDA CRM Database Schema
-- SQLite 3

-- Enable foreign keys (handled in db.js pragma)

-- ========================================
-- Customers Table
-- ========================================
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    website TEXT,
    industry TEXT,
    notes TEXT,
    status TEXT CHECK(status IN ('prospect', 'new', 'contact', 'negotiation', 'won', 'lost')) DEFAULT 'new',
    lost_reason TEXT,
    lost_at INTEGER,
    last_follow_up_at INTEGER,
    last_enriched_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_industry ON customers(industry);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at);

-- ========================================
-- Customer Enrichments Table
-- ========================================
CREATE TABLE IF NOT EXISTS customer_enrichments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id TEXT NOT NULL,
    summary TEXT,
    ceo TEXT,
    founded_year TEXT,
    recent_news TEXT,
    competitors TEXT,
    sales_opportunity TEXT,
    sources TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_enrichments_customer ON customer_enrichments(customer_id);

-- ========================================
-- Proposals Table
-- ========================================
CREATE TABLE IF NOT EXISTS proposals (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    image_url TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_proposals_customer ON proposals(customer_id);

-- ========================================
-- Follow-up History Table
-- ========================================
CREATE TABLE IF NOT EXISTS follow_up_history (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    type TEXT CHECK(type IN ('email', 'call', 'meeting', 'message')) NOT NULL,
    content TEXT,
    status TEXT CHECK(status IN ('planned', 'completed', 'cancelled')) DEFAULT 'planned',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_followup_customer ON follow_up_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_followup_status ON follow_up_history(status);

-- ========================================
-- Scheduled Follow-ups Table
-- ========================================
CREATE TABLE IF NOT EXISTS scheduled_follow_ups (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    scheduled_for INTEGER NOT NULL,
    type TEXT CHECK(type IN ('email', 'call', 'meeting', 'message')) NOT NULL,
    content TEXT,
    status TEXT CHECK(status IN ('pending', 'completed', 'cancelled')) DEFAULT 'pending',
    priority TEXT CHECK(priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
    reason TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_scheduled_customer ON scheduled_follow_ups(customer_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_status ON scheduled_follow_ups(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_for ON scheduled_follow_ups(scheduled_for);

-- ========================================
-- Prospects Table
-- ========================================
CREATE TABLE IF NOT EXISTS prospects (
    id TEXT PRIMARY KEY,
    company_name TEXT NOT NULL,
    website TEXT,
    industry TEXT,
    source_title TEXT,
    source_uri TEXT,
    source_published_at TEXT,
    signal_strength TEXT CHECK(signal_strength IN ('high', 'medium', 'low')) DEFAULT 'medium',
    icp_match TEXT,
    notes TEXT,
    detected_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    converted_to_customer_id TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (converted_to_customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_prospects_company ON prospects(company_name);
CREATE INDEX IF NOT EXISTS idx_prospects_signal ON prospects(signal_strength);
CREATE INDEX IF NOT EXISTS idx_prospects_detected ON prospects(detected_at);

-- ========================================
-- ICP Profiles Table
-- ========================================
CREATE TABLE IF NOT EXISTS icp_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    industries TEXT,
    keywords TEXT,
    company_size TEXT,
    target_regions TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

-- ========================================
-- Email Messages Table
-- ========================================
CREATE TABLE IF NOT EXISTS email_messages (
    id TEXT PRIMARY KEY,
    gmail_message_id TEXT UNIQUE,
    thread_id TEXT,
    subject TEXT,
    from_address TEXT,
    to_address TEXT,
    body TEXT,
    date INTEGER,
    customer_id TEXT,
    synced_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_emails_customer ON email_messages(customer_id);
CREATE INDEX IF NOT EXISTS idx_emails_gmail_id ON email_messages(gmail_message_id);
CREATE INDEX IF NOT EXISTS idx_emails_date ON email_messages(date);

-- ========================================
-- Slack Messages Table
-- ========================================
CREATE TABLE IF NOT EXISTS slack_messages (
    id TEXT PRIMARY KEY,
    slack_ts TEXT UNIQUE,
    channel_id TEXT,
    user_id TEXT,
    user_name TEXT,
    text TEXT,
    thread_ts TEXT,
    customer_id TEXT,
    prospect_id TEXT,
    processed INTEGER DEFAULT 0,
    received_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_slack_customer ON slack_messages(customer_id);
CREATE INDEX IF NOT EXISTS idx_slack_prospect ON slack_messages(prospect_id);
CREATE INDEX IF NOT EXISTS idx_slack_processed ON slack_messages(processed);
CREATE INDEX IF NOT EXISTS idx_slack_received ON slack_messages(received_at);

-- ========================================
-- OAuth Tokens Table
-- ========================================
CREATE TABLE IF NOT EXISTS oauth_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL UNIQUE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at INTEGER,
    scope TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_oauth_provider ON oauth_tokens(provider);

-- ========================================
-- Notifications Table
-- ========================================
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    type TEXT CHECK(type IN ('news', 'followup', 'lost_deal', 'prospect', 'meeting', 'email', 'risk', 'slack')) NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    customer_id TEXT,
    prospect_id TEXT,
    priority TEXT CHECK(priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
    read INTEGER DEFAULT 0,
    action_url TEXT,
    metadata TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- ========================================
-- Settings Table
-- ========================================
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

-- ========================================
-- Customer Contacts Table (명함/연락처)
-- ========================================
CREATE TABLE IF NOT EXISTS customer_contacts (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    name TEXT NOT NULL,
    title TEXT,
    email TEXT,
    phone TEXT,
    is_primary INTEGER DEFAULT 0,
    source TEXT CHECK(source IN ('manual', 'business_card', 'import')) DEFAULT 'manual',
    business_card_image_url TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_contacts_customer ON customer_contacts(customer_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON customer_contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_primary ON customer_contacts(is_primary);

-- ========================================
-- Meeting Summaries Table (미팅 녹음 요약)
-- ========================================
CREATE TABLE IF NOT EXISTS meeting_summaries (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    title TEXT NOT NULL,
    meeting_date INTEGER NOT NULL,
    audio_file_url TEXT,
    duration INTEGER,
    summary TEXT,
    key_discussions TEXT,    -- JSON array
    action_items TEXT,       -- JSON array
    customer_needs TEXT,     -- JSON array
    budget_mentions TEXT,
    timeline_mentions TEXT,
    next_steps TEXT,         -- JSON array
    transcription TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_meetings_customer ON meeting_summaries(customer_id);
CREATE INDEX IF NOT EXISTS idx_meetings_date ON meeting_summaries(meeting_date);

-- ========================================
-- Mixpanel Events Table (Mixpanel 이벤트 로그)
-- ========================================
CREATE TABLE IF NOT EXISTS mixpanel_events (
    id TEXT PRIMARY KEY,
    event_name TEXT NOT NULL,
    distinct_id TEXT,
    email TEXT,
    company_name TEXT,
    properties TEXT,          -- JSON object
    prospect_id TEXT,
    customer_id TEXT,
    processed INTEGER DEFAULT 0,
    received_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE SET NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_mixpanel_event ON mixpanel_events(event_name);
CREATE INDEX IF NOT EXISTS idx_mixpanel_distinct ON mixpanel_events(distinct_id);
CREATE INDEX IF NOT EXISTS idx_mixpanel_processed ON mixpanel_events(processed);
CREATE INDEX IF NOT EXISTS idx_mixpanel_received ON mixpanel_events(received_at);

-- Insert default settings if not exists
INSERT OR IGNORE INTO settings (key, value) VALUES
    ('slack', '{"webhookUrl":"","isEnabled":false,"notifications":{"newProspect":true,"followUpReminder":true,"dealWon":false,"dealLost":false},"isValidated":false,"eventApiEnabled":false}'),
    ('email', '{"provider":null,"isConnected":false,"autoSync":false,"syncInterval":3600000,"lastSyncAt":null}'),
    ('calendar', '{"provider":null,"isConnected":false,"autoSync":false,"syncInterval":3600000,"meetingPrepEnabled":true}'),
    ('notifications', '{"browser":{"enabled":true,"types":{"followUp":true,"meeting":true,"news":true,"risk":true,"prospect":true}},"email":{"enabled":false,"dailyDigest":false,"digestTime":"09:00"}}'),
    ('collection', '{"autoCollect":false,"interval":3600000,"lastRun":null}'),
    ('mixpanel', '{"isEnabled":false,"projectToken":null,"apiSecret":null,"webhookSecret":null,"trackedEvents":["$signup","sign_up","user_signup","registration","account_created"],"autoCreateProspect":true,"defaultSignalStrength":"medium","enrichWithAI":true}');
