/**
 * Centralized Logging Utility
 * Provides consistent logging across the application with environment-aware behavior
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

// Color codes for terminal output (development only)
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

class Logger {
  constructor() {
    this.isDevelopment = isDevelopment;
  }

  /**
   * Format timestamp
   */
  getTimestamp() {
    return new Date().toISOString();
  }

  /**
   * Format log message
   */
  formatMessage(level, message, meta = {}) {
    const timestamp = this.getTimestamp();
    const metaStr = Object.keys(meta).length > 0 ? ` | ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level}] ${message}${metaStr}`;
  }

  /**
   * Info level logging
   */
  info(message, meta = {}) {
    if (this.isDevelopment) {
      console.log(`${colors.green}ℹ ${message}${colors.reset}`, meta);
    } else {
      console.log(this.formatMessage('INFO', message, meta));
    }
  }

  /**
   * Warning level logging
   */
  warn(message, meta = {}) {
    if (this.isDevelopment) {
      console.warn(`${colors.yellow}⚠ ${message}${colors.reset}`, meta);
    } else {
      console.warn(this.formatMessage('WARN', message, meta));
    }
  }

  /**
   * Error level logging
   */
  error(message, error = null, meta = {}) {
    if (this.isDevelopment) {
      console.error(`${colors.red}✖ ${message}${colors.reset}`, meta);
      if (error && error.stack) {
        console.error(error.stack);
      }
    } else {
      // In production, log structured data without stack traces
      const logData = {
        ...meta,
        error: error ? {
          message: error.message,
          name: error.name
        } : undefined
      };
      console.error(this.formatMessage('ERROR', message, logData));
    }
  }

  /**
   * Debug level logging (only in development)
   */
  debug(message, meta = {}) {
    if (this.isDevelopment) {
      console.debug(`${colors.cyan}🔍 ${message}${colors.reset}`, meta);
    }
  }

  /**
   * Success level logging
   */
  success(message, meta = {}) {
    if (this.isDevelopment) {
      console.log(`${colors.green}✓ ${message}${colors.reset}`, meta);
    } else {
      console.log(this.formatMessage('SUCCESS', message, meta));
    }
  }

  /**
   * HTTP request logging
   */
  http(method, url, statusCode, duration) {
    const color = statusCode >= 500 ? colors.red :
                  statusCode >= 400 ? colors.yellow :
                  statusCode >= 300 ? colors.cyan :
                  colors.green;
    
    if (this.isDevelopment) {
      console.log(`${color}${method} ${url} ${statusCode} - ${duration}ms${colors.reset}`);
    } else {
      console.log(this.formatMessage('HTTP', `${method} ${url}`, {
        statusCode,
        duration: `${duration}ms`
      }));
    }
  }

  /**
   * Database query logging (only in development)
   */
  query(queryType, collection, duration) {
    if (this.isDevelopment) {
      console.log(`${colors.magenta}📊 ${queryType} on ${collection} - ${duration}ms${colors.reset}`);
    }
  }
}

// Export singleton instance
const logger = new Logger();
module.exports = logger;
