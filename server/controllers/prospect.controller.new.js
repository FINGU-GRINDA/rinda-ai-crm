import { prospectRepository, customerRepository } from '../database/repositories/index.js';
import { logger } from '../utils/logger.js';

class ProspectControllerNew {
  /**
   * Get all prospects
   * GET /api/prospects
   */
  async getAll(req, res, next) {
    try {
      const { signalStrength, industry, search, converted, limit, offset, orderBy, order } = req.query;

      const prospects = prospectRepository.findAll({
        signalStrength,
        industry,
        search,
        converted: converted === 'true' ? true : converted === 'false' ? false : undefined,
        limit: limit ? parseInt(limit) : 100,
        offset: offset ? parseInt(offset) : 0,
        orderBy,
        order
      });

      res.json({
        success: true,
        data: prospects,
        count: prospects.length
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get prospect by ID
   * GET /api/prospects/:id
   */
  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const prospect = prospectRepository.findById(id);

      if (!prospect) {
        return res.status(404).json({
          success: false,
          error: 'Prospect not found'
        });
      }

      res.json({
        success: true,
        data: prospect
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new prospect
   * POST /api/prospects
   */
  async create(req, res, next) {
    try {
      const { companyName, website, industry, sourceArticle, signalStrength, icpMatch, notes } = req.body;

      if (!companyName) {
        return res.status(400).json({
          success: false,
          error: 'Company name is required'
        });
      }

      // Check for duplicate
      if (prospectRepository.exists(companyName)) {
        return res.status(409).json({
          success: false,
          error: 'Prospect with this company name already exists'
        });
      }

      const prospect = prospectRepository.create({
        companyName,
        website,
        industry,
        sourceArticle,
        signalStrength,
        icpMatch,
        notes
      });

      res.status(201).json({
        success: true,
        data: prospect
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create multiple prospects (bulk)
   * POST /api/prospects/bulk
   */
  async createBulk(req, res, next) {
    try {
      const { prospects } = req.body;

      if (!prospects || !Array.isArray(prospects) || prospects.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Prospects array is required'
        });
      }

      // Filter out duplicates
      const existingNames = new Set(prospectRepository.getAllCompanyNames());
      const newProspects = prospects.filter(p => p.companyName && !existingNames.has(p.companyName));

      if (newProspects.length === 0) {
        return res.json({
          success: true,
          data: [],
          message: 'All prospects already exist',
          skipped: prospects.length
        });
      }

      const created = prospectRepository.createMany(newProspects);

      res.status(201).json({
        success: true,
        data: created,
        count: created.length,
        skipped: prospects.length - created.length
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a prospect
   * PUT /api/prospects/:id
   */
  async update(req, res, next) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const prospect = prospectRepository.update(id, updates);

      if (!prospect) {
        return res.status(404).json({
          success: false,
          error: 'Prospect not found'
        });
      }

      res.json({
        success: true,
        data: prospect
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a prospect
   * DELETE /api/prospects/:id
   */
  async delete(req, res, next) {
    try {
      const { id } = req.params;
      const success = prospectRepository.delete(id);

      if (!success) {
        return res.status(404).json({
          success: false,
          error: 'Prospect not found'
        });
      }

      res.json({
        success: true,
        message: 'Prospect deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Convert prospect to customer
   * POST /api/prospects/:id/convert
   */
  async convert(req, res, next) {
    try {
      const { id } = req.params;
      const { status = 'new', notes } = req.body;

      const prospect = prospectRepository.findById(id);

      if (!prospect) {
        return res.status(404).json({
          success: false,
          error: 'Prospect not found'
        });
      }

      if (prospect.convertedToCustomerId) {
        return res.status(400).json({
          success: false,
          error: 'Prospect has already been converted'
        });
      }

      // Create customer from prospect
      const customer = customerRepository.create({
        name: prospect.companyName,
        website: prospect.website,
        industry: prospect.industry,
        notes: notes || prospect.notes || '',
        status
      });

      // Mark prospect as converted
      prospectRepository.convertToCustomer(id, customer.id);

      res.status(201).json({
        success: true,
        data: {
          customer,
          prospect: prospectRepository.findById(id)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get prospect statistics
   * GET /api/prospects/stats
   */
  async getStats(req, res, next) {
    try {
      const countBySignal = prospectRepository.getCountBySignal();
      const unconvertedCount = prospectRepository.getUnconvertedCount();

      res.json({
        success: true,
        data: {
          countBySignal,
          unconvertedCount,
          total: Object.values(countBySignal).reduce((a, b) => a + b, 0)
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

export const prospectControllerNew = new ProspectControllerNew();
export default prospectControllerNew;
