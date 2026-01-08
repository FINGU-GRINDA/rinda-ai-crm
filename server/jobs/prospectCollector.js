import cron from 'node-cron';
import { prospectCollectionService } from '../services/prospectCollection.service.js';
import { logger } from '../utils/logger.js';

let collectionJob = null;
let isRunning = false;

/**
 * Initialize prospect collection background job
 * Runs on a schedule defined by PROSPECT_COLLECTION_CRON env variable
 */
export function initializeProspectCollectionJob() {
  const enabled = process.env.PROSPECT_COLLECTION_ENABLED === 'true';

  if (!enabled) {
    logger.info('Prospect collection background job is disabled');
    return;
  }

  // Default: Run every hour (0 * * * *)
  const cronSchedule = process.env.PROSPECT_COLLECTION_CRON || '0 * * * *';

  logger.info(`Initializing prospect collection job with schedule: ${cronSchedule}`);

  collectionJob = cron.schedule(cronSchedule, async () => {
    if (isRunning) {
      logger.warn('Collection already running, skipping scheduled run');
      return;
    }

    try {
      isRunning = true;
      logger.info('Starting scheduled prospect collection');

      const result = await prospectCollectionService.runScheduledCollection();

      logger.info('Scheduled collection completed', result);
    } catch (error) {
      logger.error('Scheduled collection failed:', { error: error.message });
    } finally {
      isRunning = false;
    }
  });

  logger.info(`Prospect collection job initialized successfully`);
}

/**
 * Stop the prospect collection background job
 */
export function stopProspectCollectionJob() {
  if (collectionJob) {
    collectionJob.stop();
    logger.info('Prospect collection job stopped');
  }
}

/**
 * Get job status
 */
export function getJobStatus() {
  return {
    enabled: collectionJob !== null,
    isRunning,
    schedule: process.env.PROSPECT_COLLECTION_CRON || '0 * * * *'
  };
}
