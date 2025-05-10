// backend/routes/standings.js
const express = require('express');
const db = require('../db'); // Keep db for determinePreviousRoundId and fetchRanksForRound
const { protect } = require('../middleware/authMiddleware');
const { calculateStandings } = require('../src/utils/scoringUtils'); // <<< IMPORT THE ENHANCED FUNCTION
const asyncHandler = require('express-async-handler'); // <<< IMPORT ASYNC HANDLER

const router = express.Router();

// === Keep Helper Functions for Movement Calculation ===
async function determinePreviousRoundId(targetRoundId, dbPoolOrClient) {
    // ... (Your existing implementation - seems okay) ...
    let completedRoundsRes;
    try {
        completedRoundsRes = await dbPoolOrClient.query(
            "SELECT round_id FROM rounds WHERE status = 'COMPLETED' ORDER BY deadline DESC, round_id DESC"
        );
    } catch (error) {
        console.error("[determinePreviousRoundId] Error fetching completed rounds:", error);
        throw new Error(`Failed to retrieve round history. DB Error: ${error.message}`);
    }
    const completedRounds = completedRoundsRes.rows;
    if (!completedRounds || completedRounds.length === 0) return null;

    if (targetRoundId) {
        const numericTargetRoundId = Number(targetRoundId);
        const targetIndex = completedRounds.findIndex(r => r.round_id === numericTargetRoundId);
        // Find the *next* one in the DESC sorted list (which is the previous chronologically)
        return (targetIndex !== -1 && targetIndex < completedRounds.length - 1) ? completedRounds[targetIndex + 1].round_id : null;
    } else {
        // For overall, the previous round is the second most recent one
        return (completedRounds.length >= 1) ? completedRounds[0].round_id : null; // Correction: 2nd item is index 1 if length >= 2. If only 1, prev is null. Let's return latest completed ID for prev rank comparison for Overall.
    }
}

async function fetchRanksForRound(roundId, dbPoolOrClient) {
    // ... (Your existing implementation - seems okay, just fetches rank) ...
     // This query could potentially be simplified or integrated if calculateStandings was adapted,
     // but for now, keeping it separate for movement is acceptable.
     const query = `
        WITH PlayerPredictions AS (
            SELECT
                u.user_id,
                u.name,
                COALESCE(SUM(p.points_awarded), 0) AS total_points
            FROM users u
            LEFT JOIN predictions p ON u.user_id = p.user_id AND p.round_id = $1
            WHERE u.role = 'PLAYER'
            GROUP BY u.user_id, u.name
        )
        SELECT
            user_id,
            RANK() OVER (ORDER BY total_points DESC, name ASC) AS rank
        FROM PlayerPredictions;
    `;
    try {
        const result = await dbPoolOrClient.query(query, [roundId]);
        const rankMap = new Map();
        result.rows.forEach(row => {
            rankMap.set(row.user_id, parseInt(row.rank, 10));
        });
        return rankMap;
    } catch (error) {
        console.error(`[fetchRanksForRound] Error fetching ranks for round ${roundId}:`, error);
        return new Map();
    }
}
// ===================================================


/**
 * @route   GET /api/standings
 * @desc    Get ranked user standings with enhanced stats and movement
 * @access  Private (Logged-in users)
 * @query   roundId (optional) - The ID of the round.
 */
// Use asyncHandler to automatically pass errors to next()
router.get('/', protect, asyncHandler(async (req, res) => {
    const { roundId: requestedRoundIdStr } = req.query;
    const requestedRoundId = requestedRoundIdStr ? parseInt(requestedRoundIdStr, 10) : null;
    let isOverall = !requestedRoundId;

    if (requestedRoundIdStr && isNaN(requestedRoundId)) {
        res.status(400); // Set status before throwing
        throw new Error('Query parameter roundId must be an integer.');
    }

    // Validate specific round request (if applicable) - Use Prisma for consistency? Or keep DB query
    // Let's keep DB query for now as calculateStandings also validates internally
    if (!isOverall) {
        const roundCheck = await db.query('SELECT status FROM rounds WHERE round_id = $1', [requestedRoundId]);
        if (roundCheck.rows.length === 0) {
             res.status(404); throw new Error('Round not found.');
        }
        if (roundCheck.rows[0].status !== 'COMPLETED') {
             res.status(400); throw new Error(`Standings only available for COMPLETED rounds.`);
        }
    }

    // --- Call the enhanced calculateStandings function ---
    // It now returns all necessary fields including user details and new stats
    const standingsData = await calculateStandings(requestedRoundId);
    // ----------------------------------------------------

    // --- Calculate and Apply Movement ---
    const previousRoundId = await determinePreviousRoundId(requestedRoundId, db);
    let previousRanksMap = new Map();
    if (previousRoundId) {
        console.log(`[Standings API] Fetching previous ranks for movement (Prev Round ID: ${previousRoundId})`);
        previousRanksMap = await fetchRanksForRound(previousRoundId, db);
    }

    // Apply movement to the data returned by calculateStandings
    const finalStandingsWithMovement = standingsData.map(player => {
        const previousRank = previousRanksMap.get(player.userId);
        let movement = null;
        if (previousRank !== undefined) {
            movement = previousRank - player.rank; // Positive = Up, Negative = Down
        }
        // Override the default movement (0) returned by calculateStandings
        return { ...player, movement: movement };
    });
    // --- End Movement Calculation ---

    console.log(`[Standings API] Sending ${finalStandingsWithMovement.length} standings entries.`);
    res.status(200).json(finalStandingsWithMovement); // Send the final enhanced data

    // No 'catch' block needed here because asyncHandler wraps it
}));

module.exports = router;