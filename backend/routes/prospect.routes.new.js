import { Router } from 'express';
import { prospectControllerNew } from '../controllers/prospect.controller.new.js';

const router = Router();

// Statistics (must be before :id routes)
router.get('/stats', prospectControllerNew.getStats.bind(prospectControllerNew));

// Bulk operations
router.post('/bulk', prospectControllerNew.createBulk.bind(prospectControllerNew));

// Basic CRUD
router.get('/', prospectControllerNew.getAll.bind(prospectControllerNew));
router.get('/:id', prospectControllerNew.getById.bind(prospectControllerNew));
router.post('/', prospectControllerNew.create.bind(prospectControllerNew));
router.put('/:id', prospectControllerNew.update.bind(prospectControllerNew));
router.delete('/:id', prospectControllerNew.delete.bind(prospectControllerNew));

// Convert to customer
router.post('/:id/convert', prospectControllerNew.convert.bind(prospectControllerNew));

export default router;
