import { getDatabase } from '../db.js';
import { logger } from '../../utils/logger.js';

class OAuthRepository {
  /**
   * Save or update OAuth tokens
   * @param {string} provider - OAuth provider (gmail, outlook, etc.)
   * @param {Object} tokens - Token data
   * @returns {Object} Saved tokens
   */
  saveTokens(provider, tokens) {
    const db = getDatabase();
    const now = Date.now();

    const stmt = db.prepare(`
      INSERT INTO oauth_tokens (provider, access_token, refresh_token, expires_at, scope, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(provider) DO UPDATE SET
        access_token = excluded.access_token,
        refresh_token = COALESCE(excluded.refresh_token, oauth_tokens.refresh_token),
        expires_at = excluded.expires_at,
        scope = COALESCE(excluded.scope, oauth_tokens.scope),
        updated_at = excluded.updated_at
    `);

    stmt.run(
      provider,
      tokens.accessToken || tokens.access_token,
      tokens.refreshToken || tokens.refresh_token || null,
      tokens.expiresAt || tokens.expires_at || null,
      tokens.scope || null,
      now,
      now
    );

    logger.info(`OAuth tokens saved for provider: ${provider}`);
    return this.getTokens(provider);
  }

  /**
   * Get tokens for a provider
   * @param {string} provider - OAuth provider
   * @returns {Object|null}
   */
  getTokens(provider) {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM oauth_tokens WHERE provider = ?').get(provider);

    if (!row) return null;

    return {
      provider: row.provider,
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      expiresAt: row.expires_at,
      scope: row.scope,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Check if tokens are valid (not expired)
   * @param {string} provider - OAuth provider
   * @returns {boolean}
   */
  hasValidTokens(provider) {
    const tokens = this.getTokens(provider);

    if (!tokens) return false;
    if (!tokens.expiresAt) return true; // No expiry means valid

    // Add 5 minute buffer
    return tokens.expiresAt > Date.now() + 5 * 60 * 1000;
  }

  /**
   * Check if provider is connected (has any tokens)
   * @param {string} provider - OAuth provider
   * @returns {boolean}
   */
  isConnected(provider) {
    const tokens = this.getTokens(provider);
    return tokens !== null && tokens.accessToken !== null;
  }

  /**
   * Update access token (after refresh)
   * @param {string} provider - OAuth provider
   * @param {string} accessToken - New access token
   * @param {number} expiresAt - New expiry time
   * @returns {Object|null}
   */
  updateAccessToken(provider, accessToken, expiresAt) {
    const db = getDatabase();
    const now = Date.now();

    db.prepare(`
      UPDATE oauth_tokens
      SET access_token = ?, expires_at = ?, updated_at = ?
      WHERE provider = ?
    `).run(accessToken, expiresAt, now, provider);

    logger.info(`Access token refreshed for provider: ${provider}`);
    return this.getTokens(provider);
  }

  /**
   * Delete tokens for a provider
   * @param {string} provider - OAuth provider
   * @returns {boolean}
   */
  deleteTokens(provider) {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM oauth_tokens WHERE provider = ?').run(provider);

    if (result.changes > 0) {
      logger.info(`OAuth tokens deleted for provider: ${provider}`);
      return true;
    }
    return false;
  }

  /**
   * Get all connected providers
   * @returns {Array<string>}
   */
  getConnectedProviders() {
    const db = getDatabase();
    const rows = db.prepare('SELECT provider FROM oauth_tokens WHERE access_token IS NOT NULL').all();
    return rows.map(r => r.provider);
  }
}

export const oauthRepository = new OAuthRepository();
export default oauthRepository;
