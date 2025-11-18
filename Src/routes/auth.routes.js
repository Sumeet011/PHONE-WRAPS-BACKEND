const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// EMAIL & PASSWORD AUTHENTICATION ROUTES
router.post('/signupemailpass', authController.signupemailpass);
router.post('/loginemailpass', authController.loginemailpass);

// EMAIL OTP AUTHENTICATION ROUTES
router.post('/send-email-otp', authController.loginemailotp);
router.post('/verify-email-otp', authController.verifyEmailOTP);

// PHONE OTP AUTHENTICATION ROUTES
router.post('/send-phone-otp', authController.loginphoneotp);
router.post('/verify-phone-otp', authController.verifyPhoneOTP);
router.post('/signupphoneotp', authController.signupphoneotp);

module.exports = router;
    