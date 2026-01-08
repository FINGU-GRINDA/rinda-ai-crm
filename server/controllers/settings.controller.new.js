import { settingsRepository, notificationRepository } from '../database/repositories/index.js';
import { slackService } from '../services/slack.service.js';
import { logger } from '../utils/logger.js';

class SettingsControllerNew {
  /**
   * Get all settings
   * GET /api/settings
   */
  async getAll(req, res, next) {
    try {
      const settings = settingsRepository.getAll();

      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a specific setting
   * GET /api/settings/:key
   */
  async get(req, res, next) {
    try {
      const { key } = req.params;
      const value = settingsRepository.get(key);

      if (value === null) {
        return res.status(404).json({
          success: false,
          error: 'Setting not found'
        });
      }

      res.json({
        success: true,
        data: value
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a setting
   * PUT /api/settings/:key
   */
  async update(req, res, next) {
    try {
      const { key } = req.params;
      const { value } = req.body;

      if (value === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Value is required'
        });
      }

      settingsRepository.set(key, value);

      res.json({
        success: true,
        data: settingsRepository.get(key)
      });
    } catch (error) {
      next(error);
    }
  }

  // ========================================
  // Slack Settings
  // ========================================

  /**
   * Get Slack settings
   * GET /api/settings/slack
   */
  async getSlackSettings(req, res, next) {
    try {
      const settings = settingsRepository.getSlackSettings();

      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update Slack settings
   * PUT /api/settings/slack
   */
  async updateSlackSettings(req, res, next) {
    try {
      const updates = req.body;
      const settings = settingsRepository.updateSlackSettings(updates);

      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Validate Slack webhook
   * POST /api/settings/slack/validate
   */
  async validateSlackWebhook(req, res, next) {
    try {
      const { webhookUrl } = req.body;

      if (!webhookUrl) {
        return res.status(400).json({
          success: false,
          error: 'Webhook URL is required'
        });
      }

      const isValid = await slackService.validateWebhook(webhookUrl);

      if (isValid) {
        // Update settings
        settingsRepository.updateSlackSettings({
          webhookUrl,
          isValidated: true
        });
      }

      res.json({
        success: true,
        data: { isValid }
      });
    } catch (error) {
      next(error);
    }
  }

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

      // Update last test time
      settingsRepository.updateSlackSettings({
        lastTestAt: Date.now()
      });

      res.json({
        success: true,
        message: 'Test message sent successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Send notification to Slack
   * POST /api/settings/slack/notify
   */
  async sendSlackNotification(req, res, next) {
    try {
      const { webhookUrl, type, data } = req.body;

      if (!webhookUrl || !type) {
        return res.status(400).json({
          success: false,
          error: 'Webhook URL and type are required'
        });
      }

      const message = slackService.formatNotification(type, data);
      await slackService.sendMessage(webhookUrl, message);

      res.json({
        success: true,
        message: 'Notification sent successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // ========================================
  // Email Settings
  // ========================================

  /**
   * Get email settings
   * GET /api/settings/email
   */
  async getEmailSettings(req, res, next) {
    try {
      const settings = settingsRepository.getEmailSettings();

      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update email settings
   * PUT /api/settings/email
   */
  async updateEmailSettings(req, res, next) {
    try {
      const updates = req.body;
      const settings = settingsRepository.updateEmailSettings(updates);

      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      next(error);
    }
  }

  // ========================================
  // Collection Settings
  // ========================================

  /**
   * Get collection settings
   * GET /api/settings/collection
   */
  async getCollectionSettings(req, res, next) {
    try {
      const settings = settingsRepository.getCollectionSettings();

      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update collection settings
   * PUT /api/settings/collection
   */
  async updateCollectionSettings(req, res, next) {
    try {
      const updates = req.body;
      const settings = settingsRepository.updateCollectionSettings(updates);

      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      next(error);
    }
  }

  // ========================================
  // Notifications
  // ========================================

  /**
   * Get notifications
   * GET /api/notifications
   */
  async getNotifications(req, res, next) {
    try {
      const { type, read, priority, limit, offset } = req.query;

      const notifications = notificationRepository.findAll({
        type,
        read: read === 'true' ? true : read === 'false' ? false : undefined,
        priority,
        limit: limit ? parseInt(limit) : 50,
        offset: offset ? parseInt(offset) : 0
      });

      const unreadCount = notificationRepository.getUnreadCount();

      res.json({
        success: true,
        data: notifications,
        unreadCount
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark notification as read
   * PUT /api/notifications/:id/read
   */
  async markNotificationRead(req, res, next) {
    try {
      const { id } = req.params;
      const notification = notificationRepository.markRead(id);

      if (!notification) {
        return res.status(404).json({
          success: false,
          error: 'Notification not found'
        });
      }

      res.json({
        success: true,
        data: notification
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark all notifications as read
   * PUT /api/notifications/read-all
   */
  async markAllNotificationsRead(req, res, next) {
    try {
      const count = notificationRepository.markAllRead();

      res.json({
        success: true,
        message: `${count} notifications marked as read`
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete notification
   * DELETE /api/notifications/:id
   */
  async deleteNotification(req, res, next) {
    try {
      const { id } = req.params;
      const success = notificationRepository.delete(id);

      if (!success) {
        return res.status(404).json({
          success: false,
          error: 'Notification not found'
        });
      }

      res.json({
        success: true,
        message: 'Notification deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}

export const settingsControllerNew = new SettingsControllerNew();
export default settingsControllerNew;
