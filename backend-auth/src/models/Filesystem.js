const mongoose = require('mongoose');

const filesystemSchema = new mongoose.Schema({
  computerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Computer',
    required: true
  },

  path: {
    type: String,
    required: true
  },

  type: {
    type: String,
    required: true,
    enum: ['directory'],
    default: 'directory'
  },

  owner: {
    type: String,
    default: 'root'
  },

  permissions: {
    type: String,
    default: '755'
  },

  // Children puede contener archivos o referencias a subdirectorios
  children: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  createdAt: {
    type: Date,
    default: Date.now
  },

  modifiedAt: {
    type: Date,
    default: Date.now
  }
});

// Indices
filesystemSchema.index({ computerId: 1, path: 1 }, { unique: true });
filesystemSchema.index({ computerId: 1 });

// Método helper para agregar archivo
filesystemSchema.methods.addFile = function(filename, fileData) {
  this.children[filename] = fileData;
  this.markModified('children');
  this.modifiedAt = new Date();
  return this.save();
};

// Método helper para agregar subdirectorio (referencia)
filesystemSchema.methods.addSubdirectory = function(dirname, fsId) {
  this.children[dirname] = {
    type: 'directory_ref',
    fsId: fsId
  };
  this.markModified('children');
  this.modifiedAt = new Date();
  return this.save();
};

// Método helper para eliminar archivo/directorio
filesystemSchema.methods.removeChild = function(name) {
  delete this.children[name];
  this.markModified('children');
  this.modifiedAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Filesystem', filesystemSchema);
