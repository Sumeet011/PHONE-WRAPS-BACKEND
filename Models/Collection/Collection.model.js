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
    price: {
        type: Number,
        required: function() {
            return this.type === 'gaming';
        },
        min: 0
    },
    plateprice: {
        type: Number,
        min: 0
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

const Collection = model('Collection', CollectionSchema);

module.exports = Collection;