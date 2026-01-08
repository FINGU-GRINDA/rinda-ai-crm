import { Router } from 'express';
import { slackEventController } from '../controllers/slackEvent.controller.js';
import { verifySlackRequest } from '../middleware/slackVerify.js';

const router = Router();

// Slack Event API endpoint (with signature verification)
router.post('/events', verifySlackRequest, slackEventController.handleEvent.bind(slackEventController));

// Status and management endpoints
router.get('/status', slackEventController.getStatus.bind(slackEventController));
router.get('/messages', slackEventController.getMessages.bind(slackEventController));
router.get('/messages/customer/:customerId', slackEventController.getCustomerMessages.bind(slackEventController));
router.post('/event-api/toggle', slackEventController.toggleEventApi.bind(slackEventController));
router.post('/reprocess', slackEventController.reprocessMessages.bind(slackEventController));

export default router;
