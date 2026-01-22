const mongoose = require('mongoose');

const computerSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['player_pc', 'npc_server', 'router', 'bank_server']
  },

  name: {
    type: String,
    required: true
  },

  ip: {
    type: String,
    required: true,
    unique: true
  },

  hardware: {
    cpu: {
      model: String,
      speed: Number  // Hz (Instructions Per Second) - Default: 5 KHz (QuantumX)
    },
    ram: {
      type: Number,
      required: true  // MB
    },
    // Legacy disk field (deprecated - use disks[] instead)
    disk: {
      capacity: {
        type: Number,
        required: true  // MB
      },
      speed: {
        type: Number,
        default: 5  // MB/s
      }
    },
    // New multi-disk support
    disks: [{
      id: { type: String, required: true },           // 'disk0', 'disk1'
      device: { type: String, required: true },       // 'sda', 'sdb', 'nvme0n1'
      name: { type: String },                         // 'Samsung SSD 980 PRO'
      type: {
        type: String,
        enum: ['ssd', 'hdd', 'nvme', 'usb'],
        default: 'hdd'
      },
      capacity: { type: Number, required: true },     // MB total
      speed: { type: Number, default: 100 },          // MB/s
      partitions: [{
        device: { type: String, required: true },     // 'sda1', 'sda2'
        mountPoint: { type: String, required: true }, // '/', '/home', '/mnt/usb'
        size: { type: Number, required: true },       // MB
        filesystem: { type: String, default: 'ext4' }
      }]
    }],
    gpu: {
      model: String,
      power: Number
    },
    network: {
      speed: Number,  // Mbps
      ping: Number    // ms
    }
  },

  accounts: [{
    username: {
      type: String,
      required: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    permissions: {
      type: String,
      enum: ['user', 'admin', 'root'],
      default: 'user'
    }
  }],

  filesystemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Filesystem',
    required: false
  },

  npcOwner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NPC',
    default: null
  },

  security: {
    hasFirewall: {
      type: Boolean,
      default: false
    },
    encryptionLevel: {
      type: Number,
      default: 0
    },
    ports: [{
      number: Number,
      service: String,
      open: Boolean
    }]
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index para búsquedas rápidas
computerSchema.index({ ip: 1 });
computerSchema.index({ type: 1 });

module.exports = mongoose.model('Computer', computerSchema);
