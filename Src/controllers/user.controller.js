const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../../Models/User/User.model');
const { mergeCart } = require('../../Models/Cart/Cart.service');

/**
 * Async handler wrapper to catch errors
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Generate JWT Token
 */
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET || 'your-secret-key-change-this',
    { expiresIn: '30d' }
  );
};

/**
 * Generate 6-digit OTP
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Send OTP via Email (placeholder - integrate with email service)
 */
const sendEmailOTP = async (email, otp) => {
  // TODO: Integrate with email service (SendGrid, Nodemailer, etc.)
  console.log(`📧 Sending OTP to ${email}: ${otp}`);
  
  // For development, just log it
  // In production, use actual email service:
  /*
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({...});
  await transporter.sendMail({
    from: 'noreply@phonewraps.com',
    to: email,
    subject: 'Your OTP Code',
    text: `Your OTP is: ${otp}. Valid for 10 minutes.`
  });
  */
};

/**
 * Send OTP via SMS (placeholder - integrate with SMS service)
 */
const sendSMSOTP = async (phone, otp) => {
  // TODO: Integrate with SMS service (Twilio, AWS SNS, etc.)
  console.log(`📱 Sending OTP to ${phone}: ${otp}`);
  
  // For development, just log it
  // In production, use actual SMS service:
  /*
  const twilio = require('twilio');
  const client = twilio(accountSid, authToken);
  await client.messages.create({
    body: `Your Phone Wraps OTP is: ${otp}. Valid for 10 minutes.`,
    from: '+1234567890',
    to: phone
  });
  */
};

/**
 * @route   POST /api/users/send-otp
 * @desc    Send OTP to email or phone
 * @access  Public
 */
exports.sendOTP = asyncHandler(async (req, res) => {
  const { identifier, type } = req.body; // identifier = email or phone, type = 'email' or 'phone'

  if (!identifier || !type) {
    return res.status(400).json({
      success: false,
      message: 'Please provide identifier (email/phone) and type'
    });
  }

  // Validate type
  if (!['email', 'phone'].includes(type)) {
    return res.status(400).json({
      success: false,
      message: 'Type must be either "email" or "phone"'
    });
  }

  // Validate email format
  if (type === 'email') {
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(identifier)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }
  }

  // Validate phone format
  if (type === 'phone') {
    const phoneRegex = /^\+?[1-9]\d{9,14}$/;
    if (!phoneRegex.test(identifier.replace(/\s/g, ''))) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid phone number'
      });
    }
  }

  // Generate OTP
  const otp = generateOTP();
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Find or create temporary OTP record
  let user = await User.findOne(
    type === 'email' 
      ? { email: identifier.toLowerCase() } 
      : { phone: identifier }
  );

  if (!user) {
    // Create temporary user for OTP verification
    user = await User.create({
      [type]: type === 'email' ? identifier.toLowerCase() : identifier,
      name: '', // Will be updated after verification
      otp,
      otpExpiry,
      isVerified: false
    });
  } else {
    // Update existing user with new OTP
    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();
  }

  // Send OTP
  if (type === 'email') {
    await sendEmailOTP(identifier, otp);
  } else {
    await sendSMSOTP(identifier, otp);
  }

  res.status(200).json({
    success: true,
    message: `OTP sent successfully to your ${type}`,
    data: {
      identifier,
      type,
      expiresIn: '10 minutes',
      // For development only - remove in production
      devOTP: process.env.NODE_ENV === 'development' ? otp : undefined
    }
  });
});

/**
 * @route   POST /api/users/verify-otp
 * @desc    Verify OTP and login/register user
 * @access  Public
 */
