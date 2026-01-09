import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db = null;

/**
 * Initialize SQLite database connection
 * @returns {Database} SQLite database instance
 */
export function initializeDatabase() {
  if (db) {
    return db;
  }

  const dbPath = process.env.DATABASE_PATH || join(__dirname, '..', 'data', 'rinda-crm.db');

  try {
    db = new Database(dbPath, { verbose: process.env.NODE_ENV === 'development' ? console.log : null });

    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Performance optimizations
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = -64000'); // 64MB cache

    logger.info(`Database initialized at: ${dbPath}`);

    // Run schema initialization
    initializeSchema();

    return db;
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Initialize database schema from schema.sql
 */
function initializeSchema() {
  const schemaPath = join(__dirname, 'schema.sql');

  try {
    const schema = readFileSync(schemaPath, 'utf8');
    db.exec(schema);
    logger.info('Database schema initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize database schema:', error);
    throw error;
  }
}

/**
 * Get database instance
 * @returns {Database} SQLite database instance
 */
export function getDatabase() {
  if (!db) {
    return initializeDatabase();
  }
  return db;
}

/**
 * Close database connection
 */
export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    logger.info('Database connection closed');
  }
}

/**
 * Run a transaction
 * @param {Function} fn - Function to run in transaction
 * @returns {*} Result of the function
 */
export function runTransaction(fn) {
  const transaction = db.transaction(fn);
  return transaction();
}

/**
 * Generate a unique ID
 * @returns {string} UUID
 */
export function generateId() {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export default {
  initializeDatabase,
  getDatabase,
  closeDatabase,
  runTransaction,
  generateId
};
