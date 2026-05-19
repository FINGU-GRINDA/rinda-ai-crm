export interface EnrichedData {
  summary: string
  ceo: string
  foundedYear: string
  recentNews: string[]
  competitors: string[]
  salesOpportunity: string // New field for AI analysis
  sources: { title: string; uri: string }[]
}

export interface Proposal {
  id: string
  title: string
  content: string // Markdown content
  imageUrl?: string
  createdAt: string // ISO date string
}

export type CustomerStatus = "prospect" | "new" | "contact" | "negotiation" | "won" | "lost"

export interface FollowUpAction {
  id: string
  type: "email" | "call" | "meeting" | "message"
  content: string
  createdAt: string // ISO date string
  status: "planned" | "completed" | "cancelled"
}

// Follow-up strategy (generated with enrichment, stored in DB)
export interface FollowUpStrategy {
  recommendedTiming: string
  approach: string
  messageTone: string
  keyPoints: string[]
  probability: "high" | "medium" | "low"
  reasoning: string
}

export interface Customer {
  id: string
  name: string
  website: string
  industry: string
  notes: string
  status: CustomerStatus // Kanban status
  enrichedData?: EnrichedData
  proposals: Proposal[]
  lastEnrichedAt?: string // ISO date string
  lostReason?: string
  lostAt?: string // ISO date string
  lastFollowUpAt?: string // ISO date string
  followUpHistory?: FollowUpAction[]
  followUpStrategy?: FollowUpStrategy // AI-generated strategy (stored with enrichment)
  contacts?: CustomerContact[]
  meetingSummaries?: MeetingSummary[]
}

// Customer Contact (명함/연락처)
export interface CustomerContact {
  id: string
  customerId: string
  name: string
  title?: string
  email?: string
  phone?: string
  isPrimary: boolean
  source?: "manual" | "business_card" | "import"
  businessCardImageUrl?: string
  createdAt: string // ISO date string
  updatedAt: string // ISO date string
}

// Meeting Summary (미팅 녹음 요약)
export interface MeetingSummary {
  id: string
  customerId: string
  title: string
  meetingDate: string // ISO date string
  audioFileUrl?: string
  duration?: number
  summary: string
  keyDiscussions: string[]
  actionItems: string[]
  customerNeeds: string[]
  budgetMentions?: string
  timelineMentions?: string
  nextSteps: string[]
  transcription?: string
  createdAt: string // ISO date string
  updatedAt: string // ISO date string
}

// Business Card OCR Result (명함 인식 결과)
export interface BusinessCardData {
  companyName?: string
  website?: string
  contactName: string
  title?: string
  email?: string
  phone?: string
  confidence?: number
}

// Recording Status (녹음 상태)
export type RecordingStatus = "idle" | "recording" | "paused" | "processing" | "complete" | "error"

export enum ImageSize {
  Size_1K = "1K",
  Size_2K = "2K",
  Size_4K = "4K",
}

export type ProcessingStatus =
  | "idle"
  | "searching"
  | "thinking"
  | "generating_image"
  | "complete"
  | "error"

export interface ICPProfile {
  id: string
  name: string
  industries: string[]
  keywords: string[]
  companySize?: string
  targetRegions?: string[]
  createdAt: string // ISO date string
  updatedAt: string // ISO date string
}

export interface Prospect {
  id: string
  companyName: string
  website: string
  industry: string
  sourceArticle: {
    title: string
    uri: string
    publishedAt?: string // ISO date string
  }
  signalStrength: "high" | "medium" | "low"
  detectedAt: string // ISO date string
  icpMatch?: string // ICP Profile ID
  notes?: string
}

// Email Integration Types
export interface EmailMessage {
  id: string
  subject: string
  from: string
  to: string
  body: string
  date: string // ISO date string
  threadId?: string
  customerId?: string // Matched customer ID
}

export interface EmailIntegration {
  provider: "gmail" | "outlook"
  isConnected: boolean
  lastSyncAt?: string // ISO date string
  autoSync: boolean
}

// Calendar Integration Types
export interface CalendarEvent {
  id: string
  title: string
  startTime: string // ISO date string
  endTime: string // ISO date string
  description?: string
  location?: string
  attendees?: string[]
  customerId?: string // Matched customer ID
  meetingPrep?: MeetingPreparation
}

