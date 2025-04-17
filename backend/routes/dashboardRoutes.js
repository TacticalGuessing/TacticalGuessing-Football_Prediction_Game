// backend/src/routes/dashboardRoutes.js
const express = require('express');
const asyncHandler = require('express-async-handler');
const { protect } = require('../middleware/authMiddleware'); // Correct path relative to this file
const dashboardController = require('../src/controllers/dashboardController'); // Correct path relative to this file

const router = express.Router();

// Get dashboard highlights - requires authentication
router.get('/highlights', protect, asyncHandler(dashboardController.getDashboardHighlights));

// --- We will add the news routes here later ---
// router.get('/news', asyncHandler(dashboardController.getNewsItems)); // Example placeholder
// router.post('/admin/news', protect, admin, asyncHandler(dashboardController.createNewsItem)); // Example placeholder


module.exports = router;