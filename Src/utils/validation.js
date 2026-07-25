/**
 * Request Validation Middleware
 * Provides Joi schema validation for request data
 */
const Joi = require('joi');
const { AppError } = require('./errors');

/**
 * Validates request data against a Joi schema
 * @param {Object} schema - Joi schema object with optional body, params, query keys
 * @returns {Function} Express middleware function
 */
const validateRequest = (schema) => {
  return (req, res, next) => {
    const validationOptions = {
      abortEarly: false, // Return all errors, not just the first one
      allowUnknown: true, // Allow unknown keys that will be ignored
      stripUnknown: true // Remove unknown keys from validated data
    };

    const toValidate = {};
    if (schema.body) toValidate.body = req.body;
    if (schema.params) toValidate.params = req.params;
    if (schema.query) toValidate.query = req.query;

    const schemaToValidate = Joi.object(toValidate);
    const { error, value } = schemaToValidate.validate(toValidate, validationOptions);

    if (error) {
      const errorMessage = error.details
        .map(detail => detail.message)
        .join(', ');
      return next(new AppError(errorMessage, 400));
    }

    // Replace request data with validated data
    if (value.body) req.body = value.body;
    if (value.params) req.params = value.params;
    if (value.query) req.query = value.query;

    next();
  };
};

module.exports = { validateRequest };
