const PlayerAccess = require('../models/PlayerAccess');
const Filesystem = require('../models/Filesystem');
const Process = require('../models/Process');
const workerPool = require('../syscript/worker-pool');
const { v4: uuidv4 } = require('uuid');
const socketService = require('../services/socketService');

// Terminal sessions (in-memory for now)
// Structure: { userId-computerId: { workingDir } }
const sessions = {};

/**
 * Parse redirection from command line
 * Returns: { command, args, redirection: { type: '>' | '>>', file } | null }
 */
function parseRedirection(command, args) {
  // Check if redirection is in args
  let allParts = [command, ...(args || [])];
  let redirectType = null;
  let redirectFile = null;
  let cleanArgs = [];

  for (let i = 0; i < allParts.length; i++) {
    const part = allParts[i];

    // Check for >> first (before >)
    if (part === '>>') {
      redirectType = '>>';
      redirectFile = allParts[i + 1];
      i++; // Skip next part (the filename)
      continue;
    }

    if (part === '>') {
      redirectType = '>';
      redirectFile = allParts[i + 1];
      i++; // Skip next part (the filename)
      continue;
    }

    // Check for attached redirection: ">>file" or ">file"
    if (part.startsWith('>>')) {
      redirectType = '>>';
      redirectFile = part.substring(2);
      continue;
    }

    if (part.startsWith('>')) {
      redirectType = '>';
      redirectFile = part.substring(1);
      continue;
    }

    // Normal argument
    if (i === 0) {
      // This is the command, skip adding to args
    } else {
      cleanArgs.push(part);
    }
  }

  return {
    command: allParts[0],
    args: cleanArgs,
    redirection: redirectType && redirectFile ? { type: redirectType, file: redirectFile } : null
  };
}

/**
 * Execute terminal command
 */
