const User = require('../../Models/User/User.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const twilio = require('twilio');
const { sendOTPEmail, sendPasswordEmail, sendPasswordResetConfirmation } = require('../services/email.service');
const { generateOTP, generateRandomPassword, isValidEmail, isStrongPassword, isOTPExpired } = require('../utils/authHelpers');

// Secret key for JWT - in production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Twilio Configuration
const TWILIO_VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID;
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

const PHONE_OTP_TTL_MS = 5 * 60 * 1000;
const PHONE_OTP_SEND_WINDOW_MS = 15 * 60 * 1000;
const PHONE_OTP_VERIFY_WINDOW_MS = 15 * 60 * 1000;
const PHONE_OTP_MAX_SEND_ATTEMPTS = 5;
const PHONE_OTP_MAX_VERIFY_ATTEMPTS = 8;
const PHONE_OTP_RESEND_COOLDOWN_MS = 30 * 1000;

const getPhoneFromBody = (body = {}) => body.phone || body.phoneNumber || '';

const normalizePhoneNumber = (phone) => {
  const rawPhone = String(phone || '').trim();
  if (!rawPhone) return '';

  let cleanedPhone = rawPhone.replace(/[\s()-]/g, '');
  if (cleanedPhone.startsWith('00')) {
    cleanedPhone = `+${cleanedPhone.slice(2)}`;
  }

  if (cleanedPhone.startsWith('+')) {
    return `+${cleanedPhone.slice(1).replace(/\D/g, '')}`;
  }

  return cleanedPhone.replace(/\D/g, '');
};

const isValidE164Phone = (phone) => /^\+[1-9]\d{7,14}$/.test(phone);

const getPhoneCandidates = (phone) => {
  const rawPhone = String(phone || '').trim();
  const normalizedPhone = normalizePhoneNumber(rawPhone);
  const withoutPlus = normalizedPhone.startsWith('+') ? normalizedPhone.slice(1) : normalizedPhone;

  return [...new Set([rawPhone, normalizedPhone, withoutPlus].filter(Boolean))];
};

const isTwilioVerifyConfigured = () => Boolean(twilioClient && TWILIO_VERIFY_SERVICE_SID);

const findUserByPhone = async (phone, selectFields = '') => {
  const candidates = getPhoneCandidates(phone);
  if (!candidates.length) {
    return null;
  }

  let query = User.findOne({
    $or: [
      { phoneNumber: { $in: candidates } },
      { phone: { $in: candidates } }
    ]
  });

  if (selectFields) {
    query = query.select(selectFields);
  }

  return query;
};

const syncUserPhoneNumber = async (user, normalizedPhone) => {
  if (!normalizedPhone || user.phoneNumber === normalizedPhone) {
    return;
  }

  const conflictingUser = await User.findOne({
    _id: { $ne: user._id },
    phoneNumber: normalizedPhone
  }).select('_id');

  if (!conflictingUser) {
    user.phoneNumber = normalizedPhone;
  }
};

// Sign Up With Email & Password
exports.signupemailpass = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const phone = getPhoneFromBody(req.body);

    // Validation
    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }

    if (!email && !phone) {
      return res.status(400).json({ message: 'Either email or phone number is required' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    // Build dynamic OR conditions
    const orConditions = [];

if (email) {
  orConditions.push({ email });
}

if (phone) {
  orConditions.push({ phoneNumber: { $in: getPhoneCandidates(phone) } });
}

const existingUser = await User.findOne(
  orConditions.length > 0 ? { $or: orConditions } : {}
);


    if (existingUser) {
      return res.status(409).json({ message: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = new User({
      username: name,
      email: email || '',
      phoneNumber: normalizePhoneNumber(phone) || phone || '',
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await newUser.save();

    // Generate JWT token (no expiration)
    const token = jwt.sign(
      { userId: newUser._id, email: newUser.email },
      JWT_SECRET
    );

    res.status(201).json({
      message: 'User created successfully',
      userId: newUser._id,
      token,
      user: {
        id: newUser._id,
        name: newUser.username,
        email: newUser.email,
        phone: newUser.phoneNumber
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Server error during sign up', error: error.message });
  }
};

// Login with Email & Password
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find user and explicitly include password field (since it has select: false)
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check if password field exists
    if (!user.password) {
      return res.status(401).json({ message: 'Please use OTP login or reset your password' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Generate JWT token (no expiration)
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET
    );

    res.status(200).json({
      message: 'Login successful',
      userId: user._id,
      token,
      user: {
        id: user._id,
        name: user.username,
        email: user.email,
        phone: user.phoneNumber
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login', error: error.message });
  }
};

// Send Email OTP using Nodemailer
exports.loginemailotp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // Check if user exists
    const user = await User.findOne({ email }).select('+otp +otpExpiry');
    if (!user) {
      return res.status(404).json({ message: 'User not found with this email' });
    }

    // Generate OTP and set expiry (10 minutes)
    const otp = generateOTP();
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    // Send OTP via Nodemailer
    await sendOTPEmail(email, otp, 'login');
    
    res.status(200).json({
      message: 'OTP sent successfully to your email',
      expiresIn: '10 minutes'
    });
  } catch (error) {
    console.error('Send email OTP error:', error);
    res.status(500).json({ message: 'Server error sending OTP', error: error.message });
  }
};

// Send Phone OTP using Twilio Verify
exports.loginphoneotp = async (req, res) => {
  try {
    const phone = getPhoneFromBody(req.body);

    if (!phone) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    if (!isTwilioVerifyConfigured()) {
      return res.status(500).json({
        message: 'Twilio Verify service is not configured on server'
      });
    }

    const normalizedPhone = normalizePhoneNumber(phone);
    if (!isValidE164Phone(normalizedPhone)) {
      return res.status(400).json({
        message: 'Phone number must be in E.164 format (for example: +919876543210)'
      });
    }

    // Check if user exists
    const user = await findUserByPhone(
      phone,
      '+phoneOTPRequestedAt +phoneOTPWindowStart +phoneOTPRequestCount'
    );
    if (!user) {
      return res.status(404).json({ message: 'User not found with this phone number' });
    }

    await syncUserPhoneNumber(user, normalizedPhone);

    const now = Date.now();
    if (!user.phoneOTPWindowStart || now - user.phoneOTPWindowStart.getTime() > PHONE_OTP_SEND_WINDOW_MS) {
      user.phoneOTPWindowStart = new Date(now);
      user.phoneOTPRequestCount = 0;
    }

    if ((user.phoneOTPRequestCount || 0) >= PHONE_OTP_MAX_SEND_ATTEMPTS) {
      return res.status(429).json({
        message: 'Too many OTP requests for this phone number. Please try again later.'
      });
    }

    if (user.phoneOTPRequestedAt && now - user.phoneOTPRequestedAt.getTime() < PHONE_OTP_RESEND_COOLDOWN_MS) {
      return res.status(429).json({
        message: 'Please wait a few seconds before requesting another OTP.'
      });
    }

    // Send OTP through Twilio Verify service
    await twilioClient.verify.v2.services(TWILIO_VERIFY_SERVICE_SID).verifications.create({
      to: normalizedPhone,
      channel: 'sms'
    });

    user.phoneOTPRequestedAt = new Date(now);
    user.phoneOTPRequestCount = (user.phoneOTPRequestCount || 0) + 1;
    await user.save();
    
    res.status(200).json({
      message: 'OTP sent successfully to your phone',
      expiresIn: '5 minutes'
    });
  } catch (error) {
    console.error('Send phone OTP error:', error);
    const isRateLimitError = error.status === 429 || error.code === 20429;
    res.status(isRateLimitError ? 429 : 500).json({
      message: isRateLimitError
        ? 'Too many OTP requests. Please try again later.'
        : 'Server error sending OTP',
      error: error.message
    });
  }
};

// Verify Email OTP
exports.verifyEmailOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    // Find user with OTP fields
    const user = await User.findOne({ email }).select('+otp +otpExpiry');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if OTP exists
    if (!user.otp || !user.otpExpiry) {
      return res.status(401).json({ message: 'OTP not found. Please request a new one.' });
    }

    // Check if OTP is expired
    if (isOTPExpired(user.otpExpiry)) {
      user.otp = undefined;
      user.otpExpiry = undefined;
      await user.save();
      return res.status(401).json({ message: 'OTP has expired. Please request a new one.' });
    }

    // Verify OTP
    if (user.otp !== otp) {
      return res.status(401).json({ message: 'Invalid OTP' });
    }

    // Clear OTP and mark email as verified
    user.otp = undefined;
    user.otpExpiry = undefined;
    user.emailVerified = true;
    await user.save();

    // Generate JWT token (no expiration)
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET
    );

    res.status(200).json({
      message: 'Login successful',
      userId: user._id,
      token,
      user: {
        id: user._id,
        name: user.username,
        email: user.email,
        phone: user.phoneNumber
      }
    });
  } catch (error) {
    console.error('Verify email OTP error:', error);
    res.status(500).json({ message: 'Server error verifying OTP', error: error.message });
  }
};

// Verify Phone OTP
exports.verifyPhoneOTP = async (req, res) => {
  try {
    const phone = getPhoneFromBody(req.body);
    const otp = String(req.body.otp || '').trim();

    if (!phone || !otp) {
      return res.status(400).json({ message: 'Phone number and OTP are required' });
    }

    if (!isTwilioVerifyConfigured()) {
      return res.status(500).json({
        message: 'Twilio Verify service is not configured on server'
      });
    }

    const normalizedPhone = normalizePhoneNumber(phone);
    if (!isValidE164Phone(normalizedPhone)) {
      return res.status(400).json({
        message: 'Phone number must be in E.164 format (for example: +919876543210)'
      });
    }

    if (!/^\d{4,10}$/.test(otp)) {
      return res.status(400).json({ message: 'OTP must be numeric' });
    }

    // Find user
    const user = await findUserByPhone(
      phone,
      '+phoneOTPRequestedAt +phoneOTPWindowStart +phoneOTPRequestCount +phoneOTPVerifyWindowStart +phoneOTPVerifyAttempts'
    );
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await syncUserPhoneNumber(user, normalizedPhone);

    const now = Date.now();

    // Check if OTP request exists
    if (!user.phoneOTPRequestedAt) {
      return res.status(401).json({ message: 'OTP not found. Please request a new one.' });
    }

    // Check if OTP is expired
    if (now - user.phoneOTPRequestedAt.getTime() > PHONE_OTP_TTL_MS) {
      user.phoneOTPRequestedAt = undefined;
      user.phoneOTPVerifyWindowStart = undefined;
      user.phoneOTPVerifyAttempts = 0;
      await user.save();
      return res.status(401).json({ message: 'OTP has expired. Please request a new one.' });
    }

    if (
      !user.phoneOTPVerifyWindowStart ||
      now - user.phoneOTPVerifyWindowStart.getTime() > PHONE_OTP_VERIFY_WINDOW_MS
    ) {
      user.phoneOTPVerifyWindowStart = new Date(now);
      user.phoneOTPVerifyAttempts = 0;
    }

    if ((user.phoneOTPVerifyAttempts || 0) >= PHONE_OTP_MAX_VERIFY_ATTEMPTS) {
      return res.status(429).json({
        message: 'Too many OTP verification attempts. Please request a new OTP.'
      });
    }

    const verificationCheck = await twilioClient.verify.v2
      .services(TWILIO_VERIFY_SERVICE_SID)
      .verificationChecks.create({
        to: normalizedPhone,
        code: otp
      });

    if (verificationCheck.status !== 'approved') {
      user.phoneOTPVerifyAttempts = (user.phoneOTPVerifyAttempts || 0) + 1;
      const isExpired = verificationCheck.status === 'expired' || verificationCheck.status === 'canceled';
      if (isExpired) {
        user.phoneOTPRequestedAt = undefined;
      }
      await user.save();

      return res.status(401).json({
        message: isExpired
          ? 'OTP has expired. Please request a new one.'
          : 'Invalid OTP'
      });
    }

    // Clear OTP metadata after successful verification
    user.phoneOTPRequestedAt = undefined;
    user.phoneOTPWindowStart = undefined;
    user.phoneOTPRequestCount = 0;
    user.phoneOTPVerifyWindowStart = undefined;
    user.phoneOTPVerifyAttempts = 0;
    user.isVerified = true;
    await user.save();

    // Generate JWT token (no expiration)
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET
    );

    res.status(200).json({
      message: 'Login successful',
      userId: user._id,
      token,
      user: {
        id: user._id,
        name: user.username,
        email: user.email,
        phone: user.phoneNumber
      }
    });
  } catch (error) {
    console.error('Verify phone OTP error:', error);
    const isRateLimitError = error.status === 429 || error.code === 20429;
    res.status(isRateLimitError ? 429 : 500).json({
      message: isRateLimitError
        ? 'Too many verification attempts. Please try again later.'
        : 'Server error verifying OTP',
      error: error.message
    });
  }
};

// Login with Email & Password (alias for compatibility)
exports.loginemailpass = exports.login;

exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body; 
    if (email === 'PHONEWRAPS@phonwrap.com' && password === 'PHONWRAPSADMIN123') {
      const token = jwt.sign(
        { userId: 'admin-id', email: email, role: 'admin' },
        JWT_SECRET
      );
      return res.status(200).json({
        success: true,
        message: 'Admin login successful',
        token
      });
    } else {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials'
      });
    }
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ success: false, message: 'Server error during admin login', error: error.message });
  }
};

