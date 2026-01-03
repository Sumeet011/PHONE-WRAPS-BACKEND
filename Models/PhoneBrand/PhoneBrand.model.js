const { Schema, model } = require('mongoose');

const PhoneBrandSchema = new Schema({
    brandName: {
        type: String,
        required: true,
        trim: true
    },
    models: [{
        modelName: {
            type: String,
            required: true,
            trim: true
        }
    }],
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Index for faster queries
PhoneBrandSchema.index({ brandName: 1 });
PhoneBrandSchema.index({ isActive: 1 });

const PhoneBrand = model('PhoneBrand', PhoneBrandSchema);
module.exports = PhoneBrand;
