const { Schema, model } = require('mongoose');

// Custom validator for URL format
const isValidUrl = (url) => {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
};

// Custom validator for hex color codes
const isValidHexColor = (hex) => /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex);

const ProductSchema = new Schema({
    // Basic Product Information
    name: {
        type: String,
        required: [true, 'Product name is required'],
        trim: true,
        minlength: [1, 'Product name cannot be empty'],
        maxlength: [200, 'Product name cannot exceed 200 characters'],
        validate: {
            validator: function(v) {
                return /^[a-zA-Z0-9\s\-_.&]+$/.test(v); // Allow alphanumeric, spaces, hyphens, underscores, dots, ampersands
            },
            message: 'Product name contains invalid characters'
        }
    },
    type: {
        type: String,
        required: [true, 'Product type is required'], // Made required for clarity
        trim: true,
        maxlength: [100, 'Product type cannot exceed 100 characters'],
        enum: {
            values: ['swap-wrap', 'gaming', 'normal', 'other'],
            message: 'Invalid product type'
        },
        default: 'other'
    },
    quantity: {
        type: Number,
        required: function (){
            return this.type==='other'; // Quantity is required only for 'other' type products  
        },
        min: [0, 'Quantity cannot be negative']
    },
    level: {
        type: String,
        required: function() {
            return this.type === 'gaming'; // Required only for gaming type
        },
        sparse: true, // Allow multiple null/undefined values, only enforce uniqueness for non-null values
        trim: true,
        maxlength: [2, 'Level cannot exceed 2 characters'],
        validate: {
            validator: function(v) {
                return !v || /^[A-Z0-9]{1,2}$/i.test(v); // Optional, but if present, 1-2 alphanumeric chars
            },
            message: 'Level must be 1-2 alphanumeric characters'
        }
    },
    description: {
        type: String,
        required: false,
        trim: true,
        maxlength: [2000, 'Description cannot exceed 2000 characters']
    },
    // Product Categories
    category: {
        type: String,
        required: [true, 'Category is required'],
        enum: {
            values: ['Phone Case', 'Phone Skin', 'Screen Protector', 'Full Body Wrap', 'Camera Protector', 'Combo Pack'],
            message: 'Invalid category'
        }
    },
    // Material & Quality
    material: {
        type: String,
        required: [true, 'Material is required'],
        enum: {
            values: ['TPU', 'Silicone', 'Polycarbonate', 'Leather', 'PU Leather', 'Metal', 'Vinyl', 'Tempered Glass', 'Hybrid', 'Aramid Fiber'],
            message: 'Invalid material'
        }
    },
    finish: {
        type: String,
        required: false,
        enum: {
            values: ['Matte', 'Glossy', 'Textured', 'Transparent', 'Metallic', 'Carbon Fiber', 'Wood Grain'],
            message: 'Invalid finish'
        }
    },
    // Design & Appearance
    design: {
        type: {
            type: String,
            required: [true, 'Design type is required'],
            enum: {
                values: ['Solid Color', 'Pattern', 'Custom Print', 'Transparent', 'Gradient', 'Marble', 'Artistic', 'Brand Logo'],
                message: 'Invalid design type'
            }
        },
        color: {
            primary: {
                type: String,
                required: [true, 'Primary color is required'],
                trim: true,
                minlength: [1, 'Primary color cannot be empty'],
                maxlength: [50, 'Primary color cannot exceed 50 characters']
            },
            secondary: {
                type: String,
                required: false,
                trim: true,
                maxlength: [50, 'Secondary color cannot exceed 50 characters']
            },
            hexCode: {
                type: String,
                required: false,
                validate: {
                    validator: function(v) {
                        return !v || isValidHexColor(v);
                    },
                    message: 'Invalid hex color code'
                }
            }
        },
        pattern: {
            type: String,
            required: false,
            trim: true,
            maxlength: [100, 'Pattern description cannot exceed 100 characters']
        },
        customizable: {
            type: Boolean,
            default: false
        }
    },
    // Pricing - Required for non-gaming/custom types, optional otherwise
   coverprice: {
        type: Number,
        required: false,
        min: [0, 'Price cannot be negative'],
        validate: {
            validator: function(v) {
                return v === undefined || v === null || (typeof v === 'number' && v >= 0);
            },
            message: 'Price must be a non-negative number'
        }
    },
    // Plate Price - Required only for normal-swap type
    plateprice: {
        type: Number,
        required: false,
        min: [0, 'Plate price cannot be negative'],
        validate: {
            validator: function(v) {
                return v === undefined || v === null || (typeof v === 'number' && v >= 0);
            },
            message: 'Plate price must be a non-negative number'
        }
    },
    // Phone Brands and Models - Required only for 'normal' type
    phoneBrands: [{
        brandName: {
            type: String,
            required: [true, 'Brand name is required'],
            trim: true,
            minlength: [1, 'Brand name cannot be empty'],
            maxlength: [100, 'Brand name cannot exceed 100 characters']
        },
        models: [{
            modelName: {
                type: String,
                required: [true, 'Model name is required'],
                trim: true,
                minlength: [1, 'Model name cannot be empty'],
                maxlength: [100, 'Model name cannot exceed 100 characters']
            },
            coverCount: {
                type: Number,
                required: [true, 'Cover count is required'],
                min: [0, 'Cover count cannot be negative'],
                default: 0
            }
        }]
    }],
    showInBrowseAll: {
        type: Boolean,
        default: true
    },
    // Media is a list of image URLs
    images: [{
        type: String,
        required: [true, 'At least one image is required'],
        trim: true,
        validate: {
            validator: function(v) {
                return isValidUrl(v);
            },
            message: 'Invalid image URL format'
        }
    }],
    
    // Features is a list of feature strings (optional)
    features: [{
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

// Indexes for performance
ProductSchema.index({ name: 1 }); // For searching by name
ProductSchema.index({ type: 1 }); // For filtering by type
ProductSchema.index({ category: 1 }); // For filtering by category
ProductSchema.index({ material: 1 }); // For filtering by material
ProductSchema.index({ 'design.type': 1 }); // For filtering by design type
ProductSchema.index({ 'phoneBrands.brandName': 1 }); // For querying by brand name
ProductSchema.index({ createdAt: -1 }); // For sorting by newest first

// Virtual for price (alias for coverprice for backward compatibility)
ProductSchema.virtual('price').get(function() {
    return this.coverprice;
}).set(function(value) {
    this.coverprice = value;
});

// Virtual for formatted price (if needed for display)
ProductSchema.virtual('formattedPrice').get(function() {
    return this.coverprice ? `$${this.coverprice.toFixed(2)}` : 'Price not set';
});

// Pre-save middleware for additional validation
ProductSchema.pre('save', function(next) {
    // Ensure arrays are not empty if required
    if (this.images.length === 0) {
        return next(new Error('At least one image is required'));
    }
    
    // Ensure phoneBrands is populated for 'other' type
    if (this.type === 'other' && (!this.phoneBrands || this.phoneBrands.length === 0)) {
        return next(new Error('Phone brands and models are required for other type products'));
    }
    
    // Additional custom logic can go here
    next();
});

const Product = model('Product', ProductSchema);

module.exports = Product;