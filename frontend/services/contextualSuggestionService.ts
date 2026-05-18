import { apiClient } from "../src/services/apiClient"
import type { ContextualSuggestion, Customer } from "../types"
import { getUpcomingMeetings } from "./calendarIntegrationService"

// Contextual Suggestions Storage
const SUGGESTIONS_KEY = "rinda_contextual_suggestions"

// Get all suggestions
export const getSuggestions = (): ContextualSuggestion[] => {
  const stored = localStorage.getItem(SUGGESTIONS_KEY)
  return stored ? JSON.parse(stored) : []
}

// Save suggestion
export const saveSuggestion = (suggestion: ContextualSuggestion): void => {
  const existing = getSuggestions()

  // Avoid duplicates
  const isDuplicate = existing.some(
    (s) =>
      s.id === suggestion.id ||
      (s.type === suggestion.type &&
        s.customerId === suggestion.customerId &&
        Math.abs(new Date(s.createdAt).getTime() - new Date(suggestion.createdAt).getTime()) <
          60000),
  )

  if (!isDuplicate) {
    existing.unshift(suggestion)
    // Keep last 100 suggestions
    const trimmed = existing.slice(0, 100)
    localStorage.setItem(SUGGESTIONS_KEY, JSON.stringify(trimmed))
  }
}

// Delete suggestion
export const deleteSuggestion = (suggestionId: string): void => {
  const existing = getSuggestions()
  const filtered = existing.filter((s) => s.id !== suggestionId)
  localStorage.setItem(SUGGESTIONS_KEY, JSON.stringify(filtered))
}

// Analyze customer context and generate suggestions
export const analyzeCustomerContext = async (
  customer: Customer,
  allCustomers: Customer[],
): Promise<ContextualSuggestion[]> => {
  const suggestions: ContextualSuggestion[] = []
  const now = Date.now()

  // Check for missing follow-up
  const lastContactDate = customer.lastFollowUpAt || customer.lastEnrichedAt
  const lastContact = lastContactDate ? new Date(lastContactDate).getTime() : 0
  const daysSinceLastContact = Math.floor((now - lastContact) / (1000 * 60 * 60 * 24))

  if (daysSinceLastContact >= 3 && customer.status !== "won" && customer.status !== "lost") {
    suggestions.push({
      id: `suggest_followup_${customer.id}`,
      type: "followup",
      title: "Follow-up이 필요합니다",
      description: `${customer.name}와의 마지막 접촉이 ${daysSinceLastContact}일 전입니다. Follow-up 메시지를 생성할까요?`,
      customerId: customer.id,
      action: "generate_followup",
      priority: daysSinceLastContact >= 7 ? "high" : "medium",
      createdAt: new Date(now).toISOString(),
    })
  }

  // Check for missing enrichment
  if (
    !customer.enrichedData ||
    (customer.lastEnrichedAt &&
      now - new Date(customer.lastEnrichedAt).getTime() > 30 * 24 * 60 * 60 * 1000)
  ) {
    suggestions.push({
      id: `suggest_enrich_${customer.id}`,
      type: "enrichment",
      title: "고객 정보 업데이트 필요",
      description: `${customer.name}의 정보가 오래되었거나 없습니다. 최신 정보를 수집할까요?`,
      customerId: customer.id,
      action: "enrich_customer",
      priority: !customer.enrichedData ? "high" : "medium",
      createdAt: new Date(now).toISOString(),
    })
  }

  // Check for missing proposal in negotiation stage
  if (customer.status === "negotiation" && customer.proposals.length === 0) {
    suggestions.push({
      id: `suggest_proposal_${customer.id}`,
      type: "proposal",
      title: "제안서 작성이 필요합니다",
      description: `${customer.name}가 제안서 검토 단계에 있지만 제안서가 없습니다. 제안서를 생성할까요?`,
      customerId: customer.id,
      action: "generate_proposal",
      priority: "high",
      createdAt: new Date(now).toISOString(),
    })
  }

  // Check for upcoming meetings
  try {
    const meetings = await getUpcomingMeetings(customer.id, 3)
    if (meetings.length > 0) {
      const nextMeeting = meetings[0]
      const hoursUntil = (new Date(nextMeeting.startTime).getTime() - now) / (1000 * 60 * 60)

      if (hoursUntil <= 48 && hoursUntil > 0) {
        suggestions.push({
          id: `suggest_meeting_prep_${customer.id}_${nextMeeting.id}`,
          type: "meeting_prep",
          title: "미팅 준비가 필요합니다",
          description: `${customer.name}와의 미팅이 ${Math.floor(hoursUntil)}시간 후에 예정되어 있습니다. 미팅 준비 자료를 생성할까요?`,
          customerId: customer.id,
          action: "generate_meeting_prep",
          priority: hoursUntil <= 24 ? "high" : "medium",
          createdAt: new Date(now).toISOString(),
        })
      }
    }
  } catch (error) {
    console.error("Failed to check meetings for suggestions:", error)
  }

  // Check for risk signals using AI
  try {
    const riskSuggestion = await detectRiskSignals(customer, allCustomers)
    if (riskSuggestion) {
      suggestions.push(riskSuggestion)
    }
  } catch (error) {
    console.error("Risk detection failed:", error)
  }

  return suggestions
}

