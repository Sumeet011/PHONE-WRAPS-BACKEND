const express = require('express');
const {
    addCoupon,
    listCoupons,
    validateCoupon,
    removeCoupon,
    updateCoupon
} = require('../controllers/coupon.controller');

const router = express.Router();

// Admin routes
router.post('/add', addCoupon);
router.get('/list', listCoupons);
router.delete('/remove/:id', removeCoupon);
router.put('/update/:id', updateCoupon);

// User routes
router.post('/validate', validateCoupon);

module.exports = router;
