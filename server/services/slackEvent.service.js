import { slackRepository, prospectRepository, customerRepository, notificationRepository, settingsRepository } from '../database/repositories/index.js';
import { geminiClient } from './geminiClient.js';
import { logger } from '../utils/logger.js';

class SlackEventService {
  constructor() {
    this.csChannelId = process.env.SLACK_CS_CHANNEL_ID;
  }

  /**
   * Handle Slack URL verification challenge
   * @param {Object} body - Request body
   * @returns {Object} Challenge response
   */
  handleUrlVerification(body) {
    logger.info('Slack URL verification challenge received');
    return { challenge: body.challenge };
  }

  /**
   * Process incoming Slack event
   * @param {Object} event - Slack event object
   * @returns {Object} Processing result
   */
  async processEvent(event) {
    const eventType = event.type;

    switch (eventType) {
      case 'message':
        return await this.handleMessageEvent(event);
      case 'app_mention':
        return await this.handleAppMention(event);
      default:
        logger.info(`Unhandled event type: ${eventType}`);
        return { handled: false, type: eventType };
    }
  }

  /**
   * Handle message event from Slack
   * @param {Object} event - Message event
   */
  async handleMessageEvent(event) {
    // Ignore bot messages
    if (event.bot_id || event.subtype === 'bot_message') {
      return { handled: false, reason: 'bot_message' };
    }

    // Check if message is from the CS channel
    const isCSChannel = this.csChannelId && event.channel === this.csChannelId;

    // Save message to database
    const savedMessage = slackRepository.saveMessage({
      slackTs: event.ts,
      channelId: event.channel,
      userId: event.user,
      userName: event.username || null,
      text: event.text,
      threadTs: event.thread_ts || null
    });

    // If from CS channel, process for CRM
    if (isCSChannel) {
      return await this.processCSMessage(savedMessage, event);
    }

    return { handled: true, messageId: savedMessage.id };
  }

  /**
   * Process customer service channel message
   * @param {Object} savedMessage - Saved message from DB
   * @param {Object} event - Original Slack event
   */
  async processCSMessage(savedMessage, event) {
    try {
      // Parse message for customer inquiry
      const parsedData = await this.parseCustomerInquiry(event.text);

      if (!parsedData.isInquiry) {
        slackRepository.markProcessed(savedMessage.id);
        return { handled: true, isInquiry: false };
      }

      let customerId = null;
      let prospectId = null;

      // Try to match with existing customer
      if (parsedData.companyName) {
        const existingCustomer = customerRepository.findByName(parsedData.companyName);

        if (existingCustomer) {
          customerId = existingCustomer.id;

          // Add note to customer
          const updatedNotes = `${existingCustomer.notes || ''}\n\n[Slack ${new Date().toLocaleString('ko-KR')}]\n${event.text}`.trim();
          customerRepository.update(existingCustomer.id, { notes: updatedNotes });

        } else {
          // Check if prospect exists
          const existingProspect = prospectRepository.findByCompanyName(parsedData.companyName);

          if (existingProspect) {
            prospectId = existingProspect.id;
          } else {
            // Create new prospect
            const newProspect = prospectRepository.create({
              companyName: parsedData.companyName,
              industry: parsedData.industry || null,
              signalStrength: parsedData.urgency === 'high' ? 'high' : 'medium',
              notes: `[Slack 문의]\n${parsedData.summary || event.text}`,
              sourceArticle: {
                title: 'Slack CS 채널',
                uri: `slack://channel/${event.channel}/${event.ts}`
              }
            });
            prospectId = newProspect.id;

            // Create notification
            notificationRepository.create({
              type: 'slack',
              title: '새로운 Slack 문의',
              message: `${parsedData.companyName}: ${parsedData.summary || '문의 내용 확인 필요'}`,
              prospectId: newProspect.id,
              priority: parsedData.urgency || 'medium',
              metadata: {
                slackChannel: event.channel,
                slackTs: event.ts,
                inquiryType: parsedData.inquiryType
              }
            });
          }
        }
      }

      // Mark message as processed
      slackRepository.markProcessed(savedMessage.id, { customerId, prospectId });

      return {
        handled: true,
        isInquiry: true,
        customerId,
        prospectId,
        parsedData
      };

    } catch (error) {
      logger.error('Error processing CS message:', error);
      slackRepository.markProcessed(savedMessage.id);
      return { handled: true, error: error.message };
    }
  }

  /**
   * Parse customer inquiry using AI
   * @param {string} messageText - Message text to analyze
   * @returns {Object} Parsed inquiry data
   */
  async parseCustomerInquiry(messageText) {
    try {
      const prompt = `다음 Slack 메시지를 분석하여 고객 문의 정보를 추출해주세요.

메시지: "${messageText}"

다음 JSON 형식으로 응답해주세요:
{
  "isInquiry": true/false (고객 문의인지 여부),
  "companyName": "회사명 (있는 경우, 없으면 null)",
  "contactPerson": "담당자명 (있는 경우, 없으면 null)",
  "inquiryType": "문의/견적/지원/기타 중 하나",
  "summary": "문의 내용 요약 (50자 이내)",
  "urgency": "high/medium/low",
  "industry": "산업 분야 추정 (있는 경우, 없으면 null)"
}

일반 대화나 내부 커뮤니케이션은 isInquiry를 false로 설정하세요.`;

      const response = await geminiClient.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      });

      const text = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text;

      if (text) {
        // Clean JSON string
        const jsonStr = text.replace(/```json\n?|\n?```/g, '').trim();
        return JSON.parse(jsonStr);
      }

      return { isInquiry: false };
    } catch (error) {
      logger.error('Error parsing customer inquiry:', error);
      return { isInquiry: false, error: error.message };
    }
  }

  /**
   * Handle app mention event
   * @param {Object} event - App mention event
   */
  async handleAppMention(event) {
    logger.info('App mention received:', event.text);

    // Save message
    slackRepository.saveMessage({
      slackTs: event.ts,
      channelId: event.channel,
      userId: event.user,
      text: event.text,
      threadTs: event.thread_ts || null,
      processed: true
    });

    return { handled: true, type: 'app_mention' };
  }

  /**
   * Get Slack integration status
   * @returns {Object} Status information
   */
  getStatus() {
    const settings = settingsRepository.getSlackSettings();
    const messageCount = slackRepository.getCount();
    const unprocessedCount = slackRepository.findUnprocessed(1).length;

    return {
      eventApiEnabled: settings.eventApiEnabled || false,
      webhookEnabled: settings.isEnabled || false,
      csChannelConfigured: !!this.csChannelId,
      totalMessages: messageCount,
      unprocessedMessages: unprocessedCount
    };
  }
}

export const slackEventService = new SlackEventService();
export default slackEventService;
