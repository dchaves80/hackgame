/**
 * Worker Pool - Manages a pool of VM worker threads
 * Provides execute() method that handles worker lifecycle and IPC
 */

const { Worker } = require('worker_threads');
const path = require('path');
const ioHandler = require('./io-handler');

class WorkerPool {
  constructor(size = 4) {
    this.size = size;
    this.workers = [];
    this.available = [];
    this.pending = [];
    this.initialized = false;
    // Track active commands: pid -> { worker, commandId, computerId, aborted }
    this.activeCommands = new Map();
  }

  /**
   * Initialize the worker pool
   */
  initialize() {
    if (this.initialized) return;

    for (let i = 0; i < this.size; i++) {
      const worker = new Worker(path.join(__dirname, 'vm-worker.js'));
      worker.id = i;
      this.workers.push(worker);
      this.available.push(worker);
    }

    this.initialized = true;
    console.log(`🔧 Worker pool initialized with ${this.size} workers`);
  }

  /**
   * Get an available worker (or wait for one)
   */
  async getWorker() {
    if (!this.initialized) {
      this.initialize();
    }

    if (this.available.length > 0) {
      return this.available.pop();
    }

    // Wait for a worker to become available
    return new Promise(resolve => {
      this.pending.push(resolve);
    });
  }

  /**
   * Release a worker back to the pool
   */
  releaseWorker(worker) {
    // Remove all listeners to avoid memory leaks
    worker.removeAllListeners('message');
    worker.removeAllListeners('error');

    if (this.pending.length > 0) {
      // Someone is waiting for a worker
      const resolve = this.pending.shift();
      resolve(worker);
    } else {
      this.available.push(worker);
    }
  }

  /**
   * Execute bytecode in a worker
   * @param {Object} bytecode - Compiled Syscript bytecode
   * @param {Array} args - Command arguments
   * @param {Object} context - { workingDir, userId, computerId }
   * @param {number} cpuSpeed - CPU speed in Hz
   * @param {string} commandId - Command ID for WebSocket correlation
   * @param {number} pid - Process ID for kill tracking
   * @param {Function} onOutput - Callback for each output line
   * @returns {Promise<Object>} Execution result
   */
  async execute(bytecode, args, context, cpuSpeed, commandId, pid, onOutput) {
    const worker = await this.getWorker();
    const timeout = 30000; // 30 second inactivity timeout
    const computerId = context.computerId.toString();

    // Register this command for kill tracking
    const commandKey = `${computerId}:${pid}`;
    this.activeCommands.set(commandKey, {
      worker,
      commandId,
      computerId,
      pid,
      aborted: false
    });

    return new Promise((resolve, reject) => {
      let timeoutId;

      const cleanup = () => {
        clearTimeout(timeoutId);
        this.activeCommands.delete(commandKey);
        this.releaseWorker(worker);
      };

      // Reset timeout on activity
      const resetTimeout = () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          cleanup();
          reject(new Error('Command execution timed out (no activity for 30s)'));
        }, timeout);
      };

      // Set initial timeout
      resetTimeout();

      // Handle messages from worker
      worker.on('message', async (msg) => {
        // Reset timeout on ANY message from worker (activity detected)
        resetTimeout();

        try {
          switch (msg.type) {
            case 'output':
              // Forward output to callback for WebSocket streaming
              if (onOutput) {
                onOutput(msg.line);
              }
              break;

            case 'io-request':
              // Execute I/O operation in main thread
              try {
                const result = await this.handleIO(context.computerId, context.workingDir, context.userId, msg.operation, msg.params);
                worker.postMessage({
                  type: 'io-response',
                  id: msg.id,
                  result
                });
              } catch (error) {
                worker.postMessage({
                  type: 'io-response',
                  id: msg.id,
                  error: error.message
                });
              }
              break;

            case 'complete':
              cleanup();
              resolve(msg.result);
              break;

            case 'aborted':
              cleanup();
              resolve({
                output: msg.result?.output || '',
                exitCode: 137,  // Killed by signal
                killed: true,
                affectedPaths: msg.result?.affectedPaths || []
              });
              break;

            case 'error':
              cleanup();
              reject(new Error(msg.error));
              break;
          }
        } catch (error) {
          cleanup();
          reject(error);
        }
      });

