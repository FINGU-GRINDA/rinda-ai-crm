import { getDatabase, generateId } from '../db.js';
import { logger } from '../../utils/logger.js';

class MeetingRepository {
  /**
   * Get all meeting summaries for a customer
   * @param {string} customerId - Customer ID
   * @param {Object} options - Query options
   * @returns {Array} List of meeting summaries
   */
  findByCustomerId(customerId, options = {}) {
    const db = getDatabase();
    const { limit = 50, offset = 0 } = options;

    const meetings = db.prepare(`
      SELECT * FROM meeting_summaries
      WHERE customer_id = ?
      ORDER BY meeting_date DESC
      LIMIT ? OFFSET ?
    `).all(customerId, limit, offset);

    return meetings.map(this._formatMeeting);
  }

  /**
   * Find meeting summary by ID
   * @param {string} id - Meeting ID
   * @returns {Object|null} Meeting summary or null
   */
  findById(id) {
    const db = getDatabase();
    const meeting = db.prepare('SELECT * FROM meeting_summaries WHERE id = ?').get(id);

    if (!meeting) return null;
    return this._formatMeeting(meeting);
  }

  /**
   * Get recent meetings across all customers
   * @param {Object} options - Query options
   * @returns {Array} List of meeting summaries
   */
  findRecent(options = {}) {
    const db = getDatabase();
    const { limit = 10, days = 30 } = options;
    const since = Date.now() - (days * 24 * 60 * 60 * 1000);

    const meetings = db.prepare(`
      SELECT ms.*, c.name as customer_name
      FROM meeting_summaries ms
      LEFT JOIN customers c ON ms.customer_id = c.id
      WHERE ms.meeting_date >= ?
      ORDER BY ms.meeting_date DESC
      LIMIT ?
    `).all(since, limit);

    return meetings.map(m => ({
      ...this._formatMeeting(m),
      customerName: m.customer_name
    }));
  }

  /**
   * Create a new meeting summary
   * @param {Object} data - Meeting data
   * @returns {Object} Created meeting summary
   */
  create(data) {
    const db = getDatabase();
    const id = data.id || generateId();
    const now = Date.now();

    const stmt = db.prepare(`
      INSERT INTO meeting_summaries (
        id, customer_id, title, meeting_date, audio_file_url, duration,
        summary, key_discussions, action_items, customer_needs,
        budget_mentions, timeline_mentions, next_steps, transcription,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.customerId,
      data.title,
      data.meetingDate || now,
      data.audioFileUrl || null,
      data.duration || null,
      data.summary || null,
      JSON.stringify(data.keyDiscussions || []),
      JSON.stringify(data.actionItems || []),
      JSON.stringify(data.customerNeeds || []),
      data.budgetMentions || null,
      data.timelineMentions || null,
      JSON.stringify(data.nextSteps || []),
      data.transcription || null,
      now,
      now
    );

    logger.info(`Meeting summary created: ${id} - ${data.title} for customer ${data.customerId}`);
    return this.findById(id);
  }

  /**
   * Update a meeting summary
   * @param {string} id - Meeting ID
   * @param {Object} data - Update data
   * @returns {Object|null} Updated meeting or null
   */
  update(id, data) {
    const db = getDatabase();
    const now = Date.now();
    const existing = this.findById(id);

    if (!existing) return null;

    const updates = [];
    const params = [];

    if (data.title !== undefined) {
      updates.push('title = ?');
      params.push(data.title);
    }
    if (data.meetingDate !== undefined) {
      updates.push('meeting_date = ?');
      params.push(data.meetingDate);
    }
    if (data.summary !== undefined) {
      updates.push('summary = ?');
      params.push(data.summary);
    }
    if (data.keyDiscussions !== undefined) {
      updates.push('key_discussions = ?');
      params.push(JSON.stringify(data.keyDiscussions));
    }
    if (data.actionItems !== undefined) {
      updates.push('action_items = ?');
      params.push(JSON.stringify(data.actionItems));
    }
    if (data.customerNeeds !== undefined) {
      updates.push('customer_needs = ?');
      params.push(JSON.stringify(data.customerNeeds));
    }
    if (data.budgetMentions !== undefined) {
      updates.push('budget_mentions = ?');
      params.push(data.budgetMentions);
    }
    if (data.timelineMentions !== undefined) {
      updates.push('timeline_mentions = ?');
      params.push(data.timelineMentions);
    }
    if (data.nextSteps !== undefined) {
      updates.push('next_steps = ?');
      params.push(JSON.stringify(data.nextSteps));
    }
    if (data.transcription !== undefined) {
      updates.push('transcription = ?');
      params.push(data.transcription);
    }

    if (updates.length === 0) return existing;

    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);

    const query = `UPDATE meeting_summaries SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(query).run(...params);

    logger.info(`Meeting summary updated: ${id}`);
    return this.findById(id);
  }

  /**
   * Delete a meeting summary
   * @param {string} id - Meeting ID
   * @returns {boolean} Success
   */
  delete(id) {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM meeting_summaries WHERE id = ?').run(id);

    if (result.changes > 0) {
      logger.info(`Meeting summary deleted: ${id}`);
      return true;
    }
    return false;
  }

  /**
   * Get action items from recent meetings
   * @param {string} customerId - Customer ID
   * @param {Object} options - Query options
   * @returns {Array} List of action items with meeting context
   */
  getActionItems(customerId, options = {}) {
    const db = getDatabase();
    const { limit = 20, includeCompleted = false } = options;

    const meetings = db.prepare(`
      SELECT id, title, meeting_date, action_items
      FROM meeting_summaries
      WHERE customer_id = ?
      ORDER BY meeting_date DESC
      LIMIT ?
    `).all(customerId, limit);

    const actionItems = [];
    meetings.forEach(m => {
      const items = JSON.parse(m.action_items || '[]');
      items.forEach(item => {
        actionItems.push({
          meetingId: m.id,
          meetingTitle: m.title,
          meetingDate: m.meeting_date,
          actionItem: item
        });
      });
    });

    return actionItems;
  }

  /**
   * Format meeting from database row
   * @param {Object} row - Database row
   * @returns {Object} Formatted meeting
   */
  _formatMeeting(row) {
    return {
      id: row.id,
      customerId: row.customer_id,
      title: row.title,
      meetingDate: row.meeting_date,
      audioFileUrl: row.audio_file_url,
      duration: row.duration,
      summary: row.summary,
      keyDiscussions: JSON.parse(row.key_discussions || '[]'),
      actionItems: JSON.parse(row.action_items || '[]'),
      customerNeeds: JSON.parse(row.customer_needs || '[]'),
      budgetMentions: row.budget_mentions,
      timelineMentions: row.timeline_mentions,
      nextSteps: JSON.parse(row.next_steps || '[]'),
      transcription: row.transcription,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export const meetingRepository = new MeetingRepository();
export default meetingRepository;
