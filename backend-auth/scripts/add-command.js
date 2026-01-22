/**
 * Migration script to add a command to existing users
 * Run with: node scripts/add-command.js <command>
 * Example: node scripts/add-command.js rm
 */

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Filesystem = require('../src/models/Filesystem');

async function migrate(commandName) {
  if (!commandName) {
    console.error('Usage: node scripts/add-command.js <command>');
    console.error('Example: node scripts/add-command.js rm');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Load bytecode and source
    const bytecodePath = path.join(__dirname, `../src/syscript/binaries/${commandName}-bytecode.json`);
    const sourcePath = path.join(__dirname, `../src/syscript/sources/${commandName}.syscript`);

    if (!fs.existsSync(bytecodePath)) {
      console.error(`Bytecode not found: ${bytecodePath}`);
      process.exit(1);
    }
    if (!fs.existsSync(sourcePath)) {
      console.error(`Source not found: ${sourcePath}`);
      process.exit(1);
    }

    const bytecode = JSON.parse(fs.readFileSync(bytecodePath, 'utf8'));
    const sourceContent = fs.readFileSync(sourcePath, 'utf8');

    // Find all /bin directories
    const binDirs = await Filesystem.find({ path: '/bin' });
    console.log(`Found ${binDirs.length} /bin directories to update`);

    for (const binDir of binDirs) {
      if (!binDir.children[commandName]) {
        binDir.children[commandName] = {
          type: 'binary',
          owner: 'root',
          permissions: '755',
          size: JSON.stringify(bytecode).length,
          description: `${commandName} command`,
          bytecode: bytecode,
          createdAt: new Date(),
          modifiedAt: new Date()
        };
        binDir.markModified('children');
        await binDir.save();
        console.log(`Added ${commandName} to /bin for computer ${binDir.computerId}`);
      } else {
        console.log(`${commandName} already exists in /bin for computer ${binDir.computerId}`);
      }
    }

    // Find all /usr/src/bin directories
    const srcBinDirs = await Filesystem.find({ path: '/usr/src/bin' });
    console.log(`Found ${srcBinDirs.length} /usr/src/bin directories to update`);

    for (const srcBinDir of srcBinDirs) {
      const sourceFileName = `${commandName}.syscript`;
      if (!srcBinDir.children[sourceFileName]) {
        srcBinDir.children[sourceFileName] = {
          type: 'source',
          owner: 'root',
          permissions: '644',
          size: Buffer.byteLength(sourceContent, 'utf8'),
          content: sourceContent,
          createdAt: new Date(),
          modifiedAt: new Date()
        };
        srcBinDir.markModified('children');
        await srcBinDir.save();
        console.log(`Added ${sourceFileName} to /usr/src/bin for computer ${srcBinDir.computerId}`);
      } else {
        console.log(`${sourceFileName} already exists in /usr/src/bin for computer ${srcBinDir.computerId}`);
      }
    }

    console.log('Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate(process.argv[2]);
