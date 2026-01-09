import { google } from 'googleapis';
import { oauthRepository, emailRepository, customerRepository, settingsRepository } from '../database/repositories/index.js';
import { geminiClient } from './geminiClient.js';
import { logger } from '../utils/logger.js';

class GmailService {
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
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/gmail/oauth/callback';

    if (clientId && clientSecret) {
      this.oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        redirectUri
      );
      logger.info('Gmail OAuth client initialized');
    } else {
      logger.warn('Gmail OAuth credentials not configured');
    }
  }

  /**
   * Check if Gmail is configured
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
      throw new Error('Gmail OAuth not configured');
    }

    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.labels'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent' // Force consent screen to get refresh token
    });
  }

  /**
   * Exchange authorization code for tokens
   * @param {string} code - Authorization code
   * @returns {Object} Token information
   */
  async exchangeCodeForTokens(code) {
    if (!this.oauth2Client) {
      throw new Error('Gmail OAuth not configured');
    }

    const { tokens } = await this.oauth2Client.getToken(code);

    // Save tokens to database
    oauthRepository.saveTokens('gmail', {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expiry_date,
      scope: tokens.scope
    });

    // Update email settings
    settingsRepository.updateEmailSettings({
      provider: 'gmail',
      isConnected: true
    });

    logger.info('Gmail tokens saved successfully');

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
    const tokens = oauthRepository.getTokens('gmail');

    if (!tokens) {
      throw new Error('Gmail not connected');
    }

    // Check if token is expired (with 5 minute buffer)
    if (tokens.expiresAt && tokens.expiresAt < Date.now() + 5 * 60 * 1000) {
      if (!tokens.refreshToken) {
        throw new Error('No refresh token available. Please reconnect Gmail.');
      }

      // Refresh the token
      this.oauth2Client.setCredentials({
        refresh_token: tokens.refreshToken
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();

      // Save new access token
      oauthRepository.updateAccessToken(
        'gmail',
        credentials.access_token,
        credentials.expiry_date
      );

      return credentials.access_token;
    }

    return tokens.accessToken;
  }

  /**
   * Get Gmail API client
   * @returns {Object} Gmail API client
   */
  async getGmailClient() {
    const accessToken = await this.getValidAccessToken();

    this.oauth2Client.setCredentials({
      access_token: accessToken
    });

    return google.gmail({ version: 'v1', auth: this.oauth2Client });
  }

  /**
   * List email messages
   * @param {Object} options - Query options
   * @returns {Array} List of messages
   */
  async listMessages(options = {}) {
    const { query = '', maxResults = 50, pageToken } = options;

    const gmail = await this.getGmailClient();

    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults,
      pageToken
    });

    return {
      messages: response.data.messages || [],
      nextPageToken: response.data.nextPageToken
    };
  }

  /**
   * Get full message details
   * @param {string} messageId - Message ID
   * @returns {Object} Message details
   */
  async getMessage(messageId) {
    const gmail = await this.getGmailClient();

    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'
    });

    const message = response.data;

    // Parse headers
    const headers = message.payload.headers.reduce((acc, header) => {
      acc[header.name.toLowerCase()] = header.value;
      return acc;
    }, {});

    // Get body content
    let body = '';
    if (message.payload.body.data) {
      body = Buffer.from(message.payload.body.data, 'base64').toString('utf8');
    } else if (message.payload.parts) {
      const textPart = message.payload.parts.find(p => p.mimeType === 'text/plain');
      if (textPart && textPart.body.data) {
        body = Buffer.from(textPart.body.data, 'base64').toString('utf8');
      }
    }

    return {
      id: message.id,
      gmailMessageId: message.id,
      threadId: message.threadId,
      subject: headers.subject || '(No Subject)',
      from: headers.from,
      to: headers.to,
      date: parseInt(message.internalDate),
      body: body.substring(0, 10000), // Limit body size
      snippet: message.snippet
    };
  }

  /**
   * Sync emails and match with customers
   * @param {Object} options - Sync options
   * @returns {Object} Sync results
   */
  async syncEmails(options = {}) {
    const { maxResults = 50, afterDate } = options;

    // Build query
    let query = '';
    if (afterDate) {
      const dateStr = new Date(afterDate).toISOString().split('T')[0];
      query = `after:${dateStr}`;
    }

    // Get message list
    const { messages } = await this.listMessages({ query, maxResults });

    if (!messages || messages.length === 0) {
      return { synced: 0, matched: 0 };
    }

    // Get all customers for matching
    const customers = customerRepository.findAll({ limit: 1000 });

    let synced = 0;
    let matched = 0;

    for (const msg of messages) {
      try {
        // Check if already synced
        const existing = emailRepository.findByGmailId(msg.id);
        if (existing) continue;

        // Get full message
        const fullMessage = await this.getMessage(msg.id);

        // Try to match with customer
        const customerId = await this.matchEmailToCustomer(fullMessage, customers);

        // Save to database
        emailRepository.save({
          ...fullMessage,
          customerId
        });

        synced++;
        if (customerId) matched++;

      } catch (error) {
        logger.error(`Error syncing message ${msg.id}:`, error);
      }
    }

    // Update last sync time
    settingsRepository.updateEmailSettings({
      lastSyncAt: Date.now()
    });

    logger.info(`Email sync completed: ${synced} synced, ${matched} matched`);

    return { synced, matched };
  }

  /**
   * Match email to customer using AI
   * @param {Object} email - Email data
   * @param {Array} customers - List of customers
   * @returns {string|null} Customer ID or null
   */
  async matchEmailToCustomer(email, customers) {
    if (!customers || customers.length === 0) return null;

    // First try domain matching
    const fromDomain = this.extractDomain(email.from);

    for (const customer of customers) {
      if (customer.website) {
        const customerDomain = this.extractDomain(customer.website);
        if (fromDomain && customerDomain && fromDomain.includes(customerDomain)) {
          return customer.id;
        }
      }
    }

    // If no domain match, try AI matching
    try {
      const customerList = customers.map(c => c.name).join(', ');

      const prompt = `다음 이메일이 어떤 고객사와 관련된 것인지 판단해주세요.

이메일 제목: ${email.subject}
발신자: ${email.from}
내용 미리보기: ${email.snippet || email.body?.substring(0, 200)}

가능한 고객사 목록: ${customerList}

고객사 이름만 정확히 반환하세요. 관련 고객사가 없으면 "없음"이라고 응답하세요.`;

      const response = await geminiClient.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt
      });

      const text = (response.text || response.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();

      if (text && text !== '없음') {
        const matchedCustomer = customers.find(c =>
          c.name.toLowerCase() === text.toLowerCase() ||
          c.name.toLowerCase().includes(text.toLowerCase()) ||
          text.toLowerCase().includes(c.name.toLowerCase())
        );

        if (matchedCustomer) {
          return matchedCustomer.id;
        }
      }
    } catch (error) {
      logger.error('Error in AI email matching:', error);
    }

    return null;
  }

  /**
   * Extract domain from email or URL
   * @param {string} input - Email address or URL
   * @returns {string|null} Domain
   */
  extractDomain(input) {
    if (!input) return null;

    // Extract from email
    const emailMatch = input.match(/@([^\s>]+)/);
    if (emailMatch) {
      return emailMatch[1].toLowerCase();
    }

    // Extract from URL
    try {
      const url = new URL(input.startsWith('http') ? input : `https://${input}`);
      return url.hostname.replace('www.', '').toLowerCase();
    } catch {
      return null;
    }
  }

  /**
   * Disconnect Gmail
   */
  disconnect() {
    oauthRepository.deleteTokens('gmail');
    settingsRepository.updateEmailSettings({
      provider: null,
      isConnected: false,
      lastSyncAt: null
    });
    logger.info('Gmail disconnected');
  }

  /**
   * Get connection status
   * @returns {Object} Status
   */
  getStatus() {
    const tokens = oauthRepository.getTokens('gmail');
    const settings = settingsRepository.getEmailSettings();

    return {
      configured: this.isConfigured(),
      connected: tokens !== null,
      hasValidToken: tokens ? oauthRepository.hasValidTokens('gmail') : false,
      lastSyncAt: settings.lastSyncAt,
      autoSync: settings.autoSync,
      syncInterval: settings.syncInterval
    };
  }
}

export const gmailService = new GmailService();
export default gmailService;
