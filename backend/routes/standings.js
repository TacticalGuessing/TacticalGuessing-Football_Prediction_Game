// backend/routes/standings.js
const express = require('express');
const db = require('../db'); // Assuming db.js exports query function or pool
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * @route   GET /api/standings
 * @desc    Get ranked user standings, either overall or for a specific completed round
 * @access  Private (Logged-in users)
 * @query   roundId (optional) - The ID of the round. If omitted, returns overall standings.
 */
router.get('/', protect, async (req, res, next) => {
    const { roundId } = req.query;
    let standingsQuery = '';
    const queryParams = [];
    let isOverall = true; // Flag to know which type of standings we are fetching

    try {
        // --- Scenario 1: Specific Round ID Provided ---
        if (roundId) {
            isOverall = false;
            const parsedRoundId = parseInt(roundId, 10);

            // 1a. --- Validation ---
            if (isNaN(parsedRoundId)) {
                return res.status(400).json({ message: 'Query parameter roundId, if provided, must be an integer.' });
            }
            queryParams.push(parsedRoundId);

            // 1b. --- Verify Specific Round Status ---
            const roundCheck = await db.query(
                'SELECT status FROM rounds WHERE round_id = $1',
                [parsedRoundId]
            );

            if (roundCheck.rows.length === 0) {
                return res.status(404).json({ message: 'Round not found.' });
            }

            const roundStatus = roundCheck.rows[0].status;
            if (roundStatus !== 'COMPLETED') {
                return res.status(400).json({ message: `Standings are only available for specific rounds with status 'COMPLETED'. Status of round ${parsedRoundId} is '${roundStatus}'.` });
            }

            // 1c. --- Standings Query for Specific Round ---
            standingsQuery = `
                SELECT
                    u.user_id,
                    u.name,
                    COALESCE(SUM(p.points_awarded), 0) AS total_points
                FROM
                    users u
                LEFT JOIN -- Include users even if they didn't predict (0 points)
                    predictions p ON u.user_id = p.user_id AND p.round_id = $1
                WHERE
                     -- Only include PLAYER roles OR any user who made a prediction in this specific round
                     u.role = 'PLAYER' OR u.user_id IN (SELECT user_id FROM predictions WHERE round_id = $1)
                GROUP BY
                    u.user_id, u.name
                ORDER BY
                    total_points DESC, u.name ASC;
            `;

        }
        // --- Scenario 2: No Round ID Provided (Overall Standings) ---
        else {
            isOverall = true;
            // 2a. --- Standings Query for Overall ---
            // Sum points only from predictions belonging to COMPLETED rounds
            standingsQuery = `
                SELECT
                    u.user_id,
                    u.name,
                    COALESCE(SUM(p.points_awarded), 0) AS total_points
                FROM
                    users u
                LEFT JOIN predictions p ON u.user_id = p.user_id
                LEFT JOIN rounds r ON p.round_id = r.round_id
                WHERE
                    u.role = 'PLAYER' AND (r.status = 'COMPLETED' OR p.prediction_id IS NULL) -- Sum points only from completed rounds, but still list players with 0 overall points
                GROUP BY
                    u.user_id, u.name
                ORDER BY
                    total_points DESC, u.name ASC;
            `;
             // Note: The WHERE clause ensures only points from COMPLETED rounds are summed.
             // Players who haven't participated in any completed round will show 0.
             // Modify u.role = 'PLAYER' if Admins should also be included in overall standings.
        }

        // 3. --- Execute the Determined Query ---
        const standingsResult = await db.query(standingsQuery, queryParams);

        // 4. --- Format Response (Add Rank and Map to camelCase) ---
        const rankedStandings = standingsResult.rows.map((row, index) => ({
            rank: index + 1, // Simple rank based on order
            // Map DB snake_case to frontend expected camelCase
            userId: row.user_id,
            name: row.name, // Use 'name' as selected from DB
            points: parseInt(row.total_points, 10) // Use 'points', parse to integer
        }));

        // Log the data being sent
        const logIdentifier = isOverall ? 'overall' : `round ${roundId}`;
        console.log(`[Standings API] Sending ${standingsResult.rows.length} standings entries for ${logIdentifier}:`, JSON.stringify(rankedStandings, null, 2));

        res.status(200).json(rankedStandings); // Send the response

    } catch (error) {
        const errorIdentifier = isOverall ? 'overall' : `round ${roundId || 'invalid'}`;
        console.error(`[Standings API] Error fetching standings for ${errorIdentifier}:`, error);
        next(error); // Pass to global error handler
    }
});

module.exports = router;