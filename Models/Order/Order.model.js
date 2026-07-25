const mongoose = require('mongoose');
const { Schema, model } = mongoose;

/**
 * Order Summary Schema
 * Comprehensive order management with full audit trail
 * Industry-level validation, error handling, and data integrity
 */

// Custom validator for phone number
const isValidPhoneNumber = (phone) => /^[0-9]{10,15}$/.test(phone);

// Custom validator for email
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Order Item Sub-Schema
const OrderItemSchema = new Schema(
  {
    itemType: {
      type: String,
      enum: {
        values: ['product', 'collection', 'custom-design', 'suggested'],
        message: 'Invalid item type',
      },
      required: [true, 'Item type is required'],
      default: 'product',
    },
    productId: {
      type: Schema.Types.ObjectId,
      refPath: 'items.itemRef',
      validate: {
        validator: function (v) {
          return this.itemType === 'custom-design' || mongoose.Types.ObjectId.isValid(v);
        },
        message: 'Invalid product ID',
      },
    },
    itemRef: {
      type: String,
      enum: ['Product', 'Collection', 'SuggestedProduct'],
      required: function () {
        return this.itemType !== 'custom-design';
      },
    },
    productName: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [200, 'Product name cannot exceed 200 characters'],
    },
    collectionId: {
      type: Schema.Types.ObjectId,
      ref: 'Collection',
    },
    phoneModel: {
      type: String,
      required: [true, 'Phone model is required'],
      trim: true,
      maxlength: [100, 'Phone model cannot exceed 100 characters'],
    },
    selectedBrand: {
      type: String,
      trim: true,
      maxlength: [100, 'Selected brand cannot exceed 100 characters'],
    },
    selectedModel: {
      type: String,
      trim: true,
      maxlength: [100, 'Selected model cannot exceed 100 characters'],
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
      max: [999, 'Quantity cannot exceed 999'],
      default: 1,
      validate: {
        validator: Number.isInteger,
        message: 'Quantity must be a whole number',
      },
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    subtotal: {
      type: Number,
      required: [true, 'Subtotal is required'],
      min: [0, 'Subtotal cannot be negative'],
    },
    // Image fields
    image: {
      type: String,
      trim: true,
    },
    collectionImage: {
      type: String,
      trim: true,
    },
    collectionName: {
      type: String,
      trim: true,
      maxlength: [200, 'Collection name cannot exceed 200 characters'],
    },
    // Gaming product level
    level: {
      type: String,
      trim: true,
      maxlength: [2, 'Level cannot exceed 2 characters'],
    },
    // Gaming collection plate fields
    hasPlate: {
      type: Boolean,
      default: false,
    },
    plateQuantity: {
      type: Number,
      min: [0, 'Plate quantity cannot be negative'],
      default: 0,
    },
    platePrice: {
      type: Number,
      min: [0, 'Plate price cannot be negative'],
      default: 0,
    },
    // Product option for gaming/custom/swap-wrap collections
    productOption: {
      type: String,
      enum: {
        values: ['cover+plates', 'plates-only', 'cover-only', 'none'],
        message: 'Invalid product option',
      },
      default: 'none',
    },
    // Collection type for tracking which collection this item belongs to
    collectionType: {
      type: String,
      enum: {
        values: ['gaming', 'swap-wrap', 'custom', 'other', 'accessories', 'none'],
        message: 'Invalid collection type',
      },
      default: 'none',
    },
    // Phone brand information for inventory tracking
    phoneBrand: {
      type: String,
      trim: true,
      maxlength: [100, 'Phone brand cannot exceed 100 characters'],
    },
    // Custom Design specific fields
    customDesign: {
      designImageUrl: {
        type: String,
        trim: true,
      },
      originalImageUrl: {
        type: String,
        trim: true,
      },
      transform: {
        x: { type: Number, default: 0 },
        y: { type: Number, default: 0 },
        scale: { type: Number, default: 1, min: 0.1, max: 10 },
        rotation: { type: Number, default: 0, min: -360, max: 360 },
      },
    },
  },
  { _id: true }
);

