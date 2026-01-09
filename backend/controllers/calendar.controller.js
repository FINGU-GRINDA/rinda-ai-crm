import { calendarService } from '../services/calendar.service.js';
import { logger } from '../utils/logger.js';

class CalendarController {
  /**
   * Get Calendar OAuth authorization URL
   * GET /api/calendar/oauth/authorize
   */
  async authorize(req, res, next) {
    try {
      if (!calendarService.isConfigured()) {
        return res.status(503).json({
          success: false,
          error: 'Calendar OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.'
        });
      }

      const authUrl = calendarService.getAuthUrl();

      res.json({
        success: true,
        data: { authUrl }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handle OAuth callback
   * GET /api/calendar/oauth/callback
   */
  async callback(req, res, next) {
    try {
      const { code, error: oauthError } = req.query;

      if (oauthError) {
        logger.error('Calendar OAuth error:', oauthError);
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings?error=calendar_auth_failed`);
      }

      if (!code) {
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings?error=no_code`);
      }

      await calendarService.exchangeCodeForTokens(code);

      // Redirect to frontend with success
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings?calendar=connected`);
    } catch (error) {
      logger.error('Calendar OAuth callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings?error=calendar_token_exchange`);
    }
  }

  /**
   * Disconnect Calendar
   * POST /api/calendar/disconnect
   */
  async disconnect(req, res, next) {
    try {
      calendarService.disconnect();

      res.json({
        success: true,
        message: 'Calendar disconnected successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Calendar connection status
   * GET /api/calendar/status
   */
  async getStatus(req, res, next) {
    try {
      const status = calendarService.getStatus();

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get upcoming events
   * GET /api/calendar/events
   */
  async getEvents(req, res, next) {
    try {
      const { maxResults, timeMin, timeMax } = req.query;

      const events = await calendarService.listEvents({
        maxResults: maxResults ? parseInt(maxResults) : 10,
        timeMin,
        timeMax
      });

      res.json({
        success: true,
        data: events
      });
    } catch (error) {
      if (error.message.includes('not connected')) {
        return res.status(401).json({
          success: false,
          error: 'Calendar is not connected. Please authenticate first.'
        });
      }
      next(error);
    }
  }

  /**
   * Get today's events
   * GET /api/calendar/events/today
   */
  async getTodayEvents(req, res, next) {
    try {
      const events = await calendarService.getTodayEvents();

      res.json({
        success: true,
        data: events
      });
    } catch (error) {
      if (error.message.includes('not connected')) {
        return res.status(401).json({
          success: false,
          error: 'Calendar is not connected. Please authenticate first.'
        });
      }
      next(error);
    }
  }

  /**
   * Get upcoming meetings (next 7 days)
   * GET /api/calendar/events/upcoming
   */
  async getUpcomingMeetings(req, res, next) {
    try {
      const events = await calendarService.getUpcomingMeetings();

      res.json({
        success: true,
        data: events
      });
    } catch (error) {
      if (error.message.includes('not connected')) {
        return res.status(401).json({
          success: false,
          error: 'Calendar is not connected. Please authenticate first.'
        });
      }
      next(error);
    }
  }

  /**
   * Get event details
   * GET /api/calendar/events/:eventId
   */
  async getEvent(req, res, next) {
    try {
      const { eventId } = req.params;

      const event = await calendarService.getEvent(eventId);

      res.json({
        success: true,
        data: event
      });
    } catch (error) {
      if (error.message.includes('not connected')) {
        return res.status(401).json({
          success: false,
          error: 'Calendar is not connected. Please authenticate first.'
        });
      }
      next(error);
    }
  }
}

export const calendarController = new CalendarController();
export default calendarController;
