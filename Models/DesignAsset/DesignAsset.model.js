const { Schema, model } = require('mongoose');

const DesignAssetSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  imageUrl: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['hero', 'banner', 'card', 'background', 'icon', 'other'],
    default: 'other'
  },
  tags: [{
    type: String,
    trim: true
  }],
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
