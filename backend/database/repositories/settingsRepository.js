import { getDatabase } from '../db.js';
import { logger } from '../../utils/logger.js';

class SettingsRepository {
  /**
   * Get a setting by key
   * @param {string} key - Setting key
   * @returns {Object|null} Setting value (parsed JSON)
   */
  get(key) {
    const db = getDatabase();
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);

    if (!row) return null;

    try {
      return JSON.parse(row.value);
    } catch {
      return row.value;
    }
  }

  /**
   * Get all settings
   * @returns {Object} All settings as key-value pairs
   */
  getAll() {
    const db = getDatabase();
    const rows = db.prepare('SELECT key, value FROM settings').all();

    return rows.reduce((acc, row) => {
      try {
        acc[row.key] = JSON.parse(row.value);
      } catch {
        acc[row.key] = row.value;
      }
      return acc;
    }, {});
  }

  /**
   * Set a setting
   * @param {string} key - Setting key
   * @param {*} value - Setting value (will be JSON stringified)
   * @returns {boolean} Success
   */
  set(key, value) {
    const db = getDatabase();
    const now = Date.now();
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

    const stmt = db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `);

    stmt.run(key, stringValue, now);
    logger.info(`Setting updated: ${key}`);
    return true;
  }

  /**
   * Delete a setting
   * @param {string} key - Setting key
   * @returns {boolean} Success
   */
  delete(key) {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM settings WHERE key = ?').run(key);
    return result.changes > 0;
  }

  /**
   * Update a partial setting (merge with existing)
   * @param {string} key - Setting key
   * @param {Object} updates - Partial updates to merge
   * @returns {Object} Updated setting value
   */
  update(key, updates) {
    const existing = this.get(key) || {};
    const merged = { ...existing, ...updates };
    this.set(key, merged);
    return merged;
  }

  // ========================================
  // Slack Settings
  // ========================================

  getSlackSettings() {
    return this.get('slack') || {
      webhookUrl: '',
      isEnabled: false,
      notifications: {
        newProspect: true,
        followUpReminder: true,
        followUpCompleted: true,
        dailyDigest: false,
        dealWon: false,
        dealLost: false
      },
      isValidated: false,
      eventApiEnabled: false,
      botToken: null,
      channelId: null,
      dailyDigestTime: '09:00',
      lastDigestSentAt: null
    };
  }

  updateSlackSettings(updates) {
    return this.update('slack', updates);
  }

  // ========================================
  // Email Settings
  // ========================================

  getEmailSettings() {
    return this.get('email') || {
      provider: null,
      isConnected: false,
      autoSync: false,
      syncInterval: 3600000,
      lastSyncAt: null
    };
  }

  updateEmailSettings(updates) {
    return this.update('email', updates);
  }

  // ========================================
  // Collection Settings
  // ========================================

  getCollectionSettings() {
    return this.get('collection') || {
      autoCollect: false,
      interval: 3600000,
      lastRun: null
    };
  }

  updateCollectionSettings(updates) {
    return this.update('collection', updates);
  }

  // ========================================
  // Notification Settings
  // ========================================

  getNotificationSettings() {
    return this.get('notifications') || {
      browser: {
        enabled: true,
        types: {
          followUp: true,
          meeting: true,
          news: true,
          risk: true,
          prospect: true
        }
      },
      email: {
        enabled: false,
        dailyDigest: false,
        digestTime: '09:00'
      }
    };
  }

  updateNotificationSettings(updates) {
    return this.update('notifications', updates);
  }
}

export const settingsRepository = new SettingsRepository();
export default settingsRepository;
