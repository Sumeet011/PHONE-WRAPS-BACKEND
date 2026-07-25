/**
 * Authentication Middleware
 * Provides JWT verification and authorization
 */
const jwt = require('jsonwebtoken');
const { AppError } = require('../utils/errors');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_SECRET) {
  logger.error('JWT_SECRET is not defined in environment variables');
  throw new Error('JWT_SECRET must be defined');
}

/**
 * Generate session token (no expiration - lasts until logout)
 * @param {Object} payload - User data to encode
 * @returns {string} JWT token
 */
const generateToken = (payload) => {
  // No expiration - token valid until user logs out
  return jwt.sign(payload, JWT_SECRET);
};

/**
 * Verify token middleware
 */
const verifyToken = (req, res, next) => {
  try {
    // Get token from Authorization header or legacy 'token' header
    let token;
    const authHeader = req.headers.authorization;
    const legacyToken = req.headers.token;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (legacyToken) {
      // Support legacy 'token' header for backward compatibility
      token = legacyToken;
    } else {
      throw new AppError('No token provided', 401);
    }

    // Verify token (no expiration check since tokens don't expire)
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Attach user data to request (set both userId and user for compatibility)
    req.userId = decoded.userId;
    req.user = decoded; // This is what authorize() expects
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token', 401));
    }
    next(error);
  }
};

/**
 * Optional authentication - doesn't fail if no token
 */
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      req.userId = decoded.userId;
      req.user = decoded;
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

/**
 * Role-based authorization middleware
 * @param {Array<string>} allowedRoles - Array of allowed role names
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    if (!req.user.role || !allowedRoles.includes(req.user.role)) {
      return next(new AppError('Insufficient permissions', 403));
    }

    next();
  };
};

// Convenience middleware for admin-only routes
const adminAuth = authorize(['admin']);

module.exports = {
  generateToken,
  verifyToken,
  optionalAuth,
  authorize,
  adminAuth
};
