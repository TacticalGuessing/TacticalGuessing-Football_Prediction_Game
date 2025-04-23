// backend/routes/leagueInviteRoutes.js
const express = require('express');
const asyncHandler = require('express-async-handler');
const { protect } = require('../middleware/authMiddleware'); // Adjust path if needed
const {
    getPendingLeagueInvites,
    acceptLeagueInvite,
    rejectLeagueInvite
} = require('../src/controllers/leagueInviteController'); // Adjust path

const router = express.Router();

// Base path will be /api/leagues/invites (mounted in server.js)

// All these routes require the user to be logged in
router.use(protect);

// GET /api/leagues/invites/pending - Get user's pending invites
router.get('/pending', asyncHandler(getPendingLeagueInvites));

// PATCH /api/leagues/invites/:membershipId/accept - Accept an invite
router.patch('/:membershipId/accept', asyncHandler(acceptLeagueInvite));

// DELETE /api/leagues/invites/:membershipId/reject - Reject an invite
router.delete('/:membershipId/reject', asyncHandler(rejectLeagueInvite));


module.exports = router;