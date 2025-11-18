const { Schema, model } = require("mongoose");

const CollectionSchema = new Schema({
    name: {
        type: String,
        required: true,
    },
    Products:[{
        type: Schema.Types.ObjectId,
        ref: 'Product'
    }],
    description: {
        type: String,
        required: true,
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