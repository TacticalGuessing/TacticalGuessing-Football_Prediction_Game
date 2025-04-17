// backend/routes/newsRoutes.js
const express = require('express');
const asyncHandler = require('express-async-handler');
// const { protect } = require('../middleware/authMiddleware'); // Incorrect - needs to go up then into src
const { protect } = require('../middleware/authMiddleware'); // Correct path
// const dashboardController = require('../controllers/dashboardController'); // Incorrect
const dashboardController = require('../src/controllers/dashboardController'); // Correct path

const router = express.Router();

// GET /api/news - Fetch latest news items
router.get('/', asyncHandler(dashboardController.getNewsItems));

module.exports = router;