const express = require('express');
const router = express.Router();
const compilerController = require('../controllers/compilerController');
const authMiddleware = require('../middleware/authMiddleware');

// Compile a .syscript file to binary
router.post('/compile', authMiddleware, compilerController.compile);

module.exports = router;
