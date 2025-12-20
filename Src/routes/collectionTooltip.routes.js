const express = require('express');
const router = express.Router();
const collectionTooltipController = require('../controllers/collectionTooltip.controller');

// Public route - Get all tooltips (used by frontend cart page)
router.get('/', collectionTooltipController.getTooltips);

// Public route - Get tooltip by quantity
router.get('/:quantity', collectionTooltipController.getTooltipByQuantity);

// Admin routes - No auth needed as admin panel already handles authentication
router.put('/', collectionTooltipController.updateTooltips);
router.put('/:quantity', collectionTooltipController.updateTooltip);

module.exports = router;
