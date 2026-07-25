const { Schema, model } = require('mongoose');

const SuggestedProductSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    description: {
        type: String,
        maxlength: 500
    },
    image: {
        type: String,
        default: null
    },
    isActive: {
        type: Boolean,
        default: true
    },
    displayOrder: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Index for performance
SuggestedProductSchema.index({ isActive: 1, displayOrder: 1 });

const SuggestedProduct = model('SuggestedProduct', SuggestedProductSchema);

module.exports = SuggestedProduct;
