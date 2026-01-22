const { Filesystem, PlayerAccess, Clipboard } = require('../models');

/**
 * GET /api/filesystem/:path?
 * Get directory contents for a specific path
 */
exports.getDirectory = async (req, res) => {
  try {
    const userId = req.user.userId;
    let requestedPath = req.params.path || '/';

    // Normalize path
    if (!requestedPath.startsWith('/')) {
      requestedPath = '/' + requestedPath;
    }

    // Get user's main computer
    const playerAccess = await PlayerAccess.findOne({ userId }).populate('computerId');

    if (!playerAccess) {
      return res.status(404).json({
        error: 'No computer found for user'
      });
    }

    const computerId = playerAccess.computerId._id;

    // Find the directory in filesystem
    const directory = await Filesystem.findOne({
      computerId,
      path: requestedPath,
      type: 'directory'
    });

    if (!directory) {
      return res.status(404).json({
        error: 'Directory not found',
        path: requestedPath
      });
    }

    // Get all children (files and subdirectories)
    const items = [];

    // Add files from children object
    for (const [name, fileData] of Object.entries(directory.children)) {
      if (fileData.type === 'directory_ref') {
        // It's a reference to a subdirectory - fetch it
        const subdir = await Filesystem.findById(fileData.fsId);
        if (subdir) {
          items.push({
            name,
            type: 'directory',
            path: subdir.path,
            owner: subdir.owner,
            permissions: subdir.permissions,
            modifiedAt: subdir.modifiedAt || subdir.createdAt
          });
        }
      } else {
        // It's a file stored inline
        items.push({
          name,
          type: fileData.type,
          size: fileData.size,
          owner: fileData.owner,
          permissions: fileData.permissions,
          description: fileData.description,
          modifiedAt: fileData.modifiedAt,
          createdAt: fileData.createdAt
        });
      }
    }

    res.json({
      path: requestedPath,
      items: items.sort((a, b) => {
        // Directories first, then files
        if (a.type === 'directory' && b.type !== 'directory') return -1;
        if (a.type !== 'directory' && b.type === 'directory') return 1;
        return a.name.localeCompare(b.name);
      })
    });

  } catch (error) {
    console.error('Get directory error:', error);
    res.status(500).json({
      error: 'Failed to get directory contents',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
};

/**
 * GET /api/filesystem/file/:path
 * Get file contents
 */
exports.getFile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const filePath = req.params.path;

    // Get user's main computer
    const playerAccess = await PlayerAccess.findOne({ userId }).populate('computerId');

    if (!playerAccess) {
      return res.status(404).json({
        error: 'No computer found for user'
      });
    }

    const computerId = playerAccess.computerId._id;

    // Parse path to get directory and filename
    const pathParts = filePath.split('/').filter(p => p);
    const fileName = pathParts.pop();
    const dirPath = '/' + pathParts.join('/');

    // Find the directory
    const directory = await Filesystem.findOne({
      computerId,
      path: dirPath || '/',
      type: 'directory'
    });

    if (!directory || !directory.children[fileName]) {
      return res.status(404).json({
        error: 'File not found'
      });
    }

    const fileData = directory.children[fileName];

    res.json({
      name: fileName,
      path: filePath,
      type: fileData.type,
      size: fileData.size,
      content: fileData.content || null,
      owner: fileData.owner,
      permissions: fileData.permissions,
      createdAt: fileData.createdAt,
      modifiedAt: fileData.modifiedAt
    });

  } catch (error) {
    console.error('Get file error:', error);
    res.status(500).json({
      error: 'Failed to get file',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
};

/**
 * POST /api/filesystem/:path
 * Create new folder
 */
exports.createFolder = async (req, res) => {
  try {
    const userId = req.user.userId;
    let parentPath = req.params.path || '/';
    const { name, type } = req.body;

    // Validate
    if (!name || !name.trim()) {
      return res.status(400).json({
        error: 'Folder name is required'
      });
    }

    if (type !== 'directory') {
      return res.status(400).json({
        error: 'Only directories can be created with this endpoint'
      });
    }

    // Normalize path
    if (!parentPath.startsWith('/')) {
      parentPath = '/' + parentPath;
    }

    // Get user's main computer
    const playerAccess = await PlayerAccess.findOne({ userId }).populate('computerId');

    if (!playerAccess) {
      return res.status(404).json({
        error: 'No computer found for user'
      });
    }

    const computerId = playerAccess.computerId._id;

    // Find parent directory
    const parentDir = await Filesystem.findOne({
      computerId,
      path: parentPath,
      type: 'directory'
    });

    if (!parentDir) {
      return res.status(404).json({
        error: 'Parent directory not found'
      });
    }

    // Check if folder already exists
    if (parentDir.children[name.trim()]) {
      return res.status(409).json({
        error: 'A file or folder with this name already exists'
      });
    }

    // Create new directory path
    const newPath = parentPath === '/' ? `/${name.trim()}` : `${parentPath}/${name.trim()}`;

    // Create new directory in Filesystem collection
    const newDir = await Filesystem.create({
      computerId,
      path: newPath,
      type: 'directory',
      owner: 'user',
      permissions: '755',
      children: {}
    });

    // Add reference to parent
    await parentDir.addSubdirectory(name.trim(), newDir._id);

    res.status(201).json({
      message: 'Folder created successfully',
      folder: {
        name: name.trim(),
        type: 'directory',
        path: newPath,
        owner: 'user',
        permissions: '755',
        createdAt: newDir.createdAt
      }
    });

  } catch (error) {
    console.error('Create folder error:', error);
    res.status(500).json({
      error: 'Failed to create folder',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
};

/**
 * PUT /api/filesystem/file/:path
 * Update or create file content
 */
exports.updateFile = async (req, res) => {
  try {
    const userId = req.user.userId;
    let filePath = req.params.path;
    const { content } = req.body;

    // Validate
    if (content === undefined) {
      return res.status(400).json({
        error: 'File content is required'
      });
    }

    // Normalize path
    if (!filePath.startsWith('/')) {
      filePath = '/' + filePath;
    }

    // Get user's main computer
    const playerAccess = await PlayerAccess.findOne({ userId }).populate('computerId');

    if (!playerAccess) {
      return res.status(404).json({
        error: 'No computer found for user'
      });
    }

    const computerId = playerAccess.computerId._id;

    // Parse path to get directory and filename
    const pathParts = filePath.split('/').filter(p => p);
    const fileName = pathParts.pop();
    const dirPath = '/' + (pathParts.length > 0 ? pathParts.join('/') : '');

    // Find the directory
    const directory = await Filesystem.findOne({
      computerId,
      path: dirPath || '/',
      type: 'directory'
    });

    if (!directory) {
      return res.status(404).json({
        error: 'Parent directory not found'
      });
    }

    // Determine file type from extension
    let fileType = 'text';
    if (fileName.endsWith('.sc')) {
      fileType = 'source';
    }

    const now = new Date();
    const fileSize = Buffer.byteLength(content, 'utf8');

    // Check if file exists
    if (directory.children[fileName]) {
      // Update existing file
      const existingFile = directory.children[fileName];
      directory.children[fileName] = {
        ...existingFile,
        content,
        size: fileSize,
        modifiedAt: now
      };
    } else {
      // Create new file
      directory.children[fileName] = {
        type: fileType,
        owner: 'user',
        permissions: '644',
        size: fileSize,
        content,
        createdAt: now,
        modifiedAt: now
      };
    }

    directory.markModified('children');
    directory.modifiedAt = now;
    await directory.save();

    res.json({
      message: 'File saved successfully',
      file: {
        name: fileName,
        path: filePath,
        type: fileType,
        size: fileSize,
        modifiedAt: now
      }
    });

  } catch (error) {
    console.error('Update file error:', error);
    res.status(500).json({
      error: 'Failed to save file',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
};

/**
 * DELETE /api/filesystem/:path
 * Delete a file or directory
 */
exports.deleteItem = async (req, res) => {
  try {
    const userId = req.user.userId;
    let itemPath = req.params.path;

    // Normalize path
    if (!itemPath.startsWith('/')) {
      itemPath = '/' + itemPath;
    }

    // Prevent deletion of critical system directories
    const protectedPaths = ['/', '/bin', '/usr', '/usr/bin', '/etc', '/home'];
    if (protectedPaths.includes(itemPath)) {
      return res.status(403).json({
        error: 'Cannot delete system directories'
      });
    }

    // Get user's main computer
    const playerAccess = await PlayerAccess.findOne({ userId }).populate('computerId');

    if (!playerAccess) {
      return res.status(404).json({
        error: 'No computer found for user'
      });
    }

    const computerId = playerAccess.computerId._id;

    // Parse path to get directory and item name
    const pathParts = itemPath.split('/').filter(p => p);
    const itemName = pathParts.pop();
    const dirPath = '/' + (pathParts.length > 0 ? pathParts.join('/') : '');

    // Find the parent directory
    const parentDir = await Filesystem.findOne({
      computerId,
      path: dirPath || '/',
      type: 'directory'
    });

    if (!parentDir || !parentDir.children[itemName]) {
      return res.status(404).json({
        error: 'Item not found'
      });
    }

    const itemData = parentDir.children[itemName];

    // If it's a directory reference, also delete the directory document
    if (itemData.type === 'directory_ref') {
      const subdir = await Filesystem.findById(itemData.fsId);
      if (subdir) {
        // Recursively delete all subdirectories
        await deleteDirectoryRecursive(subdir._id);
      }
    }

    // Remove from parent's children
    delete parentDir.children[itemName];
    parentDir.markModified('children');
    parentDir.modifiedAt = new Date();
    await parentDir.save();

    res.json({
      message: 'Item deleted successfully',
      deletedItem: {
        name: itemName,
        type: itemData.type === 'directory_ref' ? 'directory' : itemData.type,
        path: itemPath
      }
    });

  } catch (error) {
    console.error('Delete item error:', error);
    res.status(500).json({
      error: 'Failed to delete item',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
};

/**
 * Helper function to recursively delete directories
 */
async function deleteDirectoryRecursive(dirId) {
  const dir = await Filesystem.findById(dirId);
  if (!dir) return;

  // Delete all subdirectories first
  for (const [name, child] of Object.entries(dir.children)) {
    if (child.type === 'directory_ref') {
      await deleteDirectoryRecursive(child.fsId);
    }
  }

  // Delete the directory itself
  await Filesystem.findByIdAndDelete(dirId);
}

/**
 * POST /api/filesystem/clipboard
 * Copy or cut a file/folder to clipboard
 */
exports.setClipboard = async (req, res) => {
  try {
    const userId = req.user.userId;
    let { sourcePath, operation } = req.body;

    // Validate
    if (!sourcePath || !operation) {
      return res.status(400).json({
        error: 'sourcePath and operation are required'
      });
    }

    if (!['copy', 'cut'].includes(operation)) {
      return res.status(400).json({
        error: 'operation must be "copy" or "cut"'
      });
    }

    // Normalize path
    if (!sourcePath.startsWith('/')) {
      sourcePath = '/' + sourcePath;
    }

    // Get user's main computer
    const playerAccess = await PlayerAccess.findOne({ userId }).populate('computerId');

    if (!playerAccess) {
      return res.status(404).json({
        error: 'No computer found for user'
      });
    }

    const computerId = playerAccess.computerId._id;

    // Parse path to get directory and item name
    const pathParts = sourcePath.split('/').filter(p => p);
    const itemName = pathParts.pop();
    const dirPath = '/' + (pathParts.length > 0 ? pathParts.join('/') : '');

    // Find the parent directory
    const parentDir = await Filesystem.findOne({
      computerId,
      path: dirPath || '/',
      type: 'directory'
    });

    if (!parentDir || !parentDir.children[itemName]) {
      return res.status(404).json({
        error: 'Item not found'
      });
    }

    const itemData = parentDir.children[itemName];

    // Determine item type
    let itemType = itemData.type;
    if (itemData.type === 'directory_ref') {
      itemType = 'directory';
    }

    // Update or create clipboard (only one clipboard per user)
    const clipboard = await Clipboard.findOneAndUpdate(
      { userId },
      {
        userId,
        computerId,
        sourcePath,
        itemName,
        itemType,
        operation,
        createdAt: new Date()
      },
      { upsert: true, new: true }
    );

    res.json({
      message: `Item ${operation === 'copy' ? 'copied' : 'cut'} to clipboard`,
      clipboard: {
        sourcePath: clipboard.sourcePath,
        itemName: clipboard.itemName,
        itemType: clipboard.itemType,
        operation: clipboard.operation
      }
    });

  } catch (error) {
    console.error('Set clipboard error:', error);
    res.status(500).json({
      error: 'Failed to set clipboard',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
};

/**
 * GET /api/filesystem/clipboard
 * Get current clipboard content
 */
exports.getClipboard = async (req, res) => {
  try {
    const userId = req.user.userId;

    const clipboard = await Clipboard.findOne({ userId });

    if (!clipboard) {
      return res.json({ clipboard: null });
    }

    res.json({
      clipboard: {
        sourcePath: clipboard.sourcePath,
        itemName: clipboard.itemName,
        itemType: clipboard.itemType,
        operation: clipboard.operation,
        createdAt: clipboard.createdAt
      }
    });

  } catch (error) {
    console.error('Get clipboard error:', error);
    res.status(500).json({
      error: 'Failed to get clipboard',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
};

/**
 * POST /api/filesystem/paste
 * Paste clipboard content to target directory
 */
exports.pasteClipboard = async (req, res) => {
  try {
    const userId = req.user.userId;
    let { targetPath } = req.body;

    // Validate
    if (!targetPath) {
      return res.status(400).json({
        error: 'targetPath is required'
      });
    }

    // Normalize path
    if (!targetPath.startsWith('/')) {
      targetPath = '/' + targetPath;
    }

    // Get clipboard
    const clipboard = await Clipboard.findOne({ userId });

    if (!clipboard) {
      return res.status(404).json({
        error: 'Clipboard is empty'
      });
    }

    // Get user's main computer
    const playerAccess = await PlayerAccess.findOne({ userId }).populate('computerId');

    if (!playerAccess) {
      return res.status(404).json({
        error: 'No computer found for user'
      });
    }

    const computerId = playerAccess.computerId._id;

    // Check if pasting in the same location
    const sourceDirPath = clipboard.sourcePath.substring(0, clipboard.sourcePath.lastIndexOf('/')) || '/';
    if (sourceDirPath === targetPath && clipboard.operation === 'cut') {
      return res.status(400).json({
        error: 'Cannot paste in the same location when cutting'
      });
    }

    // Find target directory
    const targetDir = await Filesystem.findOne({
      computerId,
      path: targetPath,
      type: 'directory'
    });

    if (!targetDir) {
      return res.status(404).json({
        error: 'Target directory not found'
      });
    }

    // Check if item already exists in target
    let finalName = clipboard.itemName;
    let counter = 1;
    while (targetDir.children[finalName]) {
      const nameParts = clipboard.itemName.split('.');
      if (nameParts.length > 1) {
        const ext = nameParts.pop();
        const base = nameParts.join('.');
        finalName = `${base}.${counter}.${ext}`;
      } else {
        finalName = `${clipboard.itemName}.${counter}`;
      }
      counter++;
    }

    // Get source item
    const sourceDir = await Filesystem.findOne({
      computerId,
      path: sourceDirPath,
      type: 'directory'
    });

    if (!sourceDir || !sourceDir.children[clipboard.itemName]) {
      return res.status(404).json({
        error: 'Source item not found'
      });
    }

    const sourceItem = sourceDir.children[clipboard.itemName];

    // Calculate copy delay based on file size and disk speed
    const computer = playerAccess.computerId;

    // Get disk speed - use new disks[] array if available, fallback to legacy disk
    let diskSpeed = 5; // Default 5 MB/s
    if (computer.hardware?.disks?.length > 0) {
      // Find the disk that contains the destination path
      const targetDisk = computer.hardware.disks.find(disk =>
        disk.partitions?.some(p => destPath.startsWith(p.mountPoint))
      );
      diskSpeed = targetDisk?.speed || computer.hardware.disks[0]?.speed || 5;
    } else if (computer.hardware?.disk?.speed) {
      diskSpeed = computer.hardware.disk.speed;
    }

    let fileSize = 0;
    if (clipboard.itemType !== 'directory') {
      // For files, use the actual file size
      fileSize = sourceItem.size || 0;
    } else {
      // For directories, calculate total size recursively
      const sourceSubdir = await Filesystem.findById(sourceItem.fsId);
      if (sourceSubdir) {
        fileSize = await calculateDirectorySize(sourceSubdir);
      }
    }

    // Calculate delay in milliseconds
    // Formula: (fileSize in bytes / (diskSpeed in MB/s * 1024 * 1024)) * 1000
    const delayMs = Math.ceil((fileSize / (diskSpeed * 1024 * 1024)) * 1000);

    // Minimum delay of 50ms for UX, max 10 seconds to prevent long waits
    const finalDelay = Math.min(Math.max(delayMs, 50), 10000);

    // Copy or move the item
    if (clipboard.itemType === 'directory') {
      // Handle directory copy/move
      const sourceSubdir = await Filesystem.findById(sourceItem.fsId);

      if (!sourceSubdir) {
        return res.status(404).json({
          error: 'Source directory not found'
        });
      }

      if (clipboard.operation === 'copy') {
        // Copy directory (deep copy)
        const newPath = targetPath === '/' ? `/${finalName}` : `${targetPath}/${finalName}`;
        const newDir = await copyDirectoryRecursive(sourceSubdir, newPath, computerId);

        // Add reference to target
        targetDir.children[finalName] = {
          type: 'directory_ref',
          fsId: newDir._id
        };
      } else {
        // Move directory (cut)
        const newPath = targetPath === '/' ? `/${finalName}` : `${targetPath}/${finalName}`;

        // Update the directory path
        await updateDirectoryPath(sourceSubdir._id, newPath);

        // Remove from source
        delete sourceDir.children[clipboard.itemName];
        sourceDir.markModified('children');
        await sourceDir.save();

        // Add to target
        targetDir.children[finalName] = {
          type: 'directory_ref',
          fsId: sourceSubdir._id
        };
      }
    } else {
      // Handle file copy/move
      if (clipboard.operation === 'copy') {
        // Copy file
        targetDir.children[finalName] = {
          ...sourceItem,
          createdAt: new Date(),
          modifiedAt: new Date()
        };
      } else {
        // Move file (cut)
        targetDir.children[finalName] = sourceItem;

        // Remove from source
        delete sourceDir.children[clipboard.itemName];
        sourceDir.markModified('children');
        await sourceDir.save();
      }
    }

    targetDir.markModified('children');
    targetDir.modifiedAt = new Date();
    await targetDir.save();

    // Clear clipboard after cut operation
    if (clipboard.operation === 'cut') {
      await Clipboard.deleteOne({ userId });
    }

    res.json({
      message: `Item ${clipboard.operation === 'copy' ? 'copied' : 'moved'} successfully`,
      newItem: {
        name: finalName,
        type: clipboard.itemType,
        path: targetPath === '/' ? `/${finalName}` : `${targetPath}/${finalName}`
      },
      operation: clipboard.operation,
      sourceDirPath: clipboard.operation === 'cut' ? sourceDirPath : null,
      copyDelay: finalDelay,  // Delay in milliseconds
      fileSize: fileSize       // File size in bytes
    });

  } catch (error) {
    console.error('Paste clipboard error:', error);
    res.status(500).json({
      error: 'Failed to paste item',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
};

/**
 * PUT /api/filesystem/rename
 * Rename a file or directory
 */
exports.renameItem = async (req, res) => {
  try {
    const userId = req.user.userId;
    let { itemPath, newName } = req.body;

    // Validate
    if (!itemPath || !newName || !newName.trim()) {
      return res.status(400).json({
        error: 'itemPath and newName are required'
      });
    }

    // Normalize path
    if (!itemPath.startsWith('/')) {
      itemPath = '/' + itemPath;
    }

    // Get user's main computer
    const playerAccess = await PlayerAccess.findOne({ userId }).populate('computerId');

    if (!playerAccess) {
      return res.status(404).json({
        error: 'No computer found for user'
      });
    }

    const computerId = playerAccess.computerId._id;

    // Parse path to get directory and item name
    const pathParts = itemPath.split('/').filter(p => p);
    const oldName = pathParts.pop();
    const dirPath = '/' + (pathParts.length > 0 ? pathParts.join('/') : '');

    // Find the parent directory
    const parentDir = await Filesystem.findOne({
      computerId,
      path: dirPath || '/',
      type: 'directory'
    });

    if (!parentDir || !parentDir.children[oldName]) {
      return res.status(404).json({
        error: 'Item not found'
      });
    }

    // Check if new name already exists
    if (parentDir.children[newName.trim()]) {
      return res.status(409).json({
        error: 'An item with this name already exists'
      });
    }

    const itemData = parentDir.children[oldName];

    // If it's a directory, also update the directory path
    if (itemData.type === 'directory_ref') {
      const newPath = dirPath === '/' ? `/${newName.trim()}` : `${dirPath}/${newName.trim()}`;
      await updateDirectoryPath(itemData.fsId, newPath);
    }

    // Rename in parent's children
    parentDir.children[newName.trim()] = itemData;
    delete parentDir.children[oldName];
    parentDir.markModified('children');
    parentDir.modifiedAt = new Date();
    await parentDir.save();

    res.json({
      message: 'Item renamed successfully',
      oldName,
      newName: newName.trim(),
      path: dirPath,
      itemType: itemData.type === 'directory_ref' ? 'directory' : itemData.type
    });

  } catch (error) {
    console.error('Rename item error:', error);
    res.status(500).json({
      error: 'Failed to rename item',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
};

/**
 * Helper function to copy directory recursively
 */
async function copyDirectoryRecursive(sourceDir, newPath, computerId) {
  // Create new directory
  const newDir = await Filesystem.create({
    computerId,
    path: newPath,
    type: 'directory',
    owner: sourceDir.owner,
    permissions: sourceDir.permissions,
    children: {}
  });

  // Copy all children
  for (const [name, child] of Object.entries(sourceDir.children)) {
    if (child.type === 'directory_ref') {
      // Recursively copy subdirectory
      const childDir = await Filesystem.findById(child.fsId);
      if (childDir) {
        const childNewPath = `${newPath}/${name}`;
        const copiedChild = await copyDirectoryRecursive(childDir, childNewPath, computerId);
        newDir.children[name] = {
          type: 'directory_ref',
          fsId: copiedChild._id
        };
      }
    } else {
      // Copy file
      newDir.children[name] = {
        ...child,
        createdAt: new Date(),
        modifiedAt: new Date()
      };
    }
  }

  newDir.markModified('children');
  await newDir.save();

  return newDir;
}

/**
 * Helper function to update directory path recursively
 */
async function updateDirectoryPath(dirId, newPath) {
  const dir = await Filesystem.findById(dirId);
  if (!dir) return;

  dir.path = newPath;
  await dir.save();

  // Update all subdirectories
  for (const [name, child] of Object.entries(dir.children)) {
    if (child.type === 'directory_ref') {
      const childNewPath = `${newPath}/${name}`;
      await updateDirectoryPath(child.fsId, childNewPath);
    }
  }
}

/**
 * Helper function to calculate total size of directory recursively
 */
async function calculateDirectorySize(dir) {
  let totalSize = 0;

  for (const [name, child] of Object.entries(dir.children)) {
    if (child.type === 'directory_ref') {
      // Recursively calculate subdirectory size
      const subdir = await Filesystem.findById(child.fsId);
      if (subdir) {
        totalSize += await calculateDirectorySize(subdir);
      }
    } else {
      // Add file size
      totalSize += child.size || 0;
    }
  }

  return totalSize;
}
