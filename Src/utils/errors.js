const logger = require('./logger');

class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

const notFound = (message = 'Resource not found') => new AppError(message, 404);
const badRequest = (message = 'Bad request') => new AppError(message, 400);
const conflict = (message = 'Conflict') => new AppError(message, 409);

// Handle Mongoose validation errors
const handleValidationError = (err) => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

// Handle Mongoose duplicate key errors
const handleDuplicateKeyError = (err) => {
  const field = Object.keys(err.keyPattern)[0];
  const message = `${field} already exists. Please use another value.`;
  return new AppError(message, 409);
};

// Handle Mongoose cast errors (invalid ObjectId)
const handleCastError = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

// Handle JWT errors
const handleJWTError = () => new AppError('Invalid token. Please log in again.', 401);
const handleJWTExpiredError = () => new AppError('Your token has expired. Please log in again.', 401);

const errorMiddleware = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode || 500;
  error.isOperational = err.isOperational;

  // Log error with context
  logger.error(`Error: ${error.message}`, err, {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: req.userId
  });

  // Handle specific error types
  if (err.name === 'ValidationError') error = handleValidationError(err);
  if (err.code === 11000) error = handleDuplicateKeyError(err);
  if (err.name === 'CastError') error = handleCastError(err);
  if (err.name === 'JsonWebTokenError') error = handleJWTError();
  if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();

  // Prepare response
  const status = error.statusCode || 500;
  const body = {
    success: false,
    message: error.isOperational ? error.message : 'Internal Server Error',
  };

  // Add stack trace in development only
  if (process.env.NODE_ENV === 'development') {
    body.stack = err.stack;
    body.error = err;
  }

  res.status(status).json(body);
};

// Async handler wrapper to catch errors in async functions
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  AppError,
  notFound,
  badRequest,
  conflict,
  errorMiddleware,
  asyncHandler,
};
