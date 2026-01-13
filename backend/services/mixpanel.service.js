import { prospectRepository, customerRepository, notificationRepository, settingsRepository } from '../database/repositories/index.js';
import { geminiClient } from './geminiClient.js';
import { mixpanelApiClient } from './mixpanelApiClient.js';
import { logger } from '../utils/logger.js';

class MixpanelService {
  constructor() {
    this.defaultEvents = ['$signup', 'sign_up', 'user_signup', 'registration', 'account_created'];
  }

  /**
   * Get Mixpanel settings (non-sensitive config stored in DB)
   * Credentials are stored in environment variables, not here
   * @returns {Object} Mixpanel settings
   */
  getSettings() {
    return settingsRepository.get('mixpanel') || {
      isEnabled: false,
      trackedEvents: this.defaultEvents,
      autoCreateProspect: true,
      defaultSignalStrength: 'medium',
      enrichWithAI: true,
      syncInterval: 'hourly', // 'hourly' | 'every_4_hours' | 'daily'
      lastSyncAt: null
    };
  }

  /**
   * Update Mixpanel settings
   * @param {Object} updates - Settings updates
   * @returns {Object} Updated settings
   */
  updateSettings(updates) {
    // Filter out any credential fields (they should only be in env vars)
    const { projectToken, apiSecret, webhookSecret, projectId, projectSecret, serviceAccountUsername, serviceAccountSecret, ...safeUpdates } = updates;

    return settingsRepository.update('mixpanel', safeUpdates);
  }

  /**
   * Sync events from Mixpanel Raw Export API
   * This is the main sync method called by the scheduled job
   * @returns {Object} Sync result
   */
  async syncEvents() {
    const settings = this.getSettings();

    if (!settings.isEnabled) {
      logger.info('Mixpanel integration is disabled, skipping sync');
      return { synced: false, reason: 'integration_disabled' };
    }

    if (!mixpanelApiClient.hasCredentials()) {
      throw new Error('Mixpanel credentials not configured. Set MIXPANEL_PROJECT_ID and MIXPANEL_PROJECT_SECRET in environment variables.');
    }

    // Determine date range for sync
    const { fromDate, toDate } = this.buildDateRange(settings.lastSyncAt);

    logger.info(`Syncing Mixpanel events from ${fromDate} to ${toDate}`);

    try {
      // Fetch all events from Mixpanel
      const rawEvents = await mixpanelApiClient.fetchRawEvents({
        fromDate,
        toDate,
        limit: 10000
      });

      logger.info(`Fetched ${rawEvents.length} events from Mixpanel`);

      if (rawEvents.length === 0) {
        // Update lastSyncAt even if no events
        this.updateSettings({ lastSyncAt: new Date().toISOString() });
        return {
          synced: true,
          total: 0,
          processed: 0,
          created: 0,
          updated: 0,
          skipped: 0,
          errors: []
        };
      }

      // Filter by tracked events
      const trackedEvents = settings.trackedEvents || this.defaultEvents;
      const filteredEvents = rawEvents.filter(event => {
        const eventName = event.event || event.properties?.event;
        return trackedEvents.some(e => e.toLowerCase() === eventName?.toLowerCase());
      });

      logger.info(`Filtered to ${filteredEvents.length} tracked events`);

      // Process events (reuse existing logic)
      const result = await this.processBatchEvents(filteredEvents);

      // Update lastSyncAt timestamp
      this.updateSettings({ lastSyncAt: new Date().toISOString() });

      return {
        synced: true,
        fromDate,
        toDate,
        ...result
      };
    } catch (error) {
      logger.error('Mixpanel sync error:', error);
      throw error;
    }
  }

  /**
   * Build date range for sync
   * @param {string|null} lastSyncAt - ISO timestamp of last sync
   * @returns {Object} { fromDate, toDate } in YYYY-MM-DD format
   */
  buildDateRange(lastSyncAt) {
    const now = new Date();
    const toDate = now.toISOString().split('T')[0]; // YYYY-MM-DD

    let fromDate;
    if (lastSyncAt) {
      // Sync from last sync with 1 hour overlap to catch any delayed events
      const lastSync = new Date(lastSyncAt);
      lastSync.setHours(lastSync.getHours() - 1); // 1 hour overlap
      fromDate = lastSync.toISOString().split('T')[0];
    } else {
      // First sync: get last 7 days
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      fromDate = sevenDaysAgo.toISOString().split('T')[0];
    }

    return { fromDate, toDate };
  }

