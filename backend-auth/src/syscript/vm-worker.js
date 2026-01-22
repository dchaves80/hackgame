/**
 * VM Worker - Executes Syscript bytecode in a worker thread
 * Communicates with main thread for I/O operations via messages
 *
 * CPU SPEED TIERS (cpuSpeed is in Hz = Instructions Per Second):
 * ══════════════════════════════════════════════════════════════
 * Tier | Name             | Frequency  | IPS       | 1000 instr.
 * ──────────────────────────────────────────────────────────────
 *  0   | SpudCore 2500    | 2.5 KHz    | 2,500     | 400ms     ★ STARTER
 *  1   | QuantumX         | 5 KHz      | 5,000     | 200ms
 *  2   | NeuralNet 9000   | 7.5 KHz    | 7,500     | 133ms
 *  3   | SkyNet Alpha     | 10 KHz     | 10,000    | 100ms
 *  4   | CyberCore        | 15 KHz     | 15,000    | 66ms
 *  5   | Singularity      | 22 KHz     | 22,000    | 45ms
 *  6   | Event Horizon    | 33 KHz     | 33,000    | 30ms
 *  7   | Dark Matter      | 50 KHz     | 50,000    | 20ms
 *  8   | Void Engine      | 75 KHz     | 75,000    | 13ms
 *  9   | Omega Prime      | 100 KHz    | 100,000   | 10ms
 *  10  | Tesseract        | 150 KHz    | 150,000   | 6.6ms
 *  11  | Infinity Core    | 220 KHz    | 220,000   | 4.5ms
 *  12  | Multiverse       | 330 KHz    | 330,000   | 3ms
 *  13  | Reality Bender   | 500 KHz    | 500,000   | 2ms
 *  14  | Time Lord        | 750 KHz    | 750,000   | 1.3ms
 *  15  | Omniscient       | 1 MHz      | 1,000,000 | 1ms
 *  16  | GOD MODE X       | 1.5 MHz    | 1,500,000 | 0.66ms
 * ══════════════════════════════════════════════════════════════
 * Default for new users: SpudCore 2500 (2.5 KHz)
 */

const { parentPort } = require('worker_threads');
const { OPCODES, NATIVE_API } = require('./bytecode-format');

// Pending I/O requests waiting for response
const pendingIO = new Map();
let ioRequestId = 0;

// Default CPU speed for new users (SpudCore 2500)
const DEFAULT_CPU_SPEED = 2500; // 2.5 KHz = 2500 IPS

// Cycles per instruction type (for CPU speed simulation)
const INSTRUCTION_CYCLES = {
  [OPCODES.LOAD_CONST]: 1,
  [OPCODES.LOAD_ARG]: 1,
  [OPCODES.STORE_LOCAL]: 1,
  [OPCODES.LOAD_LOCAL]: 1,
  [OPCODES.GET_LENGTH]: 2,
  [OPCODES.GET_ELEMENT]: 3,
  [OPCODES.GET_PROPERTY]: 3,
  [OPCODES.ADD]: 1,
  [OPCODES.SUB]: 1,
  [OPCODES.MUL]: 2,
  [OPCODES.DIV]: 4,
  [OPCODES.MOD]: 4,
  [OPCODES.NEG]: 1,
  [OPCODES.EQ]: 1,
  [OPCODES.NEQ]: 1,
  [OPCODES.LT]: 1,
  [OPCODES.GT]: 1,
  [OPCODES.LTE]: 1,
  [OPCODES.GTE]: 1,
  [OPCODES.NOT]: 1,
  [OPCODES.AND]: 1,
  [OPCODES.OR]: 1,
  [OPCODES.JUMP_IF_FALSE]: 2,
  [OPCODES.JUMP]: 1,
  [OPCODES.CALL_NATIVE]: 10,
  [OPCODES.RETURN]: 1
};

class WorkerVM {
  constructor(cpuSpeed, commandId) {
    // cpuSpeed is in Hz (Instructions Per Second)
    // Default: 5000 Hz (QuantumX) for new users
    this.cpuSpeed = cpuSpeed || DEFAULT_CPU_SPEED;
    this.commandId = commandId;
    this.stack = [];
    this.locals = [];
    this.pc = 0;
    this.output = [];
    this.affectedPaths = new Set();
    this.clearTerminal = false;
    this.context = null;
    this.aborted = false;  // Set to true when kill signal received

    // Cycle accumulator for batched delays (avoids Windows setTimeout overhead)
    this.accumulatedCycles = 0;
    this.lastDelayTime = Date.now();
  }

