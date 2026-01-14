import { WebClient } from '@slack/web-api';
import { logger } from '../utils/logger.js';

/**
 * Slack Web API Client Wrapper
 * Provides methods to interact with Slack Web API (conversations.history, users.info, etc.)
 * Requires SLACK_BOT_TOKEN environment variable
 */
class SlackApiClient {
  constructor() {
    this.botToken = null;
    this.client = null;
    this.initialized = false;
  }

  /**
   * Lazily initialize the client when first needed
   * @private
   */
  _initialize() {
    if (this.initialized) return;

    this.botToken = process.env.SLACK_BOT_TOKEN;
    if (this.botToken) {
      this.client = new WebClient(this.botToken);
      logger.info('Slack Web API client initialized');
    } else {
      logger.warn('SLACK_BOT_TOKEN not configured - Web API unavailable');
    }
    this.initialized = true;
  }

  /**
   * Check if Web API is available
   * @returns {boolean}
   */
  isAvailable() {
    this._initialize();
    return !!this.client;
  }

  /**
   * Fetch message history from a channel
   * @param {string} channelId - Slack channel ID
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} Message history
   */
  async fetchConversationHistory(channelId, options = {}) {
    this._initialize();
    if (!this.client) {
      throw new Error('Slack Web API not configured. Set SLACK_BOT_TOKEN environment variable.');
    }

    const {
      limit = 10,
      cursor = null,
      oldest = null,
      latest = null
    } = options;

    try {
      logger.info(`Fetching conversation history for channel ${channelId}`, { limit, cursor });

      const response = await this.client.conversations.history({
        channel: channelId,
        limit,
        cursor,
        oldest,
        latest,
        inclusive: true
      });

      return {
        ok: response.ok,
        messages: response.messages || [],
        hasMore: response.has_more || false,
        nextCursor: response.response_metadata?.next_cursor || null
      };
    } catch (error) {
      logger.error('Slack API error - conversations.history:', error);

      if (error.data?.error === 'channel_not_found') {
        throw new Error(`Channel ${channelId} not found or bot is not a member`);
      }
      if (error.data?.error === 'missing_scope') {
        throw new Error('Bot token missing required scope: channels:history or groups:history');
      }
      if (error.data?.error === 'invalid_auth') {
        throw new Error('Invalid Slack bot token');
      }

      throw new Error(`Failed to fetch conversation history: ${error.message}`);
    }
  }

  /**
   * Fetch replies to a thread
   * @param {string} channelId - Slack channel ID
   * @param {string} threadTs - Thread timestamp
   * @returns {Promise<Array>} Reply messages
   */
  async fetchThreadReplies(channelId, threadTs) {
    this._initialize();
    if (!this.client) {
      throw new Error('Slack Web API not configured');
    }

    try {
      logger.info(`Fetching thread replies for ${channelId}/${threadTs}`);

      const response = await this.client.conversations.replies({
        channel: channelId,
        ts: threadTs,
        inclusive: false  // Exclude parent message (we already have it)
      });

      // Skip first message (parent) if inclusive returns it
      const replies = response.messages || [];
      return replies.filter(msg => msg.ts !== threadTs);
    } catch (error) {
      logger.error('Slack API error - conversations.replies:', error);

      if (error.data?.error === 'thread_not_found') {
        logger.warn(`Thread ${threadTs} not found, returning empty replies`);
        return [];
      }

      throw new Error(`Failed to fetch thread replies: ${error.message}`);
    }
  }

  /**
   * Get user information
   * @param {string} userId - Slack user ID
   * @returns {Promise<Object>} User info
   */
  async getUserInfo(userId) {
    this._initialize();
    if (!this.client) {
      throw new Error('Slack Web API not configured');
    }

    try {
      const response = await this.client.users.info({ user: userId });
      return response.user;
    } catch (error) {
      logger.error('Slack API error - users.info:', error);
      return null;  // Gracefully handle missing user info
    }
  }

  /**
   * Test API connection
   * @returns {Promise<Object>} Connection status
   */
  async testConnection() {
    this._initialize();
    if (!this.client) {
      return {
        success: false,
        error: 'SLACK_BOT_TOKEN not configured'
      };
    }

    try {
      const response = await this.client.auth.test();
      return {
        success: true,
        team: response.team,
        user: response.user,
        teamId: response.team_id,
        userId: response.user_id,
        botId: response.bot_id
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export const slackApiClient = new SlackApiClient();
export default slackApiClient;