export interface MeetingPreparation {
  customerId: string
  summary: string
  keyPoints: string[]
  suggestedTopics: string[]
  generatedAt: string // ISO date string
}

export interface CalendarIntegration {
  provider: "google" | "outlook"
  isConnected: boolean
  lastSyncAt?: number
  autoSync: boolean
}

// Auto Follow-up Types
export type FollowUpType = "email" | "call" | "meeting" | "message"
export type FollowUpStatus = "pending" | "completed" | "cancelled"
export type FollowUpPriority = "high" | "medium" | "low"

export interface ScheduledFollowUp {
  id: string
  customerId: string
  scheduledFor: string // ISO date string
  type: FollowUpType
  content?: string
  status: FollowUpStatus
  createdAt: string // ISO date string
  priority: FollowUpPriority
  reason: string
  // 완료 처리 관련 필드
  completedAt?: string // ISO date string
  completedNote?: string
  // 수동 생성 여부
  isManuallyCreated?: boolean
  // 알림 관련
  reminderSent?: boolean
  lastReminderAt?: string // ISO date string
}

// Follow-up 통계
export interface FollowUpStats {
  total: number
  pending: number
  completed: number
  overdue: number
  completionRate: number
  avgCompletionTime: number
  byType: Record<FollowUpType, number>
  byPriority: Record<FollowUpPriority, number>
}

// Follow-up 필터 옵션
export interface FollowUpFilterOptions {
  status?: FollowUpStatus[]
  priority?: FollowUpPriority[]
  type?: FollowUpType[]
  customerId?: string
  dateRange?: {
    start: number
    end: number
  }
  searchQuery?: string
}

// Notification Types
export interface Notification {
  id: string
  type: "news" | "followup" | "lost_deal" | "prospect" | "meeting" | "email" | "risk"
  title: string
  message: string
  customerId?: string
  priority: "high" | "medium" | "low"
  read: boolean
  createdAt: string // ISO date string
  actionUrl?: string
  metadata?: Record<string, unknown>
}

// Context-Aware AI Suggestion Types
export interface ContextualSuggestion {
  id: string
  type: "followup" | "enrichment" | "proposal" | "meeting_prep" | "risk"
  title: string
  description: string
  customerId?: string
  action: string // Action to take
  priority: "high" | "medium" | "low"
  createdAt: string // ISO date string
}

// AI Assistant Types
export interface AIMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string // ISO date string
  metadata?: {
    action?: string
    customerId?: string
    result?: unknown
  }
}

// Settings Types
export type SettingsTabType = "ai" | "prospect" | "slack" | "email" | "calendar" | "notifications"

export interface SlackSettings {
  webhookUrl: string
  isEnabled: boolean
  channel?: string
  notifications: {
    newProspect: boolean
    followUpReminder: boolean
    followUpCompleted: boolean
    dailyDigest: boolean
    dealWon: boolean
    dealLost: boolean
  }
  lastTestAt?: string // ISO date string
  isValidated: boolean
  dailyDigestTime?: string // "09:00" format
  lastDigestSentAt?: string // ISO date string
}

export interface NotificationSettings {
  browser: {
    enabled: boolean
    types: {
      followUp: boolean
      meeting: boolean
      news: boolean
      risk: boolean
      prospect: boolean
    }
  }
  email: {
    enabled: boolean
    dailyDigest: boolean
    digestTime: string // "09:00"
  }
}

export interface EmailSettings {
  provider: "gmail" | "outlook" | null
  isConnected: boolean
  autoSync: boolean
  syncInterval: number // milliseconds
  lastSyncAt?: string // ISO date string
}

export interface CalendarSettings {
  provider: "google" | "outlook" | null
  isConnected: boolean
  autoSync: boolean
  syncInterval: number // milliseconds
  lastSyncAt?: number
  meetingPrepEnabled: boolean
}

// Background Task Types
export type BackgroundTaskStatus = "pending" | "running" | "completed" | "error"

export interface BackgroundTask {
  id: string
  type: "proposal_generation"
  status: BackgroundTaskStatus
  customerId: string
  customerName: string
  progress: number
  message: string
  result?: {
    title: string
    content: string
    imageUrl?: string
  }
  error?: string
  createdAt: string // ISO date string
  completedAt?: string // ISO date string
}