exports.verifyOTP = asyncHandler(async (req, res) => {
  const { identifier, type, otp, name, guestUserId } = req.body;

  if (!identifier || !type || !otp) {
    return res.status(400).json({
      success: false,
      message: 'Please provide identifier, type, and OTP'
    });
  }

  // Find user
  const user = await User.findOne(
    type === 'email' 
      ? { email: identifier.toLowerCase() } 
      : { phone: identifier }
  ).select('+otp +otpExpiry');

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found. Please request OTP first.'
    });
  }

  // Check if OTP expired
  if (user.otpExpiry < new Date()) {
    return res.status(400).json({
      success: false,
      message: 'OTP has expired. Please request a new one.'
    });
  }

  // Verify OTP
  if (user.otp !== otp) {
    return res.status(400).json({
      success: false,
      message: 'Invalid OTP. Please try again.'
    });
  }

  // Update user details
  if (name && (!user.name || user.name === '')) {
    user.name = name;
  }
  user.isVerified = true;
  user.otp = undefined; // Clear OTP
  user.otpExpiry = undefined;
  await user.save();

  // Merge guest cart if provided
  if (guestUserId) {
    try {
      const Cart = require('../../Models/Cart/Cart.model');
      const guestCart = await Cart.findOne({ userId: guestUserId });
      
      if (guestCart && guestCart.items.length > 0) {
        await mergeCart(user._id, guestCart.items);
        // Delete guest cart
        await Cart.deleteOne({ userId: guestUserId });
      }
    } catch (error) {
      console.error('Error merging cart:', error);
    }
  }

  // Generate token
  const token = generateToken(user._id);

  res.status(200).json({
    success: true,
    message: 'OTP verified successfully',
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email || '',
        phone: user.phone || '',
        role: user.role,
        isVerified: user.isVerified
      },
      token
    }
  });
});

/**
 * @route   POST /api/users/resend-otp
 * @desc    Resend OTP
 * @access  Public
 */
exports.resendOTP = asyncHandler(async (req, res) => {
  const { identifier, type } = req.body;

  if (!identifier || !type) {
    return res.status(400).json({
      success: false,
      message: 'Please provide identifier and type'
    });
  }

  // Find user
  const user = await User.findOne(
    type === 'email' 
      ? { email: identifier.toLowerCase() } 
      : { phone: identifier }
  );

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found. Please request OTP first.'
    });
  }

  // Generate new OTP
  const otp = generateOTP();
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

  user.otp = otp;
  user.otpExpiry = otpExpiry;
  await user.save();

  // Send OTP
  if (type === 'email') {
    await sendEmailOTP(identifier, otp);
  } else {
    await sendSMSOTP(identifier, otp);
  }

  res.status(200).json({
    success: true,
    message: 'OTP resent successfully',
    data: {
      identifier,
      type,
      expiresIn: '10 minutes',
      // For development only
      devOTP: process.env.NODE_ENV === 'development' ? otp : undefined
    }
  });
});

/**
 * @route   GET /api/users/profile
 * @desc    Get user profile
 * @access  Private
 */
exports.getProfile = asyncHandler(async (req, res) => {
  const userId = req.params.userId || req.user?._id || req.user?.id;

  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  res.status(200).json({
    success: true,
    data: {
      id: user._id,
      username: user.username,
      name: user.username,
      email: user.email || '',
      phoneNumber: user.phoneNumber || '',
      phone: user.phoneNumber || '',
      role: user.role,
      isVerified: user.emailVerified,
      profilePicture: user.profilePicture || null,
      score: user.score || 0,
      rank: user.score || 0,
      addresses: user.addresses || [],
      createdAt: user.createdAt
    }
  });
});

/**
 * @route   PUT /api/users/profile
 * @desc    Update user profile
 * @access  Private
 */
exports.updateProfile = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;
  const { name, email, phone } = req.body;

  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Update fields
  if (name) user.name = name;
  
  // If updating email/phone, require OTP verification
  if (email && email !== user.email) {
    return res.status(400).json({
      success: false,
      message: 'To change email, please use send-otp endpoint for verification'
    });
  }

  if (phone && phone !== user.phone) {
    return res.status(400).json({
      success: false,
      message: 'To change phone, please use send-otp endpoint for verification'
    });
  }

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      id: user._id,
      name: user.name,
      email: user.email || '',
      phone: user.phone || '',
      role: user.role
    }
  });
});

/**
 * @route   POST /api/users/upload-profile-picture
 * @desc    Upload user profile picture
 * @access  Public (protected by userId)
 */
exports.uploadProfilePicture = asyncHandler(async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: 'User ID is required'
    });
  }

  if (!req.file || !req.file.path) {
    return res.status(400).json({
      success: false,
      message: 'No image file uploaded'
    });
  }

  try {
    // Find user
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update profile picture with Cloudinary URL
    user.profilePicture = req.file.path;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile picture uploaded successfully',
      data: {
        profilePicture: user.profilePicture
      }
    });
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload profile picture',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/users/addresses
 * @desc    Add new address
 * @access  Private
 */
