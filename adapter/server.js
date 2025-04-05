const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const config = require('./utils/config');
const logger = require('./utils/logger');
const { errorHandler } = require('./utils/errorHandler');
const { verifyAuthentication } = require('./auth/authMiddleware');

// Import routes
const searchRoutes = require('./routes/searchRoutes');
const selectRoutes = require('./routes/selectRoutes');
const initRoutes = require('./routes/initRoutes');
const onInitRoutes = require('./routes/onInitRoutes');
const confirmRoutes = require('./routes/confirmRoutes');
const onConfirmRoutes = require('./routes/onConfirmRoutes');
const productRoutes = require('./routes/productRoutes');
const cancelRoutes = require('./routes/cancelRoutes');
const onCancelRoutes = require('./routes/onCancelRoutes');

// Initialize Express app
const app = express();

// Apply security middleware
app.use(helmet());
app.use(cors());

// Middleware to parse raw body
app.use((req, res, next) => {
  req.rawBody = '';
  req.on('data', chunk => {
    req.rawBody += chunk;
  });
  req.on('end', () => {
    next();
  });
});

// Body parsing middleware with error handling
app.use(bodyParser.json({
  verify: (req, res, buf) => {
    try {
      // Store raw body for signature verification
      req.rawBody = buf.toString();
    } catch (e) {
      logger.error('Body parsing error', { error: e.message });
      throw new Error('Invalid request body');
    }
  },
  limit: config.server.bodyLimit
}));
app.use(bodyParser.urlencoded({ 
  extended: true, 
  limit: config.server.bodyLimit 
}));
app.use(morgan('combined', { 
  stream: { 
    write: message => logger.info(message.trim()) 
  } 
}));

// Apply authentication middleware if enabled
if (config.server.enableAuthentication) {
  app.use(verifyAuthentication);
  logger.info('ONDC Authentication middleware enabled');
} else {
  logger.warn('ONDC Authentication middleware is DISABLED - not recommended for production');
}

// API routes
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/select', selectRoutes);
app.use('/api/v1/init', initRoutes);
app.use('/api/v1/on_init', onInitRoutes);
app.use('/api/v1/confirm', confirmRoutes);
app.use('/api/v1/on_confirm', onConfirmRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/cancel', cancelRoutes);
app.use('/api/v1/on_cancel', onCancelRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Request processing error', {
    error: err.message,
    stack: err.stack,
    body: req.rawBody
  });

  res.status(500).json({
    error: {
      message: 'Internal Server Error',
      details: err.message || 'Unable to process the request'
    }
  });
});

// Start the server
const PORT = config.server.port || 3000;
const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`ONDC Connector initialized with endpoints:`);
  logger.info(`- /api/v1/search`);
  logger.info(`- /api/v1/select`);
  logger.info(`- /api/v1/init`);
  logger.info(`- /api/v1/on_init`);
  logger.info(`- /api/v1/confirm`);
  logger.info(`- /api/v1/on_confirm`);
  logger.info(`- /api/v1/products`);
  logger.info(`- /api/v1/cancel`);
  logger.info(`- /api/v1/on_cancel`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

module.exports = app;