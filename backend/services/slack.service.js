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
      case 'new_customer':
        return this.formatNewCustomerMessage(data);
      case 'customer_updated':
        return this.formatCustomerUpdatedMessage(data);
      case 'prospect_converted':
        return this.formatProspectConvertedMessage(data);
      case 'followup_reminder':
        return this.formatFollowUpReminderMessage(data);
      case 'followup_completed':
        return this.formatFollowUpCompletedMessage(data);
      case 'deal_won':
        return this.formatDealWonMessage(data);
      case 'deal_lost':
        return this.formatDealLostMessage(data);
      case 'test':
        return this.formatTestMessage();
      default:
        logger.warn(`Unknown notification type: ${type}`);
        return this.formatGenericMessage(type, data);
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

  /**
   * Format new customer notification
   * @param {object} customer - Customer data
   */
  formatNewCustomerMessage(customer) {
    return {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '새로운 고객 등록!',
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${customer?.name || '신규 고객'}*이(가) CRM에 추가되었습니다.`
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
              text: `*웹사이트:*\n${customer?.website ? `<${customer.website}|바로가기>` : '없음'}`
            },
            {
              type: 'mrkdwn',
              text: `*상태:*\n${this.getStatusKorean(customer?.status)}`
            },
            {
              type: 'mrkdwn',
              text: `*고객 ID:*\n${customer?.id || '알 수 없음'}`
            }
          ]
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `등록 시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`
            }
          ]
        }
      ]
    };
  }

  /**
   * Format customer updated notification
   * @param {object} data - { customer, changes }
   */
  formatCustomerUpdatedMessage(data) {
    const { customer, changes } = data;
    const changesList = Object.entries(changes || {})
      .map(([key, value]) => `• ${this.getFieldNameKorean(key)}: ${value.old || '없음'} → ${value.new || '없음'}`)
      .join('\n');

    return {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '고객 정보 업데이트',
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${customer?.name || '고객'}*의 정보가 업데이트되었습니다.`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*변경 내용:*\n${changesList || '변경사항 없음'}`
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `업데이트 시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`
            }
          ]
        }
      ]
    };
  }

  /**
   * Format prospect converted notification
   * @param {object} data - { prospect, customer }
   */
  formatProspectConvertedMessage(data) {
    const { prospect, customer } = data;

    return {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: ':sparkles: 잠재고객 전환!',
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `잠재고객 *${prospect?.companyName || ''}*이(가) 고객으로 전환되었습니다!`
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*고객명:*\n${customer?.name || prospect?.companyName || '알 수 없음'}`
            },
            {
              type: 'mrkdwn',
              text: `*산업:*\n${customer?.industry || prospect?.industry || '미분류'}`
            },
            {
              type: 'mrkdwn',
              text: `*원래 신호 강도:*\n${this.getSignalStrengthKorean(prospect?.signalStrength)}`
            },
            {
              type: 'mrkdwn',
              text: `*현재 상태:*\n${this.getStatusKorean(customer?.status)}`
            }
          ]
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `전환 시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`
            }
          ]
        }
      ]
    };
  }

  /**
   * Format follow-up completed notification
   * @param {object} data - { customer, followUp }
   */
  formatFollowUpCompletedMessage(data) {
    const { customer, followUp } = data;

    const typeKorean = {
      email: '이메일',
      call: '전화',
      meeting: '미팅',
      message: '메시지'
    };

    return {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: ':white_check_mark: Follow-up 완료',
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${customer?.name || '고객'}*에 대한 ${typeKorean[followUp?.type] || '연락'} Follow-up이 완료되었습니다.`
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*완료 시각:*\n${followUp?.completedAt ? new Date(followUp.completedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`
            },
            {
              type: 'mrkdwn',
              text: `*메모:*\n${followUp?.notes || '없음'}`
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

  /**
   * Format generic notification (fallback for unknown types)
   * @param {string} type - Notification type
   * @param {object} data - Notification data
   */
  formatGenericMessage(type, data) {
    // Extract key information from data
    const title = data?.title || data?.name || data?.companyName || '알림';
    const description = data?.description || data?.message || '';

    // Build fields from data object
    const fields = [];
    if (data && typeof data === 'object') {
      Object.entries(data).forEach(([key, value]) => {
        // Skip nested objects and arrays for simplicity
        if (value && typeof value !== 'object' && key !== 'title' && key !== 'name' && key !== 'description') {
          fields.push({
            type: 'mrkdwn',
            text: `*${this.getFieldNameKorean(key)}:*\n${value}`
          });
        }
      });
    }

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${title}`,
          emoji: true
        }
      }
    ];

    if (description) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: description
        }
      });
    }

    if (fields.length > 0) {
      blocks.push({
        type: 'section',
        fields: fields.slice(0, 10) // Slack limit: max 10 fields
      });
    }

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `알림 유형: ${type} | 시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`
        }
      ]
    });

    return { blocks };
  }

  /**
   * Helper: Get Korean status name
   * @param {string} status - Status value
   */
  getStatusKorean(status) {
    const statusMap = {
      new: '신규',
      contact: '연락중',
      meeting: '미팅',
      proposal: '제안',
      negotiation: '협상',
      won: '성사',
      lost: '실패'
    };
    return statusMap[status] || status || '알 수 없음';
  }

  /**
   * Helper: Get Korean signal strength
   * @param {string} strength - Signal strength
   */
  getSignalStrengthKorean(strength) {
    const strengthMap = {
      high: ':red_circle: 높음',
      medium: ':large_yellow_circle: 중간',
      low: ':large_green_circle: 낮음'
    };
    return strengthMap[strength] || '알 수 없음';
  }

  /**
   * Helper: Get Korean field name
   * @param {string} fieldName - Field name in English
   */
  getFieldNameKorean(fieldName) {
    const fieldMap = {
      name: '이름',
      email: '이메일',
      phone: '전화번호',
      company: '회사',
      status: '상태',
      industry: '산업',
      website: '웹사이트',
      notes: '메모',
      priority: '우선순위',
      type: '유형',
      reason: '사유',
      date: '날짜',
      time: '시간'
    };
    return fieldMap[fieldName] || fieldName;
  }
}

export const slackService = new SlackService();
