import { gmailService } from '../services/gmail.service.js';
import { emailRepository, settingsRepository } from '../database/repositories/index.js';
import { logger } from '../utils/logger.js';

class GmailController {
  /**
   * Get Gmail OAuth authorization URL
   * GET /api/gmail/oauth/authorize
   */
  async authorize(req, res, next) {
    try {
      if (!gmailService.isConfigured()) {
        return res.status(503).json({
          success: false,
          error: 'Gmail OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.'
        });
      }

      const authUrl = gmailService.getAuthUrl();

      res.json({
        success: true,
        data: { authUrl }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handle OAuth callback
   * GET /api/gmail/oauth/callback
   */
  async callback(req, res, next) {
    try {
      const { code, error: oauthError } = req.query;

      if (oauthError) {
        logger.error('Gmail OAuth error:', oauthError);
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings?error=gmail_auth_failed`);
      }

      if (!code) {
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings?error=no_code`);
      }

      await gmailService.exchangeCodeForTokens(code);

      // Redirect to frontend with success
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings?gmail=connected`);
    } catch (error) {
      logger.error('Gmail OAuth callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings?error=gmail_token_exchange`);
    }
  }

  /**
   * Disconnect Gmail
   * POST /api/gmail/disconnect
   */
  async disconnect(req, res, next) {
    try {
      gmailService.disconnect();

      res.json({
        success: true,
        message: 'Gmail disconnected successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Gmail connection status
   * GET /api/gmail/status
   */
  async getStatus(req, res, next) {
    try {
      const status = gmailService.getStatus();

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Sync emails
   * POST /api/gmail/sync
   */
  async sync(req, res, next) {
    try {
      const { maxResults, afterDate } = req.body;

      const result = await gmailService.syncEmails({
        maxResults: maxResults || 50,
        afterDate
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      if (error.message.includes('not connected')) {
        return res.status(401).json({
          success: false,
          error: 'Gmail is not connected. Please authenticate first.'
        });
      }
      next(error);
    }
  }

  /**
   * Get synced emails
   * GET /api/gmail/messages
   */
  async getMessages(req, res, next) {
    try {
      const { customerId, search, limit, offset } = req.query;

      const emails = emailRepository.findAll({
        customerId,
        search,
        limit: limit ? parseInt(limit) : 100,
        offset: offset ? parseInt(offset) : 0
      });

      res.json({
        success: true,
        data: emails,
        count: emails.length
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get emails for a customer
   * GET /api/gmail/messages/customer/:customerId
   */
  async getCustomerMessages(req, res, next) {
    try {
      const { customerId } = req.params;
      const { limit, offset } = req.query;

      const emails = emailRepository.findByCustomerId(customerId, {
        limit: limit ? parseInt(limit) : 50,
        offset: offset ? parseInt(offset) : 0
      });

      res.json({
        success: true,
        data: emails
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get unmatched emails
   * GET /api/gmail/messages/unmatched
   */
  async getUnmatchedMessages(req, res, next) {
    try {
      const { limit } = req.query;

      const emails = emailRepository.findUnmatched(limit ? parseInt(limit) : 50);

      res.json({
        success: true,
        data: emails,
        count: emails.length
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update email customer association
   * PUT /api/gmail/messages/:id/customer
   */
  async updateEmailCustomer(req, res, next) {
    try {
      const { id } = req.params;
      const { customerId } = req.body;

      const email = emailRepository.updateCustomer(id, customerId);

      if (!email) {
        return res.status(404).json({
          success: false,
          error: 'Email not found'
        });
      }

      res.json({
        success: true,
        data: email
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update email settings
   * PUT /api/gmail/settings
   */
  async updateSettings(req, res, next) {
    try {
      const { autoSync, syncInterval } = req.body;

      const settings = settingsRepository.updateEmailSettings({
        autoSync,
        syncInterval
      });

      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      next(error);
    }
  }
}

export const gmailController = new GmailController();
export default gmailController;
