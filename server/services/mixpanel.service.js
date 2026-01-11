import { prospectRepository, customerRepository, notificationRepository, settingsRepository } from '../database/repositories/index.js';
import { geminiClient } from './geminiClient.js';
import { logger } from '../utils/logger.js';
import crypto from 'crypto';

class MixpanelService {
  constructor() {
    this.defaultEvents = ['$signup', 'sign_up', 'user_signup', 'registration', 'account_created'];
  }

  /**
   * Get Mixpanel settings
   * @returns {Object} Mixpanel settings
   */
  getSettings() {
    return settingsRepository.get('mixpanel') || {
      isEnabled: false,
      projectToken: null,
      apiSecret: null,
      webhookSecret: null,
      trackedEvents: this.defaultEvents,
      autoCreateProspect: true,
      defaultSignalStrength: 'medium',
      enrichWithAI: true
    };
  }

  /**
   * Update Mixpanel settings
   * @param {Object} updates - Settings updates
   * @returns {Object} Updated settings
   */
  updateSettings(updates) {
    return settingsRepository.update('mixpanel', updates);
  }

  /**
   * Verify webhook signature (if secret is configured)
   * @param {string} payload - Raw request body
   * @param {string} signature - X-Mixpanel-Signature header
   * @returns {boolean} Is valid
   */
  verifyWebhookSignature(payload, signature) {
    const settings = this.getSettings();

    if (!settings.webhookSecret) {
      // No secret configured, skip verification
      return true;
    }

    if (!signature) {
      logger.warn('Mixpanel webhook signature missing');
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', settings.webhookSecret)
      .update(payload)
      .digest('hex');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

    if (!isValid) {
      logger.warn('Mixpanel webhook signature mismatch');
    }

    return isValid;
  }

  /**
   * Process Mixpanel webhook event
   * @param {Object} eventData - Mixpanel event data
   * @returns {Object} Processing result
   */
  async processWebhookEvent(eventData) {
    const settings = this.getSettings();

    if (!settings.isEnabled) {
      logger.info('Mixpanel integration is disabled, skipping event');
      return { processed: false, reason: 'integration_disabled' };
    }

    try {
      const { event, properties } = eventData;

      // Check if this event should be tracked
      const trackedEvents = settings.trackedEvents || this.defaultEvents;
      const isTrackedEvent = trackedEvents.some(e =>
        e.toLowerCase() === event.toLowerCase()
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
      const searchKey = userData.companyName || userData.email;
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
      logger.error('Error processing Mixpanel webhook:', error);
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
      useCase: properties.use_case
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

    for (const eventData of events) {
      try {
        const result = await this.processWebhookEvent(eventData);

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

    return {
      isEnabled: settings.isEnabled,
      hasProjectToken: !!settings.projectToken,
      hasWebhookSecret: !!settings.webhookSecret,
      trackedEvents: settings.trackedEvents || this.defaultEvents,
      autoCreateProspect: settings.autoCreateProspect,
      enrichWithAI: settings.enrichWithAI
    };
  }

  /**
   * Generate webhook URL info
   * @param {string} baseUrl - Server base URL
   * @returns {Object} Webhook configuration info
   */
  getWebhookInfo(baseUrl) {
    return {
      webhookUrl: `${baseUrl}/api/mixpanel/webhook`,
      supportedEvents: this.defaultEvents,
      instructions: {
        ko: [
          '1. Mixpanel 프로젝트 설정 > Webhooks로 이동',
          '2. 위 Webhook URL을 추가',
          '3. 추적할 이벤트 선택 (예: $signup, registration)',
          '4. (선택) Webhook Secret 설정 후 여기에 입력'
        ],
        en: [
          '1. Go to Mixpanel Project Settings > Webhooks',
          '2. Add the Webhook URL above',
          '3. Select events to track (e.g., $signup, registration)',
          '4. (Optional) Set Webhook Secret and enter it here'
        ]
      }
    };
  }
}

export const mixpanelService = new MixpanelService();
export default mixpanelService;
