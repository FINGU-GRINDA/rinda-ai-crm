import { getDatabase, generateId } from '../db.js';
import { logger } from '../../utils/logger.js';

class ProspectRepository {
  /**
   * Get all prospects with optional filters
   * @param {Object} options - Query options
   * @returns {Array} List of prospects
   */
  findAll(options = {}) {
    const db = getDatabase();
    const { signalStrength, industry, search, converted, limit = 100, offset = 0, orderBy = 'detected_at', order = 'DESC' } = options;

    let query = 'SELECT * FROM prospects WHERE 1=1';
    const params = [];

    if (signalStrength) {
      query += ' AND signal_strength = ?';
      params.push(signalStrength);
    }

    if (industry) {
      query += ' AND industry = ?';
      params.push(industry);
    }

    if (search) {
      query += ' AND (company_name LIKE ? OR notes LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (converted === true) {
      query += ' AND converted_to_customer_id IS NOT NULL';
    } else if (converted === false) {
      query += ' AND converted_to_customer_id IS NULL';
    }

    // Validate orderBy
    const validColumns = ['detected_at', 'created_at', 'company_name', 'signal_strength'];
    const safeOrderBy = validColumns.includes(orderBy) ? orderBy : 'detected_at';
    const safeOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    query += ` ORDER BY ${safeOrderBy} ${safeOrder} LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const prospects = db.prepare(query).all(...params);
    return prospects.map(p => this._toCamelCase(p));
  }

  /**
   * Find prospect by ID
   * @param {string} id - Prospect ID
   * @returns {Object|null} Prospect or null
   */
  findById(id) {
    const db = getDatabase();
    const prospect = db.prepare('SELECT * FROM prospects WHERE id = ?').get(id);
    return prospect ? this._toCamelCase(prospect) : null;
  }

  /**
   * Find prospect by company name
   * @param {string} companyName - Company name
   * @returns {Object|null} Prospect or null
   */
  findByCompanyName(companyName) {
    const db = getDatabase();
    const prospect = db.prepare('SELECT * FROM prospects WHERE company_name = ?').get(companyName);
    return prospect ? this._toCamelCase(prospect) : null;
  }

  /**
   * Check if company already exists
   * @param {string} companyName - Company name
   * @returns {boolean}
   */
  exists(companyName) {
    const db = getDatabase();
    const result = db.prepare('SELECT 1 FROM prospects WHERE company_name = ? LIMIT 1').get(companyName);
    return !!result;
  }

  /**
   * Create a new prospect
   * @param {Object} data - Prospect data
   * @returns {Object} Created prospect
   */
  create(data) {
    const db = getDatabase();
    const id = data.id || generateId();
    const now = Date.now();

    const stmt = db.prepare(`
      INSERT INTO prospects (id, company_name, website, industry, source_title, source_uri, source_published_at, signal_strength, icp_match, notes, detected_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.companyName,
      data.website || null,
      data.industry || null,
      data.sourceArticle?.title || data.sourceTitle || null,
      data.sourceArticle?.uri || data.sourceUri || null,
      data.sourceArticle?.publishedAt || data.sourcePublishedAt || null,
      data.signalStrength || 'medium',
      data.icpMatch || null,
      data.notes || null,
      data.detectedAt || now,
      now
    );

    logger.info(`Prospect created: ${id} - ${data.companyName}`);
    return this.findById(id);
  }