// Plates Sub-Schema
const PlateSchema = new Schema(
  {
    collectionId: {
      type: Schema.Types.ObjectId,
      ref: 'Collection',
      required: [true, 'Collection ID is required'],
    },
    collectionName: {
      type: String,
      required: [true, 'Collection name is required'],
      trim: true,
      maxlength: [200, 'Collection name cannot exceed 200 characters'],
    },
    collectionImage: {
      type: String,
      trim: true,
    },
    phoneModel: {
      type: String,
      trim: true,
      maxlength: [100, 'Phone model cannot exceed 100 characters'],
    },
    phoneBrand: {
      type: String,
      trim: true,
      maxlength: [100, 'Phone brand cannot exceed 100 characters'],
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
      max: [999, 'Quantity cannot exceed 999'],
      validate: {
        validator: Number.isInteger,
        message: 'Quantity must be a whole number',
      },
    },
    pricePerPlate: {
      type: Number,
      required: [true, 'Price per plate is required'],
      min: [0, 'Price per plate cannot be negative'],
    },
    totalPrice: {
      type: Number,
      required: [true, 'Total price is required'],
      min: [0, 'Total price cannot be negative'],
    },
  },
  { _id: true }
);

// Status History Sub-Schema
const StatusHistorySchema = new Schema(
  {
    status: {
      type: String,
      required: [true, 'Status is required'],
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    note: {
      type: String,
      trim: true,
      maxlength: [500, 'Note cannot exceed 500 characters'],
    },
    updatedBy: {
      type: String,
      trim: true,
      maxlength: [100, 'Updated by cannot exceed 100 characters'],
    },
  },
  { _id: true }
);

// Return Request Sub-Schema
const ReturnRequestSchema = new Schema(
  {
    isRequested: {
      type: Boolean,
      default: false,
    },
    requestedAt: {
      type: Date,
    },
    items: [
      {
        productId: {
          type: Schema.Types.ObjectId,
          ref: 'Product',
        },
        productName: {
          type: String,
          trim: true,
        },
        phoneModel: {
          type: String,
          trim: true,
        },
        quantity: {
          type: Number,
          min: [1, 'Quantity must be at least 1'],
        },
        reason: {
          type: String,
          trim: true,
          maxlength: [500, 'Reason cannot exceed 500 characters'],
        },
      },
    ],
    plates: [
      {
        collectionId: {
          type: Schema.Types.ObjectId,
          ref: 'Collection',
          required: true,
        },
        collectionName: {
          type: String,
          required: true,
          trim: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: [1, 'Quantity must be at least 1'],
        },
        reason: {
          type: String,
          trim: true,
          maxlength: [500, 'Reason cannot exceed 500 characters'],
        },
      },
    ],
    status: {
      type: String,
      enum: {
        values: ['Pending', 'Approved', 'Rejected', 'Completed'],
        message: 'Invalid return request status',
      },
      default: 'Pending',
    },
    adminNote: {
      type: String,
      trim: true,
      maxlength: [1000, 'Admin note cannot exceed 1000 characters'],
    },
    processedAt: {
      type: Date,
    },
    processedBy: {
      type: String,
      trim: true,
      maxlength: [100, 'Processed by cannot exceed 100 characters'],
    },
  },
  { _id: false }
);

const OrderSummarySchema = new Schema(
  {
    // Order Identification
    orderId: {
      type: String,
      required: [true, 'Order ID is required'],
      unique: true,
      trim: true,
    },
    orderNumber: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      // Format: ORD-YYYY-XXXX (e.g., ORD-2026-0001)
    },

    // User Reference
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },

    // Order Items and Plates
    items: {
      type: [OrderItemSchema],
      validate: {
        validator: function (items) {
          return items && items.length > 0;
        },
        message: 'Order must contain at least one item',
      },
    },
    plates: {
      type: [PlateSchema],
      default: [],
    },

    // Pricing Breakdown
    subtotal: {
      type: Number,
      required: [true, 'Subtotal is required'],
      min: [0, 'Subtotal cannot be negative'],
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative'],
    },
    tax: {
      type: Number,
      default: 0,
      min: [0, 'Tax cannot be negative'],
    },
    shippingCost: {
      type: Number,
      default: 0,
      min: [0, 'Shipping cost cannot be negative'],
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0, 'Total amount cannot be negative'],
    },

    // Discount & Coupon (supports multiple coupons)
    appliedCoupons: [
      {
        code: {
          type: String,
          required: [true, 'Coupon code is required'],
          uppercase: true,
          trim: true,
        },
        discountPercentage: {
          type: Number,
          required: [true, 'Discount percentage is required'],
          min: [0, 'Discount percentage cannot be negative'],
          max: [100, 'Discount percentage cannot exceed 100'],
        },
        discountAmount: {
          type: Number,
          required: [true, 'Discount amount is required'],
          min: [0, 'Discount amount cannot be negative'],
        },
      },
    ],

    // Order Status
    status: {
      type: String,
      required: [true, 'Order status is required'],
      enum: {
        values: [
          'Pending',
          'Confirmed',
          'Processing',
          'Shipped',
          'Out for Delivery',
          'Delivered',
          'Cancelled',
          'Refunded',
          'Failed',
        ],
        message: 'Invalid order status',
      },
      default: 'Pending',
    },

    // Status History (Audit Trail)
    statusHistory: {
      type: [StatusHistorySchema],
      default: [],
    },

    // Payment Information
    paymentMethod: {
      type: String,
      required: [true, 'Payment method is required'],
      enum: {
        values: ['COD', 'Credit Card', 'Debit Card', 'UPI', 'Net Banking', 'Wallet', 'PayPal', 'Razorpay'],
        message: 'Invalid payment method',
      },
    },
    paymentStatus: {
      type: String,
      required: [true, 'Payment status is required'],
      enum: {
        values: ['Pending', 'Paid', 'Failed', 'Refunded', 'Partially Refunded'],
        message: 'Invalid payment status',
      },
      default: 'Pending',
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
    transactionId: {
      type: String,
      trim: true,
      sparse: true,
    },
    // Razorpay specific fields
    razorpayOrderId: {
      type: String,
      trim: true,
    },
    razorpayPaymentId: {
      type: String,
      trim: true,
    },
    razorpaySignature: {
      type: String,
      trim: true,
    },
    paymentDetails: {
      gateway: {
        type: String,
        trim: true,
      },
      method: {
        type: String,
        trim: true,
      },
      last4Digits: {
        type: String,
        trim: true,
      },
      bankName: {
        type: String,
        trim: true,
      },
      upiId: {
        type: String,
        trim: true,
      },
      paidAt: {
        type: Date,
      },
    },

    // Shipping & Delivery Information
    shippingAddress: {
      fullName: {
        type: String,
        required: [true, 'Full name is required'],
        trim: true,
        maxlength: [100, 'Full name cannot exceed 100 characters'],
      },
      phoneNumber: {
        type: String,
        required: [true, 'Phone number is required'],
        trim: true,
        validate: {
          validator: isValidPhoneNumber,
          message: 'Invalid phone number format',
        },
      },
      email: {
        type: String,
        trim: true,
        lowercase: true,
        validate: {
          validator: function (v) {
            return !v || isValidEmail(v);
          },
          message: 'Invalid email format',
        },
      },
      addressLine1: {
        type: String,
        required: [true, 'Address line 1 is required'],
        trim: true,
        maxlength: [200, 'Address line 1 cannot exceed 200 characters'],
      },
      addressLine2: {
        type: String,
        trim: true,
        maxlength: [200, 'Address line 2 cannot exceed 200 characters'],
      },
      city: {
        type: String,
        required: [true, 'City is required'],
        trim: true,
        maxlength: [100, 'City cannot exceed 100 characters'],
      },
      state: {
        type: String,
        required: [true, 'State is required'],
        trim: true,
        maxlength: [100, 'State cannot exceed 100 characters'],
      },
      zipCode: {
        type: String,
        required: [true, 'Zip code is required'],
        trim: true,
        maxlength: [20, 'Zip code cannot exceed 20 characters'],
      },
      country: {
        type: String,
        required: [true, 'Country is required'],
        default: 'India',
        trim: true,
        maxlength: [100, 'Country cannot exceed 100 characters'],
      },
      landmark: {
        type: String,
        trim: true,
        maxlength: [200, 'Landmark cannot exceed 200 characters'],
      },
    },

    // Shipping Details
    shippingMethod: {
      type: String,
      enum: {
        values: ['Standard', 'Express', 'Next Day', 'Same Day', 'Free Shipping'],
        message: 'Invalid shipping method',
      },
      default: 'Standard',
    },
    trackingNumber: {
      type: String,
      trim: true,
    },
    awbCode: {
      type: String,
      trim: true,
    },
    shipmentId: {
      type: String,
      trim: true,
    },
    trackingLink: {
      type: String,
      trim: true,
    },
    courierPartner: {
      type: String,
      trim: true,
      maxlength: [100, 'Courier partner cannot exceed 100 characters'],
    },
    estimatedDelivery: {
      type: Date,
    },
    shippedAt: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },

    // Cancellation & Refund
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: [500, 'Cancellation reason cannot exceed 500 characters'],
    },
    cancelledAt: {
      type: Date,
    },
    cancelledBy: {
      type: String,
      enum: {
        values: ['Customer', 'Admin', 'System'],
        message: 'Invalid cancellation source',
      },
    },
    refundAmount: {
      type: Number,
      min: [0, 'Refund amount cannot be negative'],
    },
    refundedAt: {
      type: Date,
    },

    // Return Request Information
    returnRequest: {
      type: ReturnRequestSchema,
      default: () => ({ isRequested: false }),
    },

    // Invoice & Documentation
    invoiceNumber: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    invoiceUrl: {
      type: String,
      trim: true,
    },

    // Metadata & Analytics
    source: {
      type: String,
      enum: {
        values: ['Web', 'Mobile App', 'iOS', 'Android', 'Admin'],
        message: 'Invalid order source',
      },
      default: 'Web',
    },
    ipAddress: {
      type: String,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt
    versionKey: false,
  }
);


