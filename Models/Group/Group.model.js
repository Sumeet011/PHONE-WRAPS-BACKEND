const {Schema, model} = require('mongoose');

const groupSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  members: [{
    type: Schema.Types.ObjectId,
    ref: 'Collection',
  }],
}, {
  timestamps: true,
});

const Group = model('Group', groupSchema);

module.exports = Group;