const express = require('express');
const router = express.Router();
const processController = require('../controllers/processController');
const authMiddleware = require('../middleware/authMiddleware');

// Create a new process
router.post('/', authMiddleware, processController.createProcess);

// List all processes
router.get('/', authMiddleware, processController.listProcesses);

// Delete/kill a process by PID
router.delete('/:pid', authMiddleware, processController.deleteProcess);

module.exports = router;
