import crypto from 'crypto';
import { logger } from '../utils/logger.js';

/**
 * Middleware to verify Slack request signature
 * https://api.slack.com/authentication/verifying-requests-from-slack
 */
export function verifySlackRequest(req, res, next) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;

  // Skip verification if no signing secret configured
  if (!signingSecret) {
    logger.warn('SLACK_SIGNING_SECRET not configured, skipping verification');
    return next();
  }

  const timestamp = req.headers['x-slack-request-timestamp'];
  const slackSignature = req.headers['x-slack-signature'];

  if (!timestamp || !slackSignature) {
    logger.warn('Missing Slack signature headers');
    return res.status(400).json({
      success: false,
      error: 'Missing signature headers'
    });
  }

  // Check timestamp to prevent replay attacks (5 minutes)
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (parseInt(timestamp) < fiveMinutesAgo) {
    logger.warn('Slack request timestamp too old');
    return res.status(400).json({
      success: false,
      error: 'Request timestamp too old'
    });
  }

  // Get raw body (need to ensure express.raw() middleware is used for this route)
  const rawBody = req.rawBody || JSON.stringify(req.body);

  // Create signature base string
  const sigBaseString = `v0:${timestamp}:${rawBody}`;

  // Calculate expected signature
  const mySignature = 'v0=' + crypto
    .createHmac('sha256', signingSecret)
    .update(sigBaseString, 'utf8')
    .digest('hex');

  // Compare signatures using timing-safe comparison
  try {
    if (crypto.timingSafeEqual(Buffer.from(mySignature), Buffer.from(slackSignature))) {
      return next();
    }
  } catch (error) {
    logger.error('Signature comparison error:', error);
  }

  logger.warn('Invalid Slack signature');
  return res.status(401).json({
    success: false,
    error: 'Invalid signature'
  });
}

/**
 * Middleware to capture raw body for Slack signature verification
 */
export function captureRawBody(req, res, buf) {
  req.rawBody = buf.toString();
}

export default { verifySlackRequest, captureRawBody };
