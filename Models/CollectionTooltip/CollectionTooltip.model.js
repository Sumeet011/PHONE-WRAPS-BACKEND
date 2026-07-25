const mongoose = require('mongoose');

const tooltipMessageSchema = new mongoose.Schema({
  quantity: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  }
}, { _id: false });

const collectionTooltipSchema = new mongoose.Schema({
  tooltips: {
    type: [tooltipMessageSchema],
    validate: {
      validator: function(tooltips) {
        // Ensure we have exactly 5 tooltips (one for each quantity 1-5)
        const quantities = tooltips.map(t => t.quantity);
        const uniqueQuantities = new Set(quantities);
        return uniqueQuantities.size === 5 && 
               quantities.length === 5 &&
               [1, 2, 3, 4, 5].every(q => quantities.includes(q));
      },
      message: 'Must have exactly one tooltip for each quantity (1-5)'
    }
  }
}, {
  timestamps: true
});

// Ensure only one document exists in this collection
collectionTooltipSchema.statics.getSingleton = async function() {
  let config = await this.findOne();
  if (!config) {
    // Create default tooltips if none exist
    config = await this.create({
      tooltips: [
        {
          quantity: 1,
          title: "⚠ Just Starting",
          message: "You have 1 card. Buy 5 cards to unlock the complete collection. Otherwise, a random card will be delivered."
        },
        {
          quantity: 2,
          title: "⚠ Making Progress",
          message: "You have 2 cards. Buy 3 more to unlock the complete collection. Otherwise, a random card will be delivered."
        },
        {
          quantity: 3,
          title: "⚠ Halfway There!",
          message: "You have 3 cards. Buy 2 more to unlock the complete collection. Otherwise, a random card will be delivered."
        },
        {
          quantity: 4,
          title: "⚠ Almost Complete",
          message: "You have 4 cards. Buy 1 more to unlock the complete collection. Otherwise, a random card will be delivered."
        },
        {
          quantity: 5,
          title: "✓ Complete Collection!",
          message: "You will receive all 5 cards from this collection."
        }
      ]
    });
  }
  return config;
};

const CollectionTooltip = mongoose.model('CollectionTooltip', collectionTooltipSchema);

module.exports = CollectionTooltip;
