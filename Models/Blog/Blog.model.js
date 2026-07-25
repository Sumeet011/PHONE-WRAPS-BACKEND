const mongoose = require('mongoose');

// Content block schema for flexible blog content
const contentBlockSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['heading', 'paragraph', 'image', 'list', 'quote'],
    required: true
  },
  level: {
    type: Number, // For headings: 1, 2, 3, etc.
    min: 1,
    max: 6
  },
  content: {
    type: String // Text content for heading, paragraph, quote, or image URL
  },
  items: [{
    type: String // For list items
  }],
  alt: {
    type: String // Alt text for images
  },
  caption: {
    type: String // Caption for images
  }
}, { _id: false });

const blogSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  excerpt: {
    type: String,
    required: true,
    trim: true
  },
  // New: Rich content as array of blocks
  contentBlocks: [{
    type: contentBlockSchema
  }],
  // Keep old content field for backward compatibility
  content: {
    type: String
  },
  // Featured/cover image
  image: {
    type: String,
    required: true
  },
  // Additional images used in content
  images: [{
    url: String,
    alt: String,
    caption: String
  }],
  author: {
    type: String,
    default: 'Admin'
  },
  status: {
    type: String,
    enum: ['draft', 'published'],
    default: 'draft'
  },
  category: {
    type: String,
    default: 'General'
  },
  tags: [{
    type: String
  }],
  views: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt timestamp before saving
blogSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Blog = mongoose.model('Blog', blogSchema);

module.exports = Blog;