// Sign Up With Phone OTP
exports.signupphoneotp = async (req, res) => {
  try {
    const { name } = req.body;
    const phone = getPhoneFromBody(req.body);

    // Validation
    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }

    if (!phone) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    if (!isTwilioVerifyConfigured()) {
      return res.status(500).json({
        message: 'Twilio Verify service is not configured on server'
      });
    }

    const normalizedPhone = normalizePhoneNumber(phone);
    if (!isValidE164Phone(normalizedPhone)) {
      return res.status(400).json({
        message: 'Phone number must be in E.164 format (for example: +919876543210)'
      });
    }

    // Check if user exists
    const existingUser = await findUserByPhone(phone);
    if (existingUser) {
      return res.status(409).json({ message: 'User already exists with this phone number' });
    }

    // Create user without password
    const newUser = new User({
      username: name,
      phoneNumber: normalizedPhone,
      email: '',
      password: await bcrypt.hash(Math.random().toString(36), 10), // Random password
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await newUser.save();

    try {
      await twilioClient.verify.v2.services(TWILIO_VERIFY_SERVICE_SID).verifications.create({
        to: normalizedPhone,
        channel: 'sms'
      });

      const now = new Date();
      newUser.phoneOTPRequestedAt = now;
      newUser.phoneOTPWindowStart = now;
      newUser.phoneOTPRequestCount = 1;
      await newUser.save();
    } catch (verificationError) {
      // Roll back user creation if OTP delivery fails.
      await User.deleteOne({ _id: newUser._id });
      throw verificationError;
    }

    res.status(201).json({
      message: 'User created successfully. OTP sent to your phone.',
      userId: newUser._id,
      expiresIn: '5 minutes'
    });
  } catch (error) {
    console.error('Signup phone OTP error:', error);
    const isRateLimitError = error.status === 429 || error.code === 20429;
    res.status(isRateLimitError ? 429 : 500).json({
      message: isRateLimitError ? 'Too many OTP requests. Please try again later.' : 'Server error during sign up',
      error: error.message
    });
  }
};

// Middleware to verify JWT token
exports.verifyToken = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// ========== NEW METHODS: Email-based signup and password reset ==========

// Sign up with email and send random password
exports.signupWithEmail = async (req, res) => {
  try {
    const { name, email } = req.body;

    // Validation
    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'User already exists with this email' });
    }

    // Generate random password
    const randomPassword = generateRandomPassword();
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    // Create user
    const newUser = new User({
      username: name,
      name: name,
      email: email,
      password: hashedPassword,
      emailVerified: false
    });

    await newUser.save();

    try {
      // Send password via email. If delivery fails, remove the user so signup stays consistent.
      await sendPasswordEmail(email, randomPassword, name);
    } catch (mailError) {
      await User.deleteOne({ _id: newUser._id });
      throw mailError;
    }

    res.status(201).json({
      message: 'Account created successfully! Your password has been sent to your email.',
      userId: newUser._id,
      email: newUser.email
    });
  } catch (error) {
    console.error('Signup with email error:', error);
    const isEmailConfigError = error.message && error.message.includes('Email service is not configured');
    res.status(500).json({
      message: isEmailConfigError
        ? 'Email service is not configured on server. Please set EMAIL_USER and EMAIL_APP_PASSWORD.'
        : 'Server error during sign up',
      error: error.message
    });
  }
};

