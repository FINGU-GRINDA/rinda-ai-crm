import { mixpanelService } from '../services/mixpanel.service.js';
import { logger } from '../utils/logger.js';

/**
 * Handle Mixpanel webhook
 * POST /api/mixpanel/webhook
 */
export const handleWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-mixpanel-signature'];
    const rawBody = JSON.stringify(req.body);

    // Verify signature if configured
    if (!mixpanelService.verifyWebhookSignature(rawBody, signature)) {
      logger.warn('Invalid Mixpanel webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Handle single event or batch
    const body = req.body;

    if (Array.isArray(body)) {
      // Batch of events
      const result = await mixpanelService.processBatchEvents(body);
      return res.json({
        success: true,
        ...result
      });
    } else if (body.event) {
      // Single event
      const result = await mixpanelService.processWebhookEvent(body);
      return res.json({
        success: true,
        ...result
      });
    } else {
      // Unknown format
      logger.warn('Unknown Mixpanel webhook format:', body);
      return res.status(400).json({ error: 'Unknown webhook format' });
    }

  } catch (error) {
    logger.error('Mixpanel webhook error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

/**
 * Get Mixpanel integration settings
 * GET /api/mixpanel/settings
 */
export const getSettings = (req, res) => {
  try {
    const settings = mixpanelService.getSettings();

    // Mask sensitive data
    const maskedSettings = {
      ...settings,
      apiSecret: settings.apiSecret ? '********' : null,
      webhookSecret: settings.webhookSecret ? '********' : null
    };

    res.json(maskedSettings);
  } catch (error) {
    logger.error('Error getting Mixpanel settings:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
};

/**
 * Update Mixpanel integration settings
 * PUT /api/mixpanel/settings
 */
export const updateSettings = (req, res) => {
  try {
    const updates = req.body;

    // Validate tracked events if provided
    if (updates.trackedEvents && !Array.isArray(updates.trackedEvents)) {
      return res.status(400).json({ error: 'trackedEvents must be an array' });
    }

    const updatedSettings = mixpanelService.updateSettings(updates);

    // Mask sensitive data in response
    const maskedSettings = {
      ...updatedSettings,
      apiSecret: updatedSettings.apiSecret ? '********' : null,
      webhookSecret: updatedSettings.webhookSecret ? '********' : null
    };

    logger.info('Mixpanel settings updated');
    res.json(maskedSettings);
  } catch (error) {
    logger.error('Error updating Mixpanel settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
};

/**
 * Get Mixpanel integration status
 * GET /api/mixpanel/status
 */
export const getStatus = (req, res) => {
  try {
    const status = mixpanelService.getStatus();
    res.json(status);
  } catch (error) {
    logger.error('Error getting Mixpanel status:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
};

/**
 * Get webhook configuration info
 * GET /api/mixpanel/webhook-info
 */
export const getWebhookInfo = (req, res) => {
  try {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const info = mixpanelService.getWebhookInfo(baseUrl);
    res.json(info);
  } catch (error) {
    logger.error('Error getting webhook info:', error);
    res.status(500).json({ error: 'Failed to get webhook info' });
  }
};

/**
 * Test Mixpanel webhook with sample data
 * POST /api/mixpanel/test
 */
export const testWebhook = async (req, res) => {
  try {
    const sampleEvent = {
      event: req.body.event || '$signup',
      properties: {
        distinct_id: 'test_user_' + Date.now(),
        $email: req.body.email || 'test@example.com',
        $name: req.body.name || 'Test User',
        company: req.body.company || 'Test Company',
        ...req.body.properties
      }
    };

    logger.info('Testing Mixpanel webhook with sample event');
    const result = await mixpanelService.processWebhookEvent(sampleEvent);

    res.json({
      success: true,
      testEvent: sampleEvent,
      result
    });
  } catch (error) {
    logger.error('Mixpanel test error:', error);
    res.status(500).json({ error: 'Test failed', message: error.message });
  }
};

export default {
  handleWebhook,
  getSettings,
  updateSettings,
  getStatus,
  getWebhookInfo,
  testWebhook
};
