import { contactRepository } from '../database/repositories/contactRepository.js';
import { logger } from '../utils/logger.js';

export const contactController = {
  /**
   * Get all contacts for a customer
   * GET /api/customers/:id/contacts
   */
  async getContacts(req, res, next) {
    try {
      const { id: customerId } = req.params;

      const contacts = contactRepository.findByCustomerId(customerId);

      res.json({
        success: true,
        data: contacts
      });
    } catch (error) {
      logger.error('Failed to get contacts:', { error: error.message });
      next(error);
    }
  },

  /**
   * Get a single contact
   * GET /api/customers/:id/contacts/:contactId
   */
  async getContact(req, res, next) {
    try {
      const { contactId } = req.params;

      const contact = contactRepository.findById(contactId);

      if (!contact) {
        return res.status(404).json({
          success: false,
          error: '연락처를 찾을 수 없습니다.',
          code: 'CONTACT_NOT_FOUND'
        });
      }

      res.json({
        success: true,
        data: contact
      });
    } catch (error) {
      logger.error('Failed to get contact:', { error: error.message });
      next(error);
    }
  },

  /**
   * Create a new contact
   * POST /api/customers/:id/contacts
   */
  async createContact(req, res, next) {
    try {
      const { id: customerId } = req.params;
      const { name, title, email, phone, isPrimary, source, businessCardImageUrl } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          error: '담당자 이름은 필수입니다.',
          code: 'MISSING_NAME'
        });
      }

      const contact = contactRepository.create({
        customerId,
        name,
        title,
        email,
        phone,
        isPrimary: isPrimary || false,
        source: source || 'manual',
        businessCardImageUrl
      });

      res.status(201).json({
        success: true,
        data: contact
      });
    } catch (error) {
      logger.error('Failed to create contact:', { error: error.message });
      next(error);
    }
  },

  /**
   * Update a contact
   * PUT /api/customers/:id/contacts/:contactId
   */
  async updateContact(req, res, next) {
    try {
      const { contactId } = req.params;
      const { name, title, email, phone, isPrimary } = req.body;

      const contact = contactRepository.update(contactId, {
        name,
        title,
        email,
        phone,
        isPrimary
      });

      if (!contact) {
        return res.status(404).json({
          success: false,
          error: '연락처를 찾을 수 없습니다.',
          code: 'CONTACT_NOT_FOUND'
        });
      }

      res.json({
        success: true,
        data: contact
      });
    } catch (error) {
      logger.error('Failed to update contact:', { error: error.message });
      next(error);
    }
  },

  /**
   * Delete a contact
   * DELETE /api/customers/:id/contacts/:contactId
   */
  async deleteContact(req, res, next) {
    try {
      const { contactId } = req.params;

      const success = contactRepository.delete(contactId);

      if (!success) {
        return res.status(404).json({
          success: false,
          error: '연락처를 찾을 수 없습니다.',
          code: 'CONTACT_NOT_FOUND'
        });
      }

      res.json({
        success: true,
        message: '연락처가 삭제되었습니다.'
      });
    } catch (error) {
      logger.error('Failed to delete contact:', { error: error.message });
      next(error);
    }
  }
};

export default contactController;
