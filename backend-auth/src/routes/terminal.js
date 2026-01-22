const express = require('express');
const router = express.Router();
const terminalController = require('../controllers/terminalController');
const authMiddleware = require('../middleware/authMiddleware');

// Execute terminal command
router.post('/execute', authMiddleware, terminalController.executeCommand);

// Get current session info
router.get('/session', authMiddleware, terminalController.getSession);

module.exports = router;
