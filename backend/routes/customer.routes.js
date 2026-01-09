import { Router } from 'express';
import { customerController } from '../controllers/customer.controller.js';
import contactRoutes from './contact.routes.js';
import meetingRoutes from './meeting.routes.js';

const router = Router();

// Statistics (must be before :id routes)
router.get('/stats', customerController.getStats.bind(customerController));

// Basic CRUD
router.get('/', customerController.getAll.bind(customerController));
router.get('/:id', customerController.getById.bind(customerController));
router.post('/', customerController.create.bind(customerController));
router.put('/:id', customerController.update.bind(customerController));
router.delete('/:id', customerController.delete.bind(customerController));

// Status
router.put('/:id/status', customerController.updateStatus.bind(customerController));

// Enrichment
router.post('/:id/enrichment', customerController.saveEnrichment.bind(customerController));

// Proposals
router.get('/:id/proposals', customerController.getProposals.bind(customerController));
router.post('/:id/proposals', customerController.createProposal.bind(customerController));

// Follow-ups
router.get('/:id/follow-ups', customerController.getFollowUps.bind(customerController));
router.post('/:id/follow-ups', customerController.createFollowUp.bind(customerController));

// Contacts (nested routes)
router.use('/:id/contacts', contactRoutes);

// Meetings (nested routes)
router.use('/:id/meetings', meetingRoutes);

export default router;
