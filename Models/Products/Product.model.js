const { Schema, model } = require('mongoose');

const ProductSchema = new Schema({
    // Basic Product Information
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    type: {
        type: String,
        required: true,
        enum: ['gaming','Standard']
    },
    level:{
        type: String,
        required: false,
        maxlength: 2
    },
    description: {
        type: String,
        required: false,
        maxlength: 2000
    },
    // Product Categories
    category: {
        type: String,
        required: true,
        enum: ['Phone Case', 'Phone Skin', 'Screen Protector', 'Full Body Wrap', 'Camera Protector', 'Combo Pack']
    },
    // Material & Quality
    material: {
        type: String,
        required: true,
        enum: ['TPU', 'Silicone', 'Polycarbonate', 'Leather', 'PU Leather', 'Metal', 'Vinyl', 'Tempered Glass', 'Hybrid', 'Aramid Fiber']
    },
    finish: {
        type: String,
        enum: ['Matte', 'Glossy', 'Textured', 'Transparent', 'Metallic', 'Carbon Fiber', 'Wood Grain']
    },
    
    // Design & Appearance
    design: {
        type: {
            type: String,
            enum: ['Solid Color', 'Pattern', 'Custom Print', 'Transparent', 'Gradient', 'Marble', 'Artistic', 'Brand Logo']
        },
        color: {
            primary: {
                type: String,
                required: true
            },
            secondary: String,
            hexCode: String
        },
        pattern: String,
        customizable: {
            type: Boolean,
            default: false
        }
    },
    // Pricing - required only for Standard products, gaming products get price from collection
    price:{
        type: Number,
        required: function() {
            return this.type === 'Standard';
        }
    },
    // Media
    image:{
        type: String,
        required: true,
    }
    ,
    reviews:[{
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5
        },
        comment: {
            type: String,
        },
    }],
    Features:[{
        type:String,
        required: true,
    }]


}, {
    timestamps: true, // Automatically adds createdAt and updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});
const Product = model('Product', ProductSchema);

module.exports = Product;