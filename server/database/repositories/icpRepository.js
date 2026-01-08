import { getDatabase, generateId } from '../db.js';
import { logger } from '../../utils/logger.js';

class ICPRepository {
  /**
   * Get all ICP profiles
   * @returns {Array} List of ICP profiles
   */
  findAll() {
    const db = getDatabase();
    const profiles = db.prepare('SELECT * FROM icp_profiles ORDER BY created_at DESC').all();
    return profiles.map(p => this._parseJsonFields(p));
  }

  /**
   * Find ICP profile by ID
   * @param {string} id - Profile ID
   * @returns {Object|null} ICP profile or null
   */
  findById(id) {
    const db = getDatabase();
    const profile = db.prepare('SELECT * FROM icp_profiles WHERE id = ?').get(id);
    return profile ? this._parseJsonFields(profile) : null;
  }

  /**
   * Create a new ICP profile
   * @param {Object} data - Profile data
   * @returns {Object} Created profile
   */
  create(data) {
    const db = getDatabase();
    const id = data.id || generateId();
    const now = Date.now();

    const stmt = db.prepare(`
      INSERT INTO icp_profiles (id, name, industries, keywords, company_size, target_regions, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.name,
      JSON.stringify(data.industries || []),
      JSON.stringify(data.keywords || []),
      data.companySize || null,
      JSON.stringify(data.targetRegions || []),
      now,
      now
    );

    logger.info(`ICP Profile created: ${id} - ${data.name}`);
    return this.findById(id);
  }

  /**
   * Update an ICP profile
   * @param {string} id - Profile ID
   * @param {Object} data - Updated data
   * @returns {Object|null} Updated profile
   */
  update(id, data) {
    const db = getDatabase();
    const existing = this.findById(id);

    if (!existing) return null;

    const now = Date.now();

    const stmt = db.prepare(`
      UPDATE icp_profiles
      SET name = ?, industries = ?, keywords = ?, company_size = ?, target_regions = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      data.name !== undefined ? data.name : existing.name,
      JSON.stringify(data.industries !== undefined ? data.industries : existing.industries),
      JSON.stringify(data.keywords !== undefined ? data.keywords : existing.keywords),
      data.companySize !== undefined ? data.companySize : existing.companySize,
      JSON.stringify(data.targetRegions !== undefined ? data.targetRegions : existing.targetRegions),
      now,
      id
    );

    logger.info(`ICP Profile updated: ${id}`);
    return this.findById(id);
  }

  /**
   * Delete an ICP profile
   * @param {string} id - Profile ID
   * @returns {boolean} Success
   */
  delete(id) {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM icp_profiles WHERE id = ?').run(id);

    if (result.changes > 0) {
      logger.info(`ICP Profile deleted: ${id}`);
      return true;
    }
    return false;
  }

  /**
   * Parse JSON fields in profile
   * @private
   */
  _parseJsonFields(profile) {
    return {
      id: profile.id,
      name: profile.name,
      industries: JSON.parse(profile.industries || '[]'),
      keywords: JSON.parse(profile.keywords || '[]'),
      companySize: profile.company_size,
      targetRegions: JSON.parse(profile.target_regions || '[]'),
      createdAt: profile.created_at,
      updatedAt: profile.updated_at
    };
  }
}

export const icpRepository = new ICPRepository();
export default icpRepository;