  /**
   * CPU delay based on instruction cycles and CPU speed (Hz)
   *
   * IMPORTANT: Windows has a minimum setTimeout resolution of ~15.6ms.
   * Instead of calling setTimeout for each instruction, we accumulate
   * cycles and only delay when enough time has passed.
   *
   * Formula: delayMs = (1000 / cpuSpeed) * cycles
   *
   * Example with QuantumX (5000 Hz):
   *   - 1 cycle instruction: 1000/5000 * 1 = 0.2ms
   *   - 10 cycle instruction (CALL_NATIVE): 1000/5000 * 10 = 2ms
   */
  async cpuDelay(opcode) {
    const cycles = INSTRUCTION_CYCLES[opcode] || 1;
    this.accumulatedCycles += cycles;

    // Calculate how much time should have passed
    const targetDelayMs = (1000 / this.cpuSpeed) * this.accumulatedCycles;

    // Only do a real delay if we've accumulated >= 16ms worth of cycles
    // (Windows setTimeout minimum is ~15.6ms, so we batch to 16ms)
    if (targetDelayMs >= 16) {
      const elapsed = Date.now() - this.lastDelayTime;
      const remainingDelay = Math.max(0, targetDelayMs - elapsed);

      if (remainingDelay > 0) {
        await new Promise(r => setTimeout(r, remainingDelay));
      }

      this.accumulatedCycles = 0;
      this.lastDelayTime = Date.now();
    }
  }

  /**
   * Request I/O operation from main thread
   */
  async requestIO(operation, params) {
    const id = ++ioRequestId;

    return new Promise((resolve, reject) => {
      pendingIO.set(id, { resolve, reject });

      parentPort.postMessage({
        type: 'io-request',
        id,
        operation,
        params
      });
    });
  }

  /**
   * Emit output to main thread (for WebSocket streaming)
   */
  emitOutput(line) {
    parentPort.postMessage({
      type: 'output',
      line,
      commandId: this.commandId
    });
  }

