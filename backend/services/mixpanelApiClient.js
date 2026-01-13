import { logger } from '../utils/logger.js';

/**
 * Mixpanel Raw Export API Client
 * Fetches events from Mixpanel using the Raw Event Export API
 *
 * API Documentation: https://docs.mixpanel.com/docs/data-exports
 *
 * Rate Limits:
 * - 60 queries per hour
 * - 3 queries per second
 * - 100 concurrent queries max
 */
class MixpanelApiClient {
  constructor() {
    this.baseUrl = 'https://data.mixpanel.com/api/2.0/export';
    this.requestCount = 0;
    this.lastRequestTime = 0;
  }

  /**
   * Get credentials from environment variables
   * Supports two authentication methods:
   * 1. Project Secret (simpler)
   * 2. Service Account (more secure)
   *
   * @returns {Object|null} Credentials object or null if not configured
   */
  getCredentials() {
    const projectId = process.env.MIXPANEL_PROJECT_ID;

    // Try Project Secret first (simpler method)
    if (process.env.MIXPANEL_PROJECT_SECRET) {
      return {
        projectId,
        projectSecret: process.env.MIXPANEL_PROJECT_SECRET,
        authType: 'project_secret'
      };
    }

    // Try Service Account (more secure method)
    if (process.env.MIXPANEL_SERVICE_ACCOUNT_USERNAME && process.env.MIXPANEL_SERVICE_ACCOUNT_SECRET) {
      return {
        projectId,
        serviceAccountUsername: process.env.MIXPANEL_SERVICE_ACCOUNT_USERNAME,
        serviceAccountSecret: process.env.MIXPANEL_SERVICE_ACCOUNT_SECRET,
        authType: 'service_account'
      };
    }

    return null;
  }

  /**
   * Check if credentials are configured
   * @returns {boolean}
   */
  hasCredentials() {
    const creds = this.getCredentials();
    return creds !== null && !!creds.projectId;
  }

  /**
   * Build Authorization header based on auth type
   * @returns {string} Basic auth header value
   */
  buildAuthHeader() {
    const creds = this.getCredentials();
    if (!creds) {
      throw new Error('Mixpanel credentials not configured');
    }

    let authString;
    if (creds.authType === 'project_secret') {
      // Project Secret: use secret as username, empty password
      authString = `${creds.projectSecret}:`;
    } else {
      // Service Account: use username:password
      authString = `${creds.serviceAccountUsername}:${creds.serviceAccountSecret}`;
    }

    return `Basic ${Buffer.from(authString).toString('base64')}`;
  }

  /**
   * Enforce rate limits
   * Max 3 requests per second, 60 per hour
   */
  async enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    // Ensure at least 350ms between requests (slightly more than 3/sec limit)
    if (timeSinceLastRequest < 350) {
      await new Promise(resolve => setTimeout(resolve, 350 - timeSinceLastRequest));
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  /**
   * Parse JSONL response (newline-delimited JSON)
   * Each line is a separate JSON object
   *
   * @param {string} text - JSONL response text
   * @returns {Array} Array of parsed event objects
   */
  parseJSONL(text) {
    if (!text || !text.trim()) {
      return [];
    }

    const lines = text.trim().split('\n');
    const events = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      try {
        events.push(JSON.parse(trimmedLine));
      } catch (error) {
        logger.warn('Failed to parse JSONL line:', { line: trimmedLine.substring(0, 100), error: error.message });
      }
    }

    return events;
  }

  /**
   * Fetch raw events from Mixpanel Export API
   *
   * @param {Object} options - Fetch options
   * @param {string} options.fromDate - Start date (YYYY-MM-DD)
   * @param {string} options.toDate - End date (YYYY-MM-DD)
   * @param {string} [options.event] - Filter by specific event name
   * @param {number} [options.limit] - Maximum events to return
   * @returns {Promise<Array>} Array of event objects
   */
  async fetchRawEvents({ fromDate, toDate, event, limit = 10000 }) {
    const creds = this.getCredentials();
    if (!creds) {
      throw new Error('Mixpanel credentials not configured');
    }

    if (!creds.projectId) {
      throw new Error('MIXPANEL_PROJECT_ID is not set');
    }

    // Enforce rate limits
    await this.enforceRateLimit();

    // Build URL with query parameters
    const url = new URL(this.baseUrl);
    url.searchParams.append('from_date', fromDate);
    url.searchParams.append('to_date', toDate);

    // Only include project_id for Service Account auth (not for Project Secret)
    if (creds.authType === 'service_account') {
      url.searchParams.append('project_id', creds.projectId);
    }

    if (event) {
      url.searchParams.append('event', JSON.stringify([event]));
    }

    if (limit) {
      url.searchParams.append('limit', limit.toString());
    }

    logger.info('Fetching events from Mixpanel', { fromDate, toDate, event, limit, projectId: creds.projectId });

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': this.buildAuthHeader(),
          'Accept': 'text/plain'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();

        if (response.status === 401) {
          throw new Error('Invalid Mixpanel credentials. Check your Project Secret or Service Account credentials.');
        }

        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait before making more requests.');
        }

        if (response.status === 400) {
          throw new Error(`Invalid request: ${errorText}`);
        }

        throw new Error(`Mixpanel API error (${response.status}): ${errorText}`);
      }

      const responseText = await response.text();
      const events = this.parseJSONL(responseText);

      logger.info(`Fetched ${events.length} events from Mixpanel`);

      return events;
    } catch (error) {
      if (error.message.includes('credentials') || error.message.includes('Rate limit')) {
        throw error;
      }

      logger.error('Mixpanel API fetch error:', error);
      throw new Error(`Failed to fetch events from Mixpanel: ${error.message}`);
    }
  }

  /**
   * Test connection to Mixpanel API
   * Fetches 1 event from today to verify credentials
   *
   * @returns {Promise<Object>} Connection status
   */
  async testConnection() {
    const creds = this.getCredentials();
    if (!creds) {
      return {
        success: false,
        error: 'Mixpanel credentials not configured. Set MIXPANEL_PROJECT_ID and MIXPANEL_PROJECT_SECRET in environment variables.'
      };
    }

    if (!creds.projectId) {
      return {
        success: false,
        error: 'MIXPANEL_PROJECT_ID is not set'
      };
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const events = await this.fetchRawEvents({
        fromDate: today,
        toDate: today,
        limit: 1
      });

      return {
        success: true,
        message: 'Connection successful',
        authType: creds.authType,
        eventsFetched: events.length,
        projectId: creds.projectId.slice(-4) // Show last 4 chars only
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get connection status info (for frontend display)
   * @returns {Object} Connection status
   */
  getConnectionStatus() {
    const creds = this.getCredentials();

    if (!creds) {
      return {
        configured: false,
        authType: null,
        projectId: null,
        message: 'Mixpanel credentials not configured'
      };
    }

    if (!creds.projectId) {
      return {
        configured: false,
        authType: creds.authType,
        projectId: null,
        message: 'MIXPANEL_PROJECT_ID is not set'
      };
    }

    return {
      configured: true,
      authType: creds.authType,
      projectId: '***' + creds.projectId.slice(-4), // Partial masking
      message: 'Credentials configured'
    };
  }
}

export const mixpanelApiClient = new MixpanelApiClient();
export default mixpanelApiClient;
