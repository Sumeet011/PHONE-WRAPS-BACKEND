/**
 * Validation Schemas
 * Centralized Joi schemas for request validation
 */
const Joi = require('joi');

// Common validation patterns
const mongoIdPattern = /^[0-9a-fA-F]{24}$/;
const phonePattern = /^\+?[1-9]\d{1,14}$/; // E.164 format

// Auth validation schemas
const authSchemas = {
  signup: {
    body: Joi.object({
      name: Joi.string().trim().min(2).max(100).required()
        .messages({
          'string.min': 'Name must be at least 2 characters long',
          'string.max': 'Name cannot exceed 100 characters'
        }),
      email: Joi.string().email().trim().lowercase(),
      phone: Joi.string().pattern(phonePattern),
      password: Joi.string().min(6).max(128).required()
        .messages({
          'string.min': 'Password must be at least 6 characters long'
        })
    }).or('email', 'phone') // At least one of email or phone is required
      .messages({
        'object.missing': 'Either email or phone number is required'
      })
  },

  login: {
    body: Joi.object({
      email: Joi.string().email().trim().lowercase().required(),
      password: Joi.string().required()
    })
  },

  sendOTP: {
    body: Joi.object({
      email: Joi.string().email().trim().lowercase(),
      phone: Joi.string().pattern(phonePattern)
    }).xor('email', 'phone') // Exactly one of email or phone
      .messages({
        'object.xor': 'Provide either email or phone number, not both'
      })
  },

  verifyOTP: {
    body: Joi.object({
      email: Joi.string().email().trim().lowercase(),
      phone: Joi.string().pattern(phonePattern),
      otp: Joi.string().length(6).pattern(/^[0-9]+$/).required()
        .messages({
          'string.length': 'OTP must be 6 digits',
          'string.pattern.base': 'OTP must contain only numbers'
        })
    }).xor('email', 'phone')
  }
};

// Product validation schemas
const productSchemas = {
  create: {
    body: Joi.object({
      name: Joi.string().trim().min(2).max(200).required(),
      description: Joi.string().trim().min(10).max(2000).required(),
      price: Joi.number().min(0).required(),
      type: Joi.string().valid('gaming', 'Standard').required(),
      level: Joi.string().max(2).required(),
      category: Joi.string().valid(
        'Phone Case', 'Phone Skin', 'Screen Protector',
        'Full Body Wrap', 'Camera Protector', 'Combo Pack'
      ).required(),
      material: Joi.string().valid(
        'TPU', 'Silicone', 'Polycarbonate', 'Leather', 'PU Leather',
        'Metal', 'Vinyl', 'Tempered Glass', 'Hybrid', 'Aramid Fiber'
      ).required(),
      finish: Joi.string().valid(
        'Matte', 'Glossy', 'Textured', 'Transparent', 'Metallic',
        'Carbon Fiber', 'Wood Grain'
      ),
      designType: Joi.string().valid(
        'Solid Color', 'Pattern', 'Custom Print', 'Transparent',
        'Gradient', 'Marble', 'Artistic', 'Brand Logo'
      ),
      primaryColor: Joi.string().required(),
      secondaryColor: Joi.string().allow(''),
      hexCode: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/),
      pattern: Joi.string().allow(''),
      customizable: Joi.boolean(),
      features: Joi.string().allow(''),
      collectionId: Joi.string().pattern(mongoIdPattern),
      groupId: Joi.string().pattern(mongoIdPattern)
    })
  },

  update: {
    params: Joi.object({
      id: Joi.string().pattern(mongoIdPattern).required()
    }),
    body: Joi.object({
      name: Joi.string().trim().min(2).max(200),
      description: Joi.string().trim().min(10).max(2000),
      price: Joi.number().min(0),
      // Add other updatable fields...
    }).min(1) // At least one field must be provided
  },

  getById: {
    params: Joi.object({
      id: Joi.string().pattern(mongoIdPattern).required()
        .messages({
          'string.pattern.base': 'Invalid product ID format'
        })
    })
  },

  list: {
    query: Joi.object({
      limit: Joi.number().integer().min(1).max(100).default(20),
      page: Joi.number().integer().min(1).default(1),
      sort: Joi.string().valid('createdAt', '-createdAt', 'price', '-price', 'name', '-name'),
      type: Joi.string().valid('gaming', 'Standard'),
      category: Joi.string(),
      minPrice: Joi.number().min(0),
      maxPrice: Joi.number().min(0)
    })
  }
};

// Order validation schemas
const orderSchemas = {
  create: {
    body: Joi.object({
      userId: Joi.string().pattern(mongoIdPattern).required(),
      items: Joi.array().items(
        Joi.object({
          productId: Joi.string(),
          name: Joi.string().required(),
          quantity: Joi.number().integer().min(1).required(),
          price: Joi.number().min(0).required()
        })
      ).min(1).required(),
      amount: Joi.number().min(0).required(),
      address: Joi.object({
        firstName: Joi.string().trim().required(),
        lastName: Joi.string().trim().required(),
        email: Joi.string().email().required(),
        street: Joi.string().trim().required(),
        city: Joi.string().trim().required(),
        state: Joi.string().trim(),
        country: Joi.string().trim().required(),
        zipcode: Joi.string().trim().required(),
        phone: Joi.string().pattern(phonePattern).required()
      }).required(),
      coupon: Joi.string().trim().uppercase()
    })
  }
};

// Cart validation schemas
const cartSchemas = {
  addItem: {
    body: Joi.object({
      userId: Joi.string().required(),
      type: Joi.string().valid('product', 'collection', 'custom-design').required(),
      productId: Joi.string().required(),
      quantity: Joi.number().integer().min(1).default(1),
      price: Joi.number().min(0).required(),
      selectedBrand: Joi.string().allow(''),
      selectedModel: Joi.string().allow(''),
      customDesign: Joi.object({
        designImageUrl: Joi.string().uri(),
        originalImageUrl: Joi.string().uri(),
        phoneModel: Joi.string(),
        transform: Joi.object({
          x: Joi.number().default(0),
          y: Joi.number().default(0),
          scale: Joi.number().min(0.1).max(5).default(1),
          rotation: Joi.number().min(0).max(360).default(0)
        })
      })
    })
  }
};

module.exports = {
  authSchemas,
  productSchemas,
  orderSchemas,
  cartSchemas
};
