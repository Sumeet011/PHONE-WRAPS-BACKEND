const rateLimit = require('express-rate-limit');

const sendPhoneOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many OTP requests. Please try again in a few minutes.'
  }
});

const verifyPhoneOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many OTP verification attempts. Please try again in a few minutes.'
  }
});

module.exports = {
  sendPhoneOtpLimiter,
  verifyPhoneOtpLimiter
};
