import { getDatabase, generateId } from '../db.js';
import { logger } from '../../utils/logger.js';

class SlackRepository {
  /**
   * Save a Slack message
   * @param {Object} message - Slack message data
   * @returns {Object} Saved message
   */
  saveMessage(message) {
    const db = getDatabase();
    const id = message.id || generateId();
    const now = Date.now();

    // Check for duplicate
    if (message.slackTs) {
      const existing = db.prepare('SELECT id FROM slack_messages WHERE slack_ts = ?').get(message.slackTs);
      if (existing) {
        logger.info(`Duplicate Slack message ignored: ${message.slackTs}`);
        return this.findById(existing.id);
      }
    }

    const stmt = db.prepare(`
      INSERT INTO slack_messages (id, slack_ts, channel_id, user_id, user_name, text, thread_ts, customer_id, prospect_id, processed, received_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      message.slackTs || null,
      message.channelId || null,
      message.userId || null,
      message.userName || null,
      message.text || null,
      message.threadTs || null,
      message.customerId || null,
      message.prospectId || null,
      message.processed ? 1 : 0,
      now
    );

    logger.info(`Slack message saved: ${id}`);
    return this.findById(id);
  }

  /**
   * Find message by ID
   * @param {string} id - Message ID
   * @returns {Object|null}
   */
  findById(id) {
    const db = getDatabase();
    const message = db.prepare('SELECT * FROM slack_messages WHERE id = ?').get(id);
    return message ? this._toCamelCase(message) : null;
  }

  /**
   * Find message by Slack timestamp
   * @param {string} slackTs - Slack timestamp
   * @returns {Object|null}
   */
  findBySlackTs(slackTs) {
    const db = getDatabase();
    const message = db.prepare('SELECT * FROM slack_messages WHERE slack_ts = ?').get(slackTs);
    return message ? this._toCamelCase(message) : null;
  }

  /**
   * Get messages for a customer
   * @param {string} customerId - Customer ID
   * @returns {Array}
   */
  findByCustomerId(customerId) {
    const db = getDatabase();
    const messages = db.prepare('SELECT * FROM slack_messages WHERE customer_id = ? ORDER BY received_at DESC').all(customerId);
    return messages.map(m => this._toCamelCase(m));
  }

  /**
   * Get messages for a prospect
   * @param {string} prospectId - Prospect ID
   * @returns {Array}
   */
  findByProspectId(prospectId) {
    const db = getDatabase();
    const messages = db.prepare('SELECT * FROM slack_messages WHERE prospect_id = ? ORDER BY received_at DESC').all(prospectId);
    return messages.map(m => this._toCamelCase(m));
  }

  /**
   * Get unprocessed messages
   * @param {number} limit - Maximum messages to return
   * @returns {Array}
   */
  findUnprocessed(limit = 50) {
    const db = getDatabase();
    const messages = db.prepare('SELECT * FROM slack_messages WHERE processed = 0 ORDER BY received_at ASC LIMIT ?').all(limit);
    return messages.map(m => this._toCamelCase(m));
  }

  /**
   * Mark message as processed
   * @param {string} id - Message ID
   * @param {Object} updates - Optional updates (customerId, prospectId)
   * @returns {Object|null}
   */
  markProcessed(id, updates = {}) {
    const db = getDatabase();

    let query = 'UPDATE slack_messages SET processed = 1';
    const params = [];

    if (updates.customerId) {
      query += ', customer_id = ?';
      params.push(updates.customerId);
    }

    if (updates.prospectId) {
      query += ', prospect_id = ?';
      params.push(updates.prospectId);
    }

    query += ' WHERE id = ?';
    params.push(id);

    db.prepare(query).run(...params);

    return this.findById(id);
  }

  /**
   * Get recent messages
   * @param {Object} options - Query options
   * @returns {Array}
   */
  findRecent(options = {}) {
    const db = getDatabase();
    const { channelId, limit = 50, offset = 0 } = options;

    let query = 'SELECT * FROM slack_messages WHERE 1=1';
    const params = [];

    if (channelId) {
      query += ' AND channel_id = ?';
      params.push(channelId);
    }

    query += ' ORDER BY received_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const messages = db.prepare(query).all(...params);
    return messages.map(m => this._toCamelCase(m));
  }

  /**
   * Get message count
   * @param {boolean} processedOnly - Count only processed messages
   * @returns {number}
   */
  getCount(processedOnly = false) {
    const db = getDatabase();
    let query = 'SELECT COUNT(*) as count FROM slack_messages';

    if (processedOnly) {
      query += ' WHERE processed = 1';
    }

    const result = db.prepare(query).get();
    return result.count;
  }

  /**
   * Delete old messages
   * @param {number} olderThanMs - Delete messages older than this (milliseconds)
   * @returns {number} Number of deleted messages
   */
  deleteOld(olderThanMs = 30 * 24 * 60 * 60 * 1000) {
    const db = getDatabase();
    const threshold = Date.now() - olderThanMs;

    const result = db.prepare('DELETE FROM slack_messages WHERE received_at < ? AND processed = 1').run(threshold);

    if (result.changes > 0) {
      logger.info(`Deleted ${result.changes} old Slack messages`);
    }

    return result.changes;
  }

  /**
   * Mark message as deleted (soft delete)
   * @param {string} slackTs - Message timestamp
   * @param {string} channelId - Channel ID
   * @returns {boolean} Whether message was found and updated
   */
  markDeleted(slackTs, channelId) {
    const db = getDatabase();
    const deletedAt = new Date().toISOString();

    const result = db.prepare(`
      UPDATE slack_messages
      SET deleted = 1, deleted_at = ?
      WHERE slack_ts = ? AND channel_id = ?
    `).run(deletedAt, slackTs, channelId);

    if (result.changes > 0) {
      logger.info(`Message ${slackTs} marked as deleted in channel ${channelId}`);
    }

    return result.changes > 0;
  }

  /**
   * Update message text (for edited messages)
   * @param {string} slackTs - Message timestamp
   * @param {string} channelId - Channel ID
   * @param {string} newText - Updated message text
   * @returns {boolean} Whether message was found and updated
   */
  updateMessageText(slackTs, channelId, newText) {
    const db = getDatabase();

    const result = db.prepare(`
      UPDATE slack_messages
      SET text = ?
      WHERE slack_ts = ? AND channel_id = ?
    `).run(newText, slackTs, channelId);

    if (result.changes > 0) {
      logger.info(`Message ${slackTs} text updated in channel ${channelId}`);
    }

    return result.changes > 0;
  }

  /**
   * Find all deleted messages
   * @returns {Array} Deleted messages
   */
  findDeleted() {
    const db = getDatabase();
    const messages = db.prepare('SELECT * FROM slack_messages WHERE deleted = 1 ORDER BY deleted_at DESC').all();
    return messages.map(m => this._toCamelCase(m));
  }

  /**
   * Find deleted messages in a specific channel
   * @param {string} channelId - Channel ID
   * @returns {Array} Deleted messages
   */
  findDeletedByChannel(channelId) {
    const db = getDatabase();
    const messages = db.prepare('SELECT * FROM slack_messages WHERE deleted = 1 AND channel_id = ? ORDER BY deleted_at DESC').all(channelId);
    return messages.map(m => this._toCamelCase(m));
  }

  /**
   * Find all active (non-deleted) messages
   * @returns {Array} Active messages
   */
  findActive() {
    const db = getDatabase();
    const messages = db.prepare('SELECT * FROM slack_messages WHERE deleted = 0 OR deleted IS NULL ORDER BY received_at DESC').all();
    return messages.map(m => this._toCamelCase(m));
  }

  /**
   * Find messages by thread timestamp
   * @param {string} threadTs - Thread timestamp
   * @returns {Array} Messages in thread
   */
  findByThreadTs(threadTs) {
    const db = getDatabase();
    const messages = db.prepare('SELECT * FROM slack_messages WHERE thread_ts = ? AND (deleted = 0 OR deleted IS NULL) ORDER BY received_at ASC').all(threadTs);
    return messages.map(m => this._toCamelCase(m));
  }

  /**
   * Find thread parent messages (messages with replies that are not deleted)
   * @returns {Array} Thread parent messages
   */
  findThreadParents() {
    const db = getDatabase();
    const messages = db.prepare(`
      SELECT DISTINCT m.* FROM slack_messages m
      WHERE m.thread_ts IS NULL
      AND (m.deleted = 0 OR m.deleted IS NULL)
      AND EXISTS (SELECT 1 FROM slack_messages WHERE thread_ts = m.slack_ts AND (deleted = 0 OR deleted IS NULL))
      ORDER BY m.received_at DESC
    `).all();
    return messages.map(m => this._toCamelCase(m));
  }

  /**
   * Convert object keys from snake_case to camelCase
   * @private
   */
  _toCamelCase(obj) {
    if (obj === null || typeof obj !== 'object') return obj;

    const newObj = {};
    for (const key in obj) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      newObj[camelKey] = obj[key];
    }
    return newObj;
  }
}

export const slackRepository = new SlackRepository();
export default slackRepository;
