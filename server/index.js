import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

// Import database initialization
import { initializeDatabase, closeDatabase } from './database/db.js';

// Import existing routes
import aiRoutes from './routes/ai.routes.js';
import prospectRoutes from './routes/prospects.routes.js';
import settingsRoutes from './routes/settings.routes.js';

// Import new routes
import customerRoutes from './routes/customer.routes.js';
import prospectRoutesNew from './routes/prospect.routes.new.js';
import icpRoutes from './routes/icp.routes.js';
import settingsRoutesNew, { notificationsRouter } from './routes/settings.routes.new.js';
import migrationRoutes from './routes/migration.routes.js';
import slackEventRoutes from './routes/slackEvent.routes.js';
import mixpanelRoutes from './routes/mixpanel.routes.js';
import gmailRoutes from './routes/gmail.routes.js';
import calendarRoutes from './routes/calendar.routes.js';

// Import middleware
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestLogger, trackRequestTime } from './middleware/requestLogger.js';
import { captureRawBody } from './middleware/slackVerify.js';

// Import jobs
import { initializeProspectCollectionJob, stopProspectCollectionJob } from './jobs/prospectCollector.js';

// Import utilities
import { logger } from './utils/logger.js';

// Validate required environment variables
if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'PLACEHOLDER_API_KEY') {
  logger.error('GEMINI_API_KEY is not set or is a placeholder. Please set a valid API key.');
  process.exit(1);
}

// Initialize database
try {
  initializeDatabase();
  logger.info('Database initialized successfully');
} catch (error) {
  logger.error('Failed to initialize database:', error);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Security middleware
app.use(helmet());

// Compression middleware
app.use(compression());

// CORS configuration - allow multiple origins for development
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  process.env.FRONTEND_URL
].filter(Boolean);

// In development, allow any origin from the same network
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) {
      return callback(null, true);
    }

    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // In development, allow any localhost or local network IP on port 3000
    if (process.env.NODE_ENV !== 'production') {
      const isLocalhost = origin.includes('localhost:3000') || origin.includes('127.0.0.1:3000');
      const isLocalNetwork = /^http:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)[0-9.]+:3000$/.test(origin);
      if (isLocalhost || isLocalNetwork) {
        return callback(null, true);
      }
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Body parsing middleware with raw body capture for Slack verification
app.use(express.json({
  limit: '10mb',
  verify: captureRawBody
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request tracking and logging
app.use(trackRequestTime);
app.use(requestLogger);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    uptime: process.uptime(),
    environment: NODE_ENV,
    database: 'connected'
  });
});

// ========================================
// API Routes
// ========================================

// AI routes (existing)
app.use('/api/ai', aiRoutes);

// Legacy prospect routes (for backward compatibility with prospect collection)
app.use('/api/prospects', prospectRoutes);

// Legacy settings routes (for backward compatibility)
app.use('/api/settings', settingsRoutes);

// New database-backed routes
app.use('/api/customers', customerRoutes);
app.use('/api/leads', prospectRoutesNew);  // New prospect/lead management
app.use('/api/icp-profiles', icpRoutes);
app.use('/api/config', settingsRoutesNew);  // New settings with DB
app.use('/api/notifications', notificationsRouter);
app.use('/api/migrate', migrationRoutes);

// External integrations
app.use('/api/slack', slackEventRoutes);
app.use('/api/mixpanel', mixpanelRoutes);
app.use('/api/gmail', gmailRoutes);
app.use('/api/calendar', calendarRoutes);

// ========================================

// 404 handler
app.use(notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  logger.info(`
    ========================================
    RINDA CRM Backend Server Started
    ========================================
    Environment: ${NODE_ENV}
    Port: ${PORT}
    Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}
    Database: SQLite (connected)
    ========================================

    New API Endpoints:
    - /api/customers     - Customer management (DB)
    - /api/leads         - Lead/Prospect management (DB)
    - /api/icp-profiles  - ICP Profile management (DB)
    - /api/config        - Settings management (DB)
    - /api/notifications - Notification management (DB)
    - /api/migrate       - Data migration
    - /api/slack         - Slack Event API
    - /api/gmail         - Gmail OAuth & Sync
    - /api/calendar      - Google Calendar OAuth & Events
    ========================================
  `);

  // Initialize background jobs
  initializeProspectCollectionJob();
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  logger.info(`${signal} received. Shutting down gracefully...`);

  stopProspectCollectionJob();

  server.close(() => {
    logger.info('HTTP server closed');

    // Close database connection
    closeDatabase();

    logger.info('All connections closed. Exiting.');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', { reason, promise });
});

export default app;
