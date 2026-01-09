import { Router } from 'express';
import { migrationController } from '../controllers/migration.controller.js';

const router = Router();

router.post('/localstorage', migrationController.migrateFromLocalStorage.bind(migrationController));
router.get('/status', migrationController.getStatus.bind(migrationController));
router.get('/export', migrationController.exportData.bind(migrationController));

export default router;