  /**
   * Process Mixpanel event (used by both sync and test)
   * @param {Object} eventData - Mixpanel event data
   * @returns {Object} Processing result
   */
  async processEvent(eventData) {
    const settings = this.getSettings();

    if (!settings.isEnabled) {
      logger.info('Mixpanel integration is disabled, skipping event');
      return { processed: false, reason: 'integration_disabled' };
    }

    try {
      // Handle both webhook format and raw export format
      const event = eventData.event || eventData.properties?.event;
      const properties = eventData.properties || eventData;

      // Check if this event should be tracked
      const trackedEvents = settings.trackedEvents || this.defaultEvents;
      const isTrackedEvent = trackedEvents.some(e =>
        e.toLowerCase() === event?.toLowerCase()
      );

      if (!isTrackedEvent) {
        logger.info(`Mixpanel event '${event}' is not tracked, skipping`);
        return { processed: false, reason: 'event_not_tracked', event };
      }

      // Extract user/company information
      const userData = this.extractUserData(properties);

      if (!userData.email && !userData.companyName) {
        logger.info('No identifiable user data in Mixpanel event');
        return { processed: false, reason: 'no_identifiable_data' };
      }

      // Check for existing customer by email
      if (userData.email) {
        const existingCustomer = customerRepository.findByEmail?.(userData.email) ||
          customerRepository.findAll({ search: userData.email, limit: 1 })[0];

        if (existingCustomer) {
          // Update customer notes
          const notes = `${existingCustomer.notes || ''}\n\n[Mixpanel ${new Date().toLocaleString('ko-KR')}]\n이벤트: ${event}`.trim();
          customerRepository.update(existingCustomer.id, { notes });

          logger.info(`Mixpanel event added to existing customer: ${existingCustomer.id}`);
          return {
            processed: true,
            action: 'customer_updated',
            customerId: existingCustomer.id
          };
        }
      }

      // Check for existing prospect
      const existingProspect = userData.companyName
        ? prospectRepository.findByCompanyName(userData.companyName)
        : prospectRepository.findAll({ search: userData.email, limit: 1 })[0];

      if (existingProspect) {
        // Update prospect notes
        const notes = `${existingProspect.notes || ''}\n\n[Mixpanel ${new Date().toLocaleString('ko-KR')}]\n이벤트: ${event}`.trim();
        prospectRepository.update(existingProspect.id, { notes });

        logger.info(`Mixpanel event added to existing prospect: ${existingProspect.id}`);
        return {
          processed: true,
          action: 'prospect_updated',
          prospectId: existingProspect.id
        };
      }

      // Create new prospect if enabled
      if (settings.autoCreateProspect) {
        const prospectData = await this.createProspectFromMixpanel(userData, event, properties, settings);
        return {
          processed: true,
          action: 'prospect_created',
          prospectId: prospectData.id
        };
      }

      return { processed: false, reason: 'auto_create_disabled' };

    } catch (error) {
      logger.error('Error processing Mixpanel event:', error);
      return { processed: false, error: error.message };
    }
  }

