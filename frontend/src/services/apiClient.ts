/**
 * API Client for Backend Communication
 * Handles all HTTP requests to the backend API
 */

// Use relative URL to leverage Vite's proxy (avoids CORS issues)
// The proxy in vite.config.ts will forward /api/* requests to the backend
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Health check response type
export interface HealthCheckResponse {
  status: string;
  timestamp: number;
  version: string;
  database: string;
}

class APIClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  /**
   * Check server health status
   */
  async checkHealth(): Promise<HealthCheckResponse | null> {
    try {
      const response = await fetch(`${this.baseURL}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      // Validate the response has the expected structure
      if (data.status === 'ok' && data.database === 'connected') {
        return data as HealthCheckResponse;
      }

      return null;
    } catch (error) {
      console.error('Health check failed:', error);
      return null;
    }
  }

  /**
   * Generic request method with error handling
   */
  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          error: 'Unknown error',
          code: 'UNKNOWN_ERROR'
        }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // ==========================
  // AI Assistant Endpoints
  // ==========================

  /**
   * Parse user intent from natural language message
   */
  async parseIntent(message: string, customers: any[]) {
    return this.request('/api/ai/parse-intent', {
      method: 'POST',
      body: JSON.stringify({ message, customers }),
    });
  }

  /**
   * Enrich customer data using AI and Google Search
   */
  async enrichCustomer(companyName: string, website: string) {
    return this.request('/api/ai/enrich', {
      method: 'POST',
      body: JSON.stringify({ companyName, website }),
    });
  }

  /**
   * Generate proposal for a customer
   */
  async generateProposal(customerName: string, enrichedData: any, userNotes: string, imageSize: string = '1K') {
    return this.request('/api/ai/generate-proposal', {
      method: 'POST',
      body: JSON.stringify({ customerName, enrichedData, userNotes, imageSize }),
    });
  }

  /**
   * Generate AI assistant response
   */
  async generateResponse(message: string, context?: string, conversationHistory?: any[]) {
    return this.request('/api/ai/generate-response', {
      method: 'POST',
      body: JSON.stringify({ message, context, conversationHistory }),
    });
  }

  /**
   * Scan business card image and extract contact information
   */
  async scanBusinessCard(image: string, customerId?: string, createCustomer?: boolean) {
    return this.request('/api/ai/scan-business-card', {
      method: 'POST',
      body: JSON.stringify({ image, customerId, createCustomer }),
    });
  }

  /**
   * Summarize meeting audio or transcription
   */
  async summarizeMeeting(data: { audioData?: string; transcription?: string; customerId: string; title: string; meetingDate?: number }) {
    return this.request('/api/ai/summarize-meeting', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Generate follow-up strategy for a customer
   */
  async generateFollowUpStrategy(customerId: string, isLostDeal: boolean = false) {
    return this.request(`/api/ai/followup/strategy/${customerId}`, {
      method: 'POST',
      body: JSON.stringify({ isLostDeal }),
    });
  }

  /**
   * Generate follow-up message for a customer
   */
  async generateFollowUpMessage(
    customerId: string,
    strategy: { approach: string; messageTone: string; keyPoints: string[] },
    isLostDeal: boolean = false
  ) {
    return this.request(`/api/ai/followup/message/${customerId}`, {
      method: 'POST',
      body: JSON.stringify({ strategy, isLostDeal }),
    });
  }

  /**
   * Calculate optimal follow-up timing for a customer
   */
  async calculateFollowUpTiming(customerId: string) {
    return this.request(`/api/ai/followup/timing/${customerId}`, {
      method: 'POST',
    });
  }

  /**
   * Determine optimal follow-up type (channel) for a customer
   */
  async determineFollowUpType(customerId: string) {
    return this.request(`/api/ai/followup/type/${customerId}`, {
      method: 'POST',
    });
  }

  /**
   * Parse user intent for AI assistant
   */
  async parseAssistantIntent(message: string, customers: { id: string; name: string }[]) {
    return this.request('/api/ai/assistant/parse-intent', {
      method: 'POST',
      body: JSON.stringify({ message, customers }),
    });
  }

  /**
   * Generate AI assistant response
   */
  async generateAssistantResponse(
    message: string,
    context?: string,
    conversationHistory?: Array<{ role: string; content: string }>
  ) {
    return this.request('/api/ai/assistant/response', {
      method: 'POST',
      body: JSON.stringify({ message, context, conversationHistory }),
    });
  }

  /**
   * Detect risk signals for a customer
   */
  async detectRiskSignals(customerId: string) {
    return this.request(`/api/ai/risk/detect/${customerId}`, {
      method: 'POST',
    });
  }

  // ==========================
  // Prospect Collection Endpoints
  // ==========================

  /**
   * Run prospect collection manually
   */
  async runProspectCollection(icpProfiles: any[], existingCompanyNames: string[]) {
    return this.request('/api/prospects/collect', {
      method: 'POST',
      body: JSON.stringify({ icpProfiles, existingCompanyNames }),
    });
  }

  /**
   * Get prospect collection status
   */
  async getProspectStatus() {
    return this.request('/api/prospects/status');
  }

  /**
   * Stream prospect collection status updates (Server-Sent Events)
   */
  streamProspectStatus(onStatus: (status: any) => void, onError?: (error: Error) => void) {
    // Use relative URL for SSE to go through Vite proxy
    const url = '/api/prospects/status-stream';
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const status = JSON.parse(event.data);
        onStatus(status);
      } catch (error: any) {
        console.error('Failed to parse status:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      eventSource.close();
      if (onError) {
        onError(new Error('SSE connection failed'));
      }
    };

    return eventSource;
  }

  // ==========================
  // Settings / Slack Endpoints
  // ==========================

  /**
   * Validate Slack Webhook URL
   */
  async validateSlackWebhook(webhookUrl: string): Promise<{ success: boolean; valid: boolean; error?: string }> {
    return this.request('/api/settings/slack/validate', {
      method: 'POST',
      body: JSON.stringify({ webhookUrl }),
    });
  }

  /**
   * Send test message to Slack
   */
  async sendSlackTestMessage(webhookUrl: string): Promise<{ success: boolean; message?: string; error?: string }> {
    return this.request('/api/settings/slack/test', {
      method: 'POST',
      body: JSON.stringify({ webhookUrl }),
    });
  }

  /**
   * Send notification to Slack
   */
  async sendSlackNotification(
    webhookUrl: string,
    type: 'new_prospect' | 'followup_reminder' | 'deal_won' | 'deal_lost',
    data: any
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    return this.request('/api/settings/slack/notify', {
      method: 'POST',
      body: JSON.stringify({ webhookUrl, type, data }),
    });
  }

  // ==========================
  // Customer Endpoints (Database-backed)
  // ==========================

  async getCustomers(options: { status?: string; industry?: string; search?: string; limit?: number; offset?: number } = {}) {
    const params = new URLSearchParams();
    if (options.status) params.append('status', options.status);
    if (options.industry) params.append('industry', options.industry);
    if (options.search) params.append('search', options.search);
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());
    return this.request(`/api/customers?${params.toString()}`);
  }

  async getCustomer(id: string) {
    return this.request(`/api/customers/${id}`);
  }

  async createCustomer(data: { name: string; website?: string; industry?: string; notes?: string; status?: string }) {
    return this.request('/api/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCustomer(id: string, data: any) {
    return this.request(`/api/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCustomer(id: string) {
    return this.request(`/api/customers/${id}`, {
      method: 'DELETE',
    });
  }

  async updateCustomerStatus(id: string, status: string, lostReason?: string) {
    return this.request(`/api/customers/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, lostReason }),
    });
  }

  async saveCustomerEnrichment(customerId: string, enrichment: any) {
    return this.request(`/api/customers/${customerId}/enrichment`, {
      method: 'POST',
      body: JSON.stringify(enrichment),
    });
  }

  async getCustomerProposals(customerId: string) {
    return this.request(`/api/customers/${customerId}/proposals`);
  }

  async createCustomerProposal(customerId: string, proposal: { title?: string; content: string; imageUrl?: string }) {
    return this.request(`/api/customers/${customerId}/proposals`, {
      method: 'POST',
      body: JSON.stringify(proposal),
    });
  }

  async getCustomerFollowUps(customerId: string) {
    return this.request(`/api/customers/${customerId}/follow-ups`);
  }

  async createCustomerFollowUp(customerId: string, followUp: { type: string; content?: string; scheduledFor?: number; priority?: string; reason?: string }) {
    return this.request(`/api/customers/${customerId}/follow-ups`, {
      method: 'POST',
      body: JSON.stringify(followUp),
    });
  }

  async getCustomerStats() {
    return this.request('/api/customers/stats');
  }

  // ==========================
  // Contact Endpoints
  // ==========================

  async getContacts(customerId: string) {
    return this.request(`/api/customers/${customerId}/contacts`);
  }

  async getContact(customerId: string, contactId: string) {
    return this.request(`/api/customers/${customerId}/contacts/${contactId}`);
  }

  async createContact(customerId: string, contact: { name: string; title?: string; email?: string; phone?: string; isPrimary?: boolean; source?: string }) {
    return this.request(`/api/customers/${customerId}/contacts`, {
      method: 'POST',
      body: JSON.stringify(contact),
    });
  }

  async updateContact(customerId: string, contactId: string, contact: { name?: string; title?: string; email?: string; phone?: string; isPrimary?: boolean }) {
    return this.request(`/api/customers/${customerId}/contacts/${contactId}`, {
      method: 'PUT',
      body: JSON.stringify(contact),
    });
  }

  async deleteContact(customerId: string, contactId: string) {
    return this.request(`/api/customers/${customerId}/contacts/${contactId}`, {
      method: 'DELETE',
    });
  }

  // ==========================
  // Meeting Endpoints
  // ==========================

  async getMeetings(customerId: string, options: { limit?: number; offset?: number } = {}) {
    const params = new URLSearchParams();
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());
    return this.request(`/api/customers/${customerId}/meetings?${params.toString()}`);
  }

  async getMeeting(customerId: string, meetingId: string) {
    return this.request(`/api/customers/${customerId}/meetings/${meetingId}`);
  }

  async createMeeting(customerId: string, meeting: { title: string; meetingDate?: number; summary?: string; keyDiscussions?: string[]; actionItems?: string[]; customerNeeds?: string[]; budgetMentions?: string; timelineMentions?: string; nextSteps?: string[]; transcription?: string }) {
    return this.request(`/api/customers/${customerId}/meetings`, {
      method: 'POST',
      body: JSON.stringify(meeting),
    });
  }

  async updateMeeting(customerId: string, meetingId: string, meeting: any) {
    return this.request(`/api/customers/${customerId}/meetings/${meetingId}`, {
      method: 'PUT',
      body: JSON.stringify(meeting),
    });
  }

  async deleteMeeting(customerId: string, meetingId: string) {
    return this.request(`/api/customers/${customerId}/meetings/${meetingId}`, {
      method: 'DELETE',
    });
  }

  async getMeetingActionItems(customerId: string, limit?: number) {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    return this.request(`/api/customers/${customerId}/meetings/action-items?${params.toString()}`);
  }

  // ==========================
  // Lead/Prospect Endpoints (Database-backed)
  // ==========================

  async getLeads(options: { signalStrength?: string; industry?: string; search?: string; converted?: boolean; limit?: number; offset?: number } = {}) {
    const params = new URLSearchParams();
    if (options.signalStrength) params.append('signalStrength', options.signalStrength);
    if (options.industry) params.append('industry', options.industry);
    if (options.search) params.append('search', options.search);
    if (options.converted !== undefined) params.append('converted', options.converted.toString());
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());
    return this.request(`/api/leads?${params.toString()}`);
  }

  async getLead(id: string) {
    return this.request(`/api/leads/${id}`);
  }

  async createLead(data: { companyName: string; website?: string; industry?: string; sourceArticle?: any; signalStrength?: string; notes?: string }) {
    return this.request('/api/leads', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createLeadsBulk(prospects: any[]) {
    return this.request('/api/leads/bulk', {
      method: 'POST',
      body: JSON.stringify({ prospects }),
    });
  }

  async updateLead(id: string, data: any) {
    return this.request(`/api/leads/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteLead(id: string) {
    return this.request(`/api/leads/${id}`, {
      method: 'DELETE',
    });
  }

  async convertLeadToCustomer(leadId: string, options: { status?: string; notes?: string } = {}) {
    return this.request(`/api/leads/${leadId}/convert`, {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  async getLeadStats() {
    return this.request('/api/leads/stats');
  }

  // ==========================
  // ICP Profile Endpoints
  // ==========================

  async getICPProfiles() {
    return this.request('/api/icp-profiles');
  }

  async getICPProfile(id: string) {
    return this.request(`/api/icp-profiles/${id}`);
  }

  async createICPProfile(data: { name: string; industries?: string[]; keywords?: string[]; companySize?: string; targetRegions?: string[] }) {
    return this.request('/api/icp-profiles', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateICPProfile(id: string, data: any) {
    return this.request(`/api/icp-profiles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteICPProfile(id: string) {
    return this.request(`/api/icp-profiles/${id}`, {
      method: 'DELETE',
    });
  }

  // ==========================
  // Notifications Endpoints
  // ==========================

  async getNotifications(options: { type?: string; read?: boolean; limit?: number; offset?: number } = {}) {
    const params = new URLSearchParams();
    if (options.type) params.append('type', options.type);
    if (options.read !== undefined) params.append('read', options.read.toString());
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());
    return this.request(`/api/notifications?${params.toString()}`);
  }

  async markNotificationRead(id: string) {
    return this.request(`/api/notifications/${id}/read`, {
      method: 'PUT',
    });
  }

  async markAllNotificationsRead() {
    return this.request('/api/notifications/read-all', {
      method: 'PUT',
    });
  }

  async deleteNotification(id: string) {
    return this.request(`/api/notifications/${id}`, {
      method: 'DELETE',
    });
  }

  // ==========================
  // Migration Endpoints
  // ==========================

  async migrateFromLocalStorage(data: { customers?: any[]; prospects?: any[]; icpProfiles?: any[]; settings?: any }) {
    return this.request('/api/migrate/localstorage', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getMigrationStatus() {
    return this.request('/api/migrate/status');
  }

  async exportData() {
    return this.request('/api/migrate/export');
  }

  // ==========================
  // Slack Event API Endpoints
  // ==========================

  async getSlackStatus() {
    return this.request('/api/slack/status');
  }

  async getSlackMessages(options: { channelId?: string; limit?: number; offset?: number } = {}) {
    const params = new URLSearchParams();
    if (options.channelId) params.append('channelId', options.channelId);
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());
    return this.request(`/api/slack/messages?${params.toString()}`);
  }

  async getSlackMessagesForCustomer(customerId: string) {
    return this.request(`/api/slack/messages/customer/${customerId}`);
  }

  async toggleSlackEventApi(enabled: boolean) {
    return this.request('/api/slack/event-api/toggle', {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    });
  }

  async reprocessSlackMessages(limit?: number) {
    return this.request('/api/slack/reprocess', {
      method: 'POST',
      body: JSON.stringify({ limit }),
    });
  }

  // ==========================
  // Gmail OAuth Endpoints
  // ==========================

  async getGmailAuthUrl() {
    return this.request('/api/gmail/oauth/authorize');
  }

  async disconnectGmail() {
    return this.request('/api/gmail/disconnect', {
      method: 'POST',
    });
  }

  async getGmailStatus() {
    return this.request('/api/gmail/status');
  }

  async syncGmailEmails(options: { maxResults?: number; afterDate?: number } = {}) {
    return this.request('/api/gmail/sync', {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  async getGmailMessages(options: { customerId?: string; search?: string; limit?: number; offset?: number } = {}) {
    const params = new URLSearchParams();
    if (options.customerId) params.append('customerId', options.customerId);
    if (options.search) params.append('search', options.search);
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());
    return this.request(`/api/gmail/messages?${params.toString()}`);
  }

  async getGmailMessagesForCustomer(customerId: string, options: { limit?: number; offset?: number } = {}) {
    const params = new URLSearchParams();
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());
    return this.request(`/api/gmail/messages/customer/${customerId}?${params.toString()}`);
  }

  async getUnmatchedGmailMessages(limit?: number) {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    return this.request(`/api/gmail/messages/unmatched?${params.toString()}`);
  }

  async updateGmailMessageCustomer(emailId: string, customerId: string) {
    return this.request(`/api/gmail/messages/${emailId}/customer`, {
      method: 'PUT',
      body: JSON.stringify({ customerId }),
    });
  }

  async updateGmailSettings(settings: { autoSync?: boolean; syncInterval?: number }) {
    return this.request('/api/gmail/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  // ==========================
  // Google Calendar OAuth Endpoints
  // ==========================

  async getCalendarAuthUrl() {
    return this.request('/api/calendar/oauth/authorize');
  }

  async disconnectCalendar() {
    return this.request('/api/calendar/disconnect', {
      method: 'POST',
    });
  }

  async getCalendarStatus() {
    return this.request('/api/calendar/status');
  }

  async getCalendarEvents(options: { maxResults?: number; timeMin?: string; timeMax?: string } = {}) {
    const params = new URLSearchParams();
    if (options.maxResults) params.append('maxResults', options.maxResults.toString());
    if (options.timeMin) params.append('timeMin', options.timeMin);
    if (options.timeMax) params.append('timeMax', options.timeMax);
    return this.request(`/api/calendar/events?${params.toString()}`);
  }

  async getTodayCalendarEvents() {
    return this.request('/api/calendar/events/today');
  }

  async getUpcomingCalendarMeetings() {
    return this.request('/api/calendar/events/upcoming');
  }

  async getCalendarEvent(eventId: string) {
    return this.request(`/api/calendar/events/${eventId}`);
  }

  // ==========================
  // Mixpanel Integration Endpoints
  // ==========================

  async getMixpanelStatus() {
    return this.request('/api/mixpanel/status');
  }

  async getMixpanelSettings() {
    return this.request('/api/mixpanel/settings');
  }

  async updateMixpanelSettings(settings: any) {
    return this.request('/api/mixpanel/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  async getMixpanelEvents(options: { limit?: number; offset?: number; processed?: boolean } = {}) {
    const params = new URLSearchParams();
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());
    if (options.processed !== undefined) params.append('processed', options.processed.toString());
    return this.request(`/api/mixpanel/events?${params.toString()}`);
  }

  async reprocessMixpanelEvents() {
    return this.request('/api/mixpanel/reprocess', {
      method: 'POST',
    });
  }
}

// Export singleton instance
export const apiClient = new APIClient(API_BASE_URL);
