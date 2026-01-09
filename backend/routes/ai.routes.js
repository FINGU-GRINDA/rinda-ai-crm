import express from 'express';
import { aiAssistantController } from '../controllers/aiAssistant.controller.js';
import { aiRateLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

// Apply rate limiting to all AI endpoints
// 30 requests per 15 minutes
router.use(aiRateLimiter);

// Intent parsing
router.post('/parse-intent', aiAssistantController.parseIntent);

// Customer enrichment
router.post('/enrich', aiAssistantController.enrichCustomer);

// Proposal generation
router.post('/generate-proposal', aiAssistantController.generateProposal);

// AI response generation
router.post('/generate-response', aiAssistantController.generateResponse);

// Business card scanning
router.post('/scan-business-card', aiAssistantController.scanBusinessCard);

// Meeting summarization
router.post('/summarize-meeting', aiAssistantController.summarizeMeeting);

export default router;
