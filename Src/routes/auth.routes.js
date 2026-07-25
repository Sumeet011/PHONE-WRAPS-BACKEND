const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { sendPhoneOtpLimiter, verifyPhoneOtpLimiter } = require('../middleware/otpRateLimit');

// EMAIL & PASSWORD AUTHENTICATION ROUTES
router.post('/signupemailpass', authController.signupemailpass);
router.post('/loginemailpass', authController.loginemailpass);

// EMAIL SIGNUP WITH RANDOM PASSWORD
router.post('/signup-email', authController.signupWithEmail);

// EMAIL OTP AUTHENTICATION ROUTES (using Nodemailer)
router.post('/send-email-otp', authController.loginemailotp);
router.post('/verify-email-otp', authController.verifyEmailOTP);

// PASSWORD RESET ROUTES (using OTP via Nodemailer)
router.post('/request-password-reset', authController.requestPasswordReset);
router.post('/reset-password', authController.resetPassword);
router.post('/change-password', authController.changePassword);

// PHONE OTP AUTHENTICATION ROUTES
router.post('/send-phone-otp', sendPhoneOtpLimiter, authController.loginphoneotp);
router.post('/verify-phone-otp', verifyPhoneOtpLimiter, authController.verifyPhoneOTP);
router.post('/signupphoneotp', sendPhoneOtpLimiter, authController.signupphoneotp);

router.post('/admin', authController.adminLogin);

module.exports = router;
    