exports.addAddress = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;
  const { label, street, city, state, zipCode, country, isDefault } = req.body;

  // Validation
  if (!street || !city || !state || !zipCode) {
    return res.status(400).json({
      success: false,
      message: 'Please provide complete address details'
    });
  }

  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Initialize addresses array if not exists
  if (!user.addresses) {
    user.addresses = [];
  }

  // If this is the first address or marked as default, set as default
  if (user.addresses.length === 0 || isDefault) {
    user.addresses.forEach(addr => addr.isDefault = false);
  }

  // Add new address
  user.addresses.push({
    label: label || 'Home',
    street,
    city,
    state,
    zipCode,
    country: country || 'India',
    isDefault: user.addresses.length === 0 || isDefault || false
  });

  await user.save();

  res.status(201).json({
    success: true,
    message: 'Address added successfully',
    data: user.addresses
  });
});

/**
 * @route   PUT /api/users/addresses/:addressId
 * @desc    Update address
 * @access  Private
 */
exports.updateAddress = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;
  const { addressId } = req.params;
  const { label, street, city, state, zipCode, country, isDefault } = req.body;

  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  const address = user.addresses.id(addressId);

  if (!address) {
    return res.status(404).json({
      success: false,
      message: 'Address not found'
    });
  }

  // Update fields
  if (label !== undefined) address.label = label;
  if (street !== undefined) address.street = street;
  if (city !== undefined) address.city = city;
  if (state !== undefined) address.state = state;
  if (zipCode !== undefined) address.zipCode = zipCode;
  if (country !== undefined) address.country = country;

  // Handle default address
  if (isDefault) {
    user.addresses.forEach(addr => addr.isDefault = false);
    address.isDefault = true;
  }

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Address updated successfully',
    data: user.addresses
  });
});

/**
 * @route   DELETE /api/users/addresses/:addressId
 * @desc    Delete address
 * @access  Private
 */
exports.deleteAddress = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;
  const { addressId } = req.params;

  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  const address = user.addresses.id(addressId);

  if (!address) {
    return res.status(404).json({
      success: false,
      message: 'Address not found'
    });
  }

  const wasDefault = address.isDefault;
  address.remove();

  // If deleted address was default, make first address default
  if (wasDefault && user.addresses.length > 0) {
    user.addresses[0].isDefault = true;
  }

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Address deleted successfully',
    data: user.addresses
  });
});

/**
 * @route   GET /api/users/addresses
 * @desc    Get all addresses
 * @access  Private
 */
exports.getAddresses = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;

  const user = await User.findById(userId).select('addresses');

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  res.status(200).json({
    success: true,
    data: user.addresses || []
  });
});

/**
 * @route   POST /api/users/logout
 * @desc    Logout user (client-side token removal)
 * @access  Private
 */
exports.logout = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Logged out successfully. Please remove token from client.'
  });
});

/**
 * Error handler middleware
 */
exports.errorHandler = (err, req, res, next) => {
  console.error('User Error:', err);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(400).json({
      success: false,
      message: `${field} already exists`
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired'
    });
  }

  // Default error
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
};

/**
 * @route   POST /api/users/register
 * @desc    Register/Create a new user (send OTP for verification)
 * @access  Public
 */
exports.register = asyncHandler(async (req, res) => {
  const { name, email, phone, type } = req.body;

  // Validation
  if (!name) {
    return res.status(400).json({
      success: false,
      message: 'Name is required'
    });
  }

  if (!type || !['email', 'phone'].includes(type)) {
    return res.status(400).json({
      success: false,
      message: 'Type must be either "email" or "phone"'
    });
  }

  // Validate based on type
  if (type === 'email') {
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required for email registration'
      });
    }
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }
  }

  if (type === 'phone') {
    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone is required for phone registration'
      });
    }
    const phoneRegex = /^\+?[1-9]\d{9,14}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid phone number'
      });
    }
  }

  // Check if user already exists
  const existingUser = await User.findOne(
    type === 'email' 
      ? { email: email?.toLowerCase() } 
      : { phone: phone }
  );

  if (existingUser && existingUser.isVerified) {
    return res.status(400).json({
      success: false,
      message: `User with this ${type} already exists. Please login instead.`
    });
  }

  // Generate OTP
  const otp = generateOTP();
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  let user;

  if (existingUser) {
    // Update existing unverified user
    user = existingUser;
    user.name = name;
    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();
  } else {
    // Create new user
    user = await User.create({
      name,
      email: type === 'email' ? email.toLowerCase() : undefined,
      phone: type === 'phone' ? phone : undefined,
      otp,
      otpExpiry,
      isVerified: false
    });
  }

  // Send OTP
  const identifier = type === 'email' ? email : phone;
  if (type === 'email') {
    await sendEmailOTP(identifier, otp);
  } else {
    await sendSMSOTP(identifier, otp);
  }

  res.status(201).json({
    success: true,
    message: `Registration initiated. OTP sent to your ${type}.`,
    data: {
      userId: user._id,
      name: user.name,
      identifier,
      type,
      expiresIn: '10 minutes',
      // For development only - remove in production
      devOTP: process.env.NODE_ENV === 'development' ? otp : undefined
    }
  });
});

