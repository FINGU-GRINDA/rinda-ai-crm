import { meetingRepository } from '../database/repositories/meetingRepository.js';
import { logger } from '../utils/logger.js';

export const meetingController = {
  /**
   * Get all meetings for a customer
   * GET /api/customers/:id/meetings
   */
  async getMeetings(req, res, next) {
    try {
      const { id: customerId } = req.params;
      const { limit, offset } = req.query;

      const meetings = meetingRepository.findByCustomerId(customerId, {
        limit: limit ? parseInt(limit) : 50,
        offset: offset ? parseInt(offset) : 0
      });

      res.json({
        success: true,
        data: meetings
      });
    } catch (error) {
      logger.error('Failed to get meetings:', { error: error.message });
      next(error);
    }
  },

  /**
   * Get a single meeting
   * GET /api/customers/:id/meetings/:meetingId
   */
  async getMeeting(req, res, next) {
    try {
      const { meetingId } = req.params;

      const meeting = meetingRepository.findById(meetingId);

      if (!meeting) {
        return res.status(404).json({
          success: false,
          error: '미팅 요약을 찾을 수 없습니다.',
          code: 'MEETING_NOT_FOUND'
        });
      }

      res.json({
        success: true,
        data: meeting
      });
    } catch (error) {
      logger.error('Failed to get meeting:', { error: error.message });
      next(error);
    }
  },

  /**
   * Get recent meetings
   * GET /api/meetings/recent
   */
  async getRecentMeetings(req, res, next) {
    try {
      const { limit, days } = req.query;

      const meetings = meetingRepository.findRecent({
        limit: limit ? parseInt(limit) : 10,
        days: days ? parseInt(days) : 30
      });

      res.json({
        success: true,
        data: meetings
      });
    } catch (error) {
      logger.error('Failed to get recent meetings:', { error: error.message });
      next(error);
    }
  },

  /**
   * Create a new meeting
   * POST /api/customers/:id/meetings
   */
  async createMeeting(req, res, next) {
    try {
      const { id: customerId } = req.params;
      const {
        title,
        meetingDate,
        audioFileUrl,
        duration,
        summary,
        keyDiscussions,
        actionItems,
        customerNeeds,
        budgetMentions,
        timelineMentions,
        nextSteps,
        transcription
      } = req.body;

      if (!title) {
        return res.status(400).json({
          success: false,
          error: '미팅 제목은 필수입니다.',
          code: 'MISSING_TITLE'
        });
      }

      const meeting = meetingRepository.create({
        customerId,
        title,
        meetingDate: meetingDate || Date.now(),
        audioFileUrl,
        duration,
        summary,
        keyDiscussions,
        actionItems,
        customerNeeds,
        budgetMentions,
        timelineMentions,
        nextSteps,
        transcription
      });

      res.status(201).json({
        success: true,
        data: meeting
      });
    } catch (error) {
      logger.error('Failed to create meeting:', { error: error.message });
      next(error);
    }
  },

  /**
   * Update a meeting
   * PUT /api/customers/:id/meetings/:meetingId
   */
  async updateMeeting(req, res, next) {
    try {
      const { meetingId } = req.params;
      const {
        title,
        meetingDate,
        summary,
        keyDiscussions,
        actionItems,
        customerNeeds,
        budgetMentions,
        timelineMentions,
        nextSteps,
        transcription
      } = req.body;

      const meeting = meetingRepository.update(meetingId, {
        title,
        meetingDate,
        summary,
        keyDiscussions,
        actionItems,
        customerNeeds,
        budgetMentions,
        timelineMentions,
        nextSteps,
        transcription
      });

      if (!meeting) {
        return res.status(404).json({
          success: false,
          error: '미팅 요약을 찾을 수 없습니다.',
          code: 'MEETING_NOT_FOUND'
        });
      }

      res.json({
        success: true,
        data: meeting
      });
    } catch (error) {
      logger.error('Failed to update meeting:', { error: error.message });
      next(error);
    }
  },

  /**
   * Delete a meeting
   * DELETE /api/customers/:id/meetings/:meetingId
   */
  async deleteMeeting(req, res, next) {
    try {
      const { meetingId } = req.params;

      const success = meetingRepository.delete(meetingId);

      if (!success) {
        return res.status(404).json({
          success: false,
          error: '미팅 요약을 찾을 수 없습니다.',
          code: 'MEETING_NOT_FOUND'
        });
      }

      res.json({
        success: true,
        message: '미팅 요약이 삭제되었습니다.'
      });
    } catch (error) {
      logger.error('Failed to delete meeting:', { error: error.message });
      next(error);
    }
  },

  /**
   * Get action items for a customer
   * GET /api/customers/:id/meetings/action-items
   */
  async getActionItems(req, res, next) {
    try {
      const { id: customerId } = req.params;
      const { limit } = req.query;

      const actionItems = meetingRepository.getActionItems(customerId, {
        limit: limit ? parseInt(limit) : 20
      });

      res.json({
        success: true,
        data: actionItems
      });
    } catch (error) {
      logger.error('Failed to get action items:', { error: error.message });
      next(error);
    }
  }
};

export default meetingController;
