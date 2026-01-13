import express from 'express';
import {
  getConnectionStatus,
  getSettings,
  updateSettings,
  getStatus,
  getSyncStatus,
  syncNow,
  testConnection,
  testEvent
} from '../controllers/mixpanel.controller.js';

const router = express.Router();

// Connection status (check if env vars are configured)
router.get('/connection-status', getConnectionStatus);

// Settings management
router.get('/settings', getSettings);
router.put('/settings', updateSettings);

// Status and sync info
router.get('/status', getStatus);
router.get('/sync-status', getSyncStatus);

// Sync endpoints
router.post('/sync', syncNow);

// Test endpoints
router.post('/test', testConnection);
router.post('/test-event', testEvent);

export default router;
