import express from 'express';
import { meetingController } from '../controllers/meeting.controller.js';

const router = express.Router({ mergeParams: true });

// GET /api/customers/:id/meetings - Get all meetings for a customer
router.get('/', meetingController.getMeetings);

// GET /api/customers/:id/meetings/action-items - Get action items for a customer
router.get('/action-items', meetingController.getActionItems);

// GET /api/customers/:id/meetings/:meetingId - Get a single meeting
router.get('/:meetingId', meetingController.getMeeting);

// POST /api/customers/:id/meetings - Create a new meeting
router.post('/', meetingController.createMeeting);

// PUT /api/customers/:id/meetings/:meetingId - Update a meeting
router.put('/:meetingId', meetingController.updateMeeting);

// DELETE /api/customers/:id/meetings/:meetingId - Delete a meeting
router.delete('/:meetingId', meetingController.deleteMeeting);

export default router;
