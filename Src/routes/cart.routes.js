const express = require('express');
const router = express.Router();

const {
  getCart,
  addItem,
  updateItem,
  removeItem,
  clearCart,
  getItemCount,
  addToGuestCart,
  applyCoupon,
  removeCoupon,
  getAppliedCoupons,
  errorHandler
} = require('../controllers/cart.controller');

// Middleware to extract userId from header (for routes that don't use auth)
const extractUserId = (req, res, next) => {
  const userId = req.header('User-Id');
  
  if (!userId) {
    return res.status(400).json({
      success: false,
      message: 'User ID is required in User-Id header'
    });
  }
  
  // Attach to req.user for compatibility with existing controller
  req.user = { _id: userId, id: userId };
  next();
};

/**
 * @route   GET /api/cart
 * @desc    Get user's cart
 * @access  Public
 * @headers X-User-Id: userId
 */
router.get('/', extractUserId, getCart);

/**
 * @route   GET /api/cart/count
 * @desc    Get cart item count
 * @access  Public
 * @headers X-User-Id: userId
 */
router.get('/count', extractUserId, getItemCount);

/**
 * @route   POST /api/cart/add
 * @desc    Add item to cart
 * @access  Public
 * @headers X-User-Id: userId
 * @body    { type, productId, price, quantity?, selectedBrand?, selectedModel? }
 */
router.post('/add', extractUserId, addItem);

/**
 * @route   POST /api/cart/guest/add
 * @desc    Get guest cart item structure
 * @access  Public
 */
router.post('/guest/add', addToGuestCart);

/**
 * @route   PUT /api/cart/update/:productId
 * @desc    Update cart item quantity
 * @access  Public
 * @headers X-User-Id: userId
 * @params  productId - Product ID
 * @body    { quantity }
 */
router.put('/update/:productId', extractUserId, updateItem);

/**
 * @route   DELETE /api/cart/remove/:productId
 * @desc    Remove item from cart
 * @access  Public
 * @headers X-User-Id: userId
 * @params  productId - Product ID
 */
router.delete('/remove/:productId', extractUserId, removeItem);

/**
 * @route   DELETE /api/cart/clear
 * @desc    Clear entire cart
 * @access  Public
 * @headers X-User-Id: userId
 */
router.delete('/clear', extractUserId, clearCart);

/**
 * @route   POST /api/cart/coupon/apply
 * @desc    Apply coupon to cart
 * @access  Public
 * @headers X-User-Id: userId
 * @body    { code, discountPercentage, discountAmount }
 */
router.post('/coupon/apply', extractUserId, applyCoupon);

/**
 * @route   DELETE /api/cart/coupon/remove/:code
 * @desc    Remove coupon from cart
 * @access  Public
 * @headers X-User-Id: userId
 * @params  code - Coupon code
 */
router.delete('/coupon/remove/:code', extractUserId, removeCoupon);

/**
 * @route   GET /api/cart/coupons
 * @desc    Get all applied coupons
 * @access  Public
 * @headers X-User-Id: userId
 */
router.get('/coupons', extractUserId, getAppliedCoupons);

// Error handler
router.use(errorHandler);

module.exports = router;