/**
 * @route   POST /api/users/complete-registration
 * @desc    Complete registration by verifying OTP
 * @access  Public
 */
exports.completeRegistration = asyncHandler(async (req, res) => {
  const { userId, otp, guestUserId } = req.body;

  if (!userId || !otp) {
    return res.status(400).json({
      success: false,
      message: 'User ID and OTP are required'
    });
  }

  // Find user
  const user = await User.findById(userId).select('+otp +otpExpiry');

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Check if already verified
  if (user.isVerified) {
    return res.status(400).json({
      success: false,
      message: 'User already verified. Please login.'
    });
  }

  // Check if OTP expired
  if (user.otpExpiry < new Date()) {
    return res.status(400).json({
      success: false,
      message: 'OTP has expired. Please request a new one.'
    });
  }

  // Verify OTP
  if (user.otp !== otp) {
    return res.status(400).json({
      success: false,
      message: 'Invalid OTP. Please try again.'
    });
  }

  // Mark user as verified
  user.isVerified = true;
  user.otp = undefined;
  user.otpExpiry = undefined;
  await user.save();

  // Merge guest cart if provided
  if (guestUserId) {
    try {
      const Cart = require('../../Models/Cart/Cart.model');
      const guestCart = await Cart.findOne({ userId: guestUserId });
      
      if (guestCart && guestCart.items.length > 0) {
        await mergeCart(user._id, guestCart.items);
        await Cart.deleteOne({ userId: guestUserId });
      }
    } catch (error) {
      console.error('Error merging cart:', error);
    }
  }

  // Generate token
  const token = generateToken(user._id);

  res.status(200).json({
    success: true,
    message: 'Registration completed successfully',
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email || '',
        phone: user.phone || '',
        role: user.role,
        isVerified: user.isVerified
      },
      token
    }
  });
});

/**
 * @route   POST /api/users/login
 * @desc    Login existing user (send OTP)
 * @access  Public
 */
exports.login = asyncHandler(async (req, res) => {
  const { identifier, type } = req.body;

  if (!identifier || !type) {
    return res.status(400).json({
      success: false,
      message: 'Please provide identifier (email/phone) and type'
    });
  }

  // Validate type
  if (!['email', 'phone'].includes(type)) {
    return res.status(400).json({
      success: false,
      message: 'Type must be either "email" or "phone"'
    });
  }

  // Find user
  const user = await User.findOne(
    type === 'email' 
      ? { email: identifier.toLowerCase() } 
      : { phone: identifier }
  );

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found. Please register first.'
    });
  }

  if (!user.isVerified) {
    return res.status(400).json({
      success: false,
      message: 'User not verified. Please complete registration first.'
    });
  }

  // Generate OTP
  const otp = generateOTP();
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

  user.otp = otp;
  user.otpExpiry = otpExpiry;
  await user.save();

  // Send OTP
  if (type === 'email') {
    await sendEmailOTP(identifier, otp);
  } else {
    await sendSMSOTP(identifier, otp);
  }

  res.status(200).json({
    success: true,
    message: `OTP sent to your ${type}`,
    data: {
      userId: user._id,
      identifier,
      type,
      expiresIn: '10 minutes',
      // For development only
      devOTP: process.env.NODE_ENV === 'development' ? otp : undefined
    }
  });
});

/**
 * @route   POST /api/users/verify-login
 * @desc    Verify OTP and complete login
 * @access  Public
 */
