const User = require('../../Models/User/User.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const twilio = require('twilio');

// Secret key for JWT - in production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Twilio Configuration
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Sign Up With Email & Password
exports.signupemailpass = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

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
  orConditions.push({ phoneNumber: phone });
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
      phoneNumber: phone || '',
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

    // Find user
    const user = await User.findOne({ email });
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

// Send Email OTP using Twilio
exports.loginemailotp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found with this email' });
    }

    // Generate OTP and set expiry (5 minutes)
    const otp = generateOTP();
    user.emailOTP = otp;
    user.emailOTPExpires = new Date(Date.now() + 5 * 60 * 1000);
    await user.save();

    // Send OTP via Twilio SMS to email (or use email service)
    // Using Twilio SendGrid for email or Twilio Messaging for SMS
    await twilioClient.messages.create({
      body: `Your verification code is: ${otp}. Valid for 5 minutes.`,
      from: TWILIO_PHONE_NUMBER,
      to: email // Note: For email, you need Twilio SendGrid integration
    });
    
    res.status(200).json({
      message: 'OTP sent successfully to your email'
    });
  } catch (error) {
    console.error('Send email OTP error:', error);
    res.status(500).json({ message: 'Server error sending OTP', error: error.message });
  }
};

// Send Phone OTP using Twilio SMS
exports.loginphoneotp = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    // Check if user exists
    const user = await User.findOne({ phoneNumber: phone });
    if (!user) {
      return res.status(404).json({ message: 'User not found with this phone number' });
    }

    // Generate OTP and set expiry (5 minutes)
    const otp = generateOTP();
    user.phoneOTP = otp;
    user.phoneOTPExpires = new Date(Date.now() + 5 * 60 * 1000);
    await user.save();

    // Send OTP via Twilio SMS (phone must be in E.164 format, e.g., +1234567890)
    await twilioClient.messages.create({
      body: `Your verification code is: ${otp}. Valid for 5 minutes.`,
      from: TWILIO_PHONE_NUMBER,
      to: phone
    });
    
    res.status(200).json({
      message: 'OTP sent successfully to your phone'
    });
  } catch (error) {
    console.error('Send phone OTP error:', error);
    res.status(500).json({ message: 'Server error sending OTP', error: error.message });
  }
};

// Verify Email OTP
exports.verifyEmailOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if OTP exists
    if (!user.emailOTP || !user.emailOTPExpires) {
      return res.status(401).json({ message: 'OTP not found. Please request a new one.' });
    }

    // Check if OTP is expired
    if (new Date() > user.emailOTPExpires) {
      user.emailOTP = undefined;
      user.emailOTPExpires = undefined;
      await user.save();
      return res.status(401).json({ message: 'OTP has expired. Please request a new one.' });
    }

    // Verify OTP
    if (user.emailOTP !== otp) {
      return res.status(401).json({ message: 'Invalid OTP' });
    }

    // Clear OTP and mark email as verified
    user.emailOTP = undefined;
    user.emailOTPExpires = undefined;
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
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ message: 'Phone number and OTP are required' });
    }

    // Find user
    const user = await User.findOne({ phoneNumber: phone });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if OTP exists
    if (!user.phoneOTP || !user.phoneOTPExpires) {
      return res.status(401).json({ message: 'OTP not found. Please request a new one.' });
    }

    // Check if OTP is expired
    if (new Date() > user.phoneOTPExpires) {
      user.phoneOTP = undefined;
      user.phoneOTPExpires = undefined;
      await user.save();
      return res.status(401).json({ message: 'OTP has expired. Please request a new one.' });
    }

    // Verify OTP
    if (user.phoneOTP !== otp) {
      return res.status(401).json({ message: 'Invalid OTP' });
    }

    // Clear OTP after successful verification
    user.phoneOTP = undefined;
    user.phoneOTPExpires = undefined;
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
    res.status(500).json({ message: 'Server error verifying OTP', error: error.message });
  }
};

// Login with Email & Password (alias for compatibility)
exports.loginemailpass = exports.login;

// Sign Up With Phone OTP
exports.signupphoneotp = async (req, res) => {
  try {
    const { name, phone } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }

    if (!phone) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ phoneNumber: phone });
    if (existingUser) {
      return res.status(409).json({ message: 'User already exists with this phone number' });
    }

    // Create user without password
    const newUser = new User({
      username: name,
      phoneNumber: phone,
      email: '',
      password: await bcrypt.hash(Math.random().toString(36), 10), // Random password
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await newUser.save();

    // Generate OTP and set expiry (5 minutes)
    const otp = generateOTP();
    newUser.phoneOTP = otp;
    newUser.phoneOTPExpires = new Date(Date.now() + 5 * 60 * 1000);
    await newUser.save();

    // Send OTP via Twilio SMS
    await twilioClient.messages.create({
      body: `Welcome ${name}! Your verification code is: ${otp}. Valid for 5 minutes.`,
      from: TWILIO_PHONE_NUMBER,
      to: phone
    });

    res.status(201).json({
      message: 'User created successfully. OTP sent to your phone.',
      userId: newUser._id
    });
  } catch (error) {
    console.error('Signup phone OTP error:', error);
    res.status(500).json({ message: 'Server error during sign up', error: error.message });
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
