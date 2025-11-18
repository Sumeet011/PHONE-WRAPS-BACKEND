/**
 * Environment Variable Validation
 * Validates all required environment variables at startup
 */
const Joi = require('joi');
const logger = require('./logger');

// Define schema for environment variables
const envSchema = Joi.object({
  // Node Environment
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  
  // Server Configuration
  PORT: Joi.number()
    .default(3000),
  
  // Database
  MONGODB_URI: Joi.string()
    .uri()
    .required()
    .messages({
      'string.uri': 'MONGODB_URI must be a valid URI',
      'any.required': 'MONGODB_URI is required'
    }),
  
  // JWT Secret
  JWT_SECRET: Joi.string()
    .min(32)
    .required()
    .messages({
      'string.min': 'JWT_SECRET must be at least 32 characters long for security',
      'any.required': 'JWT_SECRET is required'
    }),
  
  // Cloudinary
  CLOUDINARY_CLOUD_NAME: Joi.string()
    .required()
    .messages({
      'any.required': 'CLOUDINARY_CLOUD_NAME is required'
    }),
  
  CLOUDINARY_API_KEY: Joi.string()
    .required()
    .messages({
      'any.required': 'CLOUDINARY_API_KEY is required'
    }),
  
  CLOUDINARY_API_SECRET: Joi.string()
    .required()
    .messages({
      'any.required': 'CLOUDINARY_API_SECRET is required'
    }),
  
  // Razorpay (Payment Gateway)
  RAZORPAY_KEY_ID: Joi.string()
    .optional(),
  
  RAZORPAY_KEY_SECRET: Joi.string()
    .optional(),
  
  // Twilio (SMS/OTP)
  TWILIO_ACCOUNT_SID: Joi.string()
    .optional(),
  
  TWILIO_AUTH_TOKEN: Joi.string()
    .optional(),
  
  TWILIO_PHONE_NUMBER: Joi.string()
    .optional(),

  // CORS
  CORS_ORIGIN: Joi.string()
    .default('http://localhost:3000'),
  
  // Optional: Email Service (if using)
  EMAIL_HOST: Joi.string()
    .optional(),
  
  EMAIL_PORT: Joi.number()
    .optional(),
  
  EMAIL_USER: Joi.string()
    .optional(),
  
  EMAIL_PASSWORD: Joi.string()
    .optional()
})
  .unknown(true); // Allow other environment variables

/**
 * Validate environment variables
 * @throws {Error} If validation fails
 */
const validateEnv = () => {
  const { error, value } = envSchema.validate(process.env, {
    abortEarly: false
  });

  if (error) {
    const errorMessages = error.details.map(detail => detail.message);
    logger.error('Environment variable validation failed:');
    errorMessages.forEach(msg => logger.error(`  - ${msg}`));
    throw new Error('Invalid environment configuration. Check the logs above.');
  }

  // Check for weak JWT secret in production
  if (value.NODE_ENV === 'production') {
    if (value.JWT_SECRET.length < 64) {
      logger.warn('JWT_SECRET is less than 64 characters. Consider using a stronger secret in production.');
    }
  }

  // Warn about missing optional but recommended services
  if (!value.RAZORPAY_KEY_ID || !value.RAZORPAY_KEY_SECRET) {
    logger.warn('Razorpay credentials not configured. Payment features will not work.');
  }

  if (!value.TWILIO_ACCOUNT_SID || !value.TWILIO_AUTH_TOKEN) {
    logger.warn('Twilio credentials not configured. SMS/OTP features will not work.');
  }

  logger.success('Environment variables validated successfully');
  
  return value;
};

module.exports = { validateEnv };
