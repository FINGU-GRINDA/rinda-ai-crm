import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger.js';

/**
 * Create rate limiter middleware
 * Prevents API abuse and manages quota
 */
export function createRateLimiter(options = {}) {
  const {
    windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 requests per window
    message = 'Too many requests, please try again later.',
    ...customOptions
  } = options;

  return rateLimit({
    windowMs,
    max,
    message: { error: message, code: 'RATE_LIMIT_EXCEEDED' },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req, res) => {
      logger.warn('Rate limit exceeded:', {
        ip: req.ip,
        path: req.path
      });
      res.status(429).json({
        error: message,
        code: 'RATE_LIMIT_EXCEEDED'
      });
    },
    ...customOptions
  });
}

/**
 * AI endpoints rate limiter (more restrictive)
 * 30 requests per 15 minutes
 */
export const aiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'AI API 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'
});

/**
 * General API rate limiter
 * 100 requests per 15 minutes
 */
export const generalRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'API 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'
});
