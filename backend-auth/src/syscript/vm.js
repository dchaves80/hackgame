// Syscript Virtual Machine
const { OPCODES, NATIVE_API } = require('./bytecode-format');
const Filesystem = require('../models/Filesystem');
const Process = require('../models/Process');
const Computer = require('../models/Computer');
const socketService = require('../services/socketService');

class SyscriptVM {
  constructor(context, options = {}) {
    this.context = context; // { workingDir, userId, computerId, filesystem }
    this.stack = [];
    this.locals = []; // Local variables array
    this.pc = 0; // Program counter
    this.output = [];
    this.affectedPaths = new Set(); // Track modified directories for frontend sync
    this.onOutput = options.onOutput || null; // Callback for streaming output
  }

  /**
   * Execute bytecode
   * @param {Object} bytecode - { version, constants, instructions }
   * @param {Array} args - Command line arguments
   * @returns {Object} { output, newWorkingDir, exitCode }
   */
  async execute(bytecode, args) {
    const { constants, instructions } = bytecode;
    this.pc = 0;
    this.stack = [];
    this.locals = [];
    this.output = [];
    this.affectedPaths = new Set();
    this.clearTerminal = false;
    let newWorkingDir = this.context.workingDir;

    try {
      while (this.pc < instructions.length) {
        const instruction = instructions[this.pc];
        const opcode = instruction[0];

        switch (opcode) {
          case OPCODES.LOAD_CONST: {
            const index = instruction[1];
            this.stack.push(constants[index]);
            this.pc++;
            break;
          }

          case OPCODES.LOAD_ARG: {
            const index = instruction[1];
            // In Main(string[] args), argument 0 is the entire args array
            // vmArgs is structured as [argsArray], so args[0] is the actual command line args
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

          // Arithmetic operations
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

          // Comparison operations
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

          // Logical operations
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

            // Special handling for ChangeDir - update working directory
            if (apiId === NATIVE_API['Console.ChangeDir'] && result.newWorkingDir) {
              newWorkingDir = result.newWorkingDir;
            }

            // Special handling for Clear - set clear flag
            if (apiId === NATIVE_API['Console.Clear'] && result.clear) {
              this.clearTerminal = true;
            }

            this.pc++;
            break;
          }

          case OPCODES.RETURN: {
            // Exit execution
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
        // Emit in real-time if callback exists
        if (this.onOutput) {
          this.onOutput(message);
        }
        return {};
      }

      case NATIVE_API['Console.ChangeDir']: {
        const targetPath = this.stack.pop();
        const newWorkingDir = await this.changeDirectory(targetPath);
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
        const items = await this.listDirectory(targetPath);
        this.stack.push(items);
        return {};
      }

      case NATIVE_API['File.Read']: {
        const filePath = this.stack.pop();
        const content = await this.readFile(filePath);
        this.stack.push(content);
        return {};
      }

      case NATIVE_API['File.Write']: {
        const content = this.stack.pop();
        const filePath = this.stack.pop();
        await this.writeFile(filePath, content, false);
        return {};
      }

      case NATIVE_API['File.Append']: {
        const content = this.stack.pop();
        const filePath = this.stack.pop();
        await this.writeFile(filePath, content, true);
        return {};
      }

      case NATIVE_API['File.Delete']: {
        const filePath = this.stack.pop();
        await this.deleteFile(filePath);
        return {};
      }

      case NATIVE_API['File.Exists']: {
        const filePath = this.stack.pop();
        const exists = await this.fileExists(filePath);
        this.stack.push(exists);
        return {};
      }

      case NATIVE_API['File.Create']: {
        const filePath = this.stack.pop();
        await this.createFile(filePath);
        return {};
      }

      case NATIVE_API['File.MakeDir']: {
        const dirPath = this.stack.pop();
        await this.makeDir(dirPath);
        return {};
      }

      case NATIVE_API['File.RemoveDir']: {
        const dirPath = this.stack.pop();
        await this.removeDir(dirPath);
        return {};
      }

      case NATIVE_API['File.Copy']: {
        const destPath = this.stack.pop();
        const srcPath = this.stack.pop();
        await this.copyFile(srcPath, destPath);
        return {};
      }

      case NATIVE_API['Process.List']: {
        const processes = await this.listProcesses();
        this.stack.push(processes);
        return {};
      }

      case NATIVE_API['Process.Kill']: {
        const pid = this.stack.pop();
        const result = await this.killProcess(pid);
        this.stack.push(result);
        return {};
      }

      case NATIVE_API['Disk.Usage']: {
        // Returns array of all disk partitions with usage info
        const disks = await this.getDisksUsage();
        this.stack.push(disks);
        return {};
      }

      default:
        throw new Error(`Unknown native API: 0x${apiId.toString(16)}`);
    }
  }

  /**
   * Change directory (Console.ChangeDir implementation)
   */
  async changeDirectory(targetPath) {
    let newPath;

    // Handle absolute vs relative paths
    if (targetPath.startsWith('/')) {
      newPath = targetPath;
    } else {
      // Relative path
      newPath = `${this.context.workingDir}/${targetPath}`.replace(/\/+/g, '/');
    }

    // Normalize path (handle .. and .)
    const parts = newPath.split('/').filter(p => p && p !== '.');
    const normalized = [];
    for (const part of parts) {
      if (part === '..') {
        normalized.pop();
      } else {
        normalized.push(part);
      }
    }
    newPath = '/' + normalized.join('/');

    // Verify directory exists
    const fs = await Filesystem.findById(this.context.filesystem._id);
    const dirExists = await this.directoryExists(fs, newPath);

    if (!dirExists) {
      throw new Error(`cd: ${targetPath}: No such file or directory`);
    }

    return newPath;
  }

  /**
   * Check if directory exists in filesystem
   */
  async directoryExists(fs, path) {
    if (path === '/') return true;

    const parts = path.split('/').filter(p => p);
    let currentFs = fs;

    for (const part of parts) {
      if (!currentFs.children || !currentFs.children[part]) {
        return false;
      }

      const child = currentFs.children[part];

      if (child.type === 'directory_ref') {
        // Load subdirectory to continue checking
        const subdir = await Filesystem.findById(child.fsId);
        if (!subdir) return false;
        currentFs = subdir;
      } else if (child.type === 'directory') {
        // Inline directory - this shouldn't happen for cross-document navigation
        return false;
      } else {
        // Not a directory
        return false;
      }
    }

    return true;
  }

  /**
   * Read file contents (File.Read implementation)
   */
  async readFile(filePath) {
    let path;

    // Handle relative vs absolute paths
    if (!filePath) {
      throw new Error('cat: missing file operand');
    } else if (filePath.startsWith('/')) {
      path = filePath;
    } else {
      path = `${this.context.workingDir}/${filePath}`.replace(/\/+/g, '/');
    }

    // Normalize path
    const parts = path.split('/').filter(p => p && p !== '.');
    const normalized = [];
    for (const part of parts) {
      if (part === '..') {
        normalized.pop();
      } else {
        normalized.push(part);
      }
    }

    // Get directory path and filename
    const fileName = normalized.pop();
    const dirPath = '/' + normalized.join('/');

    // Find the directory
    const dirFs = await Filesystem.findOne({
      computerId: this.context.computerId,
      path: dirPath || '/'
    });

    if (!dirFs) {
      throw new Error(`cat: ${filePath}: No such file or directory`);
    }

    // Find the file in directory
    if (!dirFs.children || !dirFs.children[fileName]) {
      throw new Error(`cat: ${filePath}: No such file or directory`);
    }

    const file = dirFs.children[fileName];

    // Check if it's a file (not a directory)
    if (file.type === 'directory' || file.type === 'directory_ref') {
      throw new Error(`cat: ${filePath}: Is a directory`);
    }

    // Handle virtual files that need dynamic generation
    if (file.type === 'virtual' && file.generator) {
      return await this.generateVirtualFile(file.generator);
    }

    return file.content || '';
  }

  /**
   * Generate content for virtual files (like /proc/*)
   */
  async generateVirtualFile(generator) {
    const computer = await Computer.findById(this.context.computerId);

    switch (generator) {
      case 'mounts':
        return this.generateMounts(computer);
      case 'cpuinfo':
        return this.generateCpuInfo(computer);
      case 'meminfo':
        return this.generateMemInfo(computer);
      default:
        return '';
    }
  }

  /**
   * Generate /proc/mounts content from disks[]
   */
  generateMounts(computer) {
    const disks = computer?.hardware?.disks || [];
    let output = '';

    // Add real disk partitions
    for (const disk of disks) {
      for (const partition of disk.partitions || []) {
        output += `/dev/${partition.device} ${partition.mountPoint} ${partition.filesystem} rw,relatime 0 0\n`;
      }
    }

    // Fallback for legacy computers without disks[]
    if (disks.length === 0) {
      output += '/dev/sda1 / ext4 rw,relatime 0 0\n';
    }

    // Add virtual filesystems
    output += 'proc /proc proc rw,nosuid,nodev,noexec,relatime 0 0\n';
    output += 'sysfs /sys sysfs rw,nosuid,nodev,noexec,relatime 0 0\n';
    output += 'devtmpfs /dev devtmpfs rw,nosuid 0 0\n';

    return output;
  }

  /**
   * Generate /proc/cpuinfo content
   */
  generateCpuInfo(computer) {
    const cpu = computer?.hardware?.cpu || {};
    return `processor\t: 0
vendor_id\t: GenuineIntel
model name\t: ${cpu.model || 'Intel Core i5-10400'}
cpu MHz\t\t: ${(cpu.speed || 2.9) * 1000}
cache size\t: 12288 KB
cpu cores\t: ${cpu.cores || 4}
`;
  }

  /**
   * Generate /proc/meminfo content
   */
  generateMemInfo(computer) {
    const ramMB = computer?.hardware?.ram || 8192;
    const ramKB = ramMB * 1024;
    return `MemTotal:       ${ramKB} kB
MemFree:        ${Math.floor(ramKB * 0.3)} kB
MemAvailable:   ${Math.floor(ramKB * 0.6)} kB
Buffers:        ${Math.floor(ramKB * 0.05)} kB
Cached:         ${Math.floor(ramKB * 0.25)} kB
SwapTotal:      ${ramKB * 2} kB
SwapFree:       ${ramKB * 2} kB
`;
  }

  /**
   * Helper to resolve and normalize file path
   */
  resolvePath(filePath) {
    if (!filePath) {
      throw new Error('Missing file path');
    }

    let path;
    if (filePath.startsWith('/')) {
      path = filePath;
    } else {
      path = `${this.context.workingDir}/${filePath}`.replace(/\/+/g, '/');
    }

    // Normalize path
    const parts = path.split('/').filter(p => p && p !== '.');
    const normalized = [];
    for (const part of parts) {
      if (part === '..') {
        normalized.pop();
      } else {
        normalized.push(part);
      }
    }

    const fileName = normalized.pop();
    const dirPath = '/' + normalized.join('/');

    return { dirPath: dirPath || '/', fileName };
  }

  /**
   * Write file contents (File.Write / File.Append implementation)
   */
  async writeFile(filePath, content, append = false) {
    const { dirPath, fileName } = this.resolvePath(filePath);

    // Find the directory
    const dirFs = await Filesystem.findOne({
      computerId: this.context.computerId,
      path: dirPath
    });

    if (!dirFs) {
      throw new Error(`write: ${filePath}: No such directory`);
    }

    // Check if file exists
    const existingFile = dirFs.children?.[fileName];

    // Calculate new content size and check disk space
    const newContent = append ? (existingFile?.content || '') + content : content;
    const newSize = Buffer.byteLength(newContent, 'utf8');
    const currentSize = existingFile?.size || 0;
    const additionalBytes = newSize - currentSize;

    if (additionalBytes > 0) {
      await this.checkDiskSpace(additionalBytes);
    }

    if (existingFile) {
      // Check if it's a directory
      if (existingFile.type === 'directory' || existingFile.type === 'directory_ref') {
        throw new Error(`write: ${filePath}: Is a directory`);
      }

      // Update existing file - use direct object manipulation to avoid dot notation issues
      dirFs.children[fileName] = {
        ...existingFile,
        content: newContent,
        size: newSize,
        modifiedAt: new Date()
      };
      dirFs.markModified('children');
      await dirFs.save();
      this.affectedPaths.add(dirPath);
    } else {
      // Create new file - use direct object manipulation to avoid dot notation issues
      dirFs.children[fileName] = {
        type: 'text',  // 'text' type so GUI editors can open it
        owner: this.context.userId || 'user',
        permissions: '644',
        size: newSize,
        content: newContent,
        createdAt: new Date(),
        modifiedAt: new Date()
      };
      dirFs.markModified('children');
      await dirFs.save();
      this.affectedPaths.add(dirPath);
    }
  }

  /**
   * Delete file (File.Delete implementation)
   */
  async deleteFile(filePath) {
    const { dirPath, fileName } = this.resolvePath(filePath);

    // Find the directory
    const dirFs = await Filesystem.findOne({
      computerId: this.context.computerId,
      path: dirPath
    });

    if (!dirFs) {
      throw new Error(`rm: ${filePath}: No such file or directory`);
    }

    // Check if file exists
    if (!dirFs.children?.[fileName]) {
      throw new Error(`rm: ${filePath}: No such file or directory`);
    }

    const file = dirFs.children[fileName];

    // Check if it's a directory
    if (file.type === 'directory' || file.type === 'directory_ref') {
      throw new Error(`rm: ${filePath}: Is a directory`);
    }

    // Delete the file - use direct object manipulation to avoid dot notation issues
    delete dirFs.children[fileName];
    dirFs.markModified('children');
    await dirFs.save();
    this.affectedPaths.add(dirPath);
  }

  /**
   * Check if file exists (File.Exists implementation)
   */
  async fileExists(filePath) {
    try {
      const { dirPath, fileName } = this.resolvePath(filePath);

      const dirFs = await Filesystem.findOne({
        computerId: this.context.computerId,
        path: dirPath
      });

      if (!dirFs || !dirFs.children?.[fileName]) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create empty file (File.Create implementation)
   */
  async createFile(filePath) {
    const { dirPath, fileName } = this.resolvePath(filePath);

    // Find the directory
    const dirFs = await Filesystem.findOne({
      computerId: this.context.computerId,
      path: dirPath
    });

    if (!dirFs) {
      throw new Error(`touch: ${filePath}: No such directory`);
    }

    // Check if already exists
    if (dirFs.children?.[fileName]) {
      // Just update modified time (like touch)
      dirFs.children[fileName].modifiedAt = new Date();
      dirFs.markModified('children');
      await dirFs.save();
      this.affectedPaths.add(dirPath);
      return;
    }

    // Create empty file - use direct object manipulation to avoid dot notation issues
    dirFs.children[fileName] = {
      type: 'text',  // 'text' type so GUI editors can open it
      owner: this.context.userId || 'user',
      permissions: '644',
      size: 0,
      content: '',
      createdAt: new Date(),
      modifiedAt: new Date()
    };
    dirFs.markModified('children');
    await dirFs.save();
    this.affectedPaths.add(dirPath);
  }

  /**
   * Create directory (File.MakeDir implementation)
   */
  async makeDir(targetPath) {
    const { dirPath, fileName } = this.resolvePath(targetPath);

    // Find the parent directory
    const parentFs = await Filesystem.findOne({
      computerId: this.context.computerId,
      path: dirPath
    });

    if (!parentFs) {
      throw new Error(`mkdir: ${targetPath}: No such directory`);
    }

    // Check if already exists
    if (parentFs.children?.[fileName]) {
      throw new Error(`mkdir: ${targetPath}: File exists`);
    }

    // Create new Filesystem document for the directory
    const newDirPath = dirPath === '/' ? `/${fileName}` : `${dirPath}/${fileName}`;
    const newDirFs = await Filesystem.create({
      computerId: this.context.computerId,
      path: newDirPath,
      type: 'directory',
      owner: this.context.userId || 'user',
      permissions: '755',
      children: {}
    });

    // Add reference in parent
    parentFs.children[fileName] = {
      type: 'directory_ref',
      fsId: newDirFs._id
    };
    parentFs.markModified('children');
    await parentFs.save();
    this.affectedPaths.add(dirPath);
  }

  /**
   * Remove empty directory (File.RemoveDir implementation)
   */
  async removeDir(targetPath) {
    const { dirPath, fileName } = this.resolvePath(targetPath);

    // Find the parent directory
    const parentFs = await Filesystem.findOne({
      computerId: this.context.computerId,
      path: dirPath
    });

    if (!parentFs) {
      throw new Error(`rmdir: ${targetPath}: No such file or directory`);
    }

    // Check if exists
    if (!parentFs.children?.[fileName]) {
      throw new Error(`rmdir: ${targetPath}: No such file or directory`);
    }

    const entry = parentFs.children[fileName];

    // Check if it's a directory
    if (entry.type !== 'directory_ref' && entry.type !== 'directory') {
      throw new Error(`rmdir: ${targetPath}: Not a directory`);
    }

    // If it's a directory_ref, check if it's empty
    if (entry.type === 'directory_ref') {
      const targetDirFs = await Filesystem.findById(entry.fsId);
      if (!targetDirFs) {
        throw new Error(`rmdir: ${targetPath}: Directory not found`);
      }

      // Check if empty
      if (targetDirFs.children && Object.keys(targetDirFs.children).length > 0) {
        throw new Error(`rmdir: ${targetPath}: Directory not empty`);
      }

      // Delete the directory document
      await Filesystem.findByIdAndDelete(entry.fsId);
    }

    // Remove from parent
    delete parentFs.children[fileName];
    parentFs.markModified('children');
    await parentFs.save();
    this.affectedPaths.add(dirPath);
  }

  /**
   * Copy file (File.Copy implementation)
   */
  async copyFile(srcPath, destPath) {
    // Resolve source
    const { dirPath: srcDirPath, fileName: srcFileName } = this.resolvePath(srcPath);

    // Find source directory
    const srcDirFs = await Filesystem.findOne({
      computerId: this.context.computerId,
      path: srcDirPath
    });

    if (!srcDirFs) {
      throw new Error(`cp: ${srcPath}: No such file or directory`);
    }

    // Check source file exists
    if (!srcDirFs.children?.[srcFileName]) {
      throw new Error(`cp: ${srcPath}: No such file or directory`);
    }

    const srcFile = srcDirFs.children[srcFileName];

    // Check it's a file, not a directory
    if (srcFile.type === 'directory' || srcFile.type === 'directory_ref') {
      throw new Error(`cp: ${srcPath}: Is a directory`);
    }

    // Resolve destination
    const { dirPath: destDirPath, fileName: destFileName } = this.resolvePath(destPath);

    // Find destination directory
    const destDirFs = await Filesystem.findOne({
      computerId: this.context.computerId,
      path: destDirPath
    });

    if (!destDirFs) {
      throw new Error(`cp: ${destPath}: No such directory`);
    }

    // Check if dest already exists and is a directory
    const existingDest = destDirFs.children?.[destFileName];
    if (existingDest) {
      if (existingDest.type === 'directory' || existingDest.type === 'directory_ref') {
        throw new Error(`cp: ${destPath}: Is a directory`);
      }
    }

    // Check disk space - only for additional bytes needed
    const sourceSize = srcFile.size || 0;
    const existingDestSize = existingDest?.size || 0;
    const additionalBytes = sourceSize - existingDestSize;

    if (additionalBytes > 0) {
      await this.checkDiskSpace(additionalBytes);
    }

    // Copy file
    destDirFs.children[destFileName] = {
      ...srcFile,
      createdAt: new Date(),
      modifiedAt: new Date()
    };
    destDirFs.markModified('children');
    await destDirFs.save();
    this.affectedPaths.add(destDirPath);
  }

  /**
   * List directory contents (File.List implementation)
   */
  async listDirectory(targetPath) {
    let path;

    // Handle null/undefined - use working directory
    if (!targetPath) {
      path = this.context.workingDir;
    } else if (targetPath.startsWith('/')) {
      path = targetPath;
    } else {
      path = `${this.context.workingDir}/${targetPath}`.replace(/\/+/g, '/');
    }

    // Normalize path
    const parts = path.split('/').filter(p => p && p !== '.');
    const normalized = [];
    for (const part of parts) {
      if (part === '..') {
        normalized.pop();
      } else {
        normalized.push(part);
      }
    }
    path = '/' + normalized.join('/');

    // Get directory contents
    const dirFs = await Filesystem.findOne({
      computerId: this.context.computerId,
      path: path
    });

    if (!dirFs) {
      throw new Error(`ls: cannot access '${targetPath || '.'}': No such file or directory`);
    }

    // Build list of items
    const items = [];
    if (dirFs.children) {
      for (const [name, child] of Object.entries(dirFs.children)) {
        // Skip hidden files (starting with .)
        if (name.startsWith('.')) continue;

        const isDir = child.type === 'directory' || child.type === 'directory_ref';
        items.push({
          name,
          type: isDir ? 'd' : '-',
          size: child.size || 0
        });
      }
    }

    // Sort: directories first, then alphabetically
    items.sort((a, b) => {
      if (a.type === 'd' && b.type !== 'd') return -1;
      if (a.type !== 'd' && b.type === 'd') return 1;
      return a.name.localeCompare(b.name);
    });

    return items;
  }

  /**
   * List processes (Process.List implementation)
   */
  async listProcesses() {
    const processes = await Process.find({
      computerId: this.context.computerId
    }).sort({ pid: 1 });

    return processes.map(p => ({
      pid: p.pid,
      name: p.name,
      user: p.user,
      cpu: p.cpu,
      mem: p.mem,
      status: p.status,
      type: p.type,
      port: p.port,
      protected: p.protected
    }));
  }

  /**
   * Kill a process by PID (Process.Kill implementation)
   * Returns: { success: bool, message: string }
   */
  async killProcess(pid) {
    const process = await Process.findOne({
      computerId: this.context.computerId,
      pid: parseInt(pid)
    });

    if (!process) {
      return { success: false, message: `Process ${pid} not found` };
    }

    if (process.protected) {
      return { success: false, message: `Cannot kill protected process: ${process.name}` };
    }

    await Process.deleteOne({ _id: process._id });

    // Emit event to all users on this computer
    socketService.emitToComputer(this.context.computerId, 'process:killed', {
      pid: parseInt(pid),
      name: process.name
    });

    return { success: true, message: `Process ${pid} (${process.name}) terminated` };
  }

  /**
   * Calculate total size of a directory recursively
   * @param {Object} dir - Filesystem document
   * @returns {number} Total size in bytes
   */
  async calculateDirectorySize(dir) {
    let totalSize = 0;

    for (const [name, child] of Object.entries(dir.children || {})) {
      if (child.type === 'directory_ref') {
        // Load subdirectory and calculate recursively
        const subdir = await Filesystem.findById(child.fsId);
        if (subdir) {
          totalSize += await this.calculateDirectorySize(subdir);
        }
      } else {
        // File - add its size
        totalSize += child.size || 0;
      }
    }

    return totalSize;
  }

  /**
   * Get disk usage information for all disks (new multi-disk version)
   * @returns {Array} Array of disk usage objects
   */
  async getDisksUsage() {
    const computer = await Computer.findById(this.context.computerId);
    const disks = computer?.hardware?.disks || [];

    // Fallback for legacy computers without disks[]
    if (disks.length === 0 && computer?.hardware?.disk) {
      const usedMB = await this.calculateMountPointUsage('/');
      const capacityMB = computer.hardware.disk.capacity || 50000;
      return [{
        device: 'sda1',
        mountPoint: '/',
        capacityMB,
        usedMB: Math.round(usedMB * 100) / 100,
        availableMB: Math.round((capacityMB - usedMB) * 100) / 100,
        percent: Math.round((usedMB / capacityMB) * 100),
        filesystem: 'ext4'
      }];
    }

    const result = [];

    for (const disk of disks) {
      for (const partition of disk.partitions || []) {
        const usedMB = await this.calculateMountPointUsage(partition.mountPoint);
        const capacityMB = partition.size;
        const availableMB = capacityMB - usedMB;

        result.push({
          device: partition.device,
          mountPoint: partition.mountPoint,
          capacityMB,
          usedMB: Math.round(usedMB * 100) / 100,
          availableMB: Math.round(availableMB * 100) / 100,
          percent: Math.round((usedMB / capacityMB) * 100),
          filesystem: partition.filesystem || 'ext4'
        });
      }
    }

    return result;
  }

  /**
   * Calculate disk usage for a specific mount point
   * @param {string} mountPoint - Mount point path (e.g., '/', '/home')
   * @returns {number} Used space in MB
   */
  async calculateMountPointUsage(mountPoint) {
    const fs = await Filesystem.findOne({
      computerId: this.context.computerId,
      path: mountPoint
    });

    if (!fs) return 0;

    const bytes = await this.calculateDirectorySize(fs);
    return bytes / (1024 * 1024);
  }

  /**
   * Legacy getDiskUsage for backward compatibility
   * @returns {Object} { usedBytes, usedMB, capacityMB, availableMB }
   */
  async getDiskUsage() {
    const disks = await this.getDisksUsage();
    const rootDisk = disks.find(d => d.mountPoint === '/') || disks[0];

    if (!rootDisk) {
      return { usedBytes: 0, usedMB: 0, capacityMB: 0, availableMB: 0 };
    }

    return {
      usedBytes: rootDisk.usedMB * 1024 * 1024,
      usedMB: rootDisk.usedMB,
      capacityMB: rootDisk.capacityMB,
      availableMB: rootDisk.availableMB
    };
  }

  /**
   * Check if there's enough disk space for an operation
   * @param {number} neededBytes - Bytes needed for the operation
   * @param {string} mountPoint - Target mount point (default '/')
   * @throws {Error} If not enough space
   */
  async checkDiskSpace(neededBytes, mountPoint = '/') {
    const disks = await this.getDisksUsage();
    const disk = disks.find(d => d.mountPoint === mountPoint) || disks[0];

    if (!disk) {
      throw new Error('No disk available');
    }

    const neededMB = neededBytes / (1024 * 1024);

    if (disk.usedMB + neededMB > disk.capacityMB) {
      throw new Error(`Disk full (${disk.device}): ${disk.availableMB.toFixed(2)} MB available, ${neededMB.toFixed(2)} MB needed`);
    }
  }
}

module.exports = SyscriptVM;
