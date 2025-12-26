const { Schema, model } = require('mongoose');

const OrderSummarySchema = new Schema({
    // Order Identification
    orderId: {
        type: String,
        required: true
    },
    orderNumber: {
        type: String,
        // Format: ORD-YYYY-XXXX (e.g., ORD-2025-0001)
    },
    
    // User Reference
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // Order Items Details
    items: [{
        itemType: {
            type: String,
            enum: ['product', 'collection', 'custom-design'],
            default: 'product'
        },
        productId: {
            type: Schema.Types.ObjectId,
            ref: 'Product',
            required: false // Not required for custom designs
        },
        productName: {
            type: String,
            required: true
        },
        collectionId: {
            type: Schema.Types.ObjectId,
            ref: 'Collection'
        },
        phoneModel: {
            type: String,
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1,
            default: 1
        },
        price: {
            type: Number,
            required: true,
            min: 0
        },
        // Custom Design specific fields
        customDesign: {
            designImageUrl: {
                type: String,
                default: ''
            },
            originalImageUrl: {
                type: String,
                default: ''
            },
            transform: {
                x: { type: Number, default: 0 },
                y: { type: Number, default: 0 },
                scale: { type: Number, default: 1 },
                rotation: { type: Number, default: 0 }
            }
        }
    }],
    
    // Legacy fields (for backward compatibility - consider migrating)
    productIds: [{
        type: Schema.Types.ObjectId,
        ref: 'Product'
    }],
    collectionIds: [{
        type: Schema.Types.ObjectId,
        ref: 'Collection'
    }],
    phonemodel: [{
        type: String
    }],
    
    // Pricing Breakdown
    subtotal: {
        type: Number,
        required: true,
        min: 0
    },
    discount: {
        type: Number,
        default: 0,
        min: 0
    },
    shippingCost: {
        type: Number,
        default: 0,
        min: 0
    },
    totalAmount: {
        type: Number,
        required: true,
        min: 0
    },
    
    // Discount & Coupon (supports multiple coupons)
    appliedCoupons: [{
        code: {
            type: String,
            required: true,
            uppercase: true
        },
        discountPercentage: {
            type: Number,
            required: true
        },
        discountAmount: {
            type: Number,
            required: true
        }
    }],
    // Legacy fields for backward compatibility
    couponCode: {
        type: String,
        trim: true,
        uppercase: true
    },
    couponDiscount: {
        type: Number,
        default: 0
    },
    
    // Order Status
    status: {
        type: String,
        required: true,
        enum: ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Refunded', 'Failed'],
        default: 'Pending'
    },
    
    // Status History (Audit Trail)
    statusHistory: [{
        status: {
            type: String,
            required: true
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        note: String,
        updatedBy: String
    }],
    
    // Payment Information
    paymentMethod: {
        type: String,
        required: true,
        enum: ['COD', 'Credit Card', 'Debit Card', 'UPI', 'Net Banking', 'Wallet', 'PayPal', 'Razorpay'],
    },
    paymentStatus: {
        type: String,
        required: true,
        enum: ['Pending', 'Paid', 'Failed', 'Refunded', 'Partially Refunded'],
        default: 'Pending'
    },
    isPaid: {
        type: Boolean,
        default: false
    },
    transactionId: {
        type: String,
        trim: true
    },
    // Razorpay specific fields
    razorpayOrderId: {
        type: String,
        trim: true
    },
    razorpayPaymentId: {
        type: String,
        trim: true
    },
    razorpaySignature: {
        type: String,
        trim: true
    },
    paymentDetails: {
        gateway: String,
        method: String,
        last4Digits: String,
        bankName: String,
        upiId: String,
        paidAt: Date
    },
    
    // Shipping & Delivery Information
    shippingAddress: {
        fullName: {
            type: String,
            required: true,
            trim: true
        },
        phoneNumber: {
            type: String,
            required: true,
            trim: true
        },
        email: {
            type: String,
            trim: true,
            lowercase: true
        },
        addressLine1: {
            type: String,
            required: true,
            trim: true
        },
        addressLine2: {
            type: String,
            trim: true
        },
        city: {
            type: String,
            required: true,
            trim: true
        },
        state: {
            type: String,
            required: true,
            trim: true
        },
        zipCode: {
            type: String,
            required: true,
            trim: true
        },
        country: {
            type: String,
            required: true,
            default: 'India',
            trim: true
        },
        landmark: {
            type: String,
            trim: true
        }
    },
    
    // Legacy delivery address (for backward compatibility)
    deliveryAddress: {
        type: String
    },
    
    // Shipping Details
    shippingMethod: {
        type: String,
        enum: ['Standard', 'Express', 'Next Day', 'Same Day', 'Free Shipping'],
        default: 'Standard'
    },
    trackingNumber: {
        type: String,
        trim: true
    },
    awbCode: {
        type: String,
        trim: true
    },
    shipmentId: {
        type: String,
        trim: true
    },
    trackingLink: {
        type: String,
        trim: true
    },
    courierPartner: {
        type: String,
        trim: true
    },
    estimatedDelivery: {
        type: Date
    },
    shippedAt: {
        type: Date
    },
    deliveredAt: {
        type: Date
    },
    
    
    
    // Cancellation & Refund
    cancellationReason: {
        type: String,
        trim: true
    },
    cancelledAt: {
        type: Date
    },
    cancelledBy: {
        type: String,
        enum: ['Customer', 'Admin', 'System']
    },
    refundAmount: {
        type: Number,
        min: 0
    },
    refundedAt: {
        type: Date
    },
    
    // Invoice & Documentation
    invoiceNumber: {
        type: String
    },
    invoiceUrl: {
        type: String
    },
    
    // Metadata & Analytics
    source: {
        type: String,
        enum: ['Web', 'Mobile App', 'iOS', 'Android', 'Admin'],
        default: 'Web'
    },
    ipAddress: {
        type: String
    },
    userAgent: {
        type: String
    },
    
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true // Automatically manages createdAt and updatedAt
});

// Indexes for better query performance
OrderSummarySchema.index({ orderId: 1 }, { unique: true });
OrderSummarySchema.index({ orderNumber: 1 }, { unique: true, sparse: true });
OrderSummarySchema.index({ invoiceNumber: 1 }, { unique: true, sparse: true });
OrderSummarySchema.index({ userId: 1, createdAt: -1 });
OrderSummarySchema.index({ status: 1, createdAt: -1 });
OrderSummarySchema.index({ paymentStatus: 1 });
OrderSummarySchema.index({ 'shippingAddress.phoneNumber': 1 });

// Pre-save middleware to generate order number
OrderSummarySchema.pre('save', async function(next) {
    if (this.isNew && !this.orderNumber) {
        const year = new Date().getFullYear();
        const count = await this.constructor.countDocuments({
            createdAt: {
                $gte: new Date(year, 0, 1),
                $lt: new Date(year + 1, 0, 1)
            }
        });
        this.orderNumber = `ORD-${year}-${String(count + 1).padStart(4, '0')}`;
    }
    
    // Update statusHistory when status changes
    if (this.isModified('status')) {
        this.statusHistory.push({
            status: this.status,
            timestamp: new Date(),
            note: `Status changed to ${this.status}`
        });
    }
    
    next();
});

// Instance method to calculate total
OrderSummarySchema.methods.calculateTotal = function() {
    this.subtotal = this.items.reduce((sum, item) => sum + item.subtotal, 0);
    this.totalAmount = this.subtotal + this.tax + this.shippingCost - this.discount - this.couponDiscount;
    return this.totalAmount;
};

// Instance method to mark as paid
OrderSummarySchema.methods.markAsPaid = function(transactionId, paymentDetails = {}) {
    this.isPaid = true;
    this.paymentStatus = 'Paid';
    this.transactionId = transactionId;
    this.paymentDetails = {
        ...this.paymentDetails,
        ...paymentDetails,
        paidAt: new Date()
    };
};

// Instance method to cancel order
OrderSummarySchema.methods.cancelOrder = function(reason, cancelledBy = 'Customer') {
    this.status = 'Cancelled';
    this.cancellationReason = reason;
    this.cancelledAt = new Date();
    this.cancelledBy = cancelledBy;
};

// Static method to get orders by user
OrderSummarySchema.statics.getOrdersByUser = function(userId, options = {}) {
    return this.find({ userId })
        .sort({ createdAt: -1 })
        .limit(options.limit || 10)
        .skip(options.skip || 0)
        .populate('items.productId', 'name category price')
        .populate('userId', 'username email phoneNumber');
};

// Static method to get orders by status
OrderSummarySchema.statics.getOrdersByStatus = function(status, options = {}) {
    return this.find({ status })
        .sort({ createdAt: -1 })
        .limit(options.limit || 50)
        .skip(options.skip || 0);
};

const OrderSummary = model("OrderSummary", OrderSummarySchema);

module.exports = OrderSummary;