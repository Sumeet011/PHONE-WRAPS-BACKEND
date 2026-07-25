const mongoose = require('mongoose');
const { Schema, model } = mongoose;

/**
 * Group Schema
 * Represents a group that contains only gaming collections.
 * Enforces data integrity and industry-level best practices.
 */
const groupSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Group name is required'],
      trim: true,
      minlength: [1, 'Group name cannot be empty'],
      maxlength: [100, 'Group name must be at most 100 characters'],
      unique: true,
    },
    collections: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Collection',
      },
    ],
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description must be at most 500 characters'],
      default: '',
    },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt
    versionKey: false,
  }
);

// Index for fast lookup by name
groupSchema.index({ name: 1 });

const Group = model('Group', groupSchema);

module.exports = Group;