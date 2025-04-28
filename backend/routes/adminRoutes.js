// backend/routes/adminRoutes.js
const express = require('express');
const { protect, admin } = require('../middleware/authMiddleware'); // Adjust path if needed

// Import functions from the NEW adminController
const {
    getAllUsersForAdmin,
    updateUserRoleAdmin,
    updateUserVerificationStatusAdmin,
    deleteUserAdmin
} = require('../src/controllers/adminController'); // Adjust path if needed

// Import other controllers IF admin routes for them live here too
// const { createNewsItemAdmin, deleteNewsItemAdmin } = require('../src/controllers/adminNewsController'); // Example

const router = express.Router();

// Apply admin protection to all routes defined in this file
router.use(protect, admin);

// === User Management Admin Routes ===
router.get('/users', getAllUsersForAdmin);
router.patch('/users/:userId/role', updateUserRoleAdmin);
router.patch('/users/:userId/verification', updateUserVerificationStatusAdmin);
router.delete('/users/:userId', deleteUserAdmin);

// === Other Admin Routes ===
// Example: News Management
// router.post('/news', createNewsItemAdmin);
// router.delete('/news/:newsItemId', deleteNewsItemAdmin);

// Example: Triggering round actions (could live here or in rounds.js)
// router.post('/rounds/:roundId/fetch-results', fetchRoundResults); // Make sure fetchRoundResults is imported if used here

module.exports = router;