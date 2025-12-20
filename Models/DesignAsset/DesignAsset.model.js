const { Schema, model } = require('mongoose');

const DesignAssetSchema = new Schema({
  imageUrl: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['HERO', 'CIRCULAR', 'CARD'],
    default: 'HERO'
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