exports.verifyLogin = asyncHandler(async (req, res) => {
  const { userId, otp, guestUserId } = req.body;

  if (!userId || !otp) {
    return res.status(400).json({
      success: false,
      message: 'User ID and OTP are required'
    });
  }

  // Find user
  const user = await User.findById(userId).select('+otp +otpExpiry');

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Check if OTP expired
  if (user.otpExpiry < new Date()) {
    return res.status(400).json({
      success: false,
      message: 'OTP has expired. Please request a new one.'
    });
  }

  // Verify OTP
  if (user.otp !== otp) {
    return res.status(400).json({
      success: false,
      message: 'Invalid OTP. Please try again.'
    });
  }

  // Clear OTP
  user.otp = undefined;
  user.otpExpiry = undefined;
  await user.save();

  // Merge guest cart if provided
  if (guestUserId) {
    try {
      const Cart = require('../../Models/Cart/Cart.model');
      const guestCart = await Cart.findOne({ userId: guestUserId });
      
      if (guestCart && guestCart.items.length > 0) {
        await mergeCart(user._id, guestCart.items);
        await Cart.deleteOne({ userId: guestUserId });
      }
    } catch (error) {
      console.error('Error merging cart:', error);
    }
  }

  // Generate token
  const token = generateToken(user._id);

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email || '',
        phone: user.phone || '',
        role: user.role,
        isVerified: user.isVerified
      },
      token
    }
  });
});

/**
 * @route   GET /api/users/check/:userId
 * @desc    Check if user exists by userId
 * @access  Public
 */
exports.checkUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  // Check if it's a guest user
  if (userId.startsWith('guest_')) {
    return res.status(200).json({
      success: true,
      exists: false,
      isVerified: false,
      isGuest: true
    });
  }

  // Try to find user by MongoDB ID
  const user = await User.findById(userId);

  if (!user) {
    return res.status(200).json({
      success: true,
      exists: false,
      isVerified: false,
      isGuest: false
    });
  }

  res.status(200).json({
    success: true,
    exists: true,
    isVerified: user.isVerified,
    isGuest: false,
    user: {
      id: user._id,
      name: user.name,
      email: user.email || '',
      phone: user.phone || ''
    }
  });
});

/**
 * @route   PUT /api/users/profile/:userId
 * @desc    Update user profile by userId (no token required)
 * @access  Public
 */
exports.updateProfileByUserId = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { name, phone } = req.body;

  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  if (name) user.name = name;
  if (phone) user.phone = phone;

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      id: user._id,
      name: user.name,
      email: user.email || '',
      phone: user.phone || ''
    }
  });
});

/**
 * @route   GET /api/users/addresses/:userId
 * @desc    Get addresses by userId (no token required)
 * @access  Public
 */
exports.getAddressesByUserId = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId).select('addresses');

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  res.status(200).json({
    success: true,
    data: user.addresses || []
  });
});

/**
 * @route   POST /api/users/addresses/:userId
 * @desc    Add address by userId (no token required)
 * @access  Public
 */
exports.addAddressByUserId = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { label, street, city, state, zipCode, country, isDefault } = req.body;

  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  if (!user.addresses) {
    user.addresses = [];
  }

  if (user.addresses.length === 0 || isDefault) {
    user.addresses.forEach(addr => addr.isDefault = false);
  }

  user.addresses.push({
    label: label || 'Home',
    street,
    city,
    state,
    zipCode,
    country: country || 'India',
    isDefault: user.addresses.length === 0 || isDefault || false
  });

  await user.save();

  res.status(201).json({
    success: true,
    message: 'Address added successfully',
    data: user.addresses
  });
});

/**
 * @route   PUT /api/users/addresses/:userId/:addressId
 * @desc    Update address by userId (no token required)
 * @access  Public
 */
exports.updateAddressByUserId = asyncHandler(async (req, res) => {
  const { userId, addressId } = req.params;
  const { label, street, city, state, zipCode, country, isDefault } = req.body;

  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  const address = user.addresses.id(addressId);

  if (!address) {
    return res.status(404).json({
      success: false,
      message: 'Address not found'
    });
  }

  if (label !== undefined) address.label = label;
  if (street !== undefined) address.street = street;
  if (city !== undefined) address.city = city;
  if (state !== undefined) address.state = state;
  if (zipCode !== undefined) address.zipCode = zipCode;
  if (country !== undefined) address.country = country;

  if (isDefault) {
    user.addresses.forEach(addr => addr.isDefault = false);
    address.isDefault = true;
  }

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Address updated successfully',
    data: user.addresses
  });
});