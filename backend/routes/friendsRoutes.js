// backend/src/routes/friendsRoutes.js
const express = require('express');
const asyncHandler = require('express-async-handler');
const { protect } = require('../middleware/authMiddleware'); // Adjust path
const friendsController = require('../src/controllers/friendsController'); // Adjust path

const router = express.Router();

// All routes below require authentication
router.use(protect);

// --- Friend Requests ---
router.post('/requests', asyncHandler(friendsController.sendFriendRequest));
router.get('/requests/pending', asyncHandler(friendsController.getPendingFriendRequests));
router.patch('/requests/:requestId/accept', asyncHandler(friendsController.acceptFriendRequest));
router.patch('/requests/:requestId/reject', asyncHandler(friendsController.rejectFriendRequest));
// Consider using DELETE for reject? router.delete('/requests/:requestId', ...)

// --- Friend List ---
router.get('/', asyncHandler(friendsController.getMyFriends)); // Get my friends list
router.delete('/:friendUserId', asyncHandler(friendsController.removeFriend)); // Unfriend user

module.exports = router;