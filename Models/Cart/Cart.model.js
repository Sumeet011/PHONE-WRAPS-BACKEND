const mongoose = require('mongoose');
const { Schema, model } = mongoose;

/**
 * Cart Item Schema
 * Represents individual items in a shopping cart
 */
const CartItemSchema = new Schema(
  {
    type: {
      type: String,
      enum: {
        values: ['product', 'collection', 'custom-design', 'suggested'],
        message: 'Invalid item type. Must be: product, collection, custom-design, or suggested',
      },
      required: [true, 'Item type is required'],
    },
    productId: {
      type: Schema.Types.ObjectId,
      refPath: 'items.type',
      required: [true, 'Product ID is required'],
      validate: {
        validator: function (v) {
          return mongoose.Types.ObjectId.isValid(v);
        },
        message: 'Invalid product ID format',
      },
    },
    productId: {
  type: Schema.Types.ObjectId,
  required: function () {
    return this.type !== "custom-design";
  },
},

customDesignId: {
  type: String,
  required: function () {
    return this.type === "custom-design";
  },
},
    // Reference field for dynamic population
    productRef: {
      type: String,
      enum: ['Product', 'Collection', 'SuggestedProduct'],
      required: function () {
        return this.type !== 'custom-design';
      },
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
    selectedBrand: {
      type: String,
      trim: true,
      maxlength: [100, 'Brand name cannot exceed 100 characters'],
      default: '',
    },
    selectedModel: {
      type: String,
      trim: true,
      maxlength: [100, 'Model name cannot exceed 100 characters'],
      default: '',
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
      validate: {
        validator: function (v) {
          return Number.isFinite(v) && v >= 0;
        },
        message: 'Invalid price value',
      },
    },
    // Gaming collection plate fields
    plateQuantity: {
      type: Number,
      min: [0, 'Plate quantity cannot be negative'],
      max: [999, 'Plate quantity cannot exceed 999'],
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Plate quantity must be a whole number',
      },
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
        message: 'Invalid product option. Must be: cover+plates, plates-only, cover-only, or none',
      },
      default: 'none',
    },
    // Collection type for tracking which collection this item belongs to
    collectionType: {
      type: String,
      enum: {
        values: ['gaming', 'swap-wrap', 'custom', 'other', 'accessories', 'none', 'normal-swap'],
        message: 'Invalid collection type',
      },
      default: 'none',
    },
    // Image and name fields for cart display
    image: {
      type: String,
      trim: true,
    },
    productImage: {
      type: String,
      trim: true,
    },
    productName: {
      type: String,
      trim: true,
      maxlength: [200, 'Product name cannot exceed 200 characters'],
    },
    collectionName: {
      type: String,
      trim: true,
      maxlength: [200, 'Collection name cannot exceed 200 characters'],
    },
    // Custom design specific fields (only for type: 'custom-design')
    customDesign: {
      designImageUrl: {
        type: String,
        trim: true,
        validate: {
          validator: function (v) {
    if (!v) return true;

    return (
        /^https?:\/\/.+/.test(v) ||
        /^data:image\/.+;base64,/.test(v)
    );
},
          message: 'Invalid design image URL format',
        },
      },
      originalImageUrl: {
  type: String,
  trim: true,
  validate: {
    validator: function (v) {
      if (!v) return true;

      return (
        /^https?:\/\/.+/.test(v) ||
        /^data:image\/.+;base64,/.test(v)
      );
    },
    message: "Invalid original image URL format",
  },
},
      
      phoneModel: {
        type: String,
        trim: true,
        maxlength: [100, 'Phone model cannot exceed 100 characters'],
      },
      transform: {
        x: { type: Number, default: 0 },
        y: { type: Number, default: 0 },
        scale: { type: Number, default: 1, min: 0.1, max: 10 },
        rotation: { type: Number, default: 0, min: -360, max: 360 },
      },
    },
    addedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { _id: true }
);

// Validation for custom design items
CartItemSchema.pre('validate', function (next) {
  if (this.type === 'custom-design') {
    if (!this.customDesign || !this.customDesign.designImageUrl) {
      return next(new Error('Custom design items must have a design image URL'));
    }
  }
  
  next();
});

/**
 * Cart Schema
 * Represents a user's shopping cart
 */
const CartSchema = new Schema(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      trim: true,
    },
    items: {
      type: [CartItemSchema],
      validate: {
        validator: function (items) {
          return items.length <= 100;
        },
        message: 'Cart cannot contain more than 100 items',
      },
      default: [],
    },
    appliedCoupons: [
      {
        code: {
          type: String,
          required: [true, 'Coupon code is required'],
          uppercase: true,
          trim: true,
          maxlength: [50, 'Coupon code cannot exceed 50 characters'],
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
        appliedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    sessionId: {
      type: String,
      trim: true,
    },
    lastActivity: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Indexes for optimized queries
CartSchema.index({ userId: 1 }, { unique: true });
CartSchema.index({ lastActivity: 1 }); // For cleaning up abandoned carts
CartSchema.index({ 'items.productId': 1 });

// Pre-save middleware to update last activity
CartSchema.pre('save', function (next) {
  this.lastActivity = new Date();
  next();
});

// Instance method to calculate cart totals
CartSchema.methods.calculateTotals = function () {
  const subtotal = this.items.reduce((sum, item) => {
    const itemTotal = item.price * item.quantity;
    const plateTotal = item.platePrice * item.plateQuantity;
    return sum + itemTotal + plateTotal;
  }, 0);

  const totalDiscount = this.appliedCoupons.reduce(
    (sum, coupon) => sum + coupon.discountAmount,
    0
  );

  const total = Math.max(0, subtotal - totalDiscount);

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    totalDiscount: Math.round(totalDiscount * 100) / 100,
    total: Math.round(total * 100) / 100,
    itemCount: this.items.reduce((sum, item) => sum + item.quantity, 0),
  };
};

// Instance method to check if cart is empty
CartSchema.methods.isEmpty = function () {
  return !this.items || this.items.length === 0;
};

// Instance method to clear expired coupons
CartSchema.methods.clearExpiredCoupons = async function () {
  const Coupon = mongoose.model('Coupon');
  const validCoupons = [];

  for (const appliedCoupon of this.appliedCoupons) {
    const coupon = await Coupon.findOne({ code: appliedCoupon.code });
    if (coupon && coupon.isActive && (!coupon.expiryDate || coupon.expiryDate > new Date())) {
      validCoupons.push(appliedCoupon);
    }
  }

  this.appliedCoupons = validCoupons;
  return this.save();
};

// Static method to find abandoned carts
CartSchema.statics.findAbandonedCarts = function (daysOld = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  return this.find({
    lastActivity: { $lt: cutoffDate },
    'items.0': { $exists: true }, // Has at least one item
  });
};

// Static method to clean up empty carts
CartSchema.statics.cleanupEmptyCarts = function () {
  return this.deleteMany({
    $or: [{ items: { $size: 0 } }, { items: { $exists: false } }],
  });
};

const Cart = model('Cart', CartSchema);
module.exports = Cart;
