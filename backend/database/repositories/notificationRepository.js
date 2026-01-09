import { getDatabase, generateId } from '../db.js';
import { logger } from '../../utils/logger.js';

class NotificationRepository {
  /**
   * Create a notification
   * @param {Object} data - Notification data
   * @returns {Object} Created notification
   */
  create(data) {
    const db = getDatabase();
    const id = data.id || generateId();
    const now = Date.now();

    const stmt = db.prepare(`
      INSERT INTO notifications (id, type, title, message, customer_id, prospect_id, priority, read, action_url, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.type,
      data.title,
      data.message,
      data.customerId || null,
      data.prospectId || null,
      data.priority || 'medium',
      0,
      data.actionUrl || null,
      data.metadata ? JSON.stringify(data.metadata) : null,
      now
    );

    logger.info(`Notification created: ${id} - ${data.title}`);
    return this.findById(id);
  }

  /**
   * Find notification by ID
   * @param {string} id - Notification ID
   * @returns {Object|null}
   */
  findById(id) {
    const db = getDatabase();
    const notification = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id);
    return notification ? this._parseNotification(notification) : null;
  }

  /**
   * Get all notifications with filters
   * @param {Object} options - Query options
   * @returns {Array}
   */
  findAll(options = {}) {
    const db = getDatabase();
    const { type, read, priority, limit = 50, offset = 0 } = options;

    let query = 'SELECT * FROM notifications WHERE 1=1';
    const params = [];

    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }

    if (read !== undefined) {
      query += ' AND read = ?';
      params.push(read ? 1 : 0);
    }

    if (priority) {
      query += ' AND priority = ?';
      params.push(priority);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const notifications = db.prepare(query).all(...params);
    return notifications.map(n => this._parseNotification(n));
  }

  /**
   * Get unread notifications
   * @param {number} limit - Maximum notifications
   * @returns {Array}
   */
  findUnread(limit = 50) {
    return this.findAll({ read: false, limit });
  }

  /**
   * Get unread count
   * @returns {number}
   */
  getUnreadCount() {
    const db = getDatabase();
    const result = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE read = 0').get();
    return result.count;
  }

  /**
   * Mark notification as read
   * @param {string} id - Notification ID
   * @returns {Object|null}
   */
  markRead(id) {
    const db = getDatabase();
    db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(id);
    return this.findById(id);
  }

  /**
   * Mark all notifications as read
   * @returns {number} Number of updated notifications
   */
  markAllRead() {
    const db = getDatabase();
    const result = db.prepare('UPDATE notifications SET read = 1 WHERE read = 0').run();
    logger.info(`Marked ${result.changes} notifications as read`);
    return result.changes;
  }

  /**
   * Delete notification
   * @param {string} id - Notification ID
   * @returns {boolean}
   */
  delete(id) {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM notifications WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /**
   * Delete old notifications
   * @param {number} olderThanMs - Delete notifications older than this
   * @returns {number} Number of deleted notifications
   */
  deleteOld(olderThanMs = 30 * 24 * 60 * 60 * 1000) {
    const db = getDatabase();
    const threshold = Date.now() - olderThanMs;

    const result = db.prepare('DELETE FROM notifications WHERE created_at < ? AND read = 1').run(threshold);

    if (result.changes > 0) {
      logger.info(`Deleted ${result.changes} old notifications`);
    }

    return result.changes;
  }

  /**
   * Parse notification from DB row
   * @private
   */
  _parseNotification(row) {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      message: row.message,
      customerId: row.customer_id,
      prospectId: row.prospect_id,
      priority: row.priority,
      read: row.read === 1,
      actionUrl: row.action_url,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      createdAt: row.created_at
    };
  }
}

export const notificationRepository = new NotificationRepository();
export default notificationRepository;
