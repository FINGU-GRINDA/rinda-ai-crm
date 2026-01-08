import { slackEventService } from '../services/slackEvent.service.js';
import { settingsRepository, slackRepository } from '../database/repositories/index.js';
import { logger } from '../utils/logger.js';

class SlackEventController {
  /**
   * Handle Slack events
   * POST /api/slack/events
   */
  async handleEvent(req, res, next) {
    try {
      const body = req.body;

      // Handle URL verification challenge
      if (body.type === 'url_verification') {
        const response = slackEventService.handleUrlVerification(body);
        return res.json(response);
      }

      // Handle event callback
      if (body.type === 'event_callback') {
        const event = body.event;

        // Respond immediately to Slack (3 second timeout requirement)
        res.status(200).send('ok');

        // Process event asynchronously
        try {
          const result = await slackEventService.processEvent(event);
          logger.info('Slack event processed:', result);
        } catch (error) {
          logger.error('Error processing Slack event:', error);
        }

        return;
      }

      // Unknown event type
      res.status(400).json({
        success: false,
        error: 'Unknown event type'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Slack integration status
   * GET /api/slack/status
   */
  async getStatus(req, res, next) {
    try {
      const status = slackEventService.getStatus();

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get recent Slack messages
   * GET /api/slack/messages
   */
  async getMessages(req, res, next) {
    try {
      const { channelId, limit, offset } = req.query;

      const messages = slackRepository.findRecent({
        channelId,
        limit: limit ? parseInt(limit) : 50,
        offset: offset ? parseInt(offset) : 0
      });

      res.json({
        success: true,
        data: messages,
        count: messages.length
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get messages for a customer
   * GET /api/slack/messages/customer/:customerId
   */
  async getCustomerMessages(req, res, next) {
    try {
      const { customerId } = req.params;
      const messages = slackRepository.findByCustomerId(customerId);

      res.json({
        success: true,
        data: messages
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Enable/disable Slack Event API
   * POST /api/slack/event-api/toggle
   */
  async toggleEventApi(req, res, next) {
    try {
      const { enabled } = req.body;

      const settings = settingsRepository.updateSlackSettings({
        eventApiEnabled: enabled
      });

      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Manually reprocess unprocessed messages
   * POST /api/slack/reprocess
   */
  async reprocessMessages(req, res, next) {
    try {
      const { limit = 10 } = req.body;

      const unprocessed = slackRepository.findUnprocessed(limit);

      const results = [];
      for (const message of unprocessed) {
        try {
          const result = await slackEventService.processEvent({
            type: 'message',
            ts: message.slackTs,
            channel: message.channelId,
            user: message.userId,
            text: message.text,
            thread_ts: message.threadTs
          });
          results.push({ id: message.id, ...result });
        } catch (error) {
          results.push({ id: message.id, error: error.message });
        }
      }

      res.json({
        success: true,
        data: {
          processed: results.length,
          results
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

export const slackEventController = new SlackEventController();
export default slackEventController;
