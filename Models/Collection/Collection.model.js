const { Schema, model } = require("mongoose");

const CollectionSchema = new Schema({
    name: {
        type: String,
        required: true,
    },
    type: {
        type: String,
        enum: ['gaming', 'normal'],
        default: 'normal',
        required: true,
    },
    heroImage: {
        type: String,
        default: null,
    },
    Products:[{
        type: Schema.Types.ObjectId,
        ref: 'Product'
    }],
    description: {
        type: String,
    },
    Features:[{
        type: String,
    }],
    reviews:[{
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5
        },
        comment: {
            type: String,
        },
    }]
}, {
    timestamps: true
});

// Indexes for better query performance
CollectionSchema.index({ name: 1 });
CollectionSchema.index({ type: 1 });
CollectionSchema.index({ createdAt: -1 });
CollectionSchema.index({ name: 'text', description: 'text' }); // Text search

const Collection = model('Collection', CollectionSchema);

module.exports = Collection;