import { logger } from '../utils/logger.js';

class SlackService {
  /**
   * Validate Slack Webhook URL
   * @param {string} webhookUrl - Slack Webhook URL
   * @returns {Promise<boolean>}
   */
  async validateWebhook(webhookUrl) {
    try {
      // Basic URL format validation
      if (!webhookUrl || !webhookUrl.startsWith('https://hooks.slack.com/')) {
        return false;
      }

      // Send empty payload to validate webhook exists
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '' })
      });

      // Slack returns 400 for empty message but webhook is valid
      // 404/403/410 means webhook is invalid or deleted
      if (response.status === 404 || response.status === 403 || response.status === 410) {
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Webhook validation failed:', error);
      return false;
    }
  }

  /**
   * Send message to Slack channel via webhook
   * @param {string} webhookUrl - Slack Webhook URL
   * @param {object} message - Slack message payload
   * @returns {Promise<boolean>}
   */
  async sendMessage(webhookUrl, message) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Slack API error: ${response.status} - ${errorText}`);
      }

      logger.info('Slack message sent successfully');
      return true;
    } catch (error) {
      logger.error('Failed to send Slack message:', error);
      throw error;
    }
  }

  /**
   * Format notification based on type
   * @param {string} type - Notification type
   * @param {object} data - Notification data
   * @returns {object} Formatted Slack message
   */
  formatNotification(type, data) {
    switch (type) {
      case 'new_prospect':
        return this.formatNewProspectMessage(data);
      case 'followup_reminder':
        return this.formatFollowUpReminderMessage(data);
      case 'deal_won':
        return this.formatDealWonMessage(data);
      case 'deal_lost':
        return this.formatDealLostMessage(data);
      case 'test':
        return this.formatTestMessage();
      default:
        return { text: JSON.stringify(data) };
    }
  }

  /**
   * Format test message
   */
  formatTestMessage() {
    return {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: 'RINDA CRM 연동 테스트',
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*RINDA CRM*이 Slack과 성공적으로 연동되었습니다!'
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `테스트 시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`
            }
          ]
        }
      ]
    };
  }

  /**
   * Format new prospect notification
   * @param {object} prospect - Prospect data
   */
  formatNewProspectMessage(prospect) {
    const signalEmoji = {
      high: ':red_circle:',
      medium: ':large_yellow_circle:',
      low: ':large_green_circle:'
    };
    const signalKorean = {
      high: '높음',
      medium: '중간',
      low: '낮음'
    };

    return {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '새로운 잠재고객 발견!',
            emoji: true
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*회사명:*\n${prospect.companyName || '알 수 없음'}`
            },
            {
              type: 'mrkdwn',
              text: `*산업:*\n${prospect.industry || '미분류'}`
            },
            {
              type: 'mrkdwn',
              text: `*신호 강도:*\n${signalEmoji[prospect.signalStrength] || ':white_circle:'} ${signalKorean[prospect.signalStrength] || '알 수 없음'}`
            },
            {
              type: 'mrkdwn',
              text: `*출처:*\n${prospect.sourceArticle?.uri ? `<${prospect.sourceArticle.uri}|${prospect.sourceArticle.title || '기사 보기'}>` : '직접 입력'}`
            }
          ]
        },
        {
          type: 'divider'
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `발견 시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`
            }
          ]
        }
      ]
    };
  }

  /**
   * Format follow-up reminder notification
   * @param {object} data - { customer, followUp }
   */
  formatFollowUpReminderMessage(data) {
    const { customer, followUp } = data;

    const typeKorean = {
      email: '이메일',
      call: '전화',
      meeting: '미팅',
      message: '메시지'
    };

    const priorityEmoji = {
      high: ':exclamation:',
      medium: ':bell:',
      low: ':information_source:'
    };

    const priorityKorean = {
      high: '높음',
      medium: '중간',
      low: '낮음'
    };

    return {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: 'Follow-up 리마인더',
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${customer?.name || '고객'}*에게 ${typeKorean[followUp?.type] || '연락'} Follow-up이 예정되어 있습니다.`
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*우선순위:*\n${priorityEmoji[followUp?.priority] || ''} ${priorityKorean[followUp?.priority] || '보통'}`
            },
            {
              type: 'mrkdwn',
              text: `*예정 시각:*\n${followUp?.scheduledFor ? new Date(followUp.scheduledFor).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '미정'}`
            }
          ]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*사유:* ${followUp?.reason || '사유 없음'}`
          }
        },
        {
          type: 'divider'
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `알림 시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`
            }
          ]
        }
      ]
    };
  }

  /**
   * Format deal won notification
   * @param {object} customer - Customer data
   */
  formatDealWonMessage(customer) {
    return {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: ':tada: 계약 성사!',
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${customer?.name || '고객'}*와의 계약이 성사되었습니다!`
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*산업:*\n${customer?.industry || '미분류'}`
            },
            {
              type: 'mrkdwn',
              text: `*웹사이트:*\n${customer?.website || '없음'}`
            }
          ]
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `성사 시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`
            }
          ]
        }
      ]
    };
  }

  /**
   * Format deal lost notification
   * @param {object} customer - Customer data
   */
  formatDealLostMessage(customer) {
    return {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '거래 실패',
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${customer?.name || '고객'}*와의 거래가 실패로 종료되었습니다.`
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*실패 사유:*\n${customer?.lostReason || '미입력'}`
            }
          ]
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `기록 시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`
            }
          ]
        }
      ]
    };
  }
}

export const slackService = new SlackService();
