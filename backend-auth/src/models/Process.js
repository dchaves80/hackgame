const mongoose = require('mongoose');

const processSchema = new mongoose.Schema({
  pid: {
    type: Number,
    required: true
  },

  name: {
    type: String,
    required: true
  },

  user: {
    type: String,
    required: true,
    default: 'root'
  },

  cpu: {
    type: Number,
    default: 0.0  // Percentage
  },

  mem: {
    type: Number,
    default: 0.0  // Percentage
  },

  status: {
    type: String,
    enum: ['running', 'sleeping', 'stopped', 'zombie'],
    default: 'running'
  },

  type: {
    type: String,
    enum: ['system', 'service', 'user', 'malware', 'exploit'],
    default: 'system'
  },

  computerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Computer',
    required: true
  },

  // For services - which port they listen on
  port: {
    type: Number,
    default: null
  },

  // Can this process be killed by non-root?
  protected: {
    type: Boolean,
    default: false
  },

  // Who started this process (for tracking malware origin)
  startedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  startTime: {
    type: Date,
    default: Date.now
  }
});

// Compound index for efficient queries
processSchema.index({ computerId: 1, pid: 1 }, { unique: true });
processSchema.index({ computerId: 1, type: 1 });

// Static method to get next PID for a computer
processSchema.statics.getNextPid = async function(computerId) {
  const lastProcess = await this.findOne({ computerId })
    .sort({ pid: -1 })
    .select('pid');
  return lastProcess ? lastProcess.pid + 1 : 1;
};

// Static method to initialize default processes for a computer
processSchema.statics.initializeDefaults = async function(computerId, computerType) {
  const defaults = getDefaultProcesses(computerType);
  const processes = defaults.map((p, index) => ({
    ...p,
    pid: index + 1,
    computerId,
    startTime: new Date(Date.now() - Math.random() * 86400000) // Random start in last 24h
  }));

  await this.insertMany(processes);
  return processes;
};

// Default processes by computer type
function getDefaultProcesses(computerType) {
  const base = [
    { name: 'init', user: 'root', cpu: 0.0, mem: 0.1, type: 'system', protected: true },
    { name: 'kernel', user: 'root', cpu: 0.1, mem: 0.5, type: 'system', protected: true, status: 'sleeping' },
  ];

  const shell = { name: 'shell', user: 'user', cpu: 0.0, mem: 0.3, type: 'user' };

  switch (computerType) {
    case 'player_pc':
      return [
        ...base,
        { name: 'desktop', user: 'user', cpu: 1.2, mem: 4.5, type: 'system' },
        { name: 'network-manager', user: 'root', cpu: 0.1, mem: 0.8, type: 'service', status: 'sleeping' },
        shell,
      ];

    case 'npc_server':
      return [
        ...base,
        { name: 'sshd', user: 'root', cpu: 0.0, mem: 0.2, type: 'service', port: 22, protected: true },
        { name: 'httpd', user: 'www', cpu: 0.5, mem: 2.1, type: 'service', port: 80 },
        { name: 'cron', user: 'root', cpu: 0.0, mem: 0.1, type: 'system', status: 'sleeping' },
      ];

    case 'bank_server':
      return [
        ...base,
        { name: 'sshd', user: 'root', cpu: 0.0, mem: 0.2, type: 'service', port: 22, protected: true },
        { name: 'httpd', user: 'www', cpu: 1.2, mem: 3.5, type: 'service', port: 443 },
        { name: 'postgres', user: 'postgres', cpu: 2.1, mem: 8.2, type: 'service', port: 5432 },
        { name: 'firewall', user: 'root', cpu: 0.3, mem: 1.0, type: 'service', protected: true },
        { name: 'ids', user: 'root', cpu: 0.8, mem: 2.5, type: 'service', protected: true }, // Intrusion Detection
        { name: 'cron', user: 'root', cpu: 0.0, mem: 0.1, type: 'system', status: 'sleeping' },
      ];

    case 'router':
      return [
        ...base,
        { name: 'routing', user: 'root', cpu: 0.2, mem: 0.5, type: 'service', protected: true },
        { name: 'dhcpd', user: 'root', cpu: 0.0, mem: 0.2, type: 'service', port: 67 },
        { name: 'firewall', user: 'root', cpu: 0.1, mem: 0.3, type: 'service', protected: true },
      ];

    default:
      return [...base, shell];
  }
}

module.exports = mongoose.model('Process', processSchema);