exports.executeCommand = async (req, res) => {
  try {
    let { command, args, computerId: requestComputerId } = req.body;
    const userId = req.user.userId;

    // Parse redirection (>, >>)
    const parsed = parseRedirection(command, args);
    command = parsed.command;
    args = parsed.args;
    const redirection = parsed.redirection;

    // Get computer - prefer computerId from request, fallback to playerAccess
    let computer;
    if (requestComputerId) {
      // Use computerId from frontend - verify user has access
      const Computer = require('../models/Computer');
      computer = await Computer.findById(requestComputerId);
      if (!computer) {
        return res.status(404).json({ error: 'Computer not found' });
      }
      // TODO: Add access validation here if needed
    } else {
      // Fallback to playerAccess
      const playerAccess = await PlayerAccess.findOne({ userId }).populate('computerId');
      if (!playerAccess) {
        return res.status(404).json({ error: 'No active computer session' });
      }
      computer = playerAccess.computerId;
    }

    // Get or create terminal session
    const sessionKey = `${userId}-${computer._id}`;
    if (!sessions[sessionKey]) {
      sessions[sessionKey] = {
        workingDir: `/home/${req.user.username}`
      };
    }
    const session = sessions[sessionKey];

    // Get root filesystem for this computer
    const filesystem = await Filesystem.findOne({
      computerId: computer._id,
      path: '/'
    });
    if (!filesystem) {
      return res.status(404).json({ error: 'Filesystem not found' });
    }

    // Search for binary in PATH
    const binaryPath = await findBinary(filesystem, session.workingDir, command);

    if (!binaryPath) {
      return res.json({
        output: `${command}: command not found`,
        workingDir: session.workingDir,
        exitCode: 127
      });
    }

    // Load bytecode from binary
    const bytecode = await loadBytecode(binaryPath, filesystem);

    if (!bytecode) {
      return res.json({
        output: `${command}: cannot execute binary file`,
        workingDir: session.workingDir,
        exitCode: 126
      });
    }

    // Create ephemeral process for this command
    const pid = await Process.getNextPid(computer._id);
    const ephemeralProcess = await Process.create({
      pid,
      name: command,
      user: req.user.username,
      computerId: computer._id,
      type: 'user',
      status: 'running',
      cpu: Math.random() * 0.5,
      mem: Math.random() * 0.5
    });

    // Generate commandId for WebSocket streaming
    const commandId = req.body.commandId || uuidv4();
    const computerId = computer._id.toString();

    // Get CPU speed from computer hardware (Hz = IPS)
    // Default: 2.5 KHz (SpudCore 2500) - see vm-worker.js for tier list
    const cpuSpeed = computer.hardware?.cpu?.speed || 2500;
    console.log(`[CPU] Using speed: ${cpuSpeed} Hz (${computer.hardware?.cpu?.model || 'unknown'})`);

    // Syscript expects args as args[0] = array of command arguments
    const vmArgs = [args || []];

    // Execute bytecode in worker pool with streaming callback
    let result;
    try {
      result = await workerPool.execute(
        bytecode,
        vmArgs,
        {
          workingDir: session.workingDir,
          userId,
          computerId: computer._id
        },
        cpuSpeed,
        commandId,
        pid,  // For kill tracking
        (line) => {
          // Emit each line via WebSocket in real-time
          socketService.emitToComputer(computerId, 'terminal:output', {
            commandId,
            line,
            timestamp: Date.now()
          });
        }
      );
    } finally {
      // Always delete ephemeral process after execution
      await Process.deleteOne({ _id: ephemeralProcess._id });
    }

    // Update session working directory if changed
    if (result.newWorkingDir) {
      session.workingDir = result.newWorkingDir;
    }

    // Handle output redirection
    if (redirection && result.output) {
      try {
        // Resolve the redirect file path
        let redirectPath = redirection.file;
        if (!redirectPath.startsWith('/')) {
          redirectPath = `${session.workingDir}/${redirectPath}`.replace(/\/+/g, '/');
        }

        // Use VM's writeFile functionality
        const redirectVm = new SyscriptVM({
          workingDir: session.workingDir,
          userId,
          computerId: computer._id,
          filesystem
        });

        const append = redirection.type === '>>';
        await redirectVm.writeFile(redirectPath, result.output + '\n', append);

        // Return empty output since it was redirected
        // Combine affectedPaths from command and redirect
        const allAffectedPaths = [...(result.affectedPaths || [])];
        const { dirPath: redirectDirPath } = redirectVm.resolvePath(redirectPath);
        allAffectedPaths.push(redirectDirPath);

        res.json({
          output: '',
          workingDir: session.workingDir,
          exitCode: result.exitCode,
          affectedPaths: [...new Set(allAffectedPaths)]
        });
      } catch (redirectError) {
        res.json({
          output: `${command}: ${redirectError.message}`,
          workingDir: session.workingDir,
          exitCode: 1
        });
      }
      return;
    }

    res.json({
      commandId,
      output: result.output,
      workingDir: session.workingDir,
      exitCode: result.exitCode,
      affectedPaths: result.affectedPaths || [],
      clear: result.clear || false
    });

  } catch (error) {
    console.error('Terminal execute error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get current terminal session info
 */
exports.getSession = async (req, res) => {
  try {
    const userId = req.user.userId;
    const requestComputerId = req.query.computerId;

    // Get computer - prefer computerId from request, fallback to playerAccess
    let computer;
    if (requestComputerId) {
      const Computer = require('../models/Computer');
      computer = await Computer.findById(requestComputerId);
      if (!computer) {
        return res.status(404).json({ error: 'Computer not found' });
      }
    } else {
      const playerAccess = await PlayerAccess.findOne({ userId }).populate('computerId');
      if (!playerAccess) {
        return res.status(404).json({ error: 'No active computer session' });
      }
      computer = playerAccess.computerId;
    }

    const sessionKey = `${userId}-${computer._id}`;

    if (!sessions[sessionKey]) {
      sessions[sessionKey] = {
        workingDir: `/home/${req.user.username}`
      };
    }

    res.json({
      workingDir: sessions[sessionKey].workingDir,
      hostname: computer.name,
      username: req.user.username
    });

  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Find binary in PATH
 * Search order: ./ -> /bin -> /usr/bin
 */
async function findBinary(filesystem, workingDir, command) {
  const searchPaths = [
    `${workingDir}/${command}`,  // Current directory
    `/bin/${command}`,            // /bin
    `/usr/bin/${command}`         // /usr/bin
  ];

  for (const searchPath of searchPaths) {
    if (await fileExists(filesystem, searchPath)) {
      return searchPath;
    }
  }

  return null;
}

/**
 * Check if file exists in filesystem
 */
async function fileExists(filesystem, filePath) {
  try {
    const parts = filePath.split('/').filter(p => p);
    let currentFs = filesystem;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      if (!currentFs.children || !currentFs.children[part]) {
        return false;
      }

      const child = currentFs.children[part];

      // Last part - check if it's a file
      if (i === parts.length - 1) {
        return child.type === 'systemBinary' || child.type === 'binary';
      }

      // Directory navigation - need to load the subdirectory
      if (child.type === 'directory_ref') {
        // Load subdirectory document
        const subdir = await Filesystem.findById(child.fsId);
        if (!subdir) return false;
        currentFs = subdir;
      } else {
        // Inline directory (shouldn't happen for binaries in /bin)
        return false;
      }
    }

    return false;
  } catch (error) {
    console.error('fileExists error:', error);
    return false;
  }
}

/**
 * Load bytecode from binary file
 */
async function loadBytecode(binaryPath, filesystem) {
  try {
    // Get file from filesystem
    const parts = binaryPath.split('/').filter(p => p);
    let currentFs = filesystem;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      if (!currentFs.children || !currentFs.children[part]) {
        return null;
      }

      const child = currentFs.children[part];

      if (i === parts.length - 1) {
        // Found the file
        if (child.bytecode) {
          // Bytecode stored directly in file
          return typeof child.bytecode === 'string'
            ? JSON.parse(child.bytecode)
            : child.bytecode;
        }
        return null;
      }

      // Navigate directory - need to load the subdirectory document
      if (child.type === 'directory_ref') {
        const subdir = await Filesystem.findById(child.fsId);
        if (!subdir) return null;
        currentFs = subdir;
      } else {
        // Inline directory (shouldn't happen for /bin)
        return null;
      }
    }

    return null;
  } catch (error) {
    console.error('loadBytecode error:', error);
    return null;
  }
}
