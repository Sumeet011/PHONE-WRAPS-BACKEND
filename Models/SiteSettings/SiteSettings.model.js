const mongoose = require('mongoose');

const siteSettingsSchema = new mongoose.Schema({
  // Text Scroll Settings
  textScrollContent: {
    type: String,
    default: 'Phone Wraps  ',
    required: true
  },
  textScrollVelocity: {
    type: Number,
    default: 5,
    required: true
  },

  // Collections Section (Used in ProductCard.tsx)
  collectionsTitle: {
    type: String,
    default: 'BROWSE ALL COLLECTIONS'
  },
  gamingCollectionsLimit: {
    type: Number,
    default: 1,
    min: 1,
    max: 20
  },
  nonGamingCollectionsLimit: {
    type: Number,
    default: 10,
    min: 1,
    max: 20
  },

  // Circular Gallery Section (Used in Circularcontent.jsx)
  circularGalleryTitle: {
    type: String,
    default: 'WELCOME TO MYSTERY WORLD'
  },

  // Products Section (Used in HorizontalScroll.tsx)
  productsTitle: {
    type: String,
    default: 'BROWSE ALL PRODUCTS'
  },
  productsPerRow: {
    type: Number,
    default: 41,
    min: 1,
    max: 100
  },
  productsRows: {
    type: Number,
    default: 2,
    min: 1,
    max: 10
  },

  // Section Visibility Settings (Used in ProductCard.tsx)
  showGamingSection: {
    type: Boolean,
    default: true
  },
  showNonGamingSection: {
    type: Boolean,
    default: true
  },

  // Singleton pattern - only one settings document
  _id: {
    type: String,
    default: 'site_settings'
  }
}, {
  timestamps: true,
  collection: 'sitesettings'
});

// Ensure only one settings document exists
siteSettingsSchema.statics.getSettings = async function() {
  let settings = await this.findById('site_settings');
  if (!settings) {
    settings = await this.create({ _id: 'site_settings' });
  }
  return settings;
};

siteSettingsSchema.statics.updateSettings = async function(updates) {
  const settings = await this.getSettings();
  Object.keys(updates).forEach(key => {
    if (updates[key] !== undefined && settings.schema.paths[key]) {
      settings[key] = updates[key];
    }
  });
  await settings.save();
  return settings;
};

module.exports = mongoose.model('SiteSettings', siteSettingsSchema);
