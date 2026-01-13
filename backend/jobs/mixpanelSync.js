import cron from 'node-cron';
import { mixpanelService } from '../services/mixpanel.service.js';
import { mixpanelApiClient } from '../services/mixpanelApiClient.js';
import { logger } from '../utils/logger.js';

let syncJob = null;
let isRunning = false;
let lastRunResult = null;

/**
 * Initialize Mixpanel sync background job
 * Runs on a schedule defined by MIXPANEL_SYNC_CRON env variable
 */
export function initializeMixpanelSyncJob() {
  // Check if credentials are configured
  if (!mixpanelApiClient.hasCredentials()) {
    logger.info('Mixpanel sync job not started: credentials not configured');
    return;
  }

  const enabled = process.env.MIXPANEL_SYNC_ENABLED === 'true';

  if (!enabled) {
    logger.info('Mixpanel sync background job is disabled (MIXPANEL_SYNC_ENABLED != true)');
    return;
  }

  // Default: Run every hour (0 * * * *)
  const cronSchedule = process.env.MIXPANEL_SYNC_CRON || '0 * * * *';

  // Validate cron schedule
  if (!cron.validate(cronSchedule)) {
    logger.error(`Invalid MIXPANEL_SYNC_CRON schedule: ${cronSchedule}`);
    return;
  }

  logger.info(`Initializing Mixpanel sync job with schedule: ${cronSchedule}`);

  syncJob = cron.schedule(cronSchedule, async () => {
    if (isRunning) {
      logger.warn('Mixpanel sync already running, skipping scheduled run');
      return;
    }

    try {
      isRunning = true;
      logger.info('Starting scheduled Mixpanel sync');

      const result = await mixpanelService.syncEvents();
      lastRunResult = {
        timestamp: new Date().toISOString(),
        success: true,
        ...result
      };

      logger.info('Scheduled Mixpanel sync completed', result);
    } catch (error) {
      lastRunResult = {
        timestamp: new Date().toISOString(),
        success: false,
        error: error.message
      };
      logger.error('Scheduled Mixpanel sync failed:', { error: error.message });
    } finally {
      isRunning = false;
    }
  });

  logger.info('Mixpanel sync job initialized successfully');
}

/**
 * Stop the Mixpanel sync background job
 */
export function stopMixpanelSyncJob() {
  if (syncJob) {
    syncJob.stop();
    logger.info('Mixpanel sync job stopped');
  }
}

/**
 * Get job status
 * @returns {Object} Job status information
 */
export function getMixpanelSyncJobStatus() {
  const cronSchedule = process.env.MIXPANEL_SYNC_CRON || '0 * * * *';

  return {
    enabled: syncJob !== null,
    isRunning,
    schedule: cronSchedule,
    scheduleDescription: describeCronSchedule(cronSchedule),
    lastRunResult,
    credentialsConfigured: mixpanelApiClient.hasCredentials()
  };
}

/**
 * Trigger manual sync (outside of scheduled runs)
 * @returns {Promise<Object>} Sync result
 */
export async function triggerManualSync() {
  if (isRunning) {
    throw new Error('Sync is already running');
  }

  if (!mixpanelApiClient.hasCredentials()) {
    throw new Error('Mixpanel credentials not configured');
  }

  try {
    isRunning = true;
    logger.info('Starting manual Mixpanel sync');

    const result = await mixpanelService.syncEvents();
    lastRunResult = {
      timestamp: new Date().toISOString(),
      success: true,
      manual: true,
      ...result
    };

    logger.info('Manual Mixpanel sync completed', result);
    return result;
  } catch (error) {
    lastRunResult = {
      timestamp: new Date().toISOString(),
      success: false,
      manual: true,
      error: error.message
    };
    throw error;
  } finally {
    isRunning = false;
  }
}

/**
 * Describe cron schedule in human-readable format
 * @param {string} cronSchedule - Cron schedule expression
 * @returns {string} Human-readable description
 */
function describeCronSchedule(cronSchedule) {
  const scheduleDescriptions = {
    '0 * * * *': '매시간',
    '*/30 * * * *': '30분마다',
    '0 */2 * * *': '2시간마다',
    '0 */4 * * *': '4시간마다',
    '0 */6 * * *': '6시간마다',
    '0 */12 * * *': '12시간마다',
    '0 0 * * *': '매일 자정',
    '0 2 * * *': '매일 오전 2시',
    '0 9 * * *': '매일 오전 9시',
  };

  return scheduleDescriptions[cronSchedule] || cronSchedule;
}

export default {
  initializeMixpanelSyncJob,
  stopMixpanelSyncJob,
  getMixpanelSyncJobStatus,
  triggerManualSync
};
