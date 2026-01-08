import morgan from 'morgan';
import { logger } from '../utils/logger.js';

/**
 * Request logging middleware using Morgan
 * Logs HTTP requests in development and production
 */

// Custom token for response time in milliseconds
morgan.token('response-time-ms', (req, res) => {
  if (!req._startTime) return '0';
  const ms = Date.now() - req._startTime;
  return `${ms}ms`;
});

// Development format: detailed logs
const devFormat = ':method :url :status :response-time-ms - :res[content-length]';

// Production format: combined logs
const prodFormat = ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length]';

export const requestLogger = morgan(
  process.env.NODE_ENV === 'production' ? prodFormat : devFormat,
  {
    stream: {
      write: (message) => {
        logger.info(message.trim());
      }
    },
    skip: (req) => {
      // Skip health check logs to reduce noise
      return req.path === '/health';
    }
  }
);

/**
 * Middleware to track request start time
 */
export function trackRequestTime(req, res, next) {
  req._startTime = Date.now();
  next();
}
