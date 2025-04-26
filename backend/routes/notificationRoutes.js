// backend/routes/notificationRoutes.js
const express = require('express');
const { protect } = require('../middleware/authMiddleware'); // Adjust path if needed
const {
    getNotificationSettings,
    updateNotificationSettings
} = require('../src/controllers/notificationController'); // Adjust path if needed

const router = express.Router();

// Apply protect middleware to all routes in this file
router.use(protect);

// Define routes relative to the base path they'll be mounted on
router.route('/settings')
    .get(getNotificationSettings)
    .put(updateNotificationSettings);

module.exports = router;