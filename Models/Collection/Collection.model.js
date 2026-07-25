const mongoose = require('mongoose');
const { Schema, model } = mongoose;

// Custom validator for URL format
const isValidUrl = (url) => {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
};

const CollectionSchema = new Schema({
    // Collection Name
    name: {
        type: String,
        required: [true, 'Collection name is required'],
        trim: true,
        minlength: [1, 'Collection name cannot be empty'],
        maxlength: [200, 'Collection name cannot exceed 200 characters'],
        validate: {
            validator: function(v) {
                return /^[a-zA-Z0-9\s\-_.&]+$/.test(v); // Allow alphanumeric, spaces, hyphens, underscores, dots, ampersands
            },
            message: 'Collection name contains invalid characters'
        }
    },
    // Collection Type
    type: {
        type: String,
        enum: {
            values: ['gaming','swap-wrap', 'normal'],
            message: 'Invalid collection type'
        },
        default: 'normal',
        required: [true, 'Collection type is required']
    },
    // Pricing - Required only for 'gaming' type
    price: {
        type: Number,
        required: function() {
            return this.type === 'gaming' || this.type === 'swap-wrap';
        },
        min: [0, 'Price cannot be negative']
    },
    plateprice: {
        type: Number,
        required: function() {
            return this.type === 'gaming' || this.type === 'swap-wrap';
        },
        min: [0, 'Plate price cannot be negative']
    },
    
    // Hero Image URL
    heroImage: {
        type: String,
        required: false,
        trim: true,
        validate: {
            validator: function(v) {
                return !v || isValidUrl(v); // Optional, but if provided, must be valid URL
            },
            message: 'Invalid hero image URL format'
        }
    },
    // Associated Products (references to Product model)
    products: [{ // Changed to lowercase 'products' for consistency
        type: Schema.Types.ObjectId,
        ref: 'Product',
        validate: {
            validator: function(v) {
                return mongoose.Types.ObjectId.isValid(v);
            },
            message: 'Invalid product ID'
        }
    }],
    // Description
    description: {
        type: String,
        required: false,
        trim: true,
        maxlength: [2000, 'Description cannot exceed 2000 characters']
    },
    // Features List
    features: [{ // Changed to lowercase 'features' for consistency
        type: String,
        required: false,
        trim: true,
        minlength: [1, 'Feature cannot be empty'],
        maxlength: [200, 'Feature cannot exceed 200 characters']
    }]
}, {
    timestamps: true, // Automatically adds createdAt and updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for scalability and performance
// Note: name field doesn't need index here as it's already indexed via schema.index() below
CollectionSchema.index({ type: 1 }); // For filtering by type
CollectionSchema.index({ createdAt: -1 }); // For sorting by newest first
CollectionSchema.index({ 'products': 1 }); // For querying collections by product

// Virtual for product count (useful for UI)
CollectionSchema.virtual('productCount').get(function() {
    return this.products ? this.products.length : 0;
});

// Pre-save middleware for additional validation
CollectionSchema.pre('save', function(next) {
    // Ensure unique products if needed (optional, based on business logic)
    if (this.products && this.products.length !== new Set(this.products.map(p => p.toString())).size) {
        return next(new Error('Duplicate products are not allowed in a collection'));
    }
    
    // Additional custom logic can go here
    next();
});

const Collection = model('Collection', CollectionSchema);

module.exports = Collection;