  /**
   * Create multiple prospects
   * @param {Array} prospects - Array of prospect data
   * @returns {Array} Created prospects
   */
  createMany(prospects) {
    const db = getDatabase();
    const now = Date.now();

    const stmt = db.prepare(`
      INSERT INTO prospects (id, company_name, website, industry, source_title, source_uri, source_published_at, signal_strength, icp_match, notes, detected_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((items) => {
      const created = [];
      for (const data of items) {
        const id = data.id || generateId();
        stmt.run(
          id,
          data.companyName,
          data.website || null,
          data.industry || null,
          data.sourceArticle?.title || data.sourceTitle || null,
          data.sourceArticle?.uri || data.sourceUri || null,
          data.sourceArticle?.publishedAt || data.sourcePublishedAt || null,
          data.signalStrength || 'medium',
          data.icpMatch || null,
          data.notes || null,
          data.detectedAt || now,
          now
        );
        created.push(id);
      }
      return created;
    });

    const createdIds = insertMany(prospects);
    logger.info(`${createdIds.length} prospects created`);

    return createdIds.map(id => this.findById(id));
  }

  /**
   * Update a prospect
   * @param {string} id - Prospect ID
   * @param {Object} data - Updated data
   * @returns {Object|null} Updated prospect
   */
  update(id, data) {
    const db = getDatabase();
    const existing = this.findById(id);

    if (!existing) return null;

    const updates = [];
    const params = [];

    const fieldMapping = {
      companyName: 'company_name',
      website: 'website',
      industry: 'industry',
      sourceTitle: 'source_title',
      sourceUri: 'source_uri',
      sourcePublishedAt: 'source_published_at',
      signalStrength: 'signal_strength',
      icpMatch: 'icp_match',
      notes: 'notes'
    };

    for (const [camelKey, snakeKey] of Object.entries(fieldMapping)) {
      if (data[camelKey] !== undefined) {
        updates.push(`${snakeKey} = ?`);
        params.push(data[camelKey]);
      }
    }

    if (updates.length === 0) return existing;

    params.push(id);
    const query = `UPDATE prospects SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(query).run(...params);

    logger.info(`Prospect updated: ${id}`);
    return this.findById(id);
  }

  /**
   * Delete a prospect
   * @param {string} id - Prospect ID
   * @returns {boolean} Success
   */
  delete(id) {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM prospects WHERE id = ?').run(id);

    if (result.changes > 0) {
      logger.info(`Prospect deleted: ${id}`);
      return true;
    }
    return false;
  }

  /**
   * Convert prospect to customer
   * @param {string} prospectId - Prospect ID
   * @param {string} customerId - Created customer ID
   * @returns {Object|null} Updated prospect
   */
  convertToCustomer(prospectId, customerId) {
    const db = getDatabase();

    db.prepare('UPDATE prospects SET converted_to_customer_id = ? WHERE id = ?').run(customerId, prospectId);

    logger.info(`Prospect ${prospectId} converted to customer ${customerId}`);
    return this.findById(prospectId);
  }

  /**
   * Get prospect count by signal strength
   * @returns {Object} Count by signal strength
   */
  getCountBySignal() {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT signal_strength, COUNT(*) as count FROM prospects
      WHERE converted_to_customer_id IS NULL
      GROUP BY signal_strength
    `).all();

    return rows.reduce((acc, row) => {
      acc[row.signal_strength] = row.count;
      return acc;
    }, {});
  }

  /**
   * Get unconverted prospect count
   * @returns {number}
   */
  getUnconvertedCount() {
    const db = getDatabase();
    const result = db.prepare('SELECT COUNT(*) as count FROM prospects WHERE converted_to_customer_id IS NULL').get();
    return result.count;
  }

  /**
   * Get all company names (for deduplication)
   * @returns {Array<string>}
   */
  getAllCompanyNames() {
    const db = getDatabase();
    const rows = db.prepare('SELECT company_name FROM prospects').all();
    return rows.map(r => r.company_name);
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

      // Special handling for source article
      if (key === 'source_title' || key === 'source_uri' || key === 'source_published_at') {
        if (!newObj.sourceArticle) newObj.sourceArticle = {};
        if (key === 'source_title') newObj.sourceArticle.title = obj[key];
        if (key === 'source_uri') newObj.sourceArticle.uri = obj[key];
        if (key === 'source_published_at') newObj.sourceArticle.publishedAt = obj[key];
      } else {
        newObj[camelKey] = obj[key];
      }
    }
    return newObj;
  }
}

export const prospectRepository = new ProspectRepository();
export default prospectRepository;
