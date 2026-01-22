const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * @route   POST /auth/register
 * @desc    Register new user
 * @access  Public
 */
router.post('/register', authController.register);

/**
 * @route   POST /auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', authController.login);

/**
 * @route   GET /auth/me
 * @desc    Get current user info
 * @access  Private (requires JWT)
 */
router.get('/me', authMiddleware, authController.me);

/**
 * @route   POST /auth/reset-computer
 * @desc    Destroy and recreate computer (for testing)
 * @access  Private (requires JWT)
 */
router.post('/reset-computer', authMiddleware, authController.resetComputer);

module.exports = router;
