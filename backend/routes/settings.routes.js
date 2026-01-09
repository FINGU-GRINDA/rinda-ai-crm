import express from 'express';
import { settingsController } from '../controllers/settings.controller.js';

const router = express.Router();

// Slack integration endpoints
router.post('/slack/validate', settingsController.validateSlackWebhook);
router.post('/slack/test', settingsController.sendSlackTestMessage);
router.post('/slack/notify', settingsController.sendSlackNotification);

export default router;