// Indexes for optimal query performance
OrderSummarySchema.index({ orderId: 1 });
OrderSummarySchema.index({ orderNumber: 1 });
OrderSummarySchema.index({ invoiceNumber: 1 });
OrderSummarySchema.index({ userId: 1, createdAt: -1 });
OrderSummarySchema.index({ status: 1, createdAt: -1 });
OrderSummarySchema.index({ paymentStatus: 1, createdAt: -1 });
OrderSummarySchema.index({ isPaid: 1, status: 1 });
OrderSummarySchema.index({ 'shippingAddress.phoneNumber': 1 });
OrderSummarySchema.index({ trackingNumber: 1 });
OrderSummarySchema.index({ awbCode: 1 });
OrderSummarySchema.index({ razorpayOrderId: 1 });
OrderSummarySchema.index({ createdAt: -1 }); // For sorting recent orders

// Pre-save middleware to generate order number and track status changes
OrderSummarySchema.pre('save', async function (next) {
  try {
    // Generate order number for new orders
    if (this.isNew && !this.orderNumber) {
      const year = new Date().getFullYear();
      const count = await this.constructor.countDocuments({
        createdAt: {
          $gte: new Date(year, 0, 1),
          $lt: new Date(year + 1, 0, 1),
        },
      });
      this.orderNumber = `ORD-${year}-${String(count + 1).padStart(4, '0')}`;

      // Add initial status to history
      this.statusHistory.push({
        status: this.status,
        timestamp: new Date(),
        note: 'Order created',
      });
    }

    // Update status history when status changes
    if (!this.isNew && this.isModified('status')) {
      this.statusHistory.push({
        status: this.status,
        timestamp: new Date(),
        note: `Status changed to ${this.status}`,
      });

      // Update specific timestamps based on status
      if (this.status === 'Shipped' && !this.shippedAt) {
        this.shippedAt = new Date();
      } else if (this.status === 'Delivered' && !this.deliveredAt) {
        this.deliveredAt = new Date();
      } else if (this.status === 'Cancelled' && !this.cancelledAt) {
        this.cancelledAt = new Date();
      }
    }

    // Calculate subtotals for items if not set
    this.items.forEach((item) => {
      if (!item.subtotal || item.subtotal === 0) {
        const itemTotal = item.price * item.quantity;
        const plateTotal = (item.platePrice || 0) * (item.plateQuantity || 0);
        item.subtotal = itemTotal + plateTotal;
      }
    });

    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to calculate total
OrderSummarySchema.methods.calculateTotal = function () {
  const itemsSubtotal = this.items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
  const platesSubtotal = this.plates.reduce((sum, plate) => sum + (plate.totalPrice || 0), 0);
  
  this.subtotal = itemsSubtotal + platesSubtotal;
  this.totalAmount = this.subtotal + (this.tax || 0) + (this.shippingCost || 0) - (this.discount || 0);
  
  return this.totalAmount;
};

// Instance method to mark as paid
OrderSummarySchema.methods.markAsPaid = function (transactionId, paymentDetails = {}) {
  this.isPaid = true;
  this.paymentStatus = 'Paid';
  this.transactionId = transactionId;
  this.paymentDetails = {
    ...this.paymentDetails,
    ...paymentDetails,
    paidAt: new Date(),
  };
  
  if (this.status === 'Pending') {
    this.status = 'Confirmed';
  }
  
  return this;
};

// Instance method to cancel order
OrderSummarySchema.methods.cancelOrder = function (reason, cancelledBy = 'Customer') {
  if (['Delivered', 'Cancelled', 'Refunded'].includes(this.status)) {
    throw new Error(`Cannot cancel order with status: ${this.status}`);
  }
  
  this.status = 'Cancelled';
  this.cancellationReason = reason;
  this.cancelledAt = new Date();
  this.cancelledBy = cancelledBy;
  
  return this;
};

// Instance method to process refund
OrderSummarySchema.methods.processRefund = function (amount, reason = '') {
  if (!this.isPaid) {
    throw new Error('Cannot refund unpaid order');
  }
  
  const maxRefund = this.totalAmount - (this.refundAmount || 0);
  if (amount > maxRefund) {
    throw new Error(`Refund amount exceeds maximum refundable amount: ₹${maxRefund}`);
  }
  
  this.refundAmount = (this.refundAmount || 0) + amount;
  this.refundedAt = new Date();
  
  if (this.refundAmount >= this.totalAmount) {
    this.paymentStatus = 'Refunded';
    this.status = 'Refunded';
  } else {
    this.paymentStatus = 'Partially Refunded';
  }
  
  this.statusHistory.push({
    status: this.status,
    timestamp: new Date(),
    note: `Refund processed: ₹${amount}. Reason: ${reason}`,
  });
  
  return this;
};

// Instance method to request return
OrderSummarySchema.methods.requestReturn = function (items, plates, reason = '') {
  if (!['Delivered'].includes(this.status)) {
    throw new Error('Returns can only be requested for delivered orders');
  }
  
  this.returnRequest = {
    isRequested: true,
    requestedAt: new Date(),
    items: items || [],
    plates: plates || [],
    status: 'Pending',
  };
  
  this.statusHistory.push({
    status: this.status,
    timestamp: new Date(),
    note: `Return requested. Reason: ${reason}`,
  });
  
  return this;
};

// Static method to get orders by user
OrderSummarySchema.statics.getOrdersByUser = function (userId, options = {}) {
  const {
    limit = 10,
    skip = 0,
    status = null,
    sort = { createdAt: -1 },
  } = options;
  
  const query = { userId };
  if (status) {
    query.status = status;
  }
  
  return this.find(query)
    .sort(sort)
    .limit(limit)
    .skip(skip)
    .populate('userId', 'username email phoneNumber')
    .populate('items.productId', 'name category price')
    .populate('items.collectionId', 'name type')
    .lean();
};

// Static method to get orders by status
OrderSummarySchema.statics.getOrdersByStatus = function (status, options = {}) {
  const { limit = 50, skip = 0, sort = { createdAt: -1 } } = options;
  
  return this.find({ status })
    .sort(sort)
    .limit(limit)
    .skip(skip)
    .populate('userId', 'username email phoneNumber')
    .lean();
};

// Static method to get pending payments
OrderSummarySchema.statics.getPendingPayments = function (options = {}) {
  const { limit = 50, skip = 0 } = options;
  
  return this.find({ 
    paymentStatus: 'Pending',
    status: { $nin: ['Cancelled', 'Failed'] }
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .populate('userId', 'username email phoneNumber')
    .lean();
};

// Static method to get orders requiring attention
OrderSummarySchema.statics.getOrdersRequiringAttention = function () {
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  
  return this.find({
    $or: [
      { status: 'Pending', createdAt: { $lt: twoDaysAgo } },
      { status: 'Confirmed', createdAt: { $lt: twoDaysAgo } },
      { 'returnRequest.isRequested': true, 'returnRequest.status': 'Pending' },
    ],
  })
    .sort({ createdAt: 1 })
    .populate('userId', 'username email phoneNumber')
    .lean();
};

// Static method to get order statistics
OrderSummarySchema.statics.getOrderStatistics = async function (startDate, endDate) {
  const matchStage = {
    createdAt: {
      $gte: startDate || new Date(0),
      $lte: endDate || new Date(),
    },
  };
  
  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$totalAmount' },
        avgOrderValue: { $avg: '$totalAmount' },
        totalPaidOrders: {
          $sum: { $cond: [{ $eq: ['$isPaid', true] }, 1, 0] },
        },
        totalCancelledOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'Cancelled'] }, 1, 0] },
        },
        totalDeliveredOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'Delivered'] }, 1, 0] },
        },
      },
    },
  ]);
  
  return stats[0] || {
    totalOrders: 0,
    totalRevenue: 0,
    avgOrderValue: 0,
    totalPaidOrders: 0,
    totalCancelledOrders: 0,
    totalDeliveredOrders: 0,
  };
};

const OrderSummary = model('OrderSummary', OrderSummarySchema);

module.exports = OrderSummary;