// backend/src/routes/userStatsRoutes.js
const express = require('express');
const asyncHandler = require('express-async-handler');
const { protect } = require('../middleware/authMiddleware'); // Adjust path as needed
const userStatsController = require('../src/controllers/userStatsController'); // Adjust path as needed

const router = express.Router();

// Base path will be /api/users (defined in server.js)
router.get('/me/stats/predictions', protect, asyncHandler(userStatsController.getUserPredictionStats));

module.exports = router;