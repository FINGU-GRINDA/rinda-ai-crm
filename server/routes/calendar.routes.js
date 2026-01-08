import { Router } from 'express';
import { calendarController } from '../controllers/calendar.controller.js';

const router = Router();

// OAuth endpoints
router.get('/oauth/authorize', calendarController.authorize.bind(calendarController));
router.get('/oauth/callback', calendarController.callback.bind(calendarController));
router.post('/disconnect', calendarController.disconnect.bind(calendarController));

// Status
router.get('/status', calendarController.getStatus.bind(calendarController));

// Events
router.get('/events', calendarController.getEvents.bind(calendarController));
router.get('/events/today', calendarController.getTodayEvents.bind(calendarController));
router.get('/events/upcoming', calendarController.getUpcomingMeetings.bind(calendarController));
router.get('/events/:eventId', calendarController.getEvent.bind(calendarController));

export default router;
