const express = require('express');
const router = express.Router();
const siteSettingsController = require('../controllers/siteSettings.controller');
const { verifyToken } = require('../middleware/auth');

/**
 * @route   GET /api/site-settings
 * @desc    Get site settings (public)
 * @access  Public
 */
router.get('/', siteSettingsController.getSettings);

/**
 * @route   PUT /api/site-settings
 * @desc    Update site settings
 * @access  Admin only (verified by login)
 */
router.put('/', verifyToken, siteSettingsController.updateSettings);

/**
 * @route   POST /api/site-settings/reset
 * @desc    Reset settings to default
 * @access  Admin only (verified by login)
 */
router.post('/reset', verifyToken, siteSettingsController.resetSettings);

module.exports = router;
