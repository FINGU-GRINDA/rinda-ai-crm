/**
 * API Transformation Utilities
 * Centralized transformation functions to convert API responses to frontend types
 */

import type {
  ApiCustomer,
  ApiCustomerContact,
  ApiCustomerEnrichment,
  ApiMeetingSummary,
  ApiProposal,
  ApiProspect,
} from '../../../elysia-server/src/types/api'
import type {
  Customer,
  CustomerContact,
  EnrichedData,
  FollowUpStrategy,
  MeetingSummary,
  Proposal,
  Prospect,
} from '../../types'
import { safeJsonParse } from './safeStorage'

// Extended API customer type with relations (returned from backend)
interface ApiCustomerWithRelations extends ApiCustomer {
  enrichment?: ApiCustomerEnrichment | null
  proposals?: ApiProposal[]
}

/**
 * Transform API enrichment to frontend EnrichedData type
 */
function transformApiEnrichment(apiEnrichment: ApiCustomerEnrichment | null | undefined): EnrichedData | undefined {
  if (!apiEnrichment) return undefined

  return {
    summary: apiEnrichment.summary || '',
    ceo: apiEnrichment.ceo || '',
    foundedYear: apiEnrichment.foundedYear || '',
    recentNews: safeJsonParse(apiEnrichment.recentNews, []),
    competitors: safeJsonParse(apiEnrichment.competitors, []),
    salesOpportunity: apiEnrichment.salesOpportunity || '',
    sources: safeJsonParse(apiEnrichment.sources, []),
  }
}

/**
 * Transform API enrichment follow-up strategy fields to frontend FollowUpStrategy type
 */
function transformApiFollowUpStrategy(apiEnrichment: ApiCustomerEnrichment | null | undefined): FollowUpStrategy | undefined {
  if (!apiEnrichment?.followUpApproach) return undefined

  return {
    recommendedTiming: apiEnrichment.followUpRecommendedTiming || '',
    approach: apiEnrichment.followUpApproach || '',
    messageTone: apiEnrichment.followUpMessageTone || '',
    keyPoints: safeJsonParse(apiEnrichment.followUpKeyPoints, []),
    probability: (apiEnrichment.followUpProbability as 'high' | 'medium' | 'low') || 'medium',
    reasoning: apiEnrichment.followUpReasoning || '',
  }
}

/**
 * Transform API customer to frontend Customer type
 * Handles both simple ApiCustomer and ApiCustomerWithRelations
 */
export function transformApiCustomer(apiCustomer: ApiCustomer | ApiCustomerWithRelations): Customer {
  // Check if this customer has enrichment/proposals attached
  const withRelations = apiCustomer as ApiCustomerWithRelations

  return {
    id: apiCustomer.id,
    name: apiCustomer.name,
    website: apiCustomer.website || '',
    industry: apiCustomer.industry || '미분류',
    notes: apiCustomer.notes || '',
    status: apiCustomer.status,
    enrichedData: transformApiEnrichment(withRelations.enrichment),
    proposals: withRelations.proposals?.map(transformApiProposal) || [],
    lastEnrichedAt: apiCustomer.lastEnrichedAt || undefined,
    lostReason: apiCustomer.lostReason || undefined,
    lostAt: apiCustomer.lostAt || undefined,
    lastFollowUpAt: apiCustomer.lastFollowUpAt || undefined,
    followUpHistory: [],  // Loaded separately
    followUpStrategy: transformApiFollowUpStrategy(withRelations.enrichment),
    contacts: [],  // Loaded separately
    meetingSummaries: [],  // Loaded separately
  }
}

/**
 * Transform API prospect to frontend Prospect type
 */
export function transformApiProspect(apiProspect: ApiProspect): Prospect {
  return {
    id: apiProspect.id,
    companyName: apiProspect.companyName,
    website: apiProspect.website || '',
    industry: apiProspect.industry || '미분류',
    sourceArticle: {
      title: apiProspect.sourceArticle.title || '',
      uri: apiProspect.sourceArticle.uri || '',
      publishedAt: apiProspect.sourceArticle.publishedAt,
    },
    signalStrength: apiProspect.signalStrength,
    detectedAt: apiProspect.detectedAt,
    icpMatch: apiProspect.icpMatch || undefined,
    notes: apiProspect.notes || undefined,
  }
}

/**
 * Transform API proposal to frontend Proposal type
 */
export function transformApiProposal(apiProposal: ApiProposal): Proposal {
  return {
    id: apiProposal.id,
    title: apiProposal.title,
    content: apiProposal.content,
    imageUrl: apiProposal.imageUrl || undefined,
    createdAt: apiProposal.createdAt,
  }
}

/**
 * Transform API contact to frontend CustomerContact type
 */
export function transformApiContact(apiContact: ApiCustomerContact): CustomerContact {
  return {
    id: apiContact.id,
    customerId: apiContact.customerId,
    name: apiContact.name,
    title: apiContact.title || undefined,
    email: apiContact.email || undefined,
    phone: apiContact.phone || undefined,
    isPrimary: apiContact.isPrimary === 1,  // Convert SQLite 0/1 to boolean
    source: (apiContact.source as 'manual' | 'business_card' | 'import') || undefined,
    businessCardImageUrl: apiContact.businessCardImageUrl || undefined,
    createdAt: apiContact.createdAt,
    updatedAt: apiContact.updatedAt,
  }
}

/**
 * Transform API meeting to frontend MeetingSummary type
 */
export function transformApiMeeting(apiMeeting: ApiMeetingSummary): MeetingSummary {
  return {
    id: apiMeeting.id,
    customerId: apiMeeting.customerId,
    title: apiMeeting.title,
    meetingDate: apiMeeting.meetingDate,
    audioFileUrl: apiMeeting.audioFileUrl || undefined,
    duration: apiMeeting.duration || undefined,
    summary: apiMeeting.summary || '',
    keyDiscussions: safeJsonParse(apiMeeting.keyDiscussions, []),
    actionItems: safeJsonParse(apiMeeting.actionItems, []),
    customerNeeds: safeJsonParse(apiMeeting.customerNeeds, []),
    budgetMentions: apiMeeting.budgetMentions || undefined,
    timelineMentions: apiMeeting.timelineMentions || undefined,
    nextSteps: [],
    transcription: apiMeeting.transcription || undefined,
    createdAt: apiMeeting.createdAt,
    updatedAt: apiMeeting.updatedAt,
  }
}

// ============================================================================
// Date Formatting Utilities
// ============================================================================

/**
 * Format ISO date string to localized date format
 * Example: "2024-01-20T10:30:00.000Z" -> "2024년 1월 20일"
 */
export function formatDate(isoString: string | undefined | null): string {
  if (!isoString) return ''

  return new Date(isoString).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Format ISO date string to relative time
 * Example: "2024-01-15T10:30:00.000Z" -> "5일 전"
 */
export function formatRelativeTime(isoString: string | undefined | null): string {
  if (!isoString) return ''

  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return '오늘'
  if (diffDays === 1) return '어제'
  if (diffDays < 7) return `${diffDays}일 전`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}개월 전`
  return `${Math.floor(diffDays / 365)}년 전`
}

/**
 * Format date for input fields (YYYY-MM-DD)
 */
export function formatDateForInput(isoString: string | undefined | null): string {
  if (!isoString) return ''

  const date = new Date(isoString)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

/**
 * Parse date from input field to ISO string
 */
export function parseDateFromInput(dateString: string): string | null {
  if (!dateString) return null

  try {
    const date = new Date(dateString)
    return date.toISOString()
  } catch {
    return null
  }
}