      // Handle worker errors
      worker.on('error', (error) => {
        cleanup();
        reject(error);
      });

      // Send execute message to worker
      worker.postMessage({
        type: 'execute',
        bytecode,
        args,
        context: {
          workingDir: context.workingDir,
          userId: context.userId,
          computerId
        },
        cpuSpeed,
        commandId
      });
    });
  }

  /**
   * Kill a running command by PID
   * @param {string} computerId - Computer ID
   * @param {number} pid - Process ID to kill
   * @returns {boolean} True if command was found and killed
   */
  killCommand(computerId, pid) {
    const commandKey = `${computerId}:${pid}`;
    const command = this.activeCommands.get(commandKey);

    if (!command) {
      return false; // Command not found or already finished
    }

    // Mark as aborted and send abort signal to worker
    command.aborted = true;
    command.worker.postMessage({ type: 'abort' });

    console.log(`🔪 Kill signal sent to PID ${pid} on computer ${computerId}`);
    return true;
  }

  /**
   * Check if a command is running
   */
  isCommandRunning(computerId, pid) {
    const commandKey = `${computerId}:${pid}`;
    return this.activeCommands.has(commandKey);
  }

  /**
   * Handle I/O request from worker
   */
  async handleIO(computerId, workingDir, userId, operation, params) {
    switch (operation) {
      case 'readFile':
        return await ioHandler.readFile(computerId, params.workingDir || workingDir, params.filePath);

      case 'writeFile':
        return await ioHandler.writeFile(computerId, params.workingDir || workingDir, params.filePath, params.content, params.append);

      case 'deleteFile':
        return await ioHandler.deleteFile(computerId, params.workingDir || workingDir, params.filePath);

      case 'fileExists':
        return await ioHandler.fileExists(computerId, params.workingDir || workingDir, params.filePath);

      case 'createFile':
        return await ioHandler.createFile(computerId, params.workingDir || workingDir, params.filePath, userId);

      case 'makeDir':
        return await ioHandler.makeDir(computerId, params.workingDir || workingDir, params.dirPath, userId);

      case 'removeDir':
        return await ioHandler.removeDir(computerId, params.workingDir || workingDir, params.dirPath);

      case 'copyFile':
        return await ioHandler.copyFile(computerId, params.workingDir || workingDir, params.srcPath, params.destPath);

      case 'listDirectory':
        return await ioHandler.listDirectory(computerId, params.workingDir || workingDir, params.targetPath);

      case 'changeDirectory':
        return await ioHandler.changeDirectory(computerId, params.workingDir || workingDir, params.targetPath);

      case 'listProcesses':
        return await ioHandler.listProcesses(computerId);

      case 'killProcess':
        return await ioHandler.killProcess(computerId, params.pid);

      case 'getDisksUsage':
        return await ioHandler.getDisksUsage(computerId);

      default:
        throw new Error(`Unknown I/O operation: ${operation}`);
    }
  }

  /**
   * Shutdown all workers
   */
  shutdown() {
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers = [];
    this.available = [];
    this.initialized = false;
    console.log('🔧 Worker pool shutdown');
  }

  /**
   * Get pool status
   */
  getStatus() {
    return {
      total: this.size,
      available: this.available.length,
      busy: this.size - this.available.length,
      pending: this.pending.length
    };
  }
}

// Export singleton instance
const pool = new WorkerPool(4);

// Cleanup on process exit (fixes nodemon restart issues)
const cleanup = () => {
  if (pool.initialized) {
    pool.shutdown();
  }
};

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);
process.on('exit', cleanup);

// For nodemon specifically
process.once('SIGUSR2', () => {
  cleanup();
  process.kill(process.pid, 'SIGUSR2');
});

module.exports = pool;
