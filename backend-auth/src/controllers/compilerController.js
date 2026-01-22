const PlayerAccess = require('../models/PlayerAccess');
const Filesystem = require('../models/Filesystem');
const { compileSyscript } = require('../syscript/compiler');

/**
 * POST /api/compiler/compile
 * Compile a .syscript file to binary
 */
exports.compile = async (req, res) => {
  try {
    const { sourcePath, outputPath } = req.body;
    const userId = req.user.userId;

    if (!sourcePath) {
      return res.status(400).json({ error: 'sourcePath is required' });
    }

    // Get player's computer
    const playerAccess = await PlayerAccess.findOne({ userId }).populate('computerId');
    if (!playerAccess) {
      return res.status(404).json({ error: 'No active computer session' });
    }

    const computerId = playerAccess.computerId._id;

    // Read source file
    const sourceContent = await readFile(computerId, sourcePath);
    if (!sourceContent) {
      return res.status(404).json({ error: 'Source file not found' });
    }

    // Compile source code
    const compileResult = compileSyscript(sourceContent);

    if (!compileResult.success) {
      return res.status(400).json({
        success: false,
        errors: compileResult.errors
      });
    }

    // Determine output path
    let finalOutputPath = outputPath;
    if (!finalOutputPath) {
      // Remove .syscript extension and use as output name
      finalOutputPath = sourcePath.replace(/\.syscript$/, '');
    }

    // Write binary file
    const writeResult = await writeBinary(computerId, finalOutputPath, compileResult.bytecode);

    if (!writeResult.success) {
      return res.status(500).json({
        success: false,
        error: writeResult.error
      });
    }

    res.json({
      success: true,
      outputPath: finalOutputPath,
      bytecodeSize: JSON.stringify(compileResult.bytecode).length,
      errors: []
    });

  } catch (error) {
    console.error('Compiler error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Read a file from the filesystem
 */
async function readFile(computerId, filePath) {
  try {
    const parts = filePath.split('/').filter(p => p);
    const fileName = parts.pop();
    const dirPath = '/' + parts.join('/');

    // Find directory
    const directory = await Filesystem.findOne({
      computerId,
      path: dirPath || '/'
    });

    if (!directory || !directory.children[fileName]) {
      return null;
    }

    const file = directory.children[fileName];

    // Check if it's a text/source file
    if (file.type === 'source' || file.type === 'text') {
      return file.content;
    }

    return null;
  } catch (error) {
    console.error('readFile error:', error);
    return null;
  }
}

/**
 * Write a binary file to the filesystem
 */
async function writeBinary(computerId, filePath, bytecode) {
  try {
    const parts = filePath.split('/').filter(p => p);
    const fileName = parts.pop();
    const dirPath = '/' + parts.join('/');

    // Find parent directory
    const directory = await Filesystem.findOne({
      computerId,
      path: dirPath || '/'
    });

    if (!directory) {
      return { success: false, error: 'Parent directory not found' };
    }

    // Create binary file
    directory.children[fileName] = {
      type: 'binary',
      owner: 'user',
      permissions: '755',
      size: JSON.stringify(bytecode).length,
      description: 'Compiled Syscript binary',
      bytecode: bytecode,
      createdAt: new Date(),
      modifiedAt: new Date()
    };

    directory.markModified('children');
    directory.modifiedAt = new Date();
    await directory.save();

    return { success: true };
  } catch (error) {
    console.error('writeBinary error:', error);
    return { success: false, error: error.message };
  }
}
