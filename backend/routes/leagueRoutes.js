// backend/src/routes/leagueRoutes.js
const express = require('express');
const asyncHandler = require('express-async-handler');
const { protect } = require('../middleware/authMiddleware'); // Adjust path
const leagueController = require('../src/controllers/leagueController'); // Adjust path
const {
    leaveLeague, // <<< ENSURE THIS IS PRESENT
    deleteLeague
} = require('../src/controllers/leagueController');

const router = express.Router();

// Base path will be /api/leagues (mounted in server.js)

// All league routes require basic authentication
router.use(protect);

// POST /api/leagues - Create a new league
router.post('/', asyncHandler(leagueController.createLeague));

// GET /api/leagues/my-leagues - Get leagues the user is in
router.get('/my-leagues', asyncHandler(leagueController.getMyLeagues));

// POST /api/leagues/join/:inviteCode - Join league via code
router.post('/join/:inviteCode', asyncHandler(leagueController.joinLeagueByInviteCode));

// GET /api/leagues/:leagueId - Get details for a specific league (user must be member)
router.get('/:leagueId', asyncHandler(leagueController.getLeagueDetails));

// GET /api/leagues/:leagueId/standings - Get standings for a specific league
router.get('/:leagueId/standings', asyncHandler(leagueController.getLeagueStandings));

// DELETE /api/leagues/:leagueId/members/:memberUserId - Remove member (League Admin)
router.delete('/:leagueId/members/:memberUserId', asyncHandler(leagueController.removeLeagueMember));

// PATCH /api/leagues/:leagueId/invite-code - Regenerate code (League Admin)
router.patch('/:leagueId/invite-code', asyncHandler(leagueController.regenerateInviteCode));

// POST /api/leagues/:leagueId/invites
router.post('/:leagueId/invites', asyncHandler(leagueController.inviteFriendsToLeague));

// DELETE /api/leagues/:leagueId/membership - User leaves the specified league
router.delete('/:leagueId/membership', asyncHandler(leaveLeague));

// DELETE /api/leagues/:leagueId
router.delete('/:leagueId', asyncHandler(deleteLeague));

module.exports = router;