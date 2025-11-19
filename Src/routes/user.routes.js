const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { upload } = require('../config/cloudinary');

// Import all controllers
const {
  register,
  completeRegistration,
  login,
  verifyLogin,
  sendOTP,
  verifyOTP,
  resendOTP,
  getProfile,
  updateProfile,
  uploadProfilePicture,
  addAddress,
  updateAddress,
  deleteAddress,
  getAddresses,
  logout,
  errorHandler
} = require('../controllers/user.controller');

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user to request
 */
const protect = (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Please login.'
      });
    }

    // Extract token
    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = jwt.verify(
      token, 
      process.env.JWT_SECRET || 'your-secret-key-change-this'
    );

    // Attach user ID to request
    req.user = { _id: decoded.id, id: decoded.id };
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired. Please login again.'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please login again.'
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

/**
 * Admin Middleware
 * Checks if user has admin role
 */
const adminOnly = async (req, res, next) => {
  try {
    const User = require('../../Models/User/User.model');
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Authorization check failed'
    });
  }
};

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================

/**
 * @route   POST /api/users/register
 * @desc    Register new user (sends OTP)
 * @access  Public
 * @body    { name, email?, phone?, type: "email" | "phone" }
 */
router.post('/register', register);

/**
 * @route   POST /api/users/complete-registration
 * @desc    Complete registration by verifying OTP
 * @access  Public
 * @body    { userId, otp, guestUserId? }
 */
router.post('/complete-registration', completeRegistration);

/**
 * @route   POST /api/users/login
 * @desc    Login existing user (sends OTP)
 * @access  Public
 * @body    { identifier: "email or phone", type: "email" | "phone" }
 */
router.post('/login', login);

/**
 * @route   POST /api/users/verify-login
 * @desc    Verify OTP and complete login
 * @access  Public
 * @body    { userId, otp, guestUserId? }
 */
router.post('/verify-login', verifyLogin);

/**
 * @route   POST /api/users/send-otp
 * @desc    Send OTP (unified - works for both new and existing users)
 * @access  Public
 * @body    { identifier: "email or phone", type: "email" | "phone" }
 */
router.post('/send-otp', sendOTP);

/**
 * @route   POST /api/users/verify-otp
 * @desc    Verify OTP (auto-detects registration or login)
 * @access  Public
 * @body    { identifier, type, otp, name?, guestUserId? }
 */
router.post('/verify-otp', verifyOTP);

/**
 * @route   POST /api/users/resend-otp
 * @desc    Resend OTP
 * @access  Public
 * @body    { identifier, type }
 */
router.post('/resend-otp', resendOTP);

// ============================================
// PROTECTED ROUTES (Authentication required)
// ============================================

/**
 * @route   GET /api/users/profile
 * @desc    Get current user profile
 * @access  Private
 * @headers Authorization: Bearer <token>
 */
router.get('/profile', protect, getProfile);

/**
 * @route   GET /api/users/profile/:userId
 * @desc    Get user profile by ID
 * @access  Public
 */
router.get('/profile/:userId', getProfile);

/**
 * @route   PUT /api/users/profile
 * @desc    Update user profile
 * @access  Private
 * @body    { name?, email?, phone? }
 * @headers Authorization: Bearer <token>
 */
router.put('/profile', protect, updateProfile);

/**
 * @route   POST /api/users/upload-profile-picture
 * @desc    Upload user profile picture
 * @access  Private
 * @body    FormData with profileImage file and userId
 * @headers Authorization: Bearer <token>
 */
router.post('/upload-profile-picture', upload.single('profileImage'), uploadProfilePicture);

/**
 * @route   POST /api/users/logout
 * @desc    Logout user (client should remove token)
 * @access  Private
 * @headers Authorization: Bearer <token>
 */
router.post('/logout', protect, logout);

// ============================================
// ADDRESS ROUTES (Authentication required)
// ============================================

/**
 * @route   GET /api/users/addresses
 * @desc    Get all user addresses
 * @access  Private
 * @headers Authorization: Bearer <token>
 */
router.get('/addresses', protect, getAddresses);

/**
 * @route   POST /api/users/addresses
 * @desc    Add new address
 * @access  Private
 * @body    { label?, street, city, state, zipCode, country?, isDefault? }
 * @headers Authorization: Bearer <token>
 */
router.post('/addresses', protect, addAddress);

/**
 * @route   PUT /api/users/addresses/:addressId
 * @desc    Update specific address
 * @access  Private
 * @params  addressId - MongoDB ObjectId of address
 * @body    { label?, street?, city?, state?, zipCode?, country?, isDefault? }
 * @headers Authorization: Bearer <token>
 */
router.put('/addresses/:addressId', protect, updateAddress);

/**
 * @route   DELETE /api/users/addresses/:addressId
 * @desc    Delete specific address
 * @access  Private
 * @params  addressId - MongoDB ObjectId of address
 * @headers Authorization: Bearer <token>
 */
router.delete('/addresses/:addressId', protect, deleteAddress);

// ============================================
// ADMIN ROUTES (Admin access only)
// ============================================

/**
 * @route   GET /api/users
 * @desc    Get all users (Admin only)
 * @access  Private/Admin
 * @headers Authorization: Bearer <token>
 */
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const User = require('../../Models/User/User.model');
    const users = await User.find().select('-otp -otpExpiry');
    
    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users'
    });
  }
});

/**
 * @route   GET /api/users/:userId
 * @desc    Get specific user by ID (Admin only)
 * @access  Private/Admin
 * @params  userId - MongoDB ObjectId of user
 * @headers Authorization: Bearer <token>
 */
router.get('/:userId', protect, adminOnly, async (req, res) => {
  try {
    const User = require('../../Models/User/User.model');
    const user = await User.findById(req.params.userId).select('-otp -otpExpiry');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user'
    });
  }
});

/**
 * @route   PUT /api/users/:userId/role
 * @desc    Update user role (Admin only)
 * @access  Private/Admin
 * @params  userId - MongoDB ObjectId of user
 * @body    { role: "customer" | "admin" }
 * @headers Authorization: Bearer <token>
 */
router.put('/:userId/role', protect, adminOnly, async (req, res) => {
  try {
    const User = require('../../Models/User/User.model');
    const { role } = req.body;

    if (!['customer', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be "customer" or "admin"'
      });
    }

    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.role = role;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'User role updated successfully',
      data: {
        id: user._id,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update user role'
    });
  }
});

/**
 * @route   DELETE /api/users/:userId
 * @desc    Delete user (Admin only)
 * @access  Private/Admin
 * @params  userId - MongoDB ObjectId of user
 * @headers Authorization: Bearer <token>
 */
router.delete('/:userId', protect, adminOnly, async (req, res) => {
  try {
    const User = require('../../Models/User/User.model');
    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Don't allow deleting yourself
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }

    await user.deleteOne();

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete user'
    });
  }
});

// ============================================
// ERROR HANDLER
// ============================================
router.use(errorHandler);

// ============================================
// EXPORT
// ============================================
module.exports = router;