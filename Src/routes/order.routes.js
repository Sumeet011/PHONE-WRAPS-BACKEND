const express = require('express')
const {
    placeOrderRazorpay, 
    // createRazorpayOrder,  // DEPRECATED - Orders now created after payment verification
    allOrders, 
    userOrders, 
    updateStatus,
    updateTracking,
    verifyRazorpay, 
    deleteOrder,
    placeOrderCOD,
    getLeaderboard
} = require('../controllers/order.controller.js')

const orderRouter = express.Router()

// Admin Features
orderRouter.post('/list', allOrders)
orderRouter.post('/status', updateStatus)
orderRouter.post('/tracking', updateTracking)

// Payment Features
orderRouter.post('/razorpay', placeOrderRazorpay)
// orderRouter.post('/createRazorpayOrder', createRazorpayOrder) // REMOVED - Don't create orders before payment

// User Feature 
orderRouter.post('/userorders', userOrders)

// Leaderboard
orderRouter.get('/leaderboard', getLeaderboard)

// verify payment
orderRouter.post('/verifyRazorpay', verifyRazorpay)

// COD (Cash on Delivery)
orderRouter.post('/cod', placeOrderCOD)

// Delete order
orderRouter.post('/delete', deleteOrder)

module.exports = orderRouter