const { Schema, model } = require('mongoose');

const CartItemSchema = new Schema({
  type: {
    type: String,
    enum: ['product', 'collection', 'custom-design', 'suggested'],
    required: true
  },
  productId: {
    type: String, // Custom ID like "P1001", "C202", or "CUSTOM-{timestamp}", or suggested product ObjectId
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  selectedBrand: {
    type: String,
    default: ''
  },
  selectedModel: {
    type: String,
    default: ''
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  // Custom design specific fields (only for type: 'custom-design')
  customDesign: {
    type: {
      designImageUrl: {
        type: String, // Cloudinary URL of the final design
        default: ''
      },
      originalImageUrl: {
        type: String, // User uploaded image URL
        default: ''
      },
      phoneModel: {
        type: String,
        default: ''
      },
      transform: {
        x: { type: Number, default: 0 },
        y: { type: Number, default: 0 },
        scale: { type: Number, default: 1 },
        rotation: { type: Number, default: 0 }
      }
    },
    required: false,
    default: undefined // Don't include this field unless explicitly set
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

const CartSchema = new Schema({
  userId: {
    type: String, // ✅ Changed from ObjectId to String
    required: true
  },
  items: [CartItemSchema],
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
    },
    appliedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Index for faster queries (unique because one cart per user)
CartSchema.index({ userId: 1 }, { unique: true });

const Cart = model('Cart', CartSchema);
module.exports = Cart;
