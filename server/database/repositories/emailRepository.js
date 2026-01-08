import { getDatabase, generateId } from '../db.js';
import { logger } from '../../utils/logger.js';

class EmailRepository {
  /**
   * Save an email message
   * @param {Object} email - Email data
   * @returns {Object} Saved email
   */
  save(email) {
    const db = getDatabase();
    const id = email.id || generateId();
    const now = Date.now();

    // Check for duplicate by Gmail message ID
    if (email.gmailMessageId) {
      const existing = db.prepare('SELECT id FROM email_messages WHERE gmail_message_id = ?').get(email.gmailMessageId);
      if (existing) {
        logger.debug(`Duplicate email ignored: ${email.gmailMessageId}`);
        return this.findById(existing.id);
      }
    }

    const stmt = db.prepare(`
      INSERT INTO email_messages (id, gmail_message_id, thread_id, subject, from_address, to_address, body, date, customer_id, synced_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      email.gmailMessageId || null,
      email.threadId || null,
      email.subject || null,
      email.from || email.fromAddress || null,
      email.to || email.toAddress || null,
      email.body || null,
      email.date || null,
      email.customerId || null,
      now
    );

    logger.info(`Email saved: ${id} - ${email.subject}`);
    return this.findById(id);
  }

  /**
   * Save multiple emails
   * @param {Array} emails - Array of email data
   * @returns {Array} Saved emails
   */
  saveMany(emails) {
    const db = getDatabase();
    const now = Date.now();

    const stmt = db.prepare(`
      INSERT OR IGNORE INTO email_messages (id, gmail_message_id, thread_id, subject, from_address, to_address, body, date, customer_id, synced_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((items) => {
      const ids = [];
      for (const email of items) {
        const id = email.id || generateId();
        stmt.run(
          id,
          email.gmailMessageId || null,
          email.threadId || null,
          email.subject || null,
          email.from || email.fromAddress || null,
          email.to || email.toAddress || null,
          email.body || null,
          email.date || null,
          email.customerId || null,
          now
        );
        ids.push(id);
      }
      return ids;
    });

    const savedIds = insertMany(emails);
    logger.info(`${savedIds.length} emails saved`);

    return savedIds.map(id => this.findById(id)).filter(Boolean);
  }

  /**
   * Find email by ID
   * @param {string} id - Email ID
   * @returns {Object|null}
   */
  findById(id) {
    const db = getDatabase();
    const email = db.prepare('SELECT * FROM email_messages WHERE id = ?').get(id);
    return email ? this._toCamelCase(email) : null;
  }

  /**
   * Find email by Gmail message ID
   * @param {string} gmailMessageId - Gmail message ID
   * @returns {Object|null}
   */
  findByGmailId(gmailMessageId) {
    const db = getDatabase();
    const email = db.prepare('SELECT * FROM email_messages WHERE gmail_message_id = ?').get(gmailMessageId);
    return email ? this._toCamelCase(email) : null;
  }

  /**
   * Get emails for a customer
   * @param {string} customerId - Customer ID
   * @param {Object} options - Query options
   * @returns {Array}
   */
  findByCustomerId(customerId, options = {}) {
    const db = getDatabase();
    const { limit = 50, offset = 0 } = options;

    const emails = db.prepare(`
      SELECT * FROM email_messages
      WHERE customer_id = ?
      ORDER BY date DESC
      LIMIT ? OFFSET ?
    `).all(customerId, limit, offset);

    return emails.map(e => this._toCamelCase(e));
  }

  /**
   * Get all emails with optional filters
   * @param {Object} options - Query options
   * @returns {Array}
   */
  findAll(options = {}) {
    const db = getDatabase();
    const { customerId, search, limit = 100, offset = 0 } = options;

    let query = 'SELECT * FROM email_messages WHERE 1=1';
    const params = [];

    if (customerId) {
      query += ' AND customer_id = ?';
      params.push(customerId);
    }

    if (search) {
      query += ' AND (subject LIKE ? OR from_address LIKE ? OR body LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY date DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const emails = db.prepare(query).all(...params);
    return emails.map(e => this._toCamelCase(e));
  }

  /**
   * Get emails without customer association
   * @param {number} limit - Maximum emails to return
   * @returns {Array}
   */
  findUnmatched(limit = 50) {
    const db = getDatabase();
    const emails = db.prepare(`
      SELECT * FROM email_messages
      WHERE customer_id IS NULL
      ORDER BY date DESC
      LIMIT ?
    `).all(limit);

    return emails.map(e => this._toCamelCase(e));
  }

  /**
   * Update email's customer association
   * @param {string} id - Email ID
   * @param {string} customerId - Customer ID
   * @returns {Object|null}
   */
  updateCustomer(id, customerId) {
    const db = getDatabase();
    db.prepare('UPDATE email_messages SET customer_id = ? WHERE id = ?').run(customerId, id);
    return this.findById(id);
  }

  /**
   * Get the latest email date for sync tracking
   * @returns {number|null}
   */
  getLatestEmailDate() {
    const db = getDatabase();
    const result = db.prepare('SELECT MAX(date) as latest FROM email_messages').get();
    return result?.latest || null;
  }

  /**
   * Get email count
   * @param {boolean} matchedOnly - Count only matched emails
   * @returns {number}
   */
  getCount(matchedOnly = false) {
    const db = getDatabase();
    let query = 'SELECT COUNT(*) as count FROM email_messages';

    if (matchedOnly) {
      query += ' WHERE customer_id IS NOT NULL';
    }

    const result = db.prepare(query).get();
    return result.count;
  }

  /**
   * Delete email
   * @param {string} id - Email ID
   * @returns {boolean}
   */
  delete(id) {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM email_messages WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /**
   * Delete old emails
   * @param {number} olderThanMs - Delete emails older than this (milliseconds)
   * @returns {number} Number of deleted emails
   */
  deleteOld(olderThanMs = 90 * 24 * 60 * 60 * 1000) {
    const db = getDatabase();
    const threshold = Date.now() - olderThanMs;

    const result = db.prepare('DELETE FROM email_messages WHERE synced_at < ?').run(threshold);

    if (result.changes > 0) {
      logger.info(`Deleted ${result.changes} old emails`);
    }

    return result.changes;
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

export const emailRepository = new EmailRepository();
export default emailRepository;
