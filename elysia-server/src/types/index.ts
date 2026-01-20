// Re-export types from schema

export type {
  CustomerContact,
  NewCustomerContact,
} from "../db/schema/contacts"
export type {
  Customer,
  CustomerEnrichment,
  NewCustomer,
  Proposal,
} from "../db/schema/customers"
export type {
  EmailMessage,
  NewEmailMessage,
} from "../db/schema/emails"
export type {
  FollowUpHistory,
  ScheduledFollowUp,
} from "../db/schema/followups"
export type {
  IcpProfile,
  NewIcpProfile,
} from "../db/schema/icp"
export type {
  MeetingSummary,
  NewMeetingSummary,
} from "../db/schema/meetings"
export type {
  MixpanelEvent,
  NewMixpanelEvent,
} from "../db/schema/mixpanel"

export type {
  NewNotification,
  Notification,
} from "../db/schema/notifications"
export type {
  NewOAuthToken,
  OAuthToken,
} from "../db/schema/oauth"
export type {
  NewProspect,
  Prospect,
} from "../db/schema/prospects"
export type {
  NewSetting,
  Setting,
} from "../db/schema/settings"
export type {
  NewSlackMessage,
  SlackMessage,
} from "../db/schema/slack"

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

// Query options
export interface QueryOptions {
  limit?: number
  offset?: number
  orderBy?: string
  orderDir?: "asc" | "desc"
}

// Slack types
export interface SlackEventMessage {
  ts?: string
  user?: string
  text?: string
  thread_ts?: string
}

export interface SlackEvent {
  type: string
  subtype?: string
  channel: string
  user?: string
  username?: string
  text: string
  ts: string
  thread_ts?: string
  bot_id?: string
  deleted_ts?: string
  message?: SlackEventMessage
  previous_message?: SlackEventMessage
}

export interface SlackChannelMessage {
  ts: string
  user: string
  text: string
  threadTs?: string
  replyCount?: number
  files?: SlackFile[]
  replies?: SlackReply[]
}

export interface SlackFile {
  id: string
  name: string
  mimetype: string
  url: string
}

export interface SlackReply {
  ts: string
  user: string
  text: string
}

// Customer inquiry parsed by AI
export interface ParsedInquiry {
  isInquiry: boolean
  companyName: string | null
  contactPerson: string | null
  inquiryType: string
  summary: string
  urgency: "high" | "medium" | "low"
  industry: string | null
}

// Meeting summary from AI
export interface MeetingSummaryData {
  summary: string
  keyDiscussions: string[]
  actionItems: string[]
  customerNeeds: string[]
  budgetMentions: string | null
  timelineMentions: string | null
  nextSteps: string[]
}

// Company enrichment from AI
export interface CompanyEnrichment {
  summary: string
  ceo: string | null
  foundedYear: string | null
  recentNews: string | null
  competitors: string[]
  salesOpportunity: string
}

// CS Channel parsed data
export interface ParsedCSInquiry {
  companyName: string | null
  contactName: string | null
  contactTitle: string | null
  contactPhone: string | null
  contactEmail: string | null
  inquiryDetails: string | null
  leadSource: string | null
  landingPageUrl: string | null
}

// Meeting Notes parsed data
export interface ParsedMeetingNote {
  leadCompanyName: string | null
  decisionMakerName: string | null
  meetingNote: string | null
  salesProposal: string | null
}

// Sales Channel classification
export interface SalesMessageClassification {
  messageType: "new_customer" | "existing_customer" | "other"
  confidence: "high" | "medium" | "low"
  companyName: string | null
  reasoning: string
}

// Sales Channel update data
export interface SalesUpdateData {
  updateType: "status_change" | "add_note" | "create_followup" | "update_contact"
  customerId: string | null
  customerName: string | null
  statusChange?: {
    newStatus: "prospect" | "new" | "contact" | "negotiation" | "won" | "lost"
    reason?: string
  }
  note?: string
  followUp?: {
    type: "email" | "call" | "meeting" | "message"
    content: string
    scheduledDays: number
  }
  contactUpdate?: {
    name?: string
    title?: string
    email?: string
    phone?: string
  }
}

// Settings types
export interface SlackSettings {
  webhookUrl?: string
  isEnabled?: boolean
  notifications?: {
    newProspect?: boolean
    followUpReminder?: boolean
    dealWon?: boolean
    dealLost?: boolean
  }
  isValidated?: boolean
  eventApiEnabled?: boolean
  monitoredChannels?: string[]
}

export interface EmailSettings {
  provider?: string | null
  isConnected?: boolean
  autoSync?: boolean
  syncInterval?: number
  lastSyncAt?: number | null
}

export interface CalendarSettings {
  provider?: string | null
  isConnected?: boolean
  autoSync?: boolean
  syncInterval?: number
  meetingPrepEnabled?: boolean
}

export interface NotificationSettings {
  browser?: {
    enabled?: boolean
    types?: {
      followUp?: boolean
      meeting?: boolean
      news?: boolean
      risk?: boolean
      prospect?: boolean
    }
  }
  email?: {
    enabled?: boolean
    dailyDigest?: boolean
    digestTime?: string
  }
}

export interface CollectionSettings {
  autoCollect?: boolean
  interval?: number
  lastRun?: number | null
}

export interface MixpanelSettings {
  enabled?: boolean
  isEnabled?: boolean
  projectToken?: string
  apiSecret?: string
  autoCreateLeads?: boolean
  autoCreateProspect?: boolean
  eventMappings?: Record<string, string>
  trackedEvents?: string[]
  defaultSignalStrength?: string
  enrichWithAI?: boolean
  syncFrequency?: string // 'hourly' | 'every_4_hours' | 'daily'
  lastSyncAt?: number | null
}

// Combined settings type for all application settings
export interface AllSettings {
  slack: SlackSettings
  email: EmailSettings
  calendar: CalendarSettings
  notifications: NotificationSettings
  collection: CollectionSettings
  mixpanel: MixpanelSettings
}

// Type for settings keys
export type SettingsKey = keyof AllSettings

// Slack Block Kit types
export interface SlackTextObject {
  type: "plain_text" | "mrkdwn"
  text: string
  emoji?: boolean
  verbatim?: boolean
}

export interface SlackBlockBase {
  type: string
  block_id?: string
}

export interface SlackHeaderBlock extends SlackBlockBase {
  type: "header"
  text: SlackTextObject
}

export interface SlackSectionBlock extends SlackBlockBase {
  type: "section"
  text?: SlackTextObject
  fields?: SlackTextObject[]
  accessory?: unknown
}

export interface SlackDividerBlock extends SlackBlockBase {
  type: "divider"
}

export interface SlackContextBlock extends SlackBlockBase {
  type: "context"
  elements: SlackTextObject[]
}

export type SlackBlock =
  | SlackHeaderBlock
  | SlackSectionBlock
  | SlackDividerBlock
  | SlackContextBlock

// Slack webhook payload (renamed to avoid conflict with DB SlackMessage type)
export interface SlackWebhookPayload {
  text?: string
  blocks?: SlackBlock[]
}

// Google Calendar Event types
export interface CalendarEventAttendee {
  email: string
  name?: string
  responseStatus?: string
}

export interface CalendarEvent {
  id: string
  summary: string
  description?: string
  start: Date
  end: Date
  attendees: CalendarEventAttendee[]
}

// Google OAuth tokens
export interface GoogleTokens {
  access_token?: string | null
  refresh_token?: string | null
  expiry_date?: number | null
  token_type?: string | null
  scope?: string
}

// API Response Types (shared between frontend and backend)
export type * from "./api"
