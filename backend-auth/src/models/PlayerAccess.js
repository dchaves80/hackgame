const mongoose = require('mongoose');

const playerAccessSchema = new mongoose.Schema({
  userId: {
    type: Number,  // ID del SQL Server
    required: true
  },

  computerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Computer',
    required: true
  },

  // Credenciales conocidas por el jugador
  username: {
    type: String,
    required: true
  },

  password: {
    type: String,  // Plain text - el jugador las conoce
    required: true
  },

  hasRootAccess: {
    type: Boolean,
    default: false
  },

  // Metadata
  discoveredAt: {
    type: Date,
    default: Date.now
  },

  lastUsed: {
    type: Date,
    default: Date.now
  }
});

// Indices
playerAccessSchema.index({ userId: 1 });
playerAccessSchema.index({ computerId: 1 });
playerAccessSchema.index({ userId: 1, computerId: 1 }, { unique: true });

// Método helper para actualizar último uso
playerAccessSchema.methods.updateLastUsed = function() {
  this.lastUsed = new Date();
  return this.save();
};

module.exports = mongoose.model('PlayerAccess', playerAccessSchema);
