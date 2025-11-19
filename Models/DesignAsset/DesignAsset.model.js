const { Schema, model } = require('mongoose');

const DesignAssetSchema = new Schema({
  imageUrl: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['hero', 'banner', 'card', 'background', 'icon', 'other'],
    default: 'other'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  usageCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

const DesignAsset = model('DesignAsset', DesignAssetSchema);

module.exports = DesignAsset;
