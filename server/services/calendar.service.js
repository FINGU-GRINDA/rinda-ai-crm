import { google } from 'googleapis';
import { oauthRepository, settingsRepository } from '../database/repositories/index.js';
import { logger } from '../utils/logger.js';

class CalendarService {
  constructor() {
    this.oauth2Client = null;
    this.initializeOAuthClient();
  }

  /**
   * Initialize OAuth2 client
   */
  initializeOAuthClient() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI || 'http://localhost:3001/api/calendar/oauth/callback';

    if (clientId && clientSecret) {
      this.oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        redirectUri
      );
      logger.info('Calendar OAuth client initialized');
    } else {
      logger.warn('Calendar OAuth credentials not configured');
    }
  }

  /**
   * Check if Calendar is configured
   * @returns {boolean}
   */
  isConfigured() {
    return this.oauth2Client !== null;
  }

  /**
   * Generate OAuth authorization URL
   * @returns {string} Authorization URL
   */
  getAuthUrl() {
    if (!this.oauth2Client) {
      throw new Error('Calendar OAuth not configured');
    }

    const scopes = [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events.readonly'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  /**
   * Exchange authorization code for tokens
   * @param {string} code - Authorization code
   * @returns {Object} Token information
   */
  async exchangeCodeForTokens(code) {
    if (!this.oauth2Client) {
      throw new Error('Calendar OAuth not configured');
    }

    const { tokens } = await this.oauth2Client.getToken(code);

    // Save tokens to database
    oauthRepository.saveTokens('calendar', {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expiry_date,
      scope: tokens.scope
    });

    // Update calendar settings
    settingsRepository.updateCalendarSettings({
      provider: 'google',
      isConnected: true
    });

    logger.info('Calendar tokens saved successfully');

    return {
      accessToken: tokens.access_token,
      expiresAt: tokens.expiry_date
    };
  }

  /**
   * Get valid access token (refresh if needed)
   * @returns {string} Valid access token
   */
  async getValidAccessToken() {
    const tokens = oauthRepository.getTokens('calendar');

    if (!tokens) {
      throw new Error('Calendar not connected');
    }

    // Check if token is expired (with 5 minute buffer)
    if (tokens.expiresAt && tokens.expiresAt < Date.now() + 5 * 60 * 1000) {
      if (!tokens.refreshToken) {
        throw new Error('No refresh token available. Please reconnect Calendar.');
      }

      // Refresh the token
      this.oauth2Client.setCredentials({
        refresh_token: tokens.refreshToken
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();

      // Save new access token
      oauthRepository.updateAccessToken(
        'calendar',
        credentials.access_token,
        credentials.expiry_date
      );

      return credentials.access_token;
    }

    return tokens.accessToken;
  }

  /**
   * Get Calendar API client
   * @returns {Object} Calendar API client
   */
  async getCalendarClient() {
    const accessToken = await this.getValidAccessToken();

    this.oauth2Client.setCredentials({
      access_token: accessToken
    });

    return google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * List upcoming events
   * @param {Object} options - Query options
   * @returns {Array} List of events
   */
  async listEvents(options = {}) {
    const {
      maxResults = 10,
      timeMin = new Date().toISOString(),
      timeMax,
      calendarId = 'primary'
    } = options;

    const calendar = await this.getCalendarClient();

    const params = {
      calendarId,
      timeMin,
      maxResults,
      singleEvents: true,
      orderBy: 'startTime'
    };

    if (timeMax) {
      params.timeMax = timeMax;
    }

    const response = await calendar.events.list(params);

    return (response.data.items || []).map(event => ({
      id: event.id,
      title: event.summary || '(제목 없음)',
      description: event.description,
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      location: event.location,
      attendees: (event.attendees || []).map(a => ({
        email: a.email,
        displayName: a.displayName,
        responseStatus: a.responseStatus
      })),
      hangoutLink: event.hangoutLink,
      htmlLink: event.htmlLink,
      status: event.status
    }));
  }

  /**
   * Get event details
   * @param {string} eventId - Event ID
   * @param {string} calendarId - Calendar ID
   * @returns {Object} Event details
   */
  async getEvent(eventId, calendarId = 'primary') {
    const calendar = await this.getCalendarClient();

    const response = await calendar.events.get({
      calendarId,
      eventId
    });

    const event = response.data;

    return {
      id: event.id,
      title: event.summary || '(제목 없음)',
      description: event.description,
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      location: event.location,
      attendees: (event.attendees || []).map(a => ({
        email: a.email,
        displayName: a.displayName,
        responseStatus: a.responseStatus
      })),
      hangoutLink: event.hangoutLink,
      htmlLink: event.htmlLink,
      status: event.status
    };
  }

  /**
   * Get today's events
   * @returns {Array} Today's events
   */
  async getTodayEvents() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.listEvents({
      timeMin: today.toISOString(),
      timeMax: tomorrow.toISOString(),
      maxResults: 50
    });
  }

  /**
   * Get upcoming meetings (next 7 days)
   * @returns {Array} Upcoming meetings
   */
  async getUpcomingMeetings() {
    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    return this.listEvents({
      timeMin: now.toISOString(),
      timeMax: nextWeek.toISOString(),
      maxResults: 20
    });
  }

  /**
   * Disconnect Calendar
   */
  disconnect() {
    oauthRepository.deleteTokens('calendar');
    settingsRepository.updateCalendarSettings({
      provider: null,
      isConnected: false
    });
    logger.info('Calendar disconnected');
  }

  /**
   * Get connection status
   * @returns {Object} Status
   */
  getStatus() {
    const tokens = oauthRepository.getTokens('calendar');
    const settings = settingsRepository.getCalendarSettings ?
      settingsRepository.getCalendarSettings() :
      { lastSyncAt: null };

    return {
      configured: this.isConfigured(),
      connected: tokens !== null,
      hasValidToken: tokens ? oauthRepository.hasValidTokens('calendar') : false,
      lastSyncAt: settings.lastSyncAt
    };
  }
}

export const calendarService = new CalendarService();
export default calendarService;