// Request password reset - Send OTP to email
exports.requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // Find user
    const user = await User.findOne({ email }).select('+otp +otpExpiry');
    if (!user) {
      // Don't reveal if user exists or not for security
      return res.status(200).json({ 
        message: 'If an account exists with this email, a password reset OTP has been sent.' 
      });
    }

    // Generate OTP and set expiry (10 minutes)
    const otp = generateOTP();
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    // Send OTP via email
    await sendOTPEmail(email, otp, 'password-reset');

    res.status(200).json({
      message: 'Password reset OTP sent to your email',
      expiresIn: '10 minutes'
    });
  } catch (error) {
    console.error('Request password reset error:', error);
    res.status(500).json({ message: 'Server error sending password reset OTP', error: error.message });
  }
};

// Verify OTP and reset password
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    // Validation
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'Email, OTP, and new password are required' });
    }

    const passwordCheck = isStrongPassword(newPassword);
    if (!passwordCheck.valid) {
      return res.status(400).json({ message: passwordCheck.message });
    }

    // Find user with OTP fields
    const user = await User.findOne({ email }).select('+otp +otpExpiry +password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if OTP exists
    if (!user.otp || !user.otpExpiry) {
      return res.status(401).json({ message: 'OTP not found. Please request a new one.' });
    }

    // Check if OTP is expired
    if (isOTPExpired(user.otpExpiry)) {
      user.otp = undefined;
      user.otpExpiry = undefined;
      await user.save();
      return res.status(401).json({ message: 'OTP has expired. Please request a new one.' });
    }

    // Verify OTP
    if (user.otp !== otp) {
      return res.status(401).json({ message: 'Invalid OTP' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear OTP
    user.password = hashedPassword;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    // Send confirmation email
    await sendPasswordResetConfirmation(email, user.username || user.name);

    res.status(200).json({
      message: 'Password reset successfully. You can now login with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error resetting password', error: error.message });
  }
};

// Change password (for logged-in users) - Requires OTP verification
exports.changePassword = async (req, res) => {
  try {
    const { email, otp, currentPassword, newPassword } = req.body;

    // Validation
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // User can either provide currentPassword OR otp
    if (!currentPassword && !otp) {
      return res.status(400).json({ 
        message: 'Either current password or OTP is required' 
      });
    }

    if (!newPassword) {
      return res.status(400).json({ message: 'New password is required' });
    }

    const passwordCheck = isStrongPassword(newPassword);
    if (!passwordCheck.valid) {
      return res.status(400).json({ message: passwordCheck.message });
    }

    // Find user
    const user = await User.findOne({ email }).select('+password +otp +otpExpiry');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // If OTP is provided, verify it
    if (otp) {
      if (!user.otp || !user.otpExpiry) {
        return res.status(401).json({ message: 'OTP not found. Please request a new one.' });
      }

      if (isOTPExpired(user.otpExpiry)) {
        user.otp = undefined;
        user.otpExpiry = undefined;
        await user.save();
        return res.status(401).json({ message: 'OTP has expired. Please request a new one.' });
      }

      if (user.otp !== otp) {
        return res.status(401).json({ message: 'Invalid OTP' });
      }
    }
    // If current password is provided, verify it
    else if (currentPassword) {
      if (!user.password) {
        return res.status(401).json({ 
          message: 'No password set for this account. Please use OTP verification.' 
        });
      }

      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }
    }

    // Hash new password and update
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    // Send confirmation email
    await sendPasswordResetConfirmation(email, user.username || user.name);

    res.status(200).json({
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error changing password', error: error.message });
  }
};


