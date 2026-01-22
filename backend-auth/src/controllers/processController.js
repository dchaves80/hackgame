const PlayerAccess = require('../models/PlayerAccess');
const Process = require('../models/Process');
const socketService = require('../services/socketService');

/**
 * Create a new process (for windows/applications)
 */
exports.createProcess = async (req, res) => {
  try {
    const { name, type = 'user' } = req.body;
    const userId = req.user.userId;

    if (!name) {
      return res.status(400).json({ error: 'Process name is required' });
    }

    // Get player's current computer
    const playerAccess = await PlayerAccess.findOne({ userId }).populate('computerId');
    if (!playerAccess) {
      return res.status(404).json({ error: 'No active computer session' });
    }

    const computer = playerAccess.computerId;

    // Get next PID for this computer
    const pid = await Process.getNextPid(computer._id);

    // Create the process
    const process = await Process.create({
      pid,
      name,
      user: playerAccess.username,
      computerId: computer._id,
      type,
      status: 'running',
      cpu: Math.random() * 2,  // Random CPU usage 0-2%
      mem: Math.random() * 3   // Random MEM usage 0-3%
    });

    // Emit event to all users on this computer
    socketService.emitToComputer(computer._id, 'process:created', {
      pid: process.pid,
      name: process.name,
      user: process.user,
      type: process.type
    });

    res.json({
      pid: process.pid,
      processId: process._id,
      name: process.name
    });

  } catch (error) {
    console.error('Create process error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Delete a process by PID
 */
exports.deleteProcess = async (req, res) => {
  try {
    const { pid } = req.params;
    const userId = req.user.userId;

    // Get player's current computer
    const playerAccess = await PlayerAccess.findOne({ userId }).populate('computerId');
    if (!playerAccess) {
      return res.status(404).json({ error: 'No active computer session' });
    }

    const computer = playerAccess.computerId;

    // Find the process
    const process = await Process.findOne({
      computerId: computer._id,
      pid: parseInt(pid)
    });

    if (!process) {
      return res.status(404).json({ error: `Process ${pid} not found` });
    }

    // Check if process is protected
    if (process.protected && !playerAccess.hasRootAccess) {
      return res.status(403).json({ error: `Cannot kill protected process: ${process.name}` });
    }

    // Delete the process
    await Process.deleteOne({ _id: process._id });

    // Emit event to all users on this computer
    socketService.emitToComputer(computer._id, 'process:killed', {
      pid: parseInt(pid),
      name: process.name
    });

    res.json({
      success: true,
      message: `Process ${pid} (${process.name}) terminated`
    });

  } catch (error) {
    console.error('Delete process error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * List all processes for current computer
 */
exports.listProcesses = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get player's current computer
    const playerAccess = await PlayerAccess.findOne({ userId }).populate('computerId');
    if (!playerAccess) {
      return res.status(404).json({ error: 'No active computer session' });
    }

    const computer = playerAccess.computerId;

    // Get all processes
    const processes = await Process.find({
      computerId: computer._id
    }).sort({ pid: 1 });

    res.json({
      processes: processes.map(p => ({
        pid: p.pid,
        name: p.name,
        user: p.user,
        cpu: p.cpu,
        mem: p.mem,
        status: p.status,
        type: p.type
      }))
    });

  } catch (error) {
    console.error('List processes error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Kill a process (alias for delete, used by kill command)
 */
exports.killProcess = async (req, res) => {
  // Reuse deleteProcess logic
  return exports.deleteProcess(req, res);
};
