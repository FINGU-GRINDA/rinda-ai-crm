import { customerRepository } from '../database/repositories/index.js';
import { logger } from '../utils/logger.js';

class CustomerController {
  /**
   * Get all customers
   * GET /api/customers
   */
  async getAll(req, res, next) {
    try {
      const { status, industry, search, limit, offset, orderBy, order } = req.query;

      const customers = customerRepository.findAll({
        status,
        industry,
        search,
        limit: limit ? parseInt(limit) : 100,
        offset: offset ? parseInt(offset) : 0,
        orderBy,
        order
      });

      res.json({
        success: true,
        data: customers,
        count: customers.length
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get customer by ID
   * GET /api/customers/:id
   */
  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const customer = customerRepository.findById(id);

      if (!customer) {
        return res.status(404).json({
          success: false,
          error: 'Customer not found'
        });
      }

      res.json({
        success: true,
        data: customer
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new customer
   * POST /api/customers
   */
  async create(req, res, next) {
    try {
      const { name, website, industry, notes, status } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'Customer name is required'
        });
      }

      const customer = customerRepository.create({
        name,
        website,
        industry,
        notes,
        status
      });

      res.status(201).json({
        success: true,
        data: customer
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a customer
   * PUT /api/customers/:id
   */
  async update(req, res, next) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const customer = customerRepository.update(id, updates);

      if (!customer) {
        return res.status(404).json({
          success: false,
          error: 'Customer not found'
        });
      }

      res.json({
        success: true,
        data: customer
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a customer
   * DELETE /api/customers/:id
   */
  async delete(req, res, next) {
    try {
      const { id } = req.params;
      const success = customerRepository.delete(id);

      if (!success) {
        return res.status(404).json({
          success: false,
          error: 'Customer not found'
        });
      }

      res.json({
        success: true,
        message: 'Customer deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update customer status
   * PUT /api/customers/:id/status
   */
  async updateStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status, lostReason } = req.body;

      if (!status) {
        return res.status(400).json({
          success: false,
          error: 'Status is required'
        });
      }

      const validStatuses = ['prospect', 'new', 'contact', 'negotiation', 'won', 'lost'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
      }

      const customer = customerRepository.updateStatus(id, status, lostReason);

      if (!customer) {
        return res.status(404).json({
          success: false,
          error: 'Customer not found'
        });
      }

      res.json({
        success: true,
        data: customer
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Save enrichment data
   * POST /api/customers/:id/enrichment
   */
  async saveEnrichment(req, res, next) {
    try {
      const { id } = req.params;
      const enrichment = req.body;

      const existing = customerRepository.findById(id);
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Customer not found'
        });
      }

      const customer = customerRepository.saveEnrichment(id, enrichment);

      res.json({
        success: true,
        data: customer
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get proposals for a customer
   * GET /api/customers/:id/proposals
   */
  async getProposals(req, res, next) {
    try {
      const { id } = req.params;

      const existing = customerRepository.findById(id);
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Customer not found'
        });
      }

      const proposals = customerRepository.getProposals(id);

      res.json({
        success: true,
        data: proposals
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a proposal for a customer
   * POST /api/customers/:id/proposals
   */
  async createProposal(req, res, next) {
    try {
      const { id } = req.params;
      const { title, content, imageUrl } = req.body;

      const existing = customerRepository.findById(id);
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Customer not found'
        });
      }

      if (!content) {
        return res.status(400).json({
          success: false,
          error: 'Proposal content is required'
        });
      }

      const proposal = customerRepository.saveProposal(id, { title, content, imageUrl });

      res.status(201).json({
        success: true,
        data: proposal
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get follow-up history
   * GET /api/customers/:id/follow-ups
   */
  async getFollowUps(req, res, next) {
    try {
      const { id } = req.params;

      const existing = customerRepository.findById(id);
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Customer not found'
        });
      }

      const history = customerRepository.getFollowUpHistory(id);
      const scheduled = customerRepository.getScheduledFollowUps(id);

      res.json({
        success: true,
        data: {
          history,
          scheduled
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a follow-up
   * POST /api/customers/:id/follow-ups
   */
  async createFollowUp(req, res, next) {
    try {
      const { id } = req.params;
      const { type, content, scheduledFor, priority, reason } = req.body;

      const existing = customerRepository.findById(id);
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Customer not found'
        });
      }

      if (!type) {
        return res.status(400).json({
          success: false,
          error: 'Follow-up type is required'
        });
      }

      let followUp;

      if (scheduledFor) {
        // Create scheduled follow-up
        followUp = customerRepository.saveScheduledFollowUp(id, {
          type,
          content,
          scheduledFor,
          priority,
          reason
        });
      } else {
        // Create follow-up history entry
        followUp = customerRepository.saveFollowUp(id, {
          type,
          content
        });
      }

      res.status(201).json({
        success: true,
        data: followUp
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get customer statistics
   * GET /api/customers/stats
   */
  async getStats(req, res, next) {
    try {
      const countByStatus = customerRepository.getCountByStatus();
      const dueFollowUps = customerRepository.getDueFollowUps();

      res.json({
        success: true,
        data: {
          countByStatus,
          dueFollowUpsCount: dueFollowUps.length,
          dueFollowUps: dueFollowUps.slice(0, 10) // Top 10
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

export const customerController = new CustomerController();
export default customerController;
