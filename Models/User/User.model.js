const { Schema, model } = require('mongoose');

const UserSchema = new Schema({
    username: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 100
    },
    phoneNumber: {
        type: String,
        sparse: true, // Allows multiple null values but unique non-null values
        trim: true
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        sparse: true, // Allows multiple null values but unique non-null values
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    password: {
        type: String,
        required: true,
        minlength: 6,
        select: false // Don't return password by default in queries
    },
    emailOTP: {
        type: String,
        select: false // Don't return OTP in queries
    },
    emailOTPExpires: {
        type: Date,
        select: false
    },
    emailVerified: {
        type: Boolean,
        default: false
    },
    phoneOTP: {
        type: String,
        select: false // Don't return OTP in queries
    },
    phoneOTPExpires: {
        type: Date,
        select: false
    },
    profilePicture: {
        type: String,
        default: ''
    },
    Address: {
        type: String,
    },
    unlockedProducts: [{
        type: Schema.Types.ObjectId,
        ref: 'Product'
    }],
    unlockedCollections: [{
        type: Schema.Types.ObjectId,
        ref: 'Collection'
    }],
    score: {
        type: Number,
        default: 0,
        min: 0
    },
    // Track failed login attempts for security
    loginAttempts: {
        type: Number,
        default: 0,
        select: false
    },
    lockUntil: {
        type: Date,
        select: false
    }
}, {
    timestamps: true // Automatically manage createdAt and updatedAt
});

// Indexes for performance
UserSchema.index({ email: 1 }, { unique: true, sparse: true });
UserSchema.index({ phoneNumber: 1 }, { unique: true, sparse: true });
UserSchema.index({ createdAt: -1 });
UserSchema.index({ score: -1 }); // For leaderboards

// Virtual for account lock status
UserSchema.virtual('isLocked').get(function() {
    return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Methods
UserSchema.methods.incLoginAttempts = function() {
    // Reset lock if expired
    if (this.lockUntil && this.lockUntil < Date.now()) {
        return this.updateOne({
            $set: { loginAttempts: 1 },
            $unset: { lockUntil: 1 }
        });
    }
    
    const updates = { $inc: { loginAttempts: 1 } };
    const maxAttempts = 5;
    const lockTime = 2 * 60 * 60 * 1000; // 2 hours
    
    // Lock account after max attempts
    if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked) {
        updates.$set = { lockUntil: Date.now() + lockTime };
    }
    
    return this.updateOne(updates);
};

UserSchema.methods.resetLoginAttempts = function() {
    return this.updateOne({
        $set: { loginAttempts: 0 },
        $unset: { lockUntil: 1 }
    });
};

const User = model("User", UserSchema);

module.exports = User;