  /**
   * Execute bytecode
   */
  async execute(bytecode, args, context) {
    const { constants, instructions } = bytecode;
    this.context = context;
    this.pc = 0;
    this.stack = [];
    this.locals = [];
    this.output = [];
    this.affectedPaths = new Set();
    this.clearTerminal = false;
    let newWorkingDir = context.workingDir;

    try {
      while (this.pc < instructions.length) {
        // Check for abort signal
        if (this.aborted) {
          return {
            output: this.output.join('\n') + '\n[Killed]',
            newWorkingDir,
            exitCode: 137,
            affectedPaths: Array.from(this.affectedPaths),
            clear: false
          };
        }

        const instruction = instructions[this.pc];
        const opcode = instruction[0];

        // Apply CPU delay based on instruction type
        await this.cpuDelay(opcode);

        switch (opcode) {
          case OPCODES.LOAD_CONST: {
            const index = instruction[1];
            this.stack.push(constants[index]);
            this.pc++;
            break;
          }

          case OPCODES.LOAD_ARG: {
            const index = instruction[1];
            if (index === 0) {
              this.stack.push(args[0] || []);
            } else {
              this.stack.push(null);
            }
            this.pc++;
            break;
          }

          case OPCODES.STORE_LOCAL: {
            const index = instruction[1];
            const value = this.stack.pop();
            this.locals[index] = value;
            this.pc++;
            break;
          }

          case OPCODES.LOAD_LOCAL: {
            const index = instruction[1];
            this.stack.push(this.locals[index]);
            this.pc++;
            break;
          }

          case OPCODES.GET_LENGTH: {
            const array = this.stack.pop();
            const length = array ? array.length : 0;
            this.stack.push(length);
            this.pc++;
            break;
          }

          case OPCODES.GET_ELEMENT: {
            const index = this.stack.pop();
            const array = this.stack.pop();
            const element = array && array[index] !== undefined ? array[index] : null;
            this.stack.push(element);
            this.pc++;
            break;
          }

          case OPCODES.GET_PROPERTY: {
            const propNameIndex = instruction[1];
            const propName = constants[propNameIndex];
            const obj = this.stack.pop();
            const value = obj && obj[propName] !== undefined ? obj[propName] : null;
            this.stack.push(value);
            this.pc++;
            break;
          }

          case OPCODES.ADD: {
            const b = this.stack.pop();
            const a = this.stack.pop();
            this.stack.push(a + b);
            this.pc++;
            break;
          }

          case OPCODES.SUB: {
            const b = this.stack.pop();
            const a = this.stack.pop();
            this.stack.push(a - b);
            this.pc++;
            break;
          }

          case OPCODES.MUL: {
            const b = this.stack.pop();
            const a = this.stack.pop();
            this.stack.push(a * b);
            this.pc++;
            break;
          }

          case OPCODES.DIV: {
            const b = this.stack.pop();
            const a = this.stack.pop();
            if (b === 0) throw new Error('Division by zero');
            this.stack.push(a / b);
            this.pc++;
            break;
          }

          case OPCODES.MOD: {
            const b = this.stack.pop();
            const a = this.stack.pop();
            if (b === 0) throw new Error('Modulo by zero');
            this.stack.push(a % b);
            this.pc++;
            break;
          }

          case OPCODES.NEG: {
            const a = this.stack.pop();
            this.stack.push(-a);
            this.pc++;
            break;
          }

          case OPCODES.EQ: {
            const b = this.stack.pop();
            const a = this.stack.pop();
            this.stack.push(a === b);
            this.pc++;
            break;
          }

          case OPCODES.NEQ: {
            const b = this.stack.pop();
            const a = this.stack.pop();
            this.stack.push(a !== b);
            this.pc++;
            break;
          }

          case OPCODES.LT: {
            const b = this.stack.pop();
            const a = this.stack.pop();
            this.stack.push(a < b);
            this.pc++;
            break;
          }

          case OPCODES.GT: {
            const b = this.stack.pop();
            const a = this.stack.pop();
            this.stack.push(a > b);
            this.pc++;
            break;
          }

          case OPCODES.LTE: {
            const b = this.stack.pop();
            const a = this.stack.pop();
            this.stack.push(a <= b);
            this.pc++;
            break;
          }

          case OPCODES.GTE: {
            const b = this.stack.pop();
            const a = this.stack.pop();
            this.stack.push(a >= b);
            this.pc++;
            break;
          }

          case OPCODES.NOT: {
            const a = this.stack.pop();
            this.stack.push(!a);
            this.pc++;
            break;
          }

          case OPCODES.AND: {
            const b = this.stack.pop();
            const a = this.stack.pop();
            this.stack.push(a && b);
            this.pc++;
            break;
          }

          case OPCODES.OR: {
            const b = this.stack.pop();
            const a = this.stack.pop();
            this.stack.push(a || b);
            this.pc++;
            break;
          }

          case OPCODES.JUMP_IF_FALSE: {
            const offset = instruction[1];
            const condition = this.stack.pop();
            if (!condition) {
              this.pc = offset;
            } else {
              this.pc++;
            }
            break;
          }

          case OPCODES.JUMP: {
            const offset = instruction[1];
            this.pc = offset;
            break;
          }

          case OPCODES.CALL_NATIVE: {
            const apiId = instruction[1];
            const result = await this.callNative(apiId);

            if (apiId === NATIVE_API['Console.ChangeDir'] && result.newWorkingDir) {
              newWorkingDir = result.newWorkingDir;
            }

            if (apiId === NATIVE_API['Console.Clear'] && result.clear) {
              this.clearTerminal = true;
            }

            this.pc++;
            break;
          }

          case OPCODES.RETURN: {
            this.pc = instructions.length;
            break;
          }

          default:
            throw new Error(`Unknown opcode: 0x${opcode.toString(16)}`);
        }
      }

      return {
        output: this.output.join('\n'),
        newWorkingDir,
        exitCode: 0,
        affectedPaths: Array.from(this.affectedPaths),
        clear: this.clearTerminal
      };

    } catch (error) {
      return {
        output: `Error: ${error.message}`,
        newWorkingDir,
        exitCode: 1,
        affectedPaths: Array.from(this.affectedPaths),
        clear: false
      };
    }
  }

