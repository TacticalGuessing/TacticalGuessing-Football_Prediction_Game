// backend/routes/standings.js
const express = require('express');
const db = require('../db'); // Assuming db.js exports query function or pool
const { protect } = require('../middleware/authMiddleware'); // Only need protect, not admin

const router = express.Router();

/**
 * @route   GET /api/standings
 * @desc    Get ranked user standings for a specific completed round
 * @access  Private (Logged-in users)
 * @query   roundId (required) - The ID of the round to get standings for
 */
router.get('/', protect, async (req, res, next) => {
    const { roundId } = req.query;

    // 1. --- Validation ---
    const parsedRoundId = parseInt(roundId, 10);
    if (isNaN(parsedRoundId)) {
        return res.status(400).json({ message: 'Query parameter roundId is required and must be an integer.' });
    }

    try {
        // 2. --- Verify Round Status ---
        const roundCheck = await db.query(
            'SELECT status FROM rounds WHERE round_id = $1',
            [parsedRoundId]
        );

        if (roundCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Round not found.' });
        }

        const roundStatus = roundCheck.rows[0].status;
        if (roundStatus !== 'COMPLETED') {
            return res.status(400).json({ message: `Standings are only available for rounds with status 'COMPLETED'. Status of round ${parsedRoundId} is '${roundStatus}'.` });
        }

        // 3. --- Calculate Standings ---
        const standingsQuery = `
            SELECT
                u.user_id,
                u.name,
                COALESCE(SUM(p.points_awarded), 0) AS total_points -- Use COALESCE to handle users with 0 points or no predictions
            FROM
                users u
            LEFT JOIN -- Use LEFT JOIN to include users who might not have predicted in this round (showing 0 points)
                predictions p ON u.user_id = p.user_id AND p.round_id = $1
            WHERE
                u.role = 'PLAYER' OR u.user_id IN (SELECT user_id FROM predictions WHERE round_id = $1) -- Include only players or users who actually predicted in this round
            GROUP BY
                u.user_id, u.name
            ORDER BY
                total_points DESC, u.name ASC; -- Order by points descending, then name ascending for tie-breaking
        `;
        // Note on WHERE clause: This ensures we don't list every single user if they didn't participate.
        // Adjust if you want ALL players listed regardless of participation in the specific round.

        const standingsResult = await db.query(standingsQuery, [parsedRoundId]);

        // 4. --- Format Response (Add Rank) ---
        const rankedStandings = standingsResult.rows.map((row, index) => ({
            rank: index + 1, // Simple rank based on order
            userId: row.user_id, // Make sure frontend expects 'userId' (camelCase)
            name: row.name,
            points: parseInt(row.total_points, 10) // Ensure points are integers
        }));

        // Potential Enhancement: Handle ties in rank (e.g., users with same points get same rank)
        // For MVP, simple index-based rank is usually sufficient.


        // --- ADDED LOGGING ---
        // Log the exact data structure being sent *before* the response is sent
        console.log(`[Standings API] Data being sent for round ${parsedRoundId}:`, JSON.stringify(rankedStandings, null, 2));
        // --- END LOGGING ---


        res.status(200).json(rankedStandings); // Send the response

    } catch (error) {
        console.error(`[Standings API] Error fetching standings for round ${parsedRoundId}:`, error);
        next(error); // Pass to global error handler
    }
});


module.exports = router;