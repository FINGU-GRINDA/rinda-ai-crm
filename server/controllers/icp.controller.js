import { icpRepository } from '../database/repositories/index.js';
import { logger } from '../utils/logger.js';

class ICPController {
  /**
   * Get all ICP profiles
   * GET /api/icp-profiles
   */
  async getAll(req, res, next) {
    try {
      const profiles = icpRepository.findAll();

      res.json({
        success: true,
        data: profiles,
        count: profiles.length
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get ICP profile by ID
   * GET /api/icp-profiles/:id
   */
  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const profile = icpRepository.findById(id);

      if (!profile) {
        return res.status(404).json({
          success: false,
          error: 'ICP Profile not found'
        });
      }

      res.json({
        success: true,
        data: profile
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new ICP profile
   * POST /api/icp-profiles
   */
  async create(req, res, next) {
    try {
      const { name, industries, keywords, companySize, targetRegions } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'Profile name is required'
        });
      }

      const profile = icpRepository.create({
        name,
        industries,
        keywords,
        companySize,
        targetRegions
      });

      res.status(201).json({
        success: true,
        data: profile
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update an ICP profile
   * PUT /api/icp-profiles/:id
   */
  async update(req, res, next) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const profile = icpRepository.update(id, updates);

      if (!profile) {
        return res.status(404).json({
          success: false,
          error: 'ICP Profile not found'
        });
      }

      res.json({
        success: true,
        data: profile
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete an ICP profile
   * DELETE /api/icp-profiles/:id
   */
  async delete(req, res, next) {
    try {
      const { id } = req.params;
      const success = icpRepository.delete(id);

      if (!success) {
        return res.status(404).json({
          success: false,
          error: 'ICP Profile not found'
        });
      }

      res.json({
        success: true,
        message: 'ICP Profile deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}

export const icpController = new ICPController();
export default icpController;
