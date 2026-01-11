import express from 'express';
import {
  handleWebhook,
  getSettings,
  updateSettings,
  getStatus,
  getWebhookInfo,
  testWebhook
} from '../controllers/mixpanel.controller.js';

const router = express.Router();

// Webhook endpoint (receives events from Mixpanel)
router.post('/webhook', handleWebhook);

// Settings management
router.get('/settings', getSettings);
router.put('/settings', updateSettings);

// Status and info
router.get('/status', getStatus);
router.get('/webhook-info', getWebhookInfo);

// Test endpoint
router.post('/test', testWebhook);

export default router;
