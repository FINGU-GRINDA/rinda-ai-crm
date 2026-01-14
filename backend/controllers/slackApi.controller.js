import { slackApiService } from '../services/slackApi.service.js';
import { logger } from '../utils/logger.js';

/**
 * Get messages from a Slack channel
 * GET /api/slack/channels/:channelId/messages
 *
 * Query parameters:
 * - limit: Number of messages (1-100, default: 10)
 * - includeReplies: Include thread replies (true/false, default: true)
 * - includeFiles: Include file metadata (true/false, default: true)
 * - includeUserInfo: Include user profile data (true/false, default: false)
 */
export const getChannelMessages = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const {
      limit = '10',
      includeReplies = 'true',
      includeFiles = 'true',
      includeUserInfo = 'false'
    } = req.query;

    // Parse and validate
    const parsedLimit = parseInt(limit, 10);
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      return res.status(400).json({
        success: false,
        error: 'Limit must be a number between 1 and 100'
      });
    }

    const options = {
      limit: parsedLimit,
      includeReplies: includeReplies === 'true',
      includeFiles: includeFiles === 'true',
      includeUserInfo: includeUserInfo === 'true'
    };

    logger.info(`Fetching messages for channel ${channelId}`, options);

    const result = await slackApiService.fetchChannelMessages(channelId, options);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error fetching channel messages:', error);
    next(error);
  }
};

/**
 * Get Slack Web API connection status
 * GET /api/slack/api/status
 */
export const getApiStatus = async (req, res, next) => {
  try {
    const status = await slackApiService.getConnectionStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Error checking Slack API status:', error);
    next(error);
  }
};