  /**
   * Extract user data from Mixpanel properties
   * @param {Object} properties - Event properties
   * @returns {Object} Extracted user data
   */
  extractUserData(properties) {
    const userData = {
      distinctId: properties.distinct_id || properties.$distinct_id,
      email: properties.$email || properties.email || properties.user_email,
      name: properties.$name || properties.name || properties.user_name || properties.username,
      companyName: properties.$company || properties.company || properties.company_name || properties.organization,
      phone: properties.$phone || properties.phone,
      city: properties.$city || properties.city,
      country: properties.$country_code || properties.country,
      browser: properties.$browser,
      os: properties.$os,
      device: properties.$device,
      referrer: properties.$referrer || properties.referrer,
      utmSource: properties.utm_source,
      utmMedium: properties.utm_medium,
      utmCampaign: properties.utm_campaign,
      plan: properties.plan || properties.subscription_plan,
      createdAt: properties.$created || properties.created_at,
      // Custom properties
      industry: properties.industry,
      companySize: properties.company_size || properties.employees,
      role: properties.role || properties.job_title,
      useCase: properties.use_case,
      // Raw export specific
      time: properties.time,
      insertId: properties.$insert_id
    };

    // Try to extract company from email domain
    if (!userData.companyName && userData.email) {
      const domain = userData.email.split('@')[1];
      if (domain && !['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'naver.com', 'daum.net', 'hanmail.net'].includes(domain)) {
        userData.companyDomain = domain;
        userData.companyName = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
      }
    }

    return userData;
  }

  /**
   * Create prospect from Mixpanel data
   * @param {Object} userData - Extracted user data
   * @param {string} event - Event name
   * @param {Object} properties - Full properties
   * @param {Object} settings - Mixpanel settings
   * @returns {Object} Created prospect
   */
  async createProspectFromMixpanel(userData, event, properties, settings) {
    let signalStrength = settings.defaultSignalStrength || 'medium';
    let enrichedData = {};

    // Determine signal strength based on data quality
    if (userData.companyName && userData.email && userData.phone) {
      signalStrength = 'high';
    } else if (userData.email && (userData.companyName || userData.companyDomain)) {
      signalStrength = 'medium';
    } else {
      signalStrength = 'low';
    }

    // Enrich with AI if enabled
    if (settings.enrichWithAI && userData.companyName) {
      try {
        enrichedData = await this.enrichProspectWithAI(userData);
      } catch (error) {
        logger.warn('AI enrichment failed:', error.message);
      }
    }

    // Build notes
    const noteLines = [
      `[Mixpanel - ${event}]`,
      userData.email ? `이메일: ${userData.email}` : null,
      userData.name ? `이름: ${userData.name}` : null,
      userData.role ? `직책: ${userData.role}` : null,
      userData.phone ? `전화: ${userData.phone}` : null,
      userData.city ? `위치: ${userData.city}${userData.country ? `, ${userData.country}` : ''}` : null,
      userData.plan ? `플랜: ${userData.plan}` : null,
      userData.useCase ? `사용 목적: ${userData.useCase}` : null,
      userData.utmSource ? `유입 경로: ${userData.utmSource}${userData.utmMedium ? ` / ${userData.utmMedium}` : ''}` : null,
      userData.referrer ? `레퍼러: ${userData.referrer}` : null,
      enrichedData.summary ? `\n[AI 분석]\n${enrichedData.summary}` : null
    ].filter(Boolean);

    // Create prospect
    const prospect = prospectRepository.create({
      companyName: userData.companyName || userData.email || `Mixpanel User ${userData.distinctId}`,
      website: userData.companyDomain ? `https://${userData.companyDomain}` : null,
      industry: enrichedData.industry || userData.industry || null,
      signalStrength,
      notes: noteLines.join('\n'),
      sourceTitle: `Mixpanel: ${event}`,
      sourceUri: `mixpanel://event/${event}/${userData.distinctId}`,
      icpMatch: enrichedData.icpMatch || null
    });

    // Create notification
    notificationRepository.create({
      type: 'prospect',
      title: '새로운 Mixpanel 유저',
      message: `${prospect.companyName}: ${event} 이벤트 발생`,
      prospectId: prospect.id,
      priority: signalStrength === 'high' ? 'high' : 'medium',
      metadata: {
        source: 'mixpanel',
        event,
        email: userData.email,
        distinctId: userData.distinctId
      }
    });

    logger.info(`Prospect created from Mixpanel: ${prospect.id} - ${prospect.companyName}`);
    return prospect;
  }

  /**
   * Enrich prospect with AI
   * @param {Object} userData - User data
   * @returns {Object} Enriched data
   */
  async enrichProspectWithAI(userData) {
    try {
      const prompt = `다음 정보를 바탕으로 회사에 대해 분석해주세요.

회사명: ${userData.companyName}
${userData.companyDomain ? `도메인: ${userData.companyDomain}` : ''}
${userData.industry ? `산업: ${userData.industry}` : ''}
${userData.companySize ? `규모: ${userData.companySize}` : ''}

다음 JSON 형식으로 응답해주세요:
{
  "summary": "회사에 대한 간단한 설명 (50자 이내, 정보가 부족하면 null)",
  "industry": "산업 분야 (추정, 정보가 부족하면 null)",
  "icpMatch": "우리 서비스와의 적합도 (high/medium/low/unknown)"
}`;

      const response = await geminiClient.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      });

      const text = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text;

      if (text) {
        const jsonStr = text.replace(/```json\n?|\n?```/g, '').trim();
        return JSON.parse(jsonStr);
      }

      return {};
    } catch (error) {
      logger.error('AI enrichment error:', error);
      return {};
    }
  }

  /**
   * Process batch of Mixpanel events
   * @param {Array} events - Array of event data
   * @returns {Object} Batch processing result
   */
  async processBatchEvents(events) {
    const results = {
      total: events.length,
      processed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };

    // Track processed insert_ids to avoid duplicates within batch
    const processedIds = new Set();

    for (const eventData of events) {
      try {
        // Deduplicate by insert_id if available
        const insertId = eventData.properties?.$insert_id || eventData.$insert_id;
        if (insertId && processedIds.has(insertId)) {
          results.skipped++;
          continue;
        }
        if (insertId) {
          processedIds.add(insertId);
        }

        const result = await this.processEvent(eventData);

        if (result.processed) {
          results.processed++;
          if (result.action === 'prospect_created') results.created++;
          if (result.action?.includes('updated')) results.updated++;
        } else {
          results.skipped++;
        }
      } catch (error) {
        results.errors.push({ event: eventData.event, error: error.message });
      }
    }

    logger.info(`Mixpanel batch processed: ${results.processed}/${results.total}`);
    return results;
  }

  /**
   * Get integration status
   * @returns {Object} Status
   */
  getStatus() {
    const settings = this.getSettings();
    const connectionStatus = mixpanelApiClient.getConnectionStatus();

    return {
      isEnabled: settings.isEnabled,
      credentialsConfigured: connectionStatus.configured,
      authType: connectionStatus.authType,
      projectId: connectionStatus.projectId,
      trackedEvents: settings.trackedEvents || this.defaultEvents,
      autoCreateProspect: settings.autoCreateProspect,
      enrichWithAI: settings.enrichWithAI,
      syncInterval: settings.syncInterval,
      lastSyncAt: settings.lastSyncAt
    };
  }
}

export const mixpanelService = new MixpanelService();
export default mixpanelService;
