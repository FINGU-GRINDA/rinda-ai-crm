import { logger } from '../utils/logger.js';

/**
 * Global error handling middleware
 * Catches all errors and returns appropriate responses
 */
export function errorHandler(err, req, res, next) {
  // Log the error
  logger.error('Error occurred:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  // Default error status and message
  let status = 500;
  let message = 'Internal Server Error';
  let errorCode = 'INTERNAL_ERROR';

  // Handle specific error types
  if (err.message === 'API_AUTH_FAILED') {
    status = 401;
    message = 'API 인증에 실패했습니다. 관리자에게 문의하세요.';
    errorCode = 'API_AUTH_FAILED';
  } else if (err.message === 'API_QUOTA_EXCEEDED') {
    status = 429;
    message = '일일 API 사용량을 초과했습니다. 내일 다시 시도해주세요.';
    errorCode = 'API_QUOTA_EXCEEDED';
  } else if (err.message === 'API_TIMEOUT') {
    status = 504;
    message = 'API 응답 시간이 초과되었습니다. 다시 시도해주세요.';
    errorCode = 'API_TIMEOUT';
  } else if (err.message === 'NETWORK_ERROR') {
    status = 503;
    message = '네트워크 오류가 발생했습니다. 다시 시도해주세요.';
    errorCode = 'NETWORK_ERROR';
  } else if (err.name === 'ValidationError') {
    status = 400;
    message = err.message;
    errorCode = 'VALIDATION_ERROR';
  }

  // Send error response
  res.status(status).json({
    error: message,
    code: errorCode,
    ...(process.env.NODE_ENV === 'development' && {
      details: err.message,
      stack: err.stack
    })
  });
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'Not Found',
    code: 'NOT_FOUND',
    path: req.path
  });
}
