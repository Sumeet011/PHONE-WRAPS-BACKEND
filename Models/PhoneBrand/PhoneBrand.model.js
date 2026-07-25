const { Schema, model } = require('mongoose');

const PhoneBrandSchema = new Schema({
    brandName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100 // Add max length validation
    },
    models: [{
        modelName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100 // Add max length validation
        },
        backCoversCount: { // Fixed: backcoverscount -> backCoversCount
            type: Number,
            required: true,
            default: 0,
            min: 0 // Add minimum value validation
        },
        aluminumSheetsCount: { // Fixed: alimunumsheetscount -> aluminumSheetsCount (spelling + camelCase)
            type: Number,
            required: true,
            default: 0,
            min: 0 // Add minimum value validation
        }
    }],
}, {
    timestamps: true
});

// Index for faster queries
PhoneBrandSchema.index({ brandName: 1 });
PhoneBrandSchema.index({ isActive: 1 });
PhoneBrandSchema.index({ 'models.modelName': 1 }); // Add index for model searches

const PhoneBrand = model('PhoneBrand', PhoneBrandSchema);
module.exports = PhoneBrand;
