const express = require('express');
const router = express.Router();

const {
  uploadDesignImage,
  addCustomDesignToCart,
  getCustomDesignsInCart,
  removeCustomDesignFromCart,
  errorHandler
} = require('../controllers/customDesign.controller');

// Middleware to extract userId from header
const extractUserId = (req, res, next) => {
  const userId = req.header('User-Id');
  
  if (!userId) {
    return res.status(400).json({
      success: false,
      message: 'User ID is required in User-Id header'
    });
  }
  
  req.user = { _id: userId, id: userId };
  next();
};

/**
 * @route   POST /api/custom-design/upload
 * @desc    Upload custom design image to Cloudinary
 * @access  Public
 */
router.post('/upload', uploadDesignImage);

/**
 * @route   POST /api/custom-design/add-to-cart
 * @desc    Add custom design to cart
 * @access  Public
 * @headers User-Id: userId
 */
router.post('/add-to-cart', extractUserId, addCustomDesignToCart);

/**
 * @route   GET /api/custom-design/cart
 * @desc    Get all custom designs in cart
 * @access  Public
 * @headers User-Id: userId
 */
router.get('/cart', extractUserId, getCustomDesignsInCart);

/**
 * @route   DELETE /api/custom-design/cart/:productId
 * @desc    Remove custom design from cart
 * @access  Public
 * @headers User-Id: userId
 */
router.delete('/cart/:productId', extractUserId, removeCustomDesignFromCart);

// Error handling middleware
router.use(errorHandler);

module.exports = router;
