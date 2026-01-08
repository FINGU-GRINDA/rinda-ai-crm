import { prospectCollectionService } from '../services/prospectCollection.service.js';
import { logger } from '../utils/logger.js';

/**
 * Prospect Controller
 * Handles prospect collection endpoints
 */
export const prospectController = {
  /**
   * Run manual prospect collection
   * POST /api/prospects/collect
   */
  async runCollection(req, res, next) {
    try {
      const { icpProfiles, existingCompanyNames } = req.body;

      if (!icpProfiles || !Array.isArray(icpProfiles)) {
        return res.status(400).json({
          error: 'ICP profiles are required',
          code: 'MISSING_ICP_PROFILES'
        });
      }

      if (icpProfiles.length === 0) {
        return res.json({
          newProspects: [],
          totalArticles: 0,
          message: 'No ICP profiles provided'
        });
      }

      logger.info(`Manual collection triggered for ${icpProfiles.length} ICP profiles`);

      const result = await prospectCollectionService.runCollection(
        icpProfiles,
        existingCompanyNames || []
      );

      res.json(result);
    } catch (error) {
      if (error.message === 'Collection is already running') {
        return res.status(409).json({
          error: 'Collection is already in progress',
          code: 'COLLECTION_RUNNING'
        });
      }
      next(error);
    }
  },

  /**
   * Get collection status
   * GET /api/prospects/status
   */
  async getStatus(req, res, next) {
    try {
      const status = prospectCollectionService.getCollectionStatus();
      res.json(status);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Stream collection status updates (Server-Sent Events)
   * GET /api/prospects/status-stream
   */
  streamStatus(req, res) {
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendStatus = (status) => {
      res.write(`data: ${JSON.stringify(status)}\n\n`);
    };

    // Send initial status
    sendStatus(prospectCollectionService.getCollectionStatus());

    // Listen for status updates
    prospectCollectionService.on('status', sendStatus);

    // Cleanup on client disconnect
    req.on('close', () => {
      prospectCollectionService.off('status', sendStatus);
      res.end();
    });
  }
};
