import { slackService } from '../services/slack.service.js';
import { logger } from '../utils/logger.js';

export const settingsController = {
  /**
   * Validate Slack Webhook URL
   * POST /api/settings/slack/validate
   */
  async validateSlackWebhook(req, res, next) {
    try {
      const { webhookUrl } = req.body;

      if (!webhookUrl) {
        return res.status(400).json({
          success: false,
          error: 'Webhook URL is required',
          valid: false
        });
      }

      // Basic URL format validation
      if (!webhookUrl.startsWith('https://hooks.slack.com/')) {
        return res.status(400).json({
          success: false,
          error: 'Invalid Slack Webhook URL format. URL must start with https://hooks.slack.com/',
          valid: false
        });
      }

      // Validate webhook by testing it
      const isValid = await slackService.validateWebhook(webhookUrl);

      if (!isValid) {
        return res.status(400).json({
          success: false,
          error: 'Webhook URL is not valid or has been deleted',
          valid: false
        });
      }

      logger.info('Slack webhook validated successfully');
      res.json({ success: true, valid: true });
    } catch (error) {
      logger.error('Slack webhook validation error:', error);
      next(error);
    }
  },

  /**
   * Send test message to Slack
   * POST /api/settings/slack/test
   */
  async sendSlackTestMessage(req, res, next) {
    try {
      const { webhookUrl } = req.body;

      if (!webhookUrl) {
        return res.status(400).json({
          success: false,
          error: 'Webhook URL is required'
        });
      }

      const message = slackService.formatNotification('test', {});
      await slackService.sendMessage(webhookUrl, message);

      logger.info('Slack test message sent successfully');
      res.json({ success: true, message: 'Test message sent successfully' });
    } catch (error) {
      logger.error('Slack test message error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to send test message'
      });
    }
  },

  /**
   * Send notification to Slack
   * POST /api/settings/slack/notify
   */
  async sendSlackNotification(req, res, next) {
    try {
      const { webhookUrl, type, data } = req.body;

      if (!webhookUrl) {
        return res.status(400).json({
          success: false,
          error: 'Webhook URL is required'
        });
      }

      if (!type) {
        return res.status(400).json({
          success: false,
          error: 'Notification type is required'
        });
      }

      const message = slackService.formatNotification(type, data || {});
      await slackService.sendMessage(webhookUrl, message);

      logger.info(`Slack notification sent: ${type}`);
      res.json({ success: true, message: `Notification (${type}) sent successfully` });
    } catch (error) {
      logger.error('Slack notification error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to send notification'
      });
    }
  }
};
