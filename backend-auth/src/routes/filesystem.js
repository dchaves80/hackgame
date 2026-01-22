const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const filesystemController = require('../controllers/filesystemController');

// POST /api/filesystem/clipboard - Set clipboard (copy/cut)
router.post('/clipboard', authMiddleware, filesystemController.setClipboard);

// GET /api/filesystem/clipboard - Get clipboard
router.get('/clipboard', authMiddleware, filesystemController.getClipboard);

// POST /api/filesystem/paste - Paste from clipboard
router.post('/paste', authMiddleware, filesystemController.pasteClipboard);

// PUT /api/filesystem/rename - Rename file or directory
router.put('/rename', authMiddleware, filesystemController.renameItem);

// POST /api/filesystem/:path - Create new folder
router.post('/:path(*)?', authMiddleware, filesystemController.createFolder);

// PUT /api/filesystem/file/:path - Update or create file
router.put('/file/:path(*)', authMiddleware, filesystemController.updateFile);

// DELETE /api/filesystem/:path - Delete file or directory
router.delete('/:path(*)', authMiddleware, filesystemController.deleteItem);

// GET /api/filesystem/file/:path - Get file contents
router.get('/file/:path(*)', authMiddleware, filesystemController.getFile);

// GET /api/filesystem/:path - Get directory contents
router.get('/:path(*)?', authMiddleware, filesystemController.getDirectory);

module.exports = router;
