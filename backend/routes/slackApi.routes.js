import express from 'express';
import * as slackApiController from '../controllers/slackApi.controller.js';

const router = express.Router();

/**
 * Slack Web API Routes
 * Base path: /api/slack
 */

// Get messages from a channel
router.get('/channels/:channelId/messages', slackApiController.getChannelMessages);

// Get Web API connection status
router.get('/web-api/status', slackApiController.getApiStatus);

export default router;
