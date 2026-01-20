/**
 * API Response Types
 * Shared types between frontend and backend for API communication
 */

// ============================================================================
// Generic API Response Wrappers
// ============================================================================

export type ApiSuccessResponse<T> = {
  success: true
  data: T
}

export type ApiSuccessListResponse<T> = {
  success: true
  data: T[]
  count: number
}

export type ApiErrorResponse = {
  success: false
  error: string
  code?: string
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse
export type ApiListResponse<T> = ApiSuccessListResponse<T> | ApiErrorResponse

// ============================================================================
// Domain Models for API Responses
// ============================================================================

/**
 * Source Article - nested structure for prospects
 * Represents where a prospect was discovered
 */
export interface SourceArticle {
  title: string | null
  uri: string | null
  publishedAt: string | null  // ISO date string
}

/**
 * API Customer Response
 * What the backend returns for a customer
 */
export interface ApiCustomer {
  id: string
  name: string
  website: string | null
  industry: string | null
  notes: string | null
  status: 'prospect' | 'new' | 'contact' | 'negotiation' | 'won' | 'lost'
  lostReason: string | null
  lostAt: string | null  // ISO date string
  lastFollowUpAt: string | null  // ISO date string
  lastEnrichedAt: string | null  // ISO date string
  leadSource: string | null
  initialInquiry: string | null
  sourceOfInquiry: string | null
  landingPageUrl: string | null
  createdAt: string  // ISO date string
  updatedAt: string  // ISO date string
}

/**
 * API Customer Enrichment Response
 * AI-enriched data about a customer
 */
export interface ApiCustomerEnrichment {
  id: string
  customerId: string
  summary: string | null
  ceo: string | null
  foundedYear: string | null
  recentNews: string | null  // JSON string array
  competitors: string | null  // JSON string array
  salesOpportunity: string | null
  sources: string | null  // JSON string array of {title, uri}
  createdAt: string  // ISO date string
  updatedAt: string  // ISO date string
}

/**
 * API Prospect Response (with nested sourceArticle)
 * Represents a prospective lead/customer
 */
export interface ApiProspect {
  id: string
  companyName: string
  website: string | null
  industry: string | null
  sourceArticle: SourceArticle  // NESTED OBJECT (not flat fields)
  signalStrength: 'high' | 'medium' | 'low'
  icpMatch: string | null
  notes: string | null
  contactName: string | null
  contactTitle: string | null
  contactPhone: string | null
  contactEmail: string | null
  landingPageUrl: string | null
  detectedAt: string  // ISO date string
  convertedToCustomerId: string | null
  dismissed: boolean
  dismissedAt: string | null
  dismissReason: string | null
  createdAt: string  // ISO date string
}

/**
 * API Proposal Response
 * Business proposal for a customer
 */
export interface ApiProposal {
  id: string
  customerId: string
  title: string
  content: string
  imageUrl: string | null
  proposalStatus: string | null
  feedback: string | null
  feedbackReceivedAt: string | null
  createdAt: string  // ISO date string
}

/**
 * API Customer Contact Response
 * Contact person at a customer organization
 */
export interface ApiCustomerContact {
  id: string
  customerId: string
  name: string
  title: string | null
  email: string | null
  phone: string | null
  isPrimary: number  // SQLite stores boolean as 0/1
  source: 'manual' | 'business_card' | 'import' | null
  businessCardImageUrl: string | null
  createdAt: string  // ISO date string
  updatedAt: string  // ISO date string
}

/**
 * API Meeting Summary Response
 * Summary of a meeting with a customer
 */
export interface ApiMeetingSummary {
  id: string
  customerId: string
  title: string
  meetingDate: string  // ISO date string
  audioFileUrl: string | null
  duration: number | null  // seconds
  summary: string | null
  keyDiscussions: string | null  // JSON string array
  actionItems: string | null  // JSON string array
  customerNeeds: string | null  // JSON string array
  budgetMentions: string | null
  timelineMentions: string | null
  nextSteps: string | null  // JSON string array
  transcription: string | null
  createdAt: string  // ISO date string
  updatedAt: string  // ISO date string
}

/**
 * API Follow-up History Response
 * Record of completed follow-ups
 */
export interface ApiFollowUpHistory {
  id: string
  customerId: string
  type: 'email' | 'call' | 'meeting' | 'message'
  content: string | null
  status: 'planned' | 'completed' | 'cancelled'
  createdAt: string  // ISO date string
}

/**
 * API Scheduled Follow-up Response
 * Scheduled future follow-ups
 */
export interface ApiScheduledFollowUp {
  id: string
  customerId: string
  scheduledFor: string  // ISO date string
  type: 'email' | 'call' | 'meeting' | 'message'
  content: string | null
  status: 'pending' | 'completed' | 'cancelled'
  priority: 'high' | 'medium' | 'low'
  reason: string
  completedAt: string | null  // ISO date string
  completedNote: string | null
  isManuallyCreated: boolean
  reminderSent: boolean
  lastReminderAt: string | null  // ISO date string
  createdAt: string  // ISO date string
}

/**
 * API Notification Response
 */
export interface ApiNotification {
  id: string
  type: 'news' | 'followup' | 'lost_deal' | 'prospect' | 'meeting' | 'email' | 'risk'
  title: string
  message: string
  customerId?: string
  prospectId?: string
  priority: 'high' | 'medium' | 'low'
  read: boolean
  createdAt: string  // ISO date string
  actionUrl?: string
  metadata?: string  // JSON string
}

/**
 * Extended Customer with all relationships
 * Used for detail endpoints (not list endpoints)
 */
export interface ApiCustomerWithRelations extends ApiCustomer {
  enrichment?: ApiCustomerEnrichment
  proposals?: ApiProposal[]
  contacts?: ApiCustomerContact[]
  meetings?: ApiMeetingSummary[]
  followUpHistory?: ApiFollowUpHistory[]
}
