import { getDatabase, generateId } from '../db.js';
import { logger } from '../../utils/logger.js';

class ContactRepository {
  /**
   * Get all contacts for a customer
   * @param {string} customerId - Customer ID
   * @returns {Array} List of contacts
   */
  findByCustomerId(customerId) {
    const db = getDatabase();
    const contacts = db.prepare(`
      SELECT * FROM customer_contacts
      WHERE customer_id = ?
      ORDER BY is_primary DESC, created_at DESC
    `).all(customerId);

    return contacts.map(this._formatContact);
  }

  /**
   * Find contact by ID
   * @param {string} id - Contact ID
   * @returns {Object|null} Contact or null
   */
  findById(id) {
    const db = getDatabase();
    const contact = db.prepare('SELECT * FROM customer_contacts WHERE id = ?').get(id);

    if (!contact) return null;
    return this._formatContact(contact);
  }

  /**
   * Find contact by email
   * @param {string} email - Email address
   * @returns {Object|null} Contact or null
   */
  findByEmail(email) {
    const db = getDatabase();
    const contact = db.prepare('SELECT * FROM customer_contacts WHERE email = ?').get(email);

    if (!contact) return null;
    return this._formatContact(contact);
  }

  /**
   * Create a new contact
   * @param {Object} data - Contact data
   * @returns {Object} Created contact
   */
  create(data) {
    const db = getDatabase();
    const id = data.id || generateId();
    const now = Date.now();

    // If this is primary, unset other primary contacts for this customer
    if (data.isPrimary) {
      db.prepare(`
        UPDATE customer_contacts
        SET is_primary = 0, updated_at = ?
        WHERE customer_id = ?
      `).run(now, data.customerId);
    }

    const stmt = db.prepare(`
      INSERT INTO customer_contacts (
        id, customer_id, name, title, email, phone,
        is_primary, source, business_card_image_url,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.customerId,
      data.name,
      data.title || null,
      data.email || null,
      data.phone || null,
      data.isPrimary ? 1 : 0,
      data.source || 'manual',
      data.businessCardImageUrl || null,
      now,
      now
    );

    logger.info(`Contact created: ${id} - ${data.name} for customer ${data.customerId}`);
    return this.findById(id);
  }

  /**
   * Update a contact
   * @param {string} id - Contact ID
   * @param {Object} data - Update data
   * @returns {Object|null} Updated contact or null
   */
  update(id, data) {
    const db = getDatabase();
    const now = Date.now();
    const existing = this.findById(id);

    if (!existing) return null;

    // If setting as primary, unset other primary contacts
    if (data.isPrimary && !existing.isPrimary) {
      db.prepare(`
        UPDATE customer_contacts
        SET is_primary = 0, updated_at = ?
        WHERE customer_id = ? AND id != ?
      `).run(now, existing.customerId, id);
    }

    const stmt = db.prepare(`
      UPDATE customer_contacts SET
        name = COALESCE(?, name),
        title = COALESCE(?, title),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        is_primary = COALESCE(?, is_primary),
        updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      data.name || null,
      data.title !== undefined ? data.title : null,
      data.email !== undefined ? data.email : null,
      data.phone !== undefined ? data.phone : null,
      data.isPrimary !== undefined ? (data.isPrimary ? 1 : 0) : null,
      now,
      id
    );

    logger.info(`Contact updated: ${id}`);
    return this.findById(id);
  }

  /**
   * Delete a contact
   * @param {string} id - Contact ID
   * @returns {boolean} Success
   */
  delete(id) {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM customer_contacts WHERE id = ?').run(id);

    if (result.changes > 0) {
      logger.info(`Contact deleted: ${id}`);
      return true;
    }
    return false;
  }

  /**
   * Get primary contact for a customer
   * @param {string} customerId - Customer ID
   * @returns {Object|null} Primary contact or null
   */
  findPrimaryByCustomerId(customerId) {
    const db = getDatabase();
    const contact = db.prepare(`
      SELECT * FROM customer_contacts
      WHERE customer_id = ? AND is_primary = 1
    `).get(customerId);

    if (!contact) return null;
    return this._formatContact(contact);
  }

  /**
   * Format contact from database row
   * @param {Object} row - Database row
   * @returns {Object} Formatted contact
   */
  _formatContact(row) {
    return {
      id: row.id,
      customerId: row.customer_id,
      name: row.name,
      title: row.title,
      email: row.email,
      phone: row.phone,
      isPrimary: row.is_primary === 1,
      source: row.source,
      businessCardImageUrl: row.business_card_image_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export const contactRepository = new ContactRepository();
export default contactRepository;
