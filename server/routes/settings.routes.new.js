import { Router } from 'express';
import { settingsControllerNew } from '../controllers/settings.controller.new.js';

const router = Router();

// General settings
router.get('/', settingsControllerNew.getAll.bind(settingsControllerNew));
router.get('/:key', settingsControllerNew.get.bind(settingsControllerNew));
router.put('/:key', settingsControllerNew.update.bind(settingsControllerNew));

// Slack settings
router.get('/slack', settingsControllerNew.getSlackSettings.bind(settingsControllerNew));
router.put('/slack', settingsControllerNew.updateSlackSettings.bind(settingsControllerNew));
router.post('/slack/validate', settingsControllerNew.validateSlackWebhook.bind(settingsControllerNew));
router.post('/slack/test', settingsControllerNew.sendSlackTestMessage.bind(settingsControllerNew));
router.post('/slack/notify', settingsControllerNew.sendSlackNotification.bind(settingsControllerNew));

// Email settings
router.get('/email', settingsControllerNew.getEmailSettings.bind(settingsControllerNew));
router.put('/email', settingsControllerNew.updateEmailSettings.bind(settingsControllerNew));

// Collection settings
router.get('/collection', settingsControllerNew.getCollectionSettings.bind(settingsControllerNew));
router.put('/collection', settingsControllerNew.updateCollectionSettings.bind(settingsControllerNew));

export default router;

// Notifications router (separate)
export const notificationsRouter = Router();

notificationsRouter.get('/', settingsControllerNew.getNotifications.bind(settingsControllerNew));
notificationsRouter.put('/read-all', settingsControllerNew.markAllNotificationsRead.bind(settingsControllerNew));
notificationsRouter.put('/:id/read', settingsControllerNew.markNotificationRead.bind(settingsControllerNew));
notificationsRouter.delete('/:id', settingsControllerNew.deleteNotification.bind(settingsControllerNew));