// Detect risk signals using AI
export const detectRiskSignals = async (
  customer: Customer,
  _allCustomers: Customer[],
): Promise<ContextualSuggestion | null> => {
  const now = Date.now()
  const lastContactDate = customer.lastFollowUpAt || customer.lastEnrichedAt
  const lastContact = lastContactDate ? new Date(lastContactDate).getTime() : 0
  const daysSinceLastContact = Math.floor((now - lastContact) / (1000 * 60 * 60 * 24))

  try {
    const response = await apiClient.detectRiskSignals(customer.id)
    if (response.success) {
      const result = response.data
      const priorityValue: "high" | "medium" | "low" =
        result.priority === "high" || result.priority === "medium" || result.priority === "low"
          ? result.priority
          : "medium"
      if (result.hasRisk) {
        return {
          id: `suggest_risk_${customer.id}_${Date.now()}`,
          type: "risk",
          title: "위험 신호 감지",
          description: `${customer.name}: ${typeof result.riskReason === "string" ? result.riskReason : ""}`,
          customerId: customer.id,
          action: "review_customer",
          priority: priorityValue,
          createdAt: new Date(now).toISOString(),
        }
      }
    }
  } catch (error) {
    console.error("Risk detection failed:", error)

    // Fallback: check for obvious risk signals
    if (daysSinceLastContact >= 30 && customer.status !== "won" && customer.status !== "lost") {
      return {
        id: `suggest_risk_${customer.id}_${Date.now()}`,
        type: "risk",
        title: "장기간 연락 없음",
        description: `${customer.name}와의 마지막 접촉이 ${daysSinceLastContact}일 전입니다. 상태를 확인해보세요.`,
        customerId: customer.id,
        action: "review_customer",
        priority: "medium",
        createdAt: new Date(now).toISOString(),
      }
    }
  }

  return null
}

// Generate suggestions for all customers
export const generateAllSuggestions = async (
  customers: Customer[],
): Promise<ContextualSuggestion[]> => {
  const allSuggestions: ContextualSuggestion[] = []

  // Limit to active customers to avoid too many suggestions
  const activeCustomers = customers
    .filter((c) => c.status !== "lost" && c.status !== "won")
    .slice(0, 50) // Process max 50 at a time

  for (const customer of activeCustomers) {
    try {
      const suggestions = await analyzeCustomerContext(customer, customers)
      allSuggestions.push(...suggestions)

      // Save each suggestion
      suggestions.forEach((s) => saveSuggestion(s))
    } catch (error) {
      console.error(`Failed to generate suggestions for ${customer.name}:`, error)
    }
  }

  return allSuggestions
}

// Get suggestions for a specific customer
export const getCustomerSuggestions = (customerId: string): ContextualSuggestion[] => {
  return getSuggestions().filter((s) => s.customerId === customerId)
}

// Get high-priority suggestions
export const getHighPrioritySuggestions = (): ContextualSuggestion[] => {
  return getSuggestions()
    .filter((s) => s.priority === "high")
    .slice(0, 10)
}
