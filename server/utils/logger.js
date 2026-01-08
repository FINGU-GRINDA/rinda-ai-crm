/**
 * Simple logger utility
 * In production, consider using Winston or Pino for structured logging
 */

const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

function formatMessage(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const metaString = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
  return `[${timestamp}] [${level}] ${message} ${metaString}`;
}

export const logger = {
  error: (message, meta) => {
    console.error(formatMessage(LOG_LEVELS.ERROR, message, meta));
  },

  warn: (message, meta) => {
    console.warn(formatMessage(LOG_LEVELS.WARN, message, meta));
  },

  info: (message, meta) => {
    console.log(formatMessage(LOG_LEVELS.INFO, message, meta));
  },

  debug: (message, meta) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(formatMessage(LOG_LEVELS.DEBUG, message, meta));
    }
  }
};
