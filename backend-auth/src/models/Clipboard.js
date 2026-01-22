const mongoose = require('mongoose');

const clipboardSchema = new mongoose.Schema({
  userId: {
    type: Number,
    required: true,
    index: true
  },
  computerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Computer',
    required: true
  },
  sourcePath: {
    type: String,
    required: true
  },
  itemName: {
    type: String,
    required: true
  },
  itemType: {
    type: String,
    enum: ['text', 'source', 'binary', 'directory'],
    required: true
  },
  operation: {
    type: String,
    enum: ['copy', 'cut'],
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Solo un clipboard por usuario
clipboardSchema.index({ userId: 1 }, { unique: true });

const Clipboard = mongoose.model('Clipboard', clipboardSchema);

module.exports = Clipboard;
