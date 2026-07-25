const mongoose = require('mongoose');

const testimonialSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Customer name is required'],
    trim: true
  },
  title: {
    type: String,
    required: [true, 'Customer title/designation is required'],
    trim: true
  },
  quote: {
    type: String,
    required: [true, 'Testimonial quote is required'],
    trim: true
  },
  image: {
    type: String, // Optional customer image/avatar
    trim: true
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    default: 5
  },
  isActive: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    default: 0 // For sorting testimonials
  }
}, {
  timestamps: true
});

// Index for efficient querying
testimonialSchema.index({ isActive: 1, order: 1 });

const Testimonial = mongoose.model('Testimonial', testimonialSchema);

module.exports = Testimonial;
