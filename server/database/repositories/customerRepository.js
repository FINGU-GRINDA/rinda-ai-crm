import { getDatabase, generateId } from '../db.js';
import { logger } from '../../utils/logger.js';

class CustomerRepository {
  /**
   * Get all customers with optional filters
   * @param {Object} options - Query options
   * @returns {Array} List of customers
   */
  findAll(options = {}) {
    const db = getDatabase();
    const { status, industry, search, limit = 100, offset = 0, orderBy = 'created_at', order = 'DESC' } = options;

    let query = 'SELECT * FROM customers WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (industry) {
      query += ' AND industry = ?';
      params.push(industry);
    }

    if (search) {
      query += ' AND (name LIKE ? OR notes LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    // Validate orderBy to prevent SQL injection
    const validColumns = ['created_at', 'updated_at', 'name', 'status', 'last_follow_up_at'];
    const safeOrderBy = validColumns.includes(orderBy) ? orderBy : 'created_at';
    const safeOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    query += ` ORDER BY ${safeOrderBy} ${safeOrder} LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const customers = db.prepare(query).all(...params);

    // Load enrichments and proposals for each customer
    return customers.map(customer => this._loadRelations(customer));
  }

  /**
   * Find customer by ID
   * @param {string} id - Customer ID
   * @returns {Object|null} Customer or null
   */
  findById(id) {
    const db = getDatabase();
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);

    if (!customer) return null;

    return this._loadRelations(customer);
  }

  /**
   * Find customer by name
   * @param {string} name - Customer name
   * @returns {Object|null} Customer or null
   */
  findByName(name) {
    const db = getDatabase();
    const customer = db.prepare('SELECT * FROM customers WHERE name = ?').get(name);

    if (!customer) return null;

    return this._loadRelations(customer);
  }

  /**
   * Create a new customer
   * @param {Object} data - Customer data
   * @returns {Object} Created customer
   */
  create(data) {
    const db = getDatabase();
    const id = data.id || generateId();
    const now = Date.now();

    const stmt = db.prepare(`
      INSERT INTO customers (id, name, website, industry, notes, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.name,
      data.website || null,
      data.industry || null,
      data.notes || null,
      data.status || 'new',
      now,
      now
    );

    logger.info(`Customer created: ${id} - ${data.name}`);
    return this.findById(id);
  }

