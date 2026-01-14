import { slackApiClient } from './slackApiClient.js';
import { logger } from '../utils/logger.js';

/**
 * Slack API Service
 * Business logic for fetching and formatting Slack messages with optional replies and files
 */
class SlackApiService {
  /**
   * Fetch last N messages from a Slack channel with optional replies and files
   * @param {string} channelId - Slack channel ID
   * @param {Object} options - Fetch options
   * @param {number} options.limit - Number of messages to fetch (default: 10, max: 100)
   * @param {boolean} options.includeReplies - Include thread replies (default: true)
   * @param {boolean} options.includeFiles - Include file metadata (default: true)
   * @param {boolean} options.includeUserInfo - Enrich with user profile data (default: false)
   * @returns {Promise<Object>} Formatted message data
   */
  async fetchChannelMessages(channelId, options = {}) {
    const {
      limit = 10,
      includeReplies = true,
      includeFiles = true,
      includeUserInfo = false
    } = options;

    // Validate limit
    if (limit < 1 || limit > 100) {
      throw new Error('Limit must be between 1 and 100');
    }

    logger.info(`Fetching ${limit} messages from channel ${channelId}`, options);

    // Fetch conversation history
    const historyResult = await slackApiClient.fetchConversationHistory(channelId, { limit });

    if (!historyResult.ok) {
      throw new Error('Failed to fetch conversation history');
    }

    const messages = historyResult.messages;

    // Process each message
    const processedMessages = await Promise.all(
      messages.map(async (message) => {
        const processed = this.formatMessage(message, { includeFiles });

        // Fetch thread replies if requested and message has replies
        if (includeReplies && message.reply_count > 0) {
          const replies = await slackApiClient.fetchThreadReplies(channelId, message.ts);
          processed.replies = replies.map(reply => this.formatMessage(reply, { includeFiles }));
        } else {
          processed.replies = [];
        }

        // Optionally enrich with user info
        if (includeUserInfo && message.user) {
          const userInfo = await slackApiClient.getUserInfo(message.user);
          if (userInfo) {
            processed.userProfile = {
              realName: userInfo.real_name,
              displayName: userInfo.profile?.display_name,
              avatar: userInfo.profile?.image_48
            };
          }
        }

        return processed;
      })
    );

    return {
      channelId,
      messages: processedMessages,
      hasMore: historyResult.hasMore,
      nextCursor: historyResult.nextCursor
    };
  }

  /**
   * Format a Slack message into a clean structure
   * @param {Object} slackMessage - Raw Slack message object
   * @param {Object} options - Formatting options
   * @returns {Object} Formatted message
   */
  formatMessage(slackMessage, options = {}) {
    const { includeFiles = true } = options;

    const formatted = {
      ts: slackMessage.ts,
      type: slackMessage.type,
      user: slackMessage.user,
      text: slackMessage.text || '',
      edited: !!slackMessage.edited,
      threadTs: slackMessage.thread_ts || null,
      replyCount: slackMessage.reply_count || 0,
      replyUsersCount: slackMessage.reply_users_count || 0,
      latestReply: slackMessage.latest_reply || null,
      reactions: this.formatReactions(slackMessage.reactions),
      permalink: slackMessage.permalink || null
    };

    // Include files metadata if requested
    if (includeFiles && slackMessage.files && slackMessage.files.length > 0) {
      formatted.files = slackMessage.files.map(file => ({
        id: file.id,
        name: file.name,
        title: file.title,
        mimetype: file.mimetype,
        filetype: file.filetype,
        size: file.size,
        url: file.url_private,  // Requires bot token to access
        urlDownload: file.url_private_download,
        permalink: file.permalink,
        thumbnail: file.thumb_360 || file.thumb_160 || file.thumb_80,
        isImage: file.mimetype?.startsWith('image/'),
        isVideo: file.mimetype?.startsWith('video/'),
        isPdf: file.mimetype === 'application/pdf'
      }));
    } else {
      formatted.files = [];
    }

    return formatted;
  }

  /**
   * Format message reactions
   * @param {Array} reactions - Raw Slack reactions
   * @returns {Array} Formatted reactions
   */
  formatReactions(reactions) {
    if (!reactions || reactions.length === 0) return [];

    return reactions.map(reaction => ({
      name: reaction.name,
      count: reaction.count,
      users: reaction.users || []
    }));
  }

  /**
   * Get Slack Web API connection status
   * @returns {Promise<Object>} Connection status
   */
  async getConnectionStatus() {
    return await slackApiClient.testConnection();
  }
}

export const slackApiService = new SlackApiService();
export default slackApiService;
