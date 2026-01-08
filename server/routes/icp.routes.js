import { Router } from 'express';
import { icpController } from '../controllers/icp.controller.js';

const router = Router();

router.get('/', icpController.getAll.bind(icpController));
router.get('/:id', icpController.getById.bind(icpController));
router.post('/', icpController.create.bind(icpController));
router.put('/:id', icpController.update.bind(icpController));
router.delete('/:id', icpController.delete.bind(icpController));

export default router;