  /**
   * Update a customer
   * @param {string} id - Customer ID
   * @param {Object} data - Updated data
   * @returns {Object|null} Updated customer or null
   */
  update(id, data) {
    const db = getDatabase();
    const existing = this.findById(id);

    if (!existing) return null;

    const updates = [];
    const params = [];

    const allowedFields = ['name', 'website', 'industry', 'notes', 'status', 'lost_reason', 'lost_at', 'last_follow_up_at', 'last_enriched_at'];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        // Convert camelCase to snake_case
        const snakeField = field.replace(/([A-Z])/g, '_$1').toLowerCase();
        updates.push(`${snakeField} = ?`);
        params.push(data[field]);
      }
    }

    if (updates.length === 0) return existing;

    updates.push('updated_at = ?');
    params.push(Date.now());
    params.push(id);

    const query = `UPDATE customers SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(query).run(...params);

    logger.info(`Customer updated: ${id}`);
    return this.findById(id);
  }

  /**
   * Delete a customer
   * @param {string} id - Customer ID
   * @returns {boolean} Success
   */
  delete(id) {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM customers WHERE id = ?').run(id);

    if (result.changes > 0) {
      logger.info(`Customer deleted: ${id}`);
      return true;
    }
    return false;
  }

  /**
   * Update customer status
   * @param {string} id - Customer ID
   * @param {string} status - New status
   * @param {string} lostReason - Reason for lost status
   * @returns {Object|null} Updated customer
   */
  updateStatus(id, status, lostReason = null) {
    const db = getDatabase();
    const now = Date.now();

    const updates = { status, updated_at: now };

    if (status === 'lost') {
      updates.lost_at = now;
      updates.lost_reason = lostReason;
    }

    const query = `
      UPDATE customers
      SET status = ?, lost_reason = ?, lost_at = ?, updated_at = ?
      WHERE id = ?
    `;

    db.prepare(query).run(
      status,
      status === 'lost' ? lostReason : null,
      status === 'lost' ? now : null,
      now,
      id
    );

    return this.findById(id);
  }

  /**
   * Save enrichment data for a customer
   * @param {string} customerId - Customer ID
   * @param {Object} enrichment - Enrichment data
   * @returns {Object} Customer with enrichment
   */
  saveEnrichment(customerId, enrichment) {
    const db = getDatabase();
    const now = Date.now();

    // Delete existing enrichment
    db.prepare('DELETE FROM customer_enrichments WHERE customer_id = ?').run(customerId);

    // Insert new enrichment
    const stmt = db.prepare(`
      INSERT INTO customer_enrichments (customer_id, summary, ceo, founded_year, recent_news, competitors, sales_opportunity, sources, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      customerId,
      enrichment.summary || null,
      enrichment.ceo || null,
      enrichment.foundedYear || null,
      JSON.stringify(enrichment.recentNews || []),
      JSON.stringify(enrichment.competitors || []),
      enrichment.salesOpportunity || null,
      JSON.stringify(enrichment.sources || []),
      now
    );

    // Update customer's last_enriched_at
    db.prepare('UPDATE customers SET last_enriched_at = ?, updated_at = ? WHERE id = ?').run(now, now, customerId);

    logger.info(`Enrichment saved for customer: ${customerId}`);
    return this.findById(customerId);
  }

  /**
   * Save a proposal for a customer
   * @param {string} customerId - Customer ID
   * @param {Object} proposal - Proposal data
   * @returns {Object} Created proposal
   */
  saveProposal(customerId, proposal) {
    const db = getDatabase();
    const id = proposal.id || generateId();
    const now = Date.now();

    const stmt = db.prepare(`
      INSERT INTO proposals (id, customer_id, title, content, image_url, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      customerId,
      proposal.title || 'Untitled Proposal',
      proposal.content,
      proposal.imageUrl || null,
      now
    );

    logger.info(`Proposal created for customer: ${customerId}`);
    return db.prepare('SELECT * FROM proposals WHERE id = ?').get(id);
  }

  /**
   * Get proposals for a customer
   * @param {string} customerId - Customer ID
   * @returns {Array} List of proposals
   */
  getProposals(customerId) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM proposals WHERE customer_id = ? ORDER BY created_at DESC').all(customerId);
  }

  /**
   * Save follow-up action
   * @param {string} customerId - Customer ID
   * @param {Object} followUp - Follow-up data
   * @returns {Object} Created follow-up
   */
  saveFollowUp(customerId, followUp) {
    const db = getDatabase();
    const id = followUp.id || generateId();
    const now = Date.now();

    const stmt = db.prepare(`
      INSERT INTO follow_up_history (id, customer_id, type, content, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      customerId,
      followUp.type,
      followUp.content || null,
      followUp.status || 'planned',
      now
    );

    // Update customer's last_follow_up_at
    db.prepare('UPDATE customers SET last_follow_up_at = ?, updated_at = ? WHERE id = ?').run(now, now, customerId);

    return db.prepare('SELECT * FROM follow_up_history WHERE id = ?').get(id);
  }

  /**
   * Get follow-up history for a customer
   * @param {string} customerId - Customer ID
   * @returns {Array} List of follow-ups
   */
  getFollowUpHistory(customerId) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM follow_up_history WHERE customer_id = ? ORDER BY created_at DESC').all(customerId);
  }

  /**
   * Save scheduled follow-up
   * @param {string} customerId - Customer ID
   * @param {Object} followUp - Scheduled follow-up data
   * @returns {Object} Created scheduled follow-up
   */
  saveScheduledFollowUp(customerId, followUp) {
    const db = getDatabase();
    const id = followUp.id || generateId();
    const now = Date.now();

    const stmt = db.prepare(`
      INSERT INTO scheduled_follow_ups (id, customer_id, scheduled_for, type, content, status, priority, reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      customerId,
      followUp.scheduledFor,
      followUp.type,
      followUp.content || null,
      followUp.status || 'pending',
      followUp.priority || 'medium',
      followUp.reason || null,
      now
    );

    return db.prepare('SELECT * FROM scheduled_follow_ups WHERE id = ?').get(id);
  }

  /**
   * Get scheduled follow-ups for a customer
   * @param {string} customerId - Customer ID
   * @param {string} status - Filter by status
   * @returns {Array} List of scheduled follow-ups
   */
  getScheduledFollowUps(customerId, status = null) {
    const db = getDatabase();
    let query = 'SELECT * FROM scheduled_follow_ups WHERE customer_id = ?';
    const params = [customerId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY scheduled_for ASC';
    return db.prepare(query).all(...params);
  }

  /**
   * Update scheduled follow-up status
   * @param {string} id - Follow-up ID
   * @param {string} status - New status
   * @returns {Object|null} Updated follow-up
   */
  updateScheduledFollowUpStatus(id, status) {
    const db = getDatabase();
    db.prepare('UPDATE scheduled_follow_ups SET status = ? WHERE id = ?').run(status, id);
    return db.prepare('SELECT * FROM scheduled_follow_ups WHERE id = ?').get(id);
  }

  /**
   * Get all pending follow-ups due soon
   * @param {number} withinMs - Time window in milliseconds
   * @returns {Array} List of due follow-ups with customer info
   */
  getDueFollowUps(withinMs = 24 * 60 * 60 * 1000) {
    const db = getDatabase();
    const now = Date.now();
    const deadline = now + withinMs;

    return db.prepare(`
      SELECT sf.*, c.name as customer_name, c.website as customer_website
      FROM scheduled_follow_ups sf
      JOIN customers c ON sf.customer_id = c.id
      WHERE sf.status = 'pending' AND sf.scheduled_for <= ?
      ORDER BY sf.scheduled_for ASC
    `).all(deadline);
  }

  /**
   * Get customer count by status
   * @returns {Object} Count by status
   */
  getCountByStatus() {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT status, COUNT(*) as count FROM customers GROUP BY status
    `).all();

    return rows.reduce((acc, row) => {
      acc[row.status] = row.count;
      return acc;
    }, {});
  }

  /**
   * Load relations for a customer
   * @private
   */
  _loadRelations(customer) {
    const db = getDatabase();

    // Load enrichment
    const enrichment = db.prepare('SELECT * FROM customer_enrichments WHERE customer_id = ? ORDER BY created_at DESC LIMIT 1').get(customer.id);

    if (enrichment) {
      customer.enrichedData = {
        summary: enrichment.summary,
        ceo: enrichment.ceo,
        foundedYear: enrichment.founded_year,
        recentNews: JSON.parse(enrichment.recent_news || '[]'),
        competitors: JSON.parse(enrichment.competitors || '[]'),
        salesOpportunity: enrichment.sales_opportunity,
        sources: JSON.parse(enrichment.sources || '[]')
      };
      customer.lastEnrichedAt = enrichment.created_at;
    }

    // Load proposals
    customer.proposals = db.prepare('SELECT * FROM proposals WHERE customer_id = ? ORDER BY created_at DESC').all(customer.id);

    // Load follow-up history
    customer.followUpHistory = db.prepare('SELECT * FROM follow_up_history WHERE customer_id = ? ORDER BY created_at DESC').all(customer.id);

    // Convert snake_case to camelCase for frontend compatibility
    return this._toCamelCase(customer);
  }

  /**
   * Convert object keys from snake_case to camelCase
   * @private
   */
  _toCamelCase(obj) {
    if (obj === null || typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map(item => this._toCamelCase(item));
    }

    const newObj = {};
    for (const key in obj) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      newObj[camelKey] = this._toCamelCase(obj[key]);
    }
    return newObj;
  }
}

export const customerRepository = new CustomerRepository();
export default customerRepository;
