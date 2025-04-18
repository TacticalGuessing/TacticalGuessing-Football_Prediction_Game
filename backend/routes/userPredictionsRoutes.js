// backend/src/routes/userPredictionsRoutes.js
const express = require('express');
const asyncHandler = require('express-async-handler');
const { protect } = require('../middleware/authMiddleware'); // Adjust path if needed (e.g., '../../middleware/...')
const userPredictionsController = require('../src/controllers/userPredictionsController'); // Adjust path if needed (e.g., '../src/controllers/...')

const router = express.Router();

// Base path will be /api/users (defined in server.js)
// This route becomes GET /api/users/me/predictions/:roundId
router.get('/me/predictions/:roundId', protect, asyncHandler(userPredictionsController.getUserPredictionsForRound));

module.exports = router;