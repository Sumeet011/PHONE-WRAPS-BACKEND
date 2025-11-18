const { Schema, model } = require('mongoose');

const CouponSchema = new Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    discountPercentage: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    minimumAmount: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    maxUsage: {
        type: Number,
        required: true,
        min: 1
    },
    usedCount: {
        type: Number,
        default: 0,
        min: 0
    },
    expiryDate: {
        type: Date,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    description: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

// Check if coupon is valid
CouponSchema.methods.isValid = function() {
    const now = new Date();
    return this.isActive && 
           this.expiryDate > now && 
           this.usedCount < this.maxUsage;
};

// Check if coupon can be used for order amount
CouponSchema.methods.canBeApplied = function(orderAmount) {
    return this.isValid() && orderAmount >= this.minimumAmount;
};

const Coupon = model('Coupon', CouponSchema);

module.exports = Coupon;
