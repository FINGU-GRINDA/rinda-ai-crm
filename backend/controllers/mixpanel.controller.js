import { mixpanelService } from '../services/mixpanel.service.js';
import { mixpanelApiClient } from '../services/mixpanelApiClient.js';
import { triggerManualSync, getMixpanelSyncJobStatus } from '../jobs/mixpanelSync.js';
import { logger } from '../utils/logger.js';

/**
 * Get Mixpanel connection status
 * GET /api/mixpanel/connection-status
 */
export const getConnectionStatus = (req, res) => {
  try {
    const status = mixpanelApiClient.getConnectionStatus();
    res.json(status);
  } catch (error) {
    logger.error('Error getting connection status:', error);
    res.status(500).json({ error: 'Failed to get connection status' });
  }
};

/**
 * Get Mixpanel integration settings
 * GET /api/mixpanel/settings
 */
export const getSettings = (req, res) => {
  try {
    const settings = mixpanelService.getSettings();
    res.json(settings);
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

    logger.info('Mixpanel settings updated');
    res.json(updatedSettings);
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
 * Get sync job status
 * GET /api/mixpanel/sync-status
 */
export const getSyncStatus = (req, res) => {
  try {
    const settings = mixpanelService.getSettings();
    const jobStatus = getMixpanelSyncJobStatus();

    res.json({
      lastSyncAt: settings.lastSyncAt,
      syncInterval: settings.syncInterval,
      isEnabled: settings.isEnabled,
      ...jobStatus
    });
  } catch (error) {
    logger.error('Error getting sync status:', error);
    res.status(500).json({ error: 'Failed to get sync status' });
  }
};

/**
 * Trigger manual sync
 * POST /api/mixpanel/sync
 */
export const syncNow = async (req, res) => {
  try {
    // Check if credentials are configured
    if (!mixpanelApiClient.hasCredentials()) {
      return res.status(400).json({
        success: false,
        error: 'Mixpanel credentials not configured. Set MIXPANEL_PROJECT_ID and MIXPANEL_PROJECT_SECRET in environment variables.'
      });
    }

    // Check if integration is enabled
    const settings = mixpanelService.getSettings();
    if (!settings.isEnabled) {
      return res.status(400).json({
        success: false,
        error: 'Mixpanel integration is disabled. Enable it first.'
      });
    }

    logger.info('Manual Mixpanel sync triggered');
    const result = await triggerManualSync();

    res.json({
      success: true,
      message: 'Sync completed',
      ...result
    });
  } catch (error) {
    logger.error('Manual sync error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Test Mixpanel connection
 * POST /api/mixpanel/test
 */
export const testConnection = async (req, res) => {
  try {
    const result = await mixpanelApiClient.testConnection();

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        authType: result.authType,
        eventsFetched: result.eventsFetched
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    logger.error('Connection test error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Test event processing with sample data
 * POST /api/mixpanel/test-event
 */
export const testEvent = async (req, res) => {
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

    logger.info('Testing Mixpanel event processing with sample event');
    const result = await mixpanelService.processEvent(sampleEvent);

    res.json({
      success: true,
      testEvent: sampleEvent,
      result
    });
  } catch (error) {
    logger.error('Event test error:', error);
    res.status(500).json({ error: 'Test failed', message: error.message });
  }
};

export default {
  getConnectionStatus,
  getSettings,
  updateSettings,
  getStatus,
  getSyncStatus,
  syncNow,
  testConnection,
  testEvent
};
