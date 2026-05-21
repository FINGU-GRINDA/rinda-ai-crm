/**
 * CRM type definitions for the frontend.
 *
 * These mirror the backend's response shapes. Defined locally rather than
 * re-exported from `elysia-server/src/services/crm/deals.service.ts` because
 * pulling the backend file into the frontend's tsc context drags in Drizzle
 * type-resolution paths that don't exist in this workspace. If the backend
 * shape changes, update both sides — same coupling pattern as the legacy
 * apiClient's manual transformer layer.
 */

export const DEAL_STAGES = [
  "engaged",
  "in_conversation",
  "negotiating",
  "confirmed",
  "contract",
] as const

export type DealStage = (typeof DEAL_STAGES)[number]

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  engaged: "Engaged",
  in_conversation: "In Conversation",
  negotiating: "Negotiating",
  confirmed: "Confirmed",
  contract: "Contract",
}

export type DealLostFilter = "active" | "all" | "only"

export interface DealFieldOverride {
  userId: string
  timestamp: string
}

export type DealFieldOverrides = Record<string, DealFieldOverride>

export interface DealPrimaryAccount {
  id: string
  name: string
  domain: string | null
  country: string | null
  industry: string | null
  companySize: string | null
  buyerType: string | null
}

export interface DealPrimaryPerson {
  id: string
  fullName: string
  title: string | null
}

export interface DealLastMessage {
  id: string
  channel: string
  direction: "inbound" | "outbound"
  subject: string | null
  sentAt: string
}

export interface DealListItem {
  id: string
  dealStage: DealStage
  dealSize: string | null
  currency: string | null
  expectedCloseDate: string | null
  lostAt: string | null
  isBackfilled: boolean
  fieldOverrides: DealFieldOverrides
  createdAt: string
  updatedAt: string
  primaryAccount: DealPrimaryAccount | null
  primaryPerson: DealPrimaryPerson | null
  lastMessage: DealLastMessage | null
}

export interface DealAccountLink extends DealPrimaryAccount {
  role: string | null
  isPrimary: boolean
}

export interface DealPersonLink extends DealPrimaryPerson {
  role: string | null
  isPrimary: boolean
}

export interface MessageListItem {
  id: string
  channel: string
  direction: "inbound" | "outbound"
  subject: string | null
  body: string
  sentAt: string
  openedAt: string | null
  clickedAt: string | null
  repliedAt: string | null
  extractionJson: Record<string, unknown>
  contactId: string | null
  externalMessageId: string | null
  threadExternalId: string | null
  externalThreadUrl: string | null
  contactName: string | null
  contactEmail: string | null
}

export interface DealDetail extends DealListItem {
  accounts: DealAccountLink[]
  persons: DealPersonLink[]
  recentMessages: MessageListItem[]
}

export interface ListDealsResult {
  items: DealListItem[]
  nextCursor: string | null
}

export interface ListDealMessagesResult {
  items: MessageListItem[]
  nextCursor: string | null
}
