import { Router } from 'express';
import { gmailController } from '../controllers/gmail.controller.js';

const router = Router();

// OAuth endpoints
router.get('/oauth/authorize', gmailController.authorize.bind(gmailController));
router.get('/oauth/callback', gmailController.callback.bind(gmailController));
router.post('/disconnect', gmailController.disconnect.bind(gmailController));

// Status
router.get('/status', gmailController.getStatus.bind(gmailController));

// Sync
router.post('/sync', gmailController.sync.bind(gmailController));

// Messages
router.get('/messages', gmailController.getMessages.bind(gmailController));
router.get('/messages/unmatched', gmailController.getUnmatchedMessages.bind(gmailController));
router.get('/messages/customer/:customerId', gmailController.getCustomerMessages.bind(gmailController));
router.put('/messages/:id/customer', gmailController.updateEmailCustomer.bind(gmailController));

// Settings
router.put('/settings', gmailController.updateSettings.bind(gmailController));

export default router;
