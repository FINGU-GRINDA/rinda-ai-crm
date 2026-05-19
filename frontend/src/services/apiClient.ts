/**
 * API Client for Backend Communication
 * Handles all HTTP requests to the backend API
 */

import type {
  ApiCustomer,
  ApiCustomerContact,
  ApiDeal,
  ApiDealCard,
  ApiDealWithHistory,
  ApiListResponse,
  ApiMeetingSummary,
  ApiPipeline,
  ApiPipelineStage,
  ApiProposal,
  ApiProspect,
  ApiResponse,
  ApiWorkspace,
  ApiWorkspaceWithRole,
  ForecastCategory,
} from "../../../elysia-server/src/types/api"

// Empty string => relative /api paths.
//   dev:  Vite's /api proxy forwards to the API server (vite.config.ts).
//   prod: nginx in the same container proxies to BACKEND_URL.
// Set VITE_API_URL at build time only if the bundle should hit the API directly.
const API_BASE_URL = import.meta.env.VITE_API_URL ?? ""

// Health check response type
export interface HealthCheckResponse {
  status: string
  timestamp: number
  version: string
  database: string
}

const WORKSPACE_STORAGE_KEY = "rinda.workspaceId"

class APIClient {
  private baseURL: string
  private workspaceId: string | null = null

  constructor(baseURL: string) {
    this.baseURL = baseURL
    if (typeof window !== "undefined") {
      try {
        this.workspaceId = window.localStorage.getItem(WORKSPACE_STORAGE_KEY)
      } catch {
        this.workspaceId = null
      }
    }
  }

  /** Pin every subsequent request to this workspace via the X-Workspace-Id header. */
  setWorkspaceOverride(workspaceId: string | null): void {
    this.workspaceId = workspaceId
    if (typeof window === "undefined") return
    try {
      if (workspaceId) {
        window.localStorage.setItem(WORKSPACE_STORAGE_KEY, workspaceId)
      } else {
        window.localStorage.removeItem(WORKSPACE_STORAGE_KEY)
      }
    } catch {
      // Storage unavailable / quota exceeded — header still applies in-memory.
    }
  }

  getWorkspaceOverride(): string | null {
    return this.workspaceId
  }

  /**
   * Check server health status
   */
  async checkHealth(): Promise<HealthCheckResponse | null> {
    try {
      const response = await fetch(`${this.baseURL}/health`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) {
        return null
      }

      const json = await response.json()

      // Backend wraps response with success(), so access data.data
      const healthData = json.data || json

      // Validate the response has the expected structure
      if (healthData.status === "ok" && healthData.database === "connected") {
        return healthData as HealthCheckResponse
      }

      return null
    } catch (error) {
      console.error("Health check failed:", error)
      return null
    }
  }

