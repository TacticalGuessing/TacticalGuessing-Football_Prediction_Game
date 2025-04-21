// backend/src/routes/userRoutes.js
const express = require('express');
const asyncHandler = require('express-async-handler');
const { protect } = require('../middleware/authMiddleware'); // Adjust path
const userController = require('../src/controllers/userController'); // Adjust path

const router = express.Router();

// Base path is /api/users (mounted in server.js)

// --- User Search ---
// GET /api/users/search?query=...
router.get('/search', protect, asyncHandler(userController.searchUsers));


// --- Add other user routes later maybe ---
// Example: GET /api/users/:id (Get public profile?) - Needs different controller logic
// router.get('/:userId', ...)


module.exports = router;