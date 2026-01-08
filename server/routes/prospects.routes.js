import express from 'express';
import { prospectController } from '../controllers/prospect.controller.js';
import { generalRateLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

// Apply rate limiting
router.use(generalRateLimiter);

// Manual collection trigger
router.post('/collect', prospectController.runCollection);

// Get collection status
router.get('/status', prospectController.getStatus);

// Stream collection status updates (SSE)
router.get('/status-stream', prospectController.streamStatus);

export default router;