  /**
   * Generic request method with error handling
   * Note: Token refresh is handled proactively by backend middleware
   * A 401 means both access and refresh tokens are invalid - redirect to login
   */
  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseURL}${endpoint}`

    const baseHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    }
    if (this.workspaceId) {
      baseHeaders["X-Workspace-Id"] = this.workspaceId
    }
    const config: RequestInit = {
      ...options,
      credentials: "include",
      headers: {
        ...baseHeaders,
        ...options.headers,
      },
    }

    try {
      const response = await fetch(url, config)

      // Handle 401 - session expired (backend couldn't refresh)
      if (response.status === 401 && !endpoint.includes("/auth/")) {
        console.error("Session expired - redirecting to login")
        window.location.href = "/login"
        throw new Error("Session expired")
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          error: "Unknown error",
          code: "UNKNOWN_ERROR",
        }))
        throw new Error(error.error || `HTTP ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      const err = error as Error
      console.error("API request failed:", err)
      throw err
    }
  }

  // ==========================
  // Authentication Endpoints
  // ==========================

  /**
   * Register a new user with email and password
   */
  async register(data: {
    email: string
    password: string
    name: string
  }): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
      credentials: "include",
    })
  }

  /**
   * Login with email and password
   */
  async login(data: {
    email: string
    password: string
  }): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
      credentials: "include",
    })
  }

  /**
   * Get Google OAuth authorization URL
   */
  async getGoogleOAuthUrl(): Promise<ApiResponse<{ url: string }>> {
    return this.request("/api/auth/google/url", {
      credentials: "include",
    })
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request("/api/auth/me", {
      credentials: "include",
    })
  }

  /**
   * Logout current user
   */
  async logout(): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    })
  }

  // ==========================
  // AI Assistant Endpoints
  // ==========================

  /**
   * Parse user intent from natural language message
   */
  async parseIntent(
    message: string,
    customers: Array<{ id: string; name: string }>,
  ): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request("/api/ai/parse-intent", {
      method: "POST",
      body: JSON.stringify({ message, customers }),
    })
  }

  /**
   * Enrich customer data using AI and Google Search
   */
  async enrichCustomer(
    companyName: string,
    website: string,
  ): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request("/api/ai/enrich", {
      method: "POST",
      body: JSON.stringify({ companyName, website }),
    })
  }

  /**
   * Generate proposal for a customer
   */
  async generateProposal(
    customerName: string,
    enrichedData: Record<string, unknown>,
    userNotes: string,
    imageSize: string = "1K",
  ): Promise<ApiResponse<{ title: string; content: string; imageUrl?: string }>> {
    return this.request("/api/ai/generate-proposal", {
      method: "POST",
      body: JSON.stringify({ customerName, enrichedData, userNotes, imageSize }),
    })
  }

  /**
   * Generate AI assistant response
   */
  async generateResponse(
    message: string,
    context?: string,
    conversationHistory?: Array<{ role: string; content: string }>,
  ): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request("/api/ai/generate-response", {
      method: "POST",
      body: JSON.stringify({ message, context, conversationHistory }),
    })
  }

  /**
   * Scan business card image and extract contact information
   */
  async scanBusinessCard(
    image: string,
    customerId?: string,
    createCustomer?: boolean,
  ): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request("/api/ai/scan-business-card", {
      method: "POST",
      body: JSON.stringify({ image, customerId, createCustomer }),
    })
  }

  /**
   * Summarize meeting audio or transcription
   */
  async summarizeMeeting(data: {
    audioData?: string
    transcription?: string
    customerId: string
    title: string
    meetingDate?: string
  }): Promise<ApiResponse<ApiMeetingSummary>> {
    return this.request("/api/ai/summarize-meeting", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  /**
   * Generate follow-up strategy for a customer
   */
  async generateFollowUpStrategy(
    customerId: string,
    isLostDeal: boolean = false,
  ): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request(`/api/ai/followup/strategy/${customerId}`, {
      method: "POST",
      body: JSON.stringify({ isLostDeal }),
    })
  }

  /**
   * Generate follow-up message for a customer
   */
  async generateFollowUpMessage(
    customerId: string,
    strategy: { approach: string; messageTone: string; keyPoints: string[] },
    isLostDeal: boolean = false,
  ): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request(`/api/ai/followup/message/${customerId}`, {
      method: "POST",
      body: JSON.stringify({ strategy, isLostDeal }),
    })
  }

  /**
   * Calculate optimal follow-up timing for a customer
   */
  async calculateFollowUpTiming(customerId: string): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request(`/api/ai/followup/timing/${customerId}`, {
      method: "POST",
    })
  }

  /**
   * Determine optimal follow-up type (channel) for a customer
   */
  async determineFollowUpType(customerId: string): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request(`/api/ai/followup/type/${customerId}`, {
      method: "POST",
    })
  }

  /**
   * Parse user intent for AI assistant
   */
  async parseAssistantIntent(
    message: string,
    customers: { id: string; name: string }[],
  ): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request("/api/ai/assistant/parse-intent", {
      method: "POST",
      body: JSON.stringify({ message, customers }),
    })
  }

  /**
   * Generate AI assistant response
   */
  async generateAssistantResponse(
    message: string,
    context?: string,
    conversationHistory?: Array<{ role: string; content: string }>,
  ): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request("/api/ai/assistant/response", {
      method: "POST",
      body: JSON.stringify({ message, context, conversationHistory }),
    })
  }

  /**
   * Detect risk signals for a customer
   */
  async detectRiskSignals(customerId: string): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request(`/api/ai/risk/detect/${customerId}`, {
      method: "POST",
    })
  }

  // ==========================
  // Prospect Collection Endpoints
  // ==========================

  /**
   * Run prospect collection manually
   */
  async runProspectCollection(
    icpProfiles: Record<string, unknown>[],
    existingCompanyNames: string[],
  ): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request("/api/prospects/collect", {
      method: "POST",
      body: JSON.stringify({ icpProfiles, existingCompanyNames }),
    })
  }

  /**
   * Get prospect collection status
   */
  async getProspectStatus(): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request("/api/prospects/status")
  }

  /**
   * Stream prospect collection status updates (Server-Sent Events)
   */
  streamProspectStatus(
    onStatus: (status: Record<string, unknown>) => void,
    onError?: (error: Error) => void,
  ): EventSource {
    // Use relative URL for SSE to go through Vite proxy
    const url = "/api/prospects/status-stream"
    const eventSource = new EventSource(url)

    eventSource.onmessage = (event) => {
      try {
        const status = JSON.parse(event.data)
        onStatus(status)
      } catch (error) {
        console.error("Failed to parse status:", error)
      }
    }

    eventSource.onerror = (error) => {
      console.error("SSE connection error:", error)
      eventSource.close()
      if (onError) {
        onError(new Error("SSE connection failed"))
      }
    }

    return eventSource
  }

  // ==========================
  // Settings / Slack Endpoints
  // ==========================

  /**
   * Validate Slack Webhook URL
   */
  async validateSlackWebhook(webhookUrl: string): Promise<ApiResponse<{ valid: boolean }>> {
    return this.request("/api/settings/slack/validate", {
      method: "POST",
      body: JSON.stringify({ webhookUrl }),
    })
  }

  /**
   * Send test message to Slack
   */
  async sendSlackTestMessage(webhookUrl: string): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request("/api/settings/slack/test", {
      method: "POST",
      body: JSON.stringify({ webhookUrl }),
    })
  }

  /**
   * Send notification to Slack
   */
  async sendSlackNotification(
    webhookUrl: string,
    type: "new_prospect" | "followup_reminder" | "deal_won" | "deal_lost",
    data: Record<string, unknown>,
  ): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request("/api/settings/slack/notify", {
      method: "POST",
      body: JSON.stringify({ webhookUrl, type, data }),
    })
  }

  // ==========================
  // Customer Endpoints (Database-backed)
  // ==========================

  async getCustomers(
    options: {
      status?: string
      industry?: string
      search?: string
      limit?: number
      offset?: number
    } = {},
  ): Promise<ApiListResponse<ApiCustomer>> {
    const params = new URLSearchParams()
    if (options.status) params.append("status", options.status)
    if (options.industry) params.append("industry", options.industry)
    if (options.search) params.append("search", options.search)
    if (options.limit) params.append("limit", options.limit.toString())
    if (options.offset) params.append("offset", options.offset.toString())
    return this.request(`/api/customers?${params.toString()}`)
  }

  async getCustomer(id: string): Promise<ApiResponse<ApiCustomer>> {
    return this.request(`/api/customers/${id}`)
  }

  async createCustomer(data: {
    name: string
    website?: string
    industry?: string
    notes?: string
    status?: string
  }): Promise<ApiResponse<ApiCustomer>> {
    return this.request("/api/customers", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async updateCustomer(id: string, data: Partial<ApiCustomer>): Promise<ApiResponse<ApiCustomer>> {
    return this.request(`/api/customers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  }

  async deleteCustomer(id: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.request(`/api/customers/${id}`, {
      method: "DELETE",
    })
  }

  async updateCustomerStatus(
    id: string,
    status: string,
    lostReason?: string,
  ): Promise<ApiResponse<ApiCustomer>> {
    return this.request(`/api/customers/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status, lostReason }),
    })
  }

  async saveCustomerEnrichment(
    customerId: string,
    enrichment: Record<string, unknown>,
  ): Promise<ApiResponse<ApiCustomer>> {
    return this.request(`/api/customers/${customerId}/enrichment`, {
      method: "POST",
      body: JSON.stringify(enrichment),
    })
  }

  async getCustomerProposals(customerId: string): Promise<ApiListResponse<ApiProposal>> {
    return this.request(`/api/customers/${customerId}/proposals`)
  }

  async createCustomerProposal(
    customerId: string,
    proposal: { title?: string; content: string; imageUrl?: string },
  ): Promise<ApiResponse<ApiProposal>> {
    return this.request(`/api/customers/${customerId}/proposals`, {
      method: "POST",
      body: JSON.stringify(proposal),
    })
  }

  async getCustomerFollowUps(
    customerId: string,
  ): Promise<ApiListResponse<Record<string, unknown>>> {
    return this.request(`/api/customers/${customerId}/follow-ups`)
  }

  async createCustomerFollowUp(
    customerId: string,
    followUp: {
      type: string
      content?: string
      scheduledFor?: string
      priority?: string
      reason?: string
    },
  ): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request(`/api/customers/${customerId}/follow-ups`, {
      method: "POST",
      body: JSON.stringify(followUp),
    })
  }

  async getCustomerStats(): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request("/api/customers/stats")
  }

  // ==========================
  // Contact Endpoints
  // ==========================

  async getContacts(customerId: string): Promise<ApiListResponse<ApiCustomerContact>> {
    return this.request(`/api/customers/${customerId}/contacts`)
  }

  async getContact(
    customerId: string,
    contactId: string,
  ): Promise<ApiResponse<ApiCustomerContact>> {
    return this.request(`/api/customers/${customerId}/contacts/${contactId}`)
  }

  async createContact(
    customerId: string,
    contact: {
      name: string
      title?: string
      email?: string
      phone?: string
      isPrimary?: boolean
      source?: string
    },
  ): Promise<ApiResponse<ApiCustomerContact>> {
    return this.request(`/api/customers/${customerId}/contacts`, {
      method: "POST",
      body: JSON.stringify(contact),
    })
  }

  async updateContact(
    customerId: string,
    contactId: string,
    contact: { name?: string; title?: string; email?: string; phone?: string; isPrimary?: boolean },
  ): Promise<ApiResponse<ApiCustomerContact>> {
    return this.request(`/api/customers/${customerId}/contacts/${contactId}`, {
      method: "PUT",
      body: JSON.stringify(contact),
    })
  }

  async deleteContact(
    customerId: string,
    contactId: string,
  ): Promise<ApiResponse<{ success: boolean }>> {
    return this.request(`/api/customers/${customerId}/contacts/${contactId}`, {
      method: "DELETE",
    })
  }

  // ==========================
  // Meeting Endpoints (Global)
  // ==========================

  async getMeetings(
    options: { limit?: number; offset?: number } = {},
  ): Promise<ApiListResponse<ApiMeetingSummary>> {
    const params = new URLSearchParams()
    if (options.limit) params.append("limit", options.limit.toString())
    if (options.offset) params.append("offset", options.offset.toString())
    return this.request(`/api/meetings?${params.toString()}`)
  }

  async getMeeting(meetingId: string): Promise<ApiResponse<ApiMeetingSummary>> {
    return this.request(`/api/meetings/${meetingId}`)
  }

  async createMeeting(meeting: {
    customerId: string
    title: string
    meetingDate?: string
    summary?: string
    keyDiscussions?: string[]
    actionItems?: string[]
    customerNeeds?: string[]
    budgetMentions?: string
    timelineMentions?: string
    nextSteps?: string[]
    transcription?: string
  }): Promise<ApiResponse<ApiMeetingSummary>> {
    return this.request(`/api/meetings`, {
      method: "POST",
      body: JSON.stringify(meeting),
    })
  }

  async updateMeeting(
    meetingId: string,
    meeting: Partial<ApiMeetingSummary>,
  ): Promise<ApiResponse<ApiMeetingSummary>> {
    return this.request(`/api/meetings/${meetingId}`, {
      method: "PUT",
      body: JSON.stringify(meeting),
    })
  }

  async deleteMeeting(meetingId: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.request(`/api/meetings/${meetingId}`, {
      method: "DELETE",
    })
  }

  // ==========================
  // Meeting Endpoints (Per-Customer)
  // ==========================

  async getCustomerMeetings(
    customerId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<ApiListResponse<ApiMeetingSummary>> {
    const params = new URLSearchParams()
    if (options.limit) params.append("limit", options.limit.toString())
    if (options.offset) params.append("offset", options.offset.toString())
    return this.request(`/api/customers/${customerId}/meetings?${params.toString()}`)
  }

  async getCustomerMeeting(
    customerId: string,
    meetingId: string,
  ): Promise<ApiResponse<ApiMeetingSummary>> {
    return this.request(`/api/customers/${customerId}/meetings/${meetingId}`)
  }

  async createCustomerMeeting(
    customerId: string,
    meeting: {
      title: string
      meetingDate?: string
      summary?: string
      keyDiscussions?: string[]
      actionItems?: string[]
      customerNeeds?: string[]
      budgetMentions?: string
      timelineMentions?: string
      nextSteps?: string[]
      transcription?: string
    },
  ): Promise<ApiResponse<ApiMeetingSummary>> {
    return this.request(`/api/customers/${customerId}/meetings`, {
      method: "POST",
      body: JSON.stringify(meeting),
    })
  }

  async updateCustomerMeeting(
    customerId: string,
    meetingId: string,
    meeting: Partial<ApiMeetingSummary>,
  ): Promise<ApiResponse<ApiMeetingSummary>> {
    return this.request(`/api/customers/${customerId}/meetings/${meetingId}`, {
      method: "PUT",
      body: JSON.stringify(meeting),
    })
  }

  async deleteCustomerMeeting(
    customerId: string,
    meetingId: string,
  ): Promise<ApiResponse<{ success: boolean }>> {
    return this.request(`/api/customers/${customerId}/meetings/${meetingId}`, {
      method: "DELETE",
    })
  }

  async getMeetingActionItems(
    customerId: string,
    limit?: number,
  ): Promise<ApiListResponse<Record<string, unknown>>> {
    const params = new URLSearchParams()
    if (limit) params.append("limit", limit.toString())
    return this.request(`/api/customers/${customerId}/meetings/action-items?${params.toString()}`)
  }

  // ==========================
  // Lead/Prospect Endpoints (Database-backed)
  // ==========================

  async getLeads(
    options: {
      signalStrength?: string
      industry?: string
      search?: string
      converted?: boolean
      limit?: number
      offset?: number
    } = {},
  ): Promise<ApiListResponse<ApiProspect>> {
    const params = new URLSearchParams()
    if (options.signalStrength) params.append("signalStrength", options.signalStrength)
    if (options.industry) params.append("industry", options.industry)
    if (options.search) params.append("search", options.search)
    if (options.converted !== undefined) params.append("converted", options.converted.toString())
    if (options.limit) params.append("limit", options.limit.toString())
    if (options.offset) params.append("offset", options.offset.toString())
    return this.request(`/api/leads?${params.toString()}`)
  }

  async getLead(id: string): Promise<ApiResponse<ApiProspect>> {
    return this.request(`/api/leads/${id}`)
  }

  async createLead(
    data: Omit<
      ApiProspect,
      "id" | "createdAt" | "convertedToCustomerId" | "dismissed" | "dismissedAt" | "dismissReason"
    > & { sourceArticle?: Record<string, unknown> },
  ): Promise<ApiResponse<ApiProspect>> {
    return this.request("/api/leads", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async createLeadsBulk(
    prospects: Array<
      Omit<
        ApiProspect,
        "id" | "createdAt" | "convertedToCustomerId" | "dismissed" | "dismissedAt" | "dismissReason"
      >
    >,
  ): Promise<ApiResponse<{ created: number }>> {
    return this.request("/api/leads/bulk", {
      method: "POST",
      body: JSON.stringify({ prospects }),
    })
  }

  async updateLead(id: string, data: Partial<ApiProspect>): Promise<ApiResponse<ApiProspect>> {
    return this.request(`/api/leads/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  }

  async deleteLead(id: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.request(`/api/leads/${id}`, {
      method: "DELETE",
    })
  }

  async convertLeadToCustomer(
    leadId: string,
    options: { status?: string; notes?: string } = {},
  ): Promise<ApiResponse<{ customer: ApiCustomer; prospect: ApiProspect }>> {
    return this.request(`/api/leads/${leadId}/convert`, {
      method: "POST",
      body: JSON.stringify(options),
    })
  }

  async dismissProspect(prospectId: string, reason: string): Promise<ApiResponse<ApiProspect>> {
    return this.request(`/api/leads/${prospectId}/dismiss`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    })
  }

  async getLeadStats(): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request("/api/leads/stats")
  }

  // ==========================
  // ICP Profile Endpoints
  // ==========================

  async getICPProfiles(): Promise<ApiListResponse<Record<string, unknown>>> {
    return this.request("/api/icp-profiles")
  }

  async getICPProfile(id: string): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request(`/api/icp-profiles/${id}`)
  }

  async createICPProfile(data: {
    name: string
    industries?: string[]
    keywords?: string[]
    companySize?: string
    targetRegions?: string[]
  }): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request("/api/icp-profiles", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async updateICPProfile(
    id: string,
    data: Record<string, unknown>,
  ): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request(`/api/icp-profiles/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  }

  async deleteICPProfile(id: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.request(`/api/icp-profiles/${id}`, {
      method: "DELETE",
    })
  }

  // ==========================
  // Notifications Endpoints
  // ==========================

  async getNotifications(
    options: { type?: string; read?: boolean; limit?: number; offset?: number } = {},
  ): Promise<ApiListResponse<Record<string, unknown>>> {
    const params = new URLSearchParams()
    if (options.type) params.append("type", options.type)
    if (options.read !== undefined) params.append("read", options.read.toString())
    if (options.limit) params.append("limit", options.limit.toString())
    if (options.offset) params.append("offset", options.offset.toString())
    return this.request(`/api/notifications?${params.toString()}`)
  }

  async markNotificationRead(id: string): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request(`/api/notifications/${id}/read`, {
      method: "PUT",
    })
  }

  async markAllNotificationsRead(): Promise<ApiResponse<{ success: boolean }>> {
    return this.request("/api/notifications/read-all", {
      method: "PUT",
    })
  }

  async deleteNotification(id: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.request(`/api/notifications/${id}`, {
      method: "DELETE",
    })
  }

  // ==========================
  // Migration Endpoints
  // ==========================

  async migrateFromLocalStorage(data: {
    customers?: Record<string, unknown>[]
    prospects?: Record<string, unknown>[]
    icpProfiles?: Record<string, unknown>[]
    settings?: Record<string, unknown>
  }): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request("/api/migrate/localstorage", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async getMigrationStatus(): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request("/api/migrate/status")
  }

  async exportData(): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request("/api/migrate/export")
  }

  // ==========================
  // Slack Event API Endpoints
  // ==========================

  async getSlackStatus(): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request("/api/slack/status")
  }

  async getSlackMessages(
    options: { channelId?: string; limit?: number; offset?: number } = {},
  ): Promise<ApiListResponse<Record<string, unknown>>> {
    const params = new URLSearchParams()
    if (options.channelId) params.append("channelId", options.channelId)
    if (options.limit) params.append("limit", options.limit.toString())
    if (options.offset) params.append("offset", options.offset.toString())
    return this.request(`/api/slack/messages?${params.toString()}`)
  }

  async getSlackMessagesForCustomer(
    customerId: string,
  ): Promise<ApiListResponse<Record<string, unknown>>> {
    return this.request(`/api/slack/messages/customer/${customerId}`)
  }

  async toggleSlackEventApi(enabled: boolean): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request("/api/slack/event-api/toggle", {
      method: "POST",
      body: JSON.stringify({ enabled }),
    })
  }

  async reprocessSlackMessages(limit?: number): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request("/api/slack/reprocess", {
      method: "POST",
      body: JSON.stringify({ limit }),
    })
  }

  // ==========================
  // Gmail OAuth Endpoints
  // ==========================

  async getGmailAuthUrl(): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request("/api/gmail/oauth/authorize")
  }

  async disconnectGmail(): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request("/api/gmail/disconnect", {
      method: "POST",
    })
  }

  async getGmailStatus(): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request("/api/gmail/status")
  }

  async syncGmailEmails(
    options: { maxResults?: number; afterDate?: string } = {},
  ): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request("/api/gmail/sync", {
      method: "POST",
      body: JSON.stringify(options),
    })
  }

  async getGmailMessages(
    options: { customerId?: string; search?: string; limit?: number; offset?: number } = {},
  ): Promise<ApiListResponse<Record<string, unknown>>> {
    const params = new URLSearchParams()
    if (options.customerId) params.append("customerId", options.customerId)
    if (options.search) params.append("search", options.search)
    if (options.limit) params.append("limit", options.limit.toString())
    if (options.offset) params.append("offset", options.offset.toString())
    return this.request(`/api/gmail/messages?${params.toString()}`)
  }

  async getGmailMessagesForCustomer(
    customerId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<ApiListResponse<Record<string, unknown>>> {
    const params = new URLSearchParams()
    if (options.limit) params.append("limit", options.limit.toString())
    if (options.offset) params.append("offset", options.offset.toString())
    return this.request(`/api/gmail/messages/customer/${customerId}?${params.toString()}`)
  }

  async getUnmatchedGmailMessages(
    limit?: number,
  ): Promise<ApiListResponse<Record<string, unknown>>> {
    const params = new URLSearchParams()
    if (limit) params.append("limit", limit.toString())
    return this.request(`/api/gmail/messages/unmatched?${params.toString()}`)
  }

  async updateGmailMessageCustomer(
    emailId: string,
    customerId: string,
  ): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request(`/api/gmail/messages/${emailId}/customer`, {
      method: "PUT",
      body: JSON.stringify({ customerId }),
    })
  }

  async updateGmailSettings(settings: {
    autoSync?: boolean
    syncInterval?: number
  }): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request("/api/gmail/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    })
  }

  // ==========================
  // Google Calendar OAuth Endpoints
  // ==========================

  async getCalendarAuthUrl(): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request("/api/calendar/oauth/authorize")
  }

  async disconnectCalendar(): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request("/api/calendar/disconnect", {
      method: "POST",
    })
  }

  async getCalendarStatus(): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request("/api/calendar/status")
  }

  async getCalendarEvents(
    options: { maxResults?: number; timeMin?: string; timeMax?: string } = {},
  ): Promise<ApiListResponse<Record<string, unknown>>> {
    const params = new URLSearchParams()
    if (options.maxResults) params.append("maxResults", options.maxResults.toString())
    if (options.timeMin) params.append("timeMin", options.timeMin)
    if (options.timeMax) params.append("timeMax", options.timeMax)
    return this.request(`/api/calendar/events?${params.toString()}`)
  }

  async getTodayCalendarEvents(): Promise<ApiListResponse<Record<string, unknown>>> {
    return this.request("/api/calendar/events/today")
  }

  async getUpcomingCalendarMeetings(): Promise<ApiListResponse<Record<string, unknown>>> {
    return this.request("/api/calendar/events/upcoming")
  }

  async getCalendarEvent(eventId: string): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request(`/api/calendar/events/${eventId}`)
  }

  // ==========================
  // Mixpanel Integration Endpoints
  // ==========================

  async getMixpanelStatus(): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request("/api/mixpanel/status")
  }

  async getMixpanelSettings(): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request("/api/mixpanel/settings")
  }

  async updateMixpanelSettings(
    settings: Record<string, unknown>,
  ): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request("/api/mixpanel/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    })
  }

  async getMixpanelEvents(
    options: { limit?: number; offset?: number; processed?: boolean } = {},
  ): Promise<ApiListResponse<Record<string, unknown>>> {
    const params = new URLSearchParams()
    if (options.limit) params.append("limit", options.limit.toString())
    if (options.offset) params.append("offset", options.offset.toString())
    if (options.processed !== undefined) params.append("processed", options.processed.toString())
    return this.request(`/api/mixpanel/events?${params.toString()}`)
  }

  async reprocessMixpanelEvents(): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request("/api/mixpanel/reprocess", {
      method: "POST",
    })
  }

  // ==========================
  // Workspace Endpoints (Phase 0)
  // ==========================

  async listWorkspaces(): Promise<ApiListResponse<ApiWorkspaceWithRole>> {
    return this.request("/api/workspaces")
  }

  async getCurrentWorkspace(): Promise<ApiResponse<ApiWorkspace & { role: string }>> {
    return this.request("/api/workspaces/current")
  }

  async createWorkspace(data: {
    organizationName: string
    workspaceName?: string
    baseCurrency?: string
    locale?: string
    timezone?: string
    pipelineTemplate?: "b2b-saas" | "agency" | "ecommerce"
  }): Promise<
    ApiResponse<{ organization: unknown; workspace: ApiWorkspace; membership: unknown }>
  > {
    return this.request("/api/workspaces", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  // ==========================
  // Pipeline Endpoints (Phase 1)
  // ==========================

  async listPipelines(): Promise<ApiListResponse<ApiPipeline>> {
    return this.request("/api/pipelines")
  }

  async getPipeline(id: string): Promise<ApiResponse<ApiPipeline>> {
    return this.request(`/api/pipelines/${id}`)
  }

  async createPipeline(data: {
    name: string
    description?: string
    isDefault?: boolean
    displayOrder?: number
  }): Promise<ApiResponse<ApiPipeline>> {
    return this.request("/api/pipelines", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async createPipelineStage(
    pipelineId: string,
    data: {
      name: string
      stageType?: "open" | "won" | "lost"
      displayOrder?: number
      defaultProbability?: string
      color?: string
      rottingDays?: number
    },
  ): Promise<ApiResponse<ApiPipelineStage>> {
    return this.request(`/api/pipelines/${pipelineId}/stages`, {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async updatePipelineStage(
    pipelineId: string,
    stageId: string,
    patch: {
      name?: string
      displayOrder?: number
      defaultProbability?: string
      color?: string
      rottingDays?: number
    },
  ): Promise<ApiResponse<ApiPipelineStage>> {
    return this.request(`/api/pipelines/${pipelineId}/stages/${stageId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    })
  }

  async archivePipelineStage(
    pipelineId: string,
    stageId: string,
  ): Promise<ApiResponse<{ archived: boolean }>> {
    return this.request(`/api/pipelines/${pipelineId}/stages/${stageId}`, {
      method: "DELETE",
    })
  }

  // ==========================
  // Deal Endpoints (Phase 1)
  // ==========================

  async listDeals(
    options: {
      pipelineId?: string
      stageId?: string
      ownerId?: string
      customerId?: string
      forecastCategory?: ForecastCategory
      search?: string
      includeClosed?: boolean
      limit?: number
      offset?: number
      orderBy?: "created" | "updated" | "expected_close" | "amount" | "stage_entered"
      order?: "asc" | "desc"
    } = {},
  ): Promise<ApiListResponse<ApiDealCard>> {
    const params = new URLSearchParams()
    if (options.pipelineId) params.append("pipelineId", options.pipelineId)
    if (options.stageId) params.append("stageId", options.stageId)
    if (options.ownerId) params.append("ownerId", options.ownerId)
    if (options.customerId) params.append("customerId", options.customerId)
    if (options.forecastCategory) params.append("forecastCategory", options.forecastCategory)
    if (options.search) params.append("search", options.search)
    if (options.includeClosed) params.append("includeClosed", "true")
    if (options.limit) params.append("limit", options.limit.toString())
    if (options.offset) params.append("offset", options.offset.toString())
    if (options.orderBy) params.append("orderBy", options.orderBy)
    if (options.order) params.append("order", options.order)
    const qs = params.toString()
    return this.request(`/api/deals${qs ? `?${qs}` : ""}`)
  }

  async getDeal(id: string): Promise<ApiResponse<ApiDealWithHistory>> {
    return this.request(`/api/deals/${id}`)
  }

  async createDeal(data: {
    pipelineId: string
    stageId: string
    title: string
    description?: string
    customerId?: string
    ownerId?: string
    /** Pre-computed amount in minor units (e.g. cents). Use this for precise migrations. */
    amountMinor?: string
    /** Human-typed amount in major units (e.g. "1,234.56"). Server resolves to minor. */
    amount?: string
    currency?: string
    probability?: string
    forecastCategory?: ForecastCategory
    expectedCloseDate?: string
    source?: string
    externalId?: string
    customFields?: Record<string, unknown>
  }): Promise<ApiResponse<ApiDeal>> {
    return this.request("/api/deals", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async updateDeal(
    id: string,
    patch: {
      title?: string
      description?: string
      customerId?: string
      ownerId?: string
      amountMinor?: string
      amount?: string
      currency?: string
      probability?: string
      forecastCategory?: ForecastCategory
      expectedCloseDate?: string
      source?: string
      customFields?: Record<string, unknown>
    },
  ): Promise<ApiResponse<ApiDeal>> {
    return this.request(`/api/deals/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    })
  }

  async moveDealStage(id: string, stageId: string, note?: string): Promise<ApiResponse<ApiDeal>> {
    return this.request(`/api/deals/${id}/move`, {
      method: "POST",
      body: JSON.stringify({ stageId, note }),
    })
  }

  async deleteDeal(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
    return this.request(`/api/deals/${id}`, {
      method: "DELETE",
    })
  }
}

// Export singleton instance
export const apiClient = new APIClient(API_BASE_URL)
