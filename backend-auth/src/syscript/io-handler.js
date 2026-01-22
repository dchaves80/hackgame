/**
 * IO Handler - Centralized I/O operations for VM
 * These operations run in the main thread and communicate with MongoDB
 */

const Filesystem = require('../models/Filesystem');
const Process = require('../models/Process');
const Computer = require('../models/Computer');
const socketService = require('../services/socketService');

class IOHandler {
  /**
   * Resolve and normalize file path
   */
  resolvePath(workingDir, filePath) {
    if (!filePath) {
      throw new Error('Missing file path');
    }

    let path;
    if (filePath.startsWith('/')) {
      path = filePath;
    } else {
      path = `${workingDir}/${filePath}`.replace(/\/+/g, '/');
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

    return { dirPath: dirPath || '/', fileName, fullPath: '/' + normalized.concat(fileName || []).join('/') };
  }

  /**
   * Read file contents
   */
  async readFile(computerId, workingDir, filePath) {
    if (!filePath) {
      throw new Error('cat: missing file operand');
    }

    const { dirPath, fileName } = this.resolvePath(workingDir, filePath);

    const dirFs = await Filesystem.findOne({
      computerId,
      path: dirPath || '/'
    });

    if (!dirFs) {
      throw new Error(`cat: ${filePath}: No such file or directory`);
    }

    if (!dirFs.children || !dirFs.children[fileName]) {
      throw new Error(`cat: ${filePath}: No such file or directory`);
    }

    const file = dirFs.children[fileName];

    if (file.type === 'directory' || file.type === 'directory_ref') {
      throw new Error(`cat: ${filePath}: Is a directory`);
    }

    // Handle virtual files
    if (file.type === 'virtual' && file.generator) {
      return await this.generateVirtualFile(computerId, file.generator);
    }

    return file.content || '';
  }

  /**
   * Write file contents
   */
  async writeFile(computerId, workingDir, filePath, content, append = false) {
    const { dirPath, fileName } = this.resolvePath(workingDir, filePath);

    const dirFs = await Filesystem.findOne({
      computerId,
      path: dirPath
    });

    if (!dirFs) {
      throw new Error(`write: ${filePath}: No such directory`);
    }

    const existingFile = dirFs.children?.[fileName];

    const newContent = append ? (existingFile?.content || '') + content : content;
    const newSize = Buffer.byteLength(newContent, 'utf8');
    const currentSize = existingFile?.size || 0;
    const additionalBytes = newSize - currentSize;

    if (additionalBytes > 0) {
      await this.checkDiskSpace(computerId, additionalBytes);
    }

    if (existingFile) {
      if (existingFile.type === 'directory' || existingFile.type === 'directory_ref') {
        throw new Error(`write: ${filePath}: Is a directory`);
      }

      dirFs.children[fileName] = {
        ...existingFile,
        content: newContent,
        size: newSize,
        modifiedAt: new Date()
      };
    } else {
      dirFs.children[fileName] = {
        type: 'text',
        owner: 'user',
        permissions: '644',
        size: newSize,
        content: newContent,
        createdAt: new Date(),
        modifiedAt: new Date()
      };
    }

    dirFs.markModified('children');
    await dirFs.save();
    return { affectedPath: dirPath };
  }

  /**
   * Delete file
   */
  async deleteFile(computerId, workingDir, filePath) {
    const { dirPath, fileName } = this.resolvePath(workingDir, filePath);

    const dirFs = await Filesystem.findOne({
      computerId,
      path: dirPath
    });

    if (!dirFs || !dirFs.children?.[fileName]) {
      throw new Error(`rm: ${filePath}: No such file or directory`);
    }

    const file = dirFs.children[fileName];

    if (file.type === 'directory' || file.type === 'directory_ref') {
      throw new Error(`rm: ${filePath}: Is a directory`);
    }

    delete dirFs.children[fileName];
    dirFs.markModified('children');
    await dirFs.save();
    return { affectedPath: dirPath };
  }

  /**
   * Check if file exists
   */
  async fileExists(computerId, workingDir, filePath) {
    try {
      const { dirPath, fileName } = this.resolvePath(workingDir, filePath);

      const dirFs = await Filesystem.findOne({
        computerId,
        path: dirPath
      });

      return !!(dirFs && dirFs.children?.[fileName]);
    } catch {
      return false;
    }
  }

  /**
   * Create empty file
   */
  async createFile(computerId, workingDir, filePath, userId) {
    const { dirPath, fileName } = this.resolvePath(workingDir, filePath);

    const dirFs = await Filesystem.findOne({
      computerId,
      path: dirPath
    });

    if (!dirFs) {
      throw new Error(`touch: ${filePath}: No such directory`);
    }

    if (dirFs.children?.[fileName]) {
      dirFs.children[fileName].modifiedAt = new Date();
      dirFs.markModified('children');
      await dirFs.save();
      return { affectedPath: dirPath };
    }

    dirFs.children[fileName] = {
      type: 'text',
      owner: userId || 'user',
      permissions: '644',
      size: 0,
      content: '',
      createdAt: new Date(),
      modifiedAt: new Date()
    };
    dirFs.markModified('children');
    await dirFs.save();
    return { affectedPath: dirPath };
  }

  /**
   * Create directory
   */
  async makeDir(computerId, workingDir, targetPath, userId) {
    const { dirPath, fileName } = this.resolvePath(workingDir, targetPath);

    const parentFs = await Filesystem.findOne({
      computerId,
      path: dirPath
    });

    if (!parentFs) {
      throw new Error(`mkdir: ${targetPath}: No such directory`);
    }

    if (parentFs.children?.[fileName]) {
      throw new Error(`mkdir: ${targetPath}: File exists`);
    }

    const newDirPath = dirPath === '/' ? `/${fileName}` : `${dirPath}/${fileName}`;
    const newDirFs = await Filesystem.create({
      computerId,
      path: newDirPath,
      type: 'directory',
      owner: userId || 'user',
      permissions: '755',
      children: {}
    });

    parentFs.children[fileName] = {
      type: 'directory_ref',
      fsId: newDirFs._id
    };
    parentFs.markModified('children');
    await parentFs.save();
    return { affectedPath: dirPath };
  }

  /**
   * Remove directory
   */
  async removeDir(computerId, workingDir, targetPath) {
    const { dirPath, fileName } = this.resolvePath(workingDir, targetPath);

    const parentFs = await Filesystem.findOne({
      computerId,
      path: dirPath
    });

    if (!parentFs || !parentFs.children?.[fileName]) {
      throw new Error(`rmdir: ${targetPath}: No such file or directory`);
    }

    const entry = parentFs.children[fileName];

    if (entry.type !== 'directory_ref' && entry.type !== 'directory') {
      throw new Error(`rmdir: ${targetPath}: Not a directory`);
    }

    if (entry.type === 'directory_ref') {
      const targetDirFs = await Filesystem.findById(entry.fsId);
      if (!targetDirFs) {
        throw new Error(`rmdir: ${targetPath}: Directory not found`);
      }

      if (targetDirFs.children && Object.keys(targetDirFs.children).length > 0) {
        throw new Error(`rmdir: ${targetPath}: Directory not empty`);
      }

      await Filesystem.findByIdAndDelete(entry.fsId);
    }

    delete parentFs.children[fileName];
    parentFs.markModified('children');
    await parentFs.save();
    return { affectedPath: dirPath };
  }

  /**
   * Copy file
   */
  async copyFile(computerId, workingDir, srcPath, destPath) {
    const { dirPath: srcDirPath, fileName: srcFileName } = this.resolvePath(workingDir, srcPath);

    const srcDirFs = await Filesystem.findOne({
      computerId,
      path: srcDirPath
    });

    if (!srcDirFs || !srcDirFs.children?.[srcFileName]) {
      throw new Error(`cp: ${srcPath}: No such file or directory`);
    }

    const srcFile = srcDirFs.children[srcFileName];

    if (srcFile.type === 'directory' || srcFile.type === 'directory_ref') {
      throw new Error(`cp: ${srcPath}: Is a directory`);
    }

    const { dirPath: destDirPath, fileName: destFileName } = this.resolvePath(workingDir, destPath);

    const destDirFs = await Filesystem.findOne({
      computerId,
      path: destDirPath
    });

    if (!destDirFs) {
      throw new Error(`cp: ${destPath}: No such directory`);
    }

    const existingDest = destDirFs.children?.[destFileName];
    if (existingDest && (existingDest.type === 'directory' || existingDest.type === 'directory_ref')) {
      throw new Error(`cp: ${destPath}: Is a directory`);
    }

    const sourceSize = srcFile.size || 0;
    const existingDestSize = existingDest?.size || 0;
    const additionalBytes = sourceSize - existingDestSize;

    if (additionalBytes > 0) {
      await this.checkDiskSpace(computerId, additionalBytes);
    }

    destDirFs.children[destFileName] = {
      ...srcFile,
      createdAt: new Date(),
      modifiedAt: new Date()
    };
    destDirFs.markModified('children');
    await destDirFs.save();
    return { affectedPath: destDirPath };
  }

  /**
   * List directory contents
   */
  async listDirectory(computerId, workingDir, targetPath) {
    let path;

    if (!targetPath) {
      path = workingDir;
    } else if (targetPath.startsWith('/')) {
      path = targetPath;
    } else {
      path = `${workingDir}/${targetPath}`.replace(/\/+/g, '/');
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

    const dirFs = await Filesystem.findOne({
      computerId,
      path: path
    });

    if (!dirFs) {
      throw new Error(`ls: cannot access '${targetPath || '.'}': No such file or directory`);
    }

    const items = [];
    if (dirFs.children) {
      for (const [name, child] of Object.entries(dirFs.children)) {
        if (name.startsWith('.')) continue;

        const isDir = child.type === 'directory' || child.type === 'directory_ref';
        items.push({
          name,
          type: isDir ? 'd' : '-',
          size: child.size || 0
        });
      }
    }

    items.sort((a, b) => {
      if (a.type === 'd' && b.type !== 'd') return -1;
      if (a.type !== 'd' && b.type === 'd') return 1;
      return a.name.localeCompare(b.name);
    });

    return items;
  }

  /**
   * Change directory - validates path exists
   */
  async changeDirectory(computerId, workingDir, targetPath) {
    let newPath;

    if (targetPath.startsWith('/')) {
      newPath = targetPath;
    } else {
      newPath = `${workingDir}/${targetPath}`.replace(/\/+/g, '/');
    }

    // Normalize path
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
    if (newPath !== '/') {
      const dirFs = await Filesystem.findOne({
        computerId,
        path: newPath
      });

      if (!dirFs) {
        throw new Error(`cd: ${targetPath}: No such file or directory`);
      }
    }

    return newPath;
  }

  /**
   * List processes
   */
  async listProcesses(computerId) {
    const processes = await Process.find({ computerId }).sort({ pid: 1 });

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
   * Kill a process
   */
  async killProcess(computerId, pid) {
    const parsedPid = parseInt(pid);

    const process = await Process.findOne({
      computerId,
      pid: parsedPid
    });

    if (!process) {
      return { success: false, message: `Process ${pid} not found` };
    }

    if (process.protected) {
      return { success: false, message: `Cannot kill protected process: ${process.name}` };
    }

    // Try to kill the running worker if this is an active command
    // (lazy require to avoid circular dependency)
    const workerPool = require('./worker-pool');
    const killed = workerPool.killCommand(computerId.toString(), parsedPid);

    if (killed) {
      console.log(`🔪 Killed running command with PID ${parsedPid}`);
    }

    // Delete process from database
    await Process.deleteOne({ _id: process._id });

    socketService.emitToComputer(computerId.toString(), 'process:killed', {
      pid: parsedPid,
      name: process.name
    });

    return { success: true, message: `Process ${pid} (${process.name}) terminated` };
  }

  /**
   * Get disks usage
   */
  async getDisksUsage(computerId) {
    const computer = await Computer.findById(computerId);
    const disks = computer?.hardware?.disks || [];

    // Fallback for legacy
    if (disks.length === 0 && computer?.hardware?.disk) {
      const usedMB = await this.calculateMountPointUsage(computerId, '/');
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
        const usedMB = await this.calculateMountPointUsage(computerId, partition.mountPoint);
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
   * Calculate mount point usage
   */
  async calculateMountPointUsage(computerId, mountPoint) {
    const fs = await Filesystem.findOne({ computerId, path: mountPoint });
    if (!fs) return 0;

    const bytes = await this.calculateDirectorySize(fs);
    return bytes / (1024 * 1024);
  }

  /**
   * Calculate directory size recursively
   */
  async calculateDirectorySize(dir) {
    let totalSize = 0;

    for (const [name, child] of Object.entries(dir.children || {})) {
      if (child.type === 'directory_ref') {
        const subdir = await Filesystem.findById(child.fsId);
        if (subdir) {
          totalSize += await this.calculateDirectorySize(subdir);
        }
      } else {
        totalSize += child.size || 0;
      }
    }

    return totalSize;
  }

  /**
   * Check disk space
   */
  async checkDiskSpace(computerId, neededBytes, mountPoint = '/') {
    const disks = await this.getDisksUsage(computerId);
    const disk = disks.find(d => d.mountPoint === mountPoint) || disks[0];

    if (!disk) {
      throw new Error('No disk available');
    }

    const neededMB = neededBytes / (1024 * 1024);

    if (disk.usedMB + neededMB > disk.capacityMB) {
      throw new Error(`Disk full (${disk.device}): ${disk.availableMB.toFixed(2)} MB available, ${neededMB.toFixed(2)} MB needed`);
    }
  }

  /**
   * Generate virtual file content
   */
  async generateVirtualFile(computerId, generator) {
    const computer = await Computer.findById(computerId);

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

  generateMounts(computer) {
    const disks = computer?.hardware?.disks || [];
    let output = '';

    for (const disk of disks) {
      for (const partition of disk.partitions || []) {
        output += `/dev/${partition.device} ${partition.mountPoint} ${partition.filesystem} rw,relatime 0 0\n`;
      }
    }

    if (disks.length === 0) {
      output += '/dev/sda1 / ext4 rw,relatime 0 0\n';
    }

    output += 'proc /proc proc rw,nosuid,nodev,noexec,relatime 0 0\n';
    output += 'sysfs /sys sysfs rw,nosuid,nodev,noexec,relatime 0 0\n';
    output += 'devtmpfs /dev devtmpfs rw,nosuid 0 0\n';

    return output;
  }

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
}

module.exports = new IOHandler();
