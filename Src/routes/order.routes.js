const express = require('express')
const {
    placeOrderRazorpay, 
    // createRazorpayOrder,  // DEPRECATED - Orders now created after payment verification
    allOrders,
    getOrderById,
    userOrders, 
    updateStatus,
    updateTracking,
    verifyRazorpay, 
    deleteOrder,
    placeOrderCOD,
    getLeaderboard,
    createOrderShipment,
    cancelOrderShipment,
    cancelOrder
} = require('../controllers/order.controller.js')

const orderRouter = express.Router()

// Admin Features
orderRouter.post('/list', allOrders)
orderRouter.post('/status', updateStatus)
orderRouter.post('/tracking', updateTracking)

// Leaderboard (specific route before parameterized route)
orderRouter.get('/leaderboard', getLeaderboard)

// Manual Shipment Management Routes
orderRouter.post('/:orderId/create-shipment', createOrderShipment)
orderRouter.post('/:orderId/cancel-shipment', cancelOrderShipment)
orderRouter.post('/:orderId/cancel', cancelOrder)

// Get single order by ID (must be after specific GET routes)
orderRouter.get('/:orderId', getOrderById)

// Payment Features
orderRouter.post('/razorpay', placeOrderRazorpay)
// orderRouter.post('/createRazorpayOrder', createRazorpayOrder) // REMOVED - Don't create orders before payment

// User Feature 
orderRouter.post('/userorders', userOrders)

// verify payment
orderRouter.post('/verifyRazorpay', verifyRazorpay)

// COD (Cash on Delivery)
orderRouter.post('/cod', placeOrderCOD)

// Delete order
orderRouter.post('/delete', deleteOrder)

module.exports = orderRouter