  /**
   * Call native API function
   */
  async callNative(apiId) {
    switch (apiId) {
      case NATIVE_API['Console.Log']: {
        const message = this.stack.pop();
        this.output.push(message);
        // Emit in real-time via WebSocket
        this.emitOutput(message);
        return {};
      }

      case NATIVE_API['Console.ChangeDir']: {
        const targetPath = this.stack.pop();
        const newWorkingDir = await this.requestIO('changeDirectory', {
          workingDir: this.context.workingDir,
          targetPath
        });
        return { newWorkingDir };
      }

      case NATIVE_API['Console.Clear']: {
        return { clear: true };
      }

      case NATIVE_API['Console.GetWorkingDir']: {
        this.stack.push(this.context.workingDir);
        return {};
      }

      case NATIVE_API['File.List']: {
        const targetPath = this.stack.pop();
        const items = await this.requestIO('listDirectory', {
          workingDir: this.context.workingDir,
          targetPath
        });
        this.stack.push(items);
        return {};
      }

      case NATIVE_API['File.Read']: {
        const filePath = this.stack.pop();
        const content = await this.requestIO('readFile', {
          workingDir: this.context.workingDir,
          filePath
        });
        this.stack.push(content);
        return {};
      }

      case NATIVE_API['File.Write']: {
        const content = this.stack.pop();
        const filePath = this.stack.pop();
        const result = await this.requestIO('writeFile', {
          workingDir: this.context.workingDir,
          filePath,
          content,
          append: false
        });
        if (result.affectedPath) this.affectedPaths.add(result.affectedPath);
        return {};
      }

      case NATIVE_API['File.Append']: {
        const content = this.stack.pop();
        const filePath = this.stack.pop();
        const result = await this.requestIO('writeFile', {
          workingDir: this.context.workingDir,
          filePath,
          content,
          append: true
        });
        if (result.affectedPath) this.affectedPaths.add(result.affectedPath);
        return {};
      }

      case NATIVE_API['File.Delete']: {
        const filePath = this.stack.pop();
        const result = await this.requestIO('deleteFile', {
          workingDir: this.context.workingDir,
          filePath
        });
        if (result.affectedPath) this.affectedPaths.add(result.affectedPath);
        return {};
      }

      case NATIVE_API['File.Exists']: {
        const filePath = this.stack.pop();
        const exists = await this.requestIO('fileExists', {
          workingDir: this.context.workingDir,
          filePath
        });
        this.stack.push(exists);
        return {};
      }

      case NATIVE_API['File.Create']: {
        const filePath = this.stack.pop();
        const result = await this.requestIO('createFile', {
          workingDir: this.context.workingDir,
          filePath
        });
        if (result.affectedPath) this.affectedPaths.add(result.affectedPath);
        return {};
      }

      case NATIVE_API['File.MakeDir']: {
        const dirPath = this.stack.pop();
        const result = await this.requestIO('makeDir', {
          workingDir: this.context.workingDir,
          dirPath
        });
        if (result.affectedPath) this.affectedPaths.add(result.affectedPath);
        return {};
      }

      case NATIVE_API['File.RemoveDir']: {
        const dirPath = this.stack.pop();
        const result = await this.requestIO('removeDir', {
          workingDir: this.context.workingDir,
          dirPath
        });
        if (result.affectedPath) this.affectedPaths.add(result.affectedPath);
        return {};
      }

      case NATIVE_API['File.Copy']: {
        const destPath = this.stack.pop();
        const srcPath = this.stack.pop();
        const result = await this.requestIO('copyFile', {
          workingDir: this.context.workingDir,
          srcPath,
          destPath
        });
        if (result.affectedPath) this.affectedPaths.add(result.affectedPath);
        return {};
      }

      case NATIVE_API['Process.List']: {
        const processes = await this.requestIO('listProcesses', {});
        this.stack.push(processes);
        return {};
      }

      case NATIVE_API['Process.Kill']: {
        const pid = this.stack.pop();
        const result = await this.requestIO('killProcess', { pid });
        this.stack.push(result);
        return {};
      }

      case NATIVE_API['Disk.Usage']: {
        const disks = await this.requestIO('getDisksUsage', {});
        this.stack.push(disks);
        return {};
      }

      default:
        throw new Error(`Unknown native API: 0x${apiId.toString(16)}`);
    }
  }
}

// Current running VM instance (for abort signaling)
let currentVM = null;

// Listen for messages from main thread
parentPort.on('message', async (msg) => {
  if (msg.type === 'execute') {
    const vm = new WorkerVM(msg.cpuSpeed, msg.commandId);
    currentVM = vm;

    try {
      const result = await vm.execute(msg.bytecode, msg.args, msg.context);
      currentVM = null;

      if (vm.aborted) {
        parentPort.postMessage({ type: 'aborted', result });
      } else {
        parentPort.postMessage({ type: 'complete', result });
      }
    } catch (error) {
      currentVM = null;
      if (error.message === 'ABORTED') {
        parentPort.postMessage({ type: 'aborted', result: { output: '', exitCode: 137 } });
      } else {
        parentPort.postMessage({ type: 'error', error: error.message });
      }
    }
  }

  // Handle abort signal from main thread
  if (msg.type === 'abort') {
    if (currentVM) {
      currentVM.aborted = true;
      console.log('🔪 Abort signal received by worker');
    }
  }

  // Handle I/O response from main thread
  if (msg.type === 'io-response') {
    const pending = pendingIO.get(msg.id);
    if (pending) {
      pendingIO.delete(msg.id);
      if (msg.error) {
        pending.reject(new Error(msg.error));
      } else {
        pending.resolve(msg.result);
      }
    }
  }
});
