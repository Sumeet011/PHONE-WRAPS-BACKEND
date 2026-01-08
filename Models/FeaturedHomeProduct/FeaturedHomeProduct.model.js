const { Schema, model } = require('mongoose');

const FeaturedHomeProductSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    image: {
        type: String,
        required: true
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
FeaturedHomeProductSchema.index({ isActive: 1, displayOrder: 1 });

const FeaturedHomeProduct = model('FeaturedHomeProduct', FeaturedHomeProductSchema);

module.exports = FeaturedHomeProduct;
