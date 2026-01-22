const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getSQLPool, sql } = require('../config/database');
const { Computer, Filesystem, PlayerAccess, Process } = require('../models');

/**
 * Generate unique IP address for new computers
 */
const generateUniqueIP = async () => {
  let ip;
  let exists = true;

  while (exists) {
    // Generate random IP in range 45.0.0.0 - 45.255.255.255
    const octet2 = Math.floor(Math.random() * 256);
    const octet3 = Math.floor(Math.random() * 256);
    const octet4 = Math.floor(Math.random() * 256);
    ip = `45.${octet2}.${octet3}.${octet4}`;

    // Check if IP already exists
    const existing = await Computer.findOne({ ip });
    exists = !!existing;
  }

  return ip;
};

/**
 * Generate random password
 */
const generatePassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

/**
 * Initialize filesystem for new computer
 */
const initializeFilesystem = async (computerId, username) => {
  // Load bytecodes for system commands
  const fs = require('fs');
  const path = require('path');

  const cdBytecode = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../syscript/binaries/cd-bytecode.json'), 'utf8')
  );
  const lsBytecode = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../syscript/binaries/ls-bytecode.json'), 'utf8')
  );
  const pwdBytecode = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../syscript/binaries/pwd-bytecode.json'), 'utf8')
  );
  const catBytecode = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../syscript/binaries/cat-bytecode.json'), 'utf8')
  );
  const psBytecode = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../syscript/binaries/ps-bytecode.json'), 'utf8')
  );
  const touchBytecode = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../syscript/binaries/touch-bytecode.json'), 'utf8')
  );
  const rmBytecode = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../syscript/binaries/rm-bytecode.json'), 'utf8')
  );
  const echoBytecode = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../syscript/binaries/echo-bytecode.json'), 'utf8')
  );
  const mkdirBytecode = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../syscript/binaries/mkdir-bytecode.json'), 'utf8')
  );
  const rmdirBytecode = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../syscript/binaries/rmdir-bytecode.json'), 'utf8')
  );
  const cpBytecode = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../syscript/binaries/cp-bytecode.json'), 'utf8')
  );
  const mvBytecode = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../syscript/binaries/mv-bytecode.json'), 'utf8')
  );
  const clearBytecode = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../syscript/binaries/clear-bytecode.json'), 'utf8')
  );
  const killBytecode = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../syscript/binaries/kill-bytecode.json'), 'utf8')
  );
  const dfBytecode = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../syscript/binaries/df-bytecode.json'), 'utf8')
  );
  const megaechoBytecode = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../syscript/binaries/megaecho-bytecode.json'), 'utf8')
  );
  const fillmeBytecode = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../syscript/binaries/fillme-bytecode.json'), 'utf8')
  );

  // Load source files
  const cdSyscriptContent = fs.readFileSync(
    path.join(__dirname, '../syscript/sources/cd.syscript'), 'utf8'
  );
  const lsSyscriptContent = fs.readFileSync(
    path.join(__dirname, '../syscript/sources/ls.syscript'), 'utf8'
  );
  const pwdSyscriptContent = fs.readFileSync(
    path.join(__dirname, '../syscript/sources/pwd.syscript'), 'utf8'
  );
  const catSyscriptContent = fs.readFileSync(
    path.join(__dirname, '../syscript/sources/cat.syscript'), 'utf8'
  );
  const psSyscriptContent = fs.readFileSync(
    path.join(__dirname, '../syscript/sources/ps.syscript'), 'utf8'
  );
  const touchSyscriptContent = fs.readFileSync(
    path.join(__dirname, '../syscript/sources/touch.syscript'), 'utf8'
  );
  const rmSyscriptContent = fs.readFileSync(
    path.join(__dirname, '../syscript/sources/rm.syscript'), 'utf8'
  );
  const echoSyscriptContent = fs.readFileSync(
    path.join(__dirname, '../syscript/sources/echo.syscript'), 'utf8'
  );
  const mkdirSyscriptContent = fs.readFileSync(
    path.join(__dirname, '../syscript/sources/mkdir.syscript'), 'utf8'
  );
  const rmdirSyscriptContent = fs.readFileSync(
    path.join(__dirname, '../syscript/sources/rmdir.syscript'), 'utf8'
  );
  const cpSyscriptContent = fs.readFileSync(
    path.join(__dirname, '../syscript/sources/cp.syscript'), 'utf8'
  );
  const mvSyscriptContent = fs.readFileSync(
    path.join(__dirname, '../syscript/sources/mv.syscript'), 'utf8'
  );
  const clearSyscriptContent = fs.readFileSync(
    path.join(__dirname, '../syscript/sources/clear.syscript'), 'utf8'
  );
  const killSyscriptContent = fs.readFileSync(
    path.join(__dirname, '../syscript/sources/kill.syscript'), 'utf8'
  );
  const dfSyscriptContent = fs.readFileSync(
    path.join(__dirname, '../syscript/sources/df.syscript'), 'utf8'
  );
  const megaechoSyscriptContent = fs.readFileSync(
    path.join(__dirname, '../syscript/sources/megaecho.syscript'), 'utf8'
  );
  const fillmeSyscriptContent = fs.readFileSync(
    path.join(__dirname, '../syscript/sources/fillme.syscript'), 'utf8'
  );

  // Create root directory
  const rootFs = await Filesystem.create({
    computerId,
    path: '/',
    type: 'directory',
    owner: 'root',
    permissions: '755',
    children: {}
  });

  // Create /bin directory (basic CLI system commands)
  // Note: System binaries don't have content, using realistic sizes for CLI tools
  const binFs = await Filesystem.create({
    computerId,
    path: '/bin',
    type: 'directory',
    owner: 'root',
    permissions: '755',
    children: {
      'ls': {
        type: 'binary',
        owner: 'root',
        permissions: '755',
        size: JSON.stringify(lsBytecode).length,
        description: 'List directory contents',
        bytecode: lsBytecode,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'cat': {
        type: 'binary',
        owner: 'root',
        permissions: '755',
        size: JSON.stringify(catBytecode).length,
        description: 'Concatenate and display files',
        bytecode: catBytecode,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'cd': {
        type: 'binary',
        owner: 'root',
        permissions: '755',
        size: JSON.stringify(cdBytecode).length,
        description: 'Change directory',
        bytecode: cdBytecode,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'pwd': {
        type: 'binary',
        owner: 'root',
        permissions: '755',
        size: JSON.stringify(pwdBytecode).length,
        description: 'Print working directory',
        bytecode: pwdBytecode,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'ps': {
        type: 'binary',
        owner: 'root',
        permissions: '755',
        size: JSON.stringify(psBytecode).length,
        description: 'List running processes',
        bytecode: psBytecode,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'touch': {
        type: 'binary',
        owner: 'root',
        permissions: '755',
        size: JSON.stringify(touchBytecode).length,
        description: 'Create empty file',
        bytecode: touchBytecode,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'rm': {
        type: 'binary',
        owner: 'root',
        permissions: '755',
        size: JSON.stringify(rmBytecode).length,
        description: 'Remove file',
        bytecode: rmBytecode,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'echo': {
        type: 'binary',
        owner: 'root',
        permissions: '755',
        size: JSON.stringify(echoBytecode).length,
        description: 'Display text',
        bytecode: echoBytecode,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'mkdir': {
        type: 'binary',
        owner: 'root',
        permissions: '755',
        size: JSON.stringify(mkdirBytecode).length,
        description: 'Make directory',
        bytecode: mkdirBytecode,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'rmdir': {
        type: 'binary',
        owner: 'root',
        permissions: '755',
        size: JSON.stringify(rmdirBytecode).length,
        description: 'Remove empty directory',
        bytecode: rmdirBytecode,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'cp': {
        type: 'binary',
        owner: 'root',
        permissions: '755',
        size: JSON.stringify(cpBytecode).length,
        description: 'Copy file',
        bytecode: cpBytecode,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'mv': {
        type: 'binary',
        owner: 'root',
        permissions: '755',
        size: JSON.stringify(mvBytecode).length,
        description: 'Move/rename file',
        bytecode: mvBytecode,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'clear': {
        type: 'binary',
        owner: 'root',
        permissions: '755',
        size: JSON.stringify(clearBytecode).length,
        description: 'Clear terminal screen',
        bytecode: clearBytecode,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'kill': {
        type: 'binary',
        owner: 'root',
        permissions: '755',
        size: JSON.stringify(killBytecode).length,
        description: 'Terminate a process',
        bytecode: killBytecode,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'df': {
        type: 'binary',
        owner: 'root',
        permissions: '755',
        size: JSON.stringify(dfBytecode).length,
        description: 'Display disk space usage',
        bytecode: dfBytecode,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'megaecho': {
        type: 'binary',
        owner: 'root',
        permissions: '755',
        size: JSON.stringify(megaechoBytecode).length,
        description: 'Echo message multiple times',
        bytecode: megaechoBytecode,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'fillme': {
        type: 'binary',
        owner: 'root',
        permissions: '755',
        size: JSON.stringify(fillmeBytecode).length,
        description: 'Fill disk with data chunks',
        bytecode: fillmeBytecode,
        createdAt: new Date(),
        modifiedAt: new Date()
      }
    }
  });

  // Create /usr directory
  const usrFs = await Filesystem.create({
    computerId,
    path: '/usr',
    type: 'directory',
    owner: 'root',
    permissions: '755',
    children: {}
  });

  // Create /usr/src directory (source files)
  const usrSrcFs = await Filesystem.create({
    computerId,
    path: '/usr/src',
    type: 'directory',
    owner: 'root',
    permissions: '755',
    children: {
      'cd.syscript': {
        type: 'source',
        owner: 'root',
        permissions: '644',
        size: Buffer.byteLength(cdSyscriptContent, 'utf8'),
        content: cdSyscriptContent,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'ls.syscript': {
        type: 'source',
        owner: 'root',
        permissions: '644',
        size: Buffer.byteLength(lsSyscriptContent, 'utf8'),
        content: lsSyscriptContent,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'pwd.syscript': {
        type: 'source',
        owner: 'root',
        permissions: '644',
        size: Buffer.byteLength(pwdSyscriptContent, 'utf8'),
        content: pwdSyscriptContent,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'cat.syscript': {
        type: 'source',
        owner: 'root',
        permissions: '644',
        size: Buffer.byteLength(catSyscriptContent, 'utf8'),
        content: catSyscriptContent,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'ps.syscript': {
        type: 'source',
        owner: 'root',
        permissions: '644',
        size: Buffer.byteLength(psSyscriptContent, 'utf8'),
        content: psSyscriptContent,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'touch.syscript': {
        type: 'source',
        owner: 'root',
        permissions: '644',
        size: Buffer.byteLength(touchSyscriptContent, 'utf8'),
        content: touchSyscriptContent,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'rm.syscript': {
        type: 'source',
        owner: 'root',
        permissions: '644',
        size: Buffer.byteLength(rmSyscriptContent, 'utf8'),
        content: rmSyscriptContent,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'echo.syscript': {
        type: 'source',
        owner: 'root',
        permissions: '644',
        size: Buffer.byteLength(echoSyscriptContent, 'utf8'),
        content: echoSyscriptContent,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'mkdir.syscript': {
        type: 'source',
        owner: 'root',
        permissions: '644',
        size: Buffer.byteLength(mkdirSyscriptContent, 'utf8'),
        content: mkdirSyscriptContent,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'rmdir.syscript': {
        type: 'source',
        owner: 'root',
        permissions: '644',
        size: Buffer.byteLength(rmdirSyscriptContent, 'utf8'),
        content: rmdirSyscriptContent,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'cp.syscript': {
        type: 'source',
        owner: 'root',
        permissions: '644',
        size: Buffer.byteLength(cpSyscriptContent, 'utf8'),
        content: cpSyscriptContent,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'mv.syscript': {
        type: 'source',
        owner: 'root',
        permissions: '644',
        size: Buffer.byteLength(mvSyscriptContent, 'utf8'),
        content: mvSyscriptContent,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'clear.syscript': {
        type: 'source',
        owner: 'root',
        permissions: '644',
        size: Buffer.byteLength(clearSyscriptContent, 'utf8'),
        content: clearSyscriptContent,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'kill.syscript': {
        type: 'source',
        owner: 'root',
        permissions: '644',
        size: Buffer.byteLength(killSyscriptContent, 'utf8'),
        content: killSyscriptContent,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'df.syscript': {
        type: 'source',
        owner: 'root',
        permissions: '644',
        size: Buffer.byteLength(dfSyscriptContent, 'utf8'),
        content: dfSyscriptContent,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'megaecho.syscript': {
        type: 'source',
        owner: 'root',
        permissions: '644',
        size: Buffer.byteLength(megaechoSyscriptContent, 'utf8'),
        content: megaechoSyscriptContent,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'fillme.syscript': {
        type: 'source',
        owner: 'root',
        permissions: '644',
        size: Buffer.byteLength(fillmeSyscriptContent, 'utf8'),
        content: fillmeSyscriptContent,
        createdAt: new Date(),
        modifiedAt: new Date()
      }
    }
  });

  // Create /usr/bin directory (system GUI applications)
  // Note: GUI applications are larger than CLI tools (1-5 MB realistic for basic GUI apps)
  const usrBinFs = await Filesystem.create({
    computerId,
    path: '/usr/bin',
    type: 'directory',
    owner: 'root',
    permissions: '755',
    children: {
      'terminal': {
        type: 'systemBinary',
        owner: 'root',
        permissions: '755',
        size: 1572864, // 1.5 MB - realistic for terminal GUI
        description: 'Terminal emulator application',
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'filemanager': {
        type: 'systemBinary',
        owner: 'root',
        permissions: '755',
        size: 3145728, // 3 MB - realistic for file manager GUI
        description: 'File manager application',
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'sysmonitor': {
        type: 'systemBinary',
        owner: 'root',
        permissions: '755',
        size: 2097152, // 2 MB - realistic for system monitor GUI
        description: 'System monitor application',
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'texteditor': {
        type: 'systemBinary',
        owner: 'root',
        permissions: '755',
        size: 1048576, // 1 MB - realistic for text editor GUI
        description: 'Text editor application',
        createdAt: new Date(),
        modifiedAt: new Date()
      }
    }
  });

  // Create /etc directory (system config)
  const etcFs = await Filesystem.create({
    computerId,
    path: '/etc',
    type: 'directory',
    owner: 'root',
    permissions: '755',
    children: {}
  });

  // Create /home directory
  const homeFs = await Filesystem.create({
    computerId,
    path: '/home',
    type: 'directory',
    owner: 'root',
    permissions: '755',
    children: {}
  });

  // Create /home/examples directory
  const helloScContent = `void Main() {\n    Console.Log("Hello, Hacker!");\n}`;
  const examplesFs = await Filesystem.create({
    computerId,
    path: '/home/examples',
    type: 'directory',
    owner: 'user',
    permissions: '755',
    children: {
      'hello.sc': {
        type: 'source',
        owner: 'user',
        permissions: '644',
        size: Buffer.byteLength(helloScContent, 'utf8'),
        content: helloScContent,
        createdAt: new Date(),
        modifiedAt: new Date()
      }
    }
  });

  // Create /dev directory (device files - simulated block/character devices)
  const devFs = await Filesystem.create({
    computerId,
    path: '/dev',
    type: 'directory',
    owner: 'root',
    permissions: '755',
    children: {
      'sda': {
        type: 'device',
        deviceType: 'block',
        owner: 'root',
        permissions: '660',
        size: 0,
        description: 'SATA disk device',
        major: 8,
        minor: 0,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'sda1': {
        type: 'device',
        deviceType: 'block',
        owner: 'root',
        permissions: '660',
        size: 0,
        description: 'SATA disk partition 1 (root filesystem)',
        major: 8,
        minor: 1,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'null': {
        type: 'device',
        deviceType: 'char',
        owner: 'root',
        permissions: '666',
        size: 0,
        description: 'Null device - discards all input',
        major: 1,
        minor: 3,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'zero': {
        type: 'device',
        deviceType: 'char',
        owner: 'root',
        permissions: '666',
        size: 0,
        description: 'Zero device - provides null bytes',
        major: 1,
        minor: 5,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'random': {
        type: 'device',
        deviceType: 'char',
        owner: 'root',
        permissions: '666',
        size: 0,
        description: 'Random number generator',
        major: 1,
        minor: 8,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'urandom': {
        type: 'device',
        deviceType: 'char',
        owner: 'root',
        permissions: '666',
        size: 0,
        description: 'Unlimited random number generator',
        major: 1,
        minor: 9,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'tty': {
        type: 'device',
        deviceType: 'char',
        owner: 'root',
        permissions: '666',
        size: 0,
        description: 'Current terminal device',
        major: 5,
        minor: 0,
        createdAt: new Date(),
        modifiedAt: new Date()
      }
    }
  });

  // Create /proc directory (virtual filesystem - kernel info)
  const procFs = await Filesystem.create({
    computerId,
    path: '/proc',
    type: 'directory',
    owner: 'root',
    permissions: '555',  // Read-only
    children: {
      'version': {
        type: 'virtual',
        owner: 'root',
        permissions: '444',
        content: 'SynapseOS version 1.0.0 (synapse-kernel 5.15.0-generic)',
        size: 52,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'cpuinfo': {
        type: 'virtual',
        owner: 'root',
        permissions: '444',
        generator: 'cpuinfo',  // Dynamic generation flag
        size: 0,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'meminfo': {
        type: 'virtual',
        owner: 'root',
        permissions: '444',
        generator: 'meminfo',  // Dynamic generation flag
        size: 0,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'mounts': {
        type: 'virtual',
        owner: 'root',
        permissions: '444',
        generator: 'mounts',  // Dynamic generation from disks[]
        size: 0,
        createdAt: new Date(),
        modifiedAt: new Date()
      }
    }
  });

  // Create user's Desktop directory
  const welcomeTxtContent = `Welcome to your Desktop!\n\nThis is where you can store your files and shortcuts.\n\nDouble-click any file to open it.\n\nGood luck, hacker!`;
  const desktopFs = await Filesystem.create({
    computerId,
    path: `/home/${username}/Desktop`,
    type: 'directory',
    owner: 'user',
    permissions: '755',
    children: {
      'Welcome.txt': {
        type: 'text',
        owner: 'user',
        permissions: '644',
        size: Buffer.byteLength(welcomeTxtContent, 'utf8'),
        content: welcomeTxtContent,
        createdAt: new Date(),
        modifiedAt: new Date()
      }
    }
  });

  // Create user's home directory /home/{username}
  const readmeMdContent = `# Welcome, ${username}\n\nYou just booted your PC. You are in your personal terminal.\n\n## First Steps\n\n1. Type \`ls\` to see your files\n2. Read the tutorial: \`cat TUTORIAL.md\`\n3. Check examples: \`ls /home/examples\`\n\n## Your First Mission\n\nYour goal is simple: hack a server and steal data to earn money.\n\nSteps:\n1. Scan the network\n2. Choose an easy target\n3. Execute an exploit\n4. Steal files\n5. ⚠️ IMPORTANT: Delete your logs\n6. Sell the data\n\nGood luck, and don't get caught.\n\n- The System`;
  const tutorialMdContent = `# Tutorial - Getting Started\n\n## Basic Commands\n\nComing soon...\n\nFor now:\n- Use \`ls\` to list files\n- Use \`cat <file>\` to read files\n- Check /home/examples for sample scripts\n\nMore documentation will be added as you progress.`;

  const userHomeFs = await Filesystem.create({
    computerId,
    path: `/home/${username}`,
    type: 'directory',
    owner: 'user',
    permissions: '755',
    children: {
      'README.md': {
        type: 'text',
        owner: 'user',
        permissions: '644',
        size: Buffer.byteLength(readmeMdContent, 'utf8'),
        content: readmeMdContent,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      'TUTORIAL.md': {
        type: 'text',
        owner: 'user',
        permissions: '644',
        size: Buffer.byteLength(tutorialMdContent, 'utf8'),
        content: tutorialMdContent,
        createdAt: new Date(),
        modifiedAt: new Date()
      }
    }
  });

  // Link /usr/src and /usr/bin in /usr
  await usrFs.addSubdirectory('src', usrSrcFs._id);
  await usrFs.addSubdirectory('bin', usrBinFs._id);

  // Link directories in root
  await rootFs.addSubdirectory('bin', binFs._id);
  await rootFs.addSubdirectory('dev', devFs._id);
  await rootFs.addSubdirectory('proc', procFs._id);
  await rootFs.addSubdirectory('usr', usrFs._id);
  await rootFs.addSubdirectory('etc', etcFs._id);
  await rootFs.addSubdirectory('home', homeFs._id);

  // Link Desktop in user's home directory
  await userHomeFs.addSubdirectory('Desktop', desktopFs._id);

  // Link user directories in /home
  await homeFs.addSubdirectory(username, userHomeFs._id);
  await homeFs.addSubdirectory('examples', examplesFs._id);

  return rootFs;
};

/**
 * POST /auth/register
 * Register new user and create initial computer
 */
exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({
        error: 'Username, email, and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters'
      });
    }

    const pool = getSQLPool();

    // Check if user already exists
    const checkUser = await pool.request()
      .input('email', sql.NVarChar, email)
      .input('username', sql.NVarChar, username)
      .query('SELECT id FROM Users WHERE email = @email OR username = @username');

    if (checkUser.recordset.length > 0) {
      return res.status(409).json({
        error: 'User already exists with that email or username'
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user in SQL Server
    const result = await pool.request()
      .input('username', sql.NVarChar, username)
      .input('email', sql.NVarChar, email)
      .input('password_hash', sql.NVarChar, passwordHash)
      .query(`
        INSERT INTO Users (username, email, password_hash, created_at, is_active)
        OUTPUT INSERTED.id, INSERTED.username, INSERTED.email, INSERTED.created_at
        VALUES (@username, @email, @password_hash, GETDATE(), 1)
      `);

    const user = result.recordset[0];

    // Generate unique IP and password for computer
    const computerIP = await generateUniqueIP();
    const computerPassword = generatePassword();
    const computerPasswordHash = await bcrypt.hash(computerPassword, 10);

    // Create computer in MongoDB
    const computer = await Computer.create({
      type: 'player_pc',
      name: 'Desktop PC',
      ip: computerIP,
      hardware: {
        cpu: { model: 'SpudCore 2500', speed: 2500 },  // 2.5 KHz = Tier 0 (starter)
        ram: 2048,      // 2GB
        disk: { capacity: 50000, speed: 5 },  // Legacy (deprecated)
        disks: [{
          id: 'disk0',
          device: 'sda',
          name: 'Seagate Barracuda 50GB',
          type: 'hdd',
          capacity: 50000,
          speed: 5,
          partitions: [{
            device: 'sda1',
            mountPoint: '/',
            size: 50000,
            filesystem: 'ext4'
          }]
        }],
        gpu: { model: 'Integrated Graphics', power: 1 },
        network: { speed: 10, ping: 50 }
      },
      accounts: [{
        username: 'user',
        passwordHash: computerPasswordHash,
        permissions: 'admin'
      }],
      npcOwner: null,
      security: {
        hasFirewall: false,
        encryptionLevel: 0,
        ports: [
          { number: 22, service: 'ssh', open: true },
          { number: 80, service: 'http', open: true }
        ]
      }
    });

    // Initialize filesystem with user's home directory
    const rootFilesystem = await initializeFilesystem(computer._id, username);

    // Update computer with filesystem reference
    computer.filesystemId = rootFilesystem._id;
    await computer.save();

    // Initialize default processes for this computer
    await Process.initializeDefaults(computer._id, computer.type);

    // Grant player access to computer
    await PlayerAccess.create({
      userId: user.id,
      computerId: computer._id,
      username: 'user',
      password: computerPassword,  // Plain text - player knows it
      hasRootAccess: true
    });

    // Generate JWT
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        email: user.email
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // Create session in SQL Server
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await pool.request()
      .input('user_id', sql.Int, user.id)
      .input('token', sql.NVarChar, token)
      .input('expires_at', sql.DateTime, expiresAt)
      .input('ip_address', sql.NVarChar, req.ip)
      .input('user_agent', sql.NVarChar, req.headers['user-agent'] || 'unknown')
      .query(`
        INSERT INTO Sessions (user_id, token, expires_at, ip_address, user_agent)
        VALUES (@user_id, @token, @expires_at, @ip_address, @user_agent)
      `);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      },
      computer: {
        _id: computer._id,
        ip: computer.ip,
        name: computer.name,
        credentials: {
          username: 'user',
          password: computerPassword
        }
      }
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      error: 'Registration failed',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
};

/**
 * POST /auth/login
 * Login existing user
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    const pool = getSQLPool();

    // Find user
    const result = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT id, username, email, password_hash FROM Users WHERE email = @email AND is_active = 1');

    if (result.recordset.length === 0) {
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    const user = result.recordset[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    // Update last login
    await pool.request()
      .input('user_id', sql.Int, user.id)
      .query('UPDATE Users SET last_login = GETDATE() WHERE id = @user_id');

    // Generate JWT
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        email: user.email
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // Create session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await pool.request()
      .input('user_id', sql.Int, user.id)
      .input('token', sql.NVarChar, token)
      .input('expires_at', sql.DateTime, expiresAt)
      .input('ip_address', sql.NVarChar, req.ip)
      .input('user_agent', sql.NVarChar, req.headers['user-agent'] || 'unknown')
      .query(`
        INSERT INTO Sessions (user_id, token, expires_at, ip_address, user_agent)
        VALUES (@user_id, @token, @expires_at, @ip_address, @user_agent)
      `);

    // Get player's main computer
    const playerAccess = await PlayerAccess.findOne({ userId: user.id }).populate('computerId');

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      },
      computer: playerAccess ? {
        _id: playerAccess.computerId._id,
        ip: playerAccess.computerId.ip,
        name: playerAccess.computerId.name
      } : null
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
};

/**
 * GET /auth/me
 * Get current user info (requires auth middleware)
 */
exports.me = async (req, res) => {
  try {
    const pool = getSQLPool();

    // Get user from SQL
    const result = await pool.request()
      .input('user_id', sql.Int, req.user.userId)
      .query('SELECT id, username, email, created_at, last_login FROM Users WHERE id = @user_id');

    if (result.recordset.length === 0) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    const user = result.recordset[0];

    // Get player's computers
    const computers = await PlayerAccess.find({ userId: user.id }).populate('computerId');

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.created_at,
        lastLogin: user.last_login
      },
      computers: computers.map(access => ({
        ip: access.computerId.ip,
        name: access.computerId.name,
        username: access.username,
        hasRootAccess: access.hasRootAccess
      }))
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      error: 'Failed to get user info',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
};

/**
 * POST /auth/reset-computer
 * Destroy current computer and create a new one (for testing)
 */
exports.resetComputer = async (req, res) => {
  try {
    const userId = req.user.userId;
    const username = req.user.username;

    // Get current player access
    const playerAccess = await PlayerAccess.findOne({ userId }).populate('computerId');

    if (playerAccess && playerAccess.computerId) {
      const computerId = playerAccess.computerId._id;

      // Delete all filesystems for this computer
      await Filesystem.deleteMany({ computerId });

      // Delete all processes for this computer
      await Process.deleteMany({ computerId });

      // Delete clipboard
      const Clipboard = require('../models/Clipboard');
      await Clipboard.deleteMany({ userId });

      // Delete computer
      await Computer.findByIdAndDelete(computerId);

      // Delete player access
      await PlayerAccess.deleteMany({ userId });
    }

    // Generate new unique IP
    const newIp = await generateUniqueIP();

    // Generate new password
    const computerPassword = generatePassword();

    // Create new computer
    const newComputer = await Computer.create({
      type: 'player_pc',
      name: `${username}-PC`,
      ip: newIp,
      hardware: {
        cpu: { model: 'SpudCore 2500', speed: 2500 },  // 2.5 KHz = Tier 0 (starter)
        ram: 2048,      // 2GB - Reset to starter
        disk: { capacity: 50000, speed: 5 },  // Legacy (deprecated)
        disks: [{
          id: 'disk0',
          device: 'sda',
          name: 'Seagate Barracuda 50GB',
          type: 'hdd',
          capacity: 50000,
          speed: 5,
          partitions: [{
            device: 'sda1',
            mountPoint: '/',
            size: 50000,
            filesystem: 'ext4'
          }]
        }],
        gpu: { model: 'Integrated Graphics', power: 1 },
        network: { speed: 10, ping: 50 }
      },
      accounts: [
        {
          username: 'root',
          passwordHash: await require('bcryptjs').hash('toor', 10),
          permissions: 'root'
        },
        {
          username: 'user',
          passwordHash: await require('bcryptjs').hash(computerPassword, 10),
          permissions: 'user'
        }
      ],
      security: {
        hasFirewall: false,
        encryptionLevel: 0,
        ports: [
          { number: 22, service: 'SSH', open: true },
          { number: 80, service: 'HTTP', open: false }
        ]
      }
    });

    // Initialize filesystem
    await initializeFilesystem(newComputer._id, username);

    // Initialize default processes
    await Process.initializeDefaults(newComputer._id, newComputer.type);

    // Create player access
    await PlayerAccess.create({
      userId,
      computerId: newComputer._id,
      username: 'user',
      password: computerPassword,
      hasRootAccess: false
    });

    res.json({
      message: 'Computer destroyed and recreated successfully',
      computer: {
        ip: newComputer.ip,
        name: newComputer.name,
        hardware: newComputer.hardware
      }
    });

  } catch (error) {
    console.error('Reset computer error:', error);
    res.status(500).json({
      error: 'Failed to reset computer',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
};
