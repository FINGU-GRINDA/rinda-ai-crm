import express from 'express';
import { contactController } from '../controllers/contact.controller.js';

const router = express.Router({ mergeParams: true });

// GET /api/customers/:id/contacts - Get all contacts for a customer
router.get('/', contactController.getContacts);

// GET /api/customers/:id/contacts/:contactId - Get a single contact
router.get('/:contactId', contactController.getContact);

// POST /api/customers/:id/contacts - Create a new contact
router.post('/', contactController.createContact);

// PUT /api/customers/:id/contacts/:contactId - Update a contact
router.put('/:contactId', contactController.updateContact);

// DELETE /api/customers/:id/contacts/:contactId - Delete a contact
router.delete('/:contactId', contactController.deleteContact);

export default router;
