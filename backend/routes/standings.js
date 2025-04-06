// backend/routes/standings.js  <- THIS IS PURE JAVASCRIPT
const express = require('express');
const db = require('../db'); // Assuming db.js exports query function or pool
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// =======================================================================
// ===== HELPER FUNCTION: Determine Previous Completed Round ID ========
// =======================================================================
async function determinePreviousRoundId(targetRoundId, dbPoolOrClient) {
    let completedRoundsRes;
    try {
        // Use round_id for rounds table
        completedRoundsRes = await dbPoolOrClient.query(
            "SELECT round_id FROM rounds WHERE status = 'COMPLETED' ORDER BY deadline DESC, round_id DESC"
        );
    } catch (error) {
        console.error("[determinePreviousRoundId] Error fetching completed rounds:", error);
        throw new Error(`Failed to retrieve round history for movement calculation. DB Error: ${error.message}`);
    }
    const completedRounds = completedRoundsRes.rows;
    if (!completedRounds || completedRounds.length === 0) return null;

    if (targetRoundId) {
        const numericTargetRoundId = Number(targetRoundId);
        const targetIndex = completedRounds.findIndex(r => r.round_id === numericTargetRoundId); // Compare using round_id

        if (targetIndex !== -1 && targetIndex < completedRounds.length - 1) {
             const previousRoundId = completedRounds[targetIndex + 1].round_id; // Get round_id
             return previousRoundId;
        } else {
             return null;
        }
    } else {
        if (completedRounds.length >= 2) {
            const previousRoundId = completedRounds[1].round_id; // Get round_id
            return previousRoundId;
        } else {
            return null;
        }
    }
}
// =======================================================================

// =======================================================================
// ===== HELPER FUNCTION: Fetch Ranks for a Specific Round ========
// =======================================================================
async function fetchRanksForRound(roundId, dbPoolOrClient) {
    // Uses users.user_id, users.name, predictions.user_id, predictions.round_id, predictions.points_awarded
    const query = `
        WITH PlayerPredictions AS (
            SELECT
                u.user_id AS user_id, -- Use user_id from users table
                u.name,
                COALESCE(SUM(p.points_awarded), 0) AS total_points
            FROM
                users u
            LEFT JOIN predictions p ON u.user_id = p.user_id AND p.round_id = $1 -- Join using user_id and round_id
            WHERE u.role = 'PLAYER'
            GROUP BY
                u.user_id, u.name -- Group by user_id
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
            rankMap.set(row.user_id, parseInt(row.rank, 10)); // Key the map with user_id
        });
        return rankMap;
    } catch (error) {
        console.error(`[fetchRanksForRound] Error fetching ranks for round ${roundId}:`, error);
        return new Map();
    }
}
// ================== END HELPER FUNCTION ================================


/**
 * @route   GET /api/standings
 * @desc    Get ranked user standings with stats and movement, either overall or for a specific completed round
 * @access  Private (Logged-in users)
 * @query   roundId (optional) - The ID of the round (should be round_id).
 */
router.get('/', protect, async (req, res, next) => {
    const { roundId: requestedRoundIdStr } = req.query;
    const requestedRoundId = requestedRoundIdStr ? parseInt(requestedRoundIdStr, 10) : null;
    let isOverall = !requestedRoundId;
    let previousRoundId = null;

    if (requestedRoundIdStr && isNaN(requestedRoundId)) {
        return res.status(400).json({ message: 'Query parameter roundId, if provided, must be an integer.' });
    }

    try {
        // Determine previous round ID (using rounds.round_id)
        previousRoundId = await determinePreviousRoundId(requestedRoundId, db);
        console.log(`[Standings API Backend] Determined previousRoundId: ${previousRoundId} for requested: ${requestedRoundId}`); // DEBUG LOG

        // Validate specific round request (using rounds.round_id)
        if (!isOverall) {
            const roundCheck = await db.query('SELECT status FROM rounds WHERE round_id = $1', [requestedRoundId]);
            if (roundCheck.rows.length === 0) return res.status(404).json({ message: 'Round not found.' });
            const roundStatus = roundCheck.rows[0].status;
            if (roundStatus !== 'COMPLETED') {
                return res.status(400).json({ message: `Standings are only available for specific rounds with status 'COMPLETED'. Status of round ${requestedRoundId} is '${roundStatus}'.` });
            }
        }

        // Fetch Previous Ranks (using users.user_id)
        let previousRanksMap = new Map();
        if (previousRoundId) {
            console.log(`[Standings API Backend] Fetching previous ranks for round: ${previousRoundId}`); // DEBUG LOG
            previousRanksMap = await fetchRanksForRound(previousRoundId, db);
            console.log(`[Standings API Backend] Fetched ${previousRanksMap.size} previous ranks.`); // DEBUG LOG
        } else {
             console.log(`[Standings API Backend] No previous round ID, skipping previous rank fetch.`); // DEBUG LOG
        }

        // Define Main Standings Query
        const queryParams = [];
        let filterClause = '';

        if (isOverall) {
            filterClause = `r.status = 'COMPLETED'`;
        } else {
            filterClause = `p.round_id = $1`;
            queryParams.push(requestedRoundId);
        }

        // Main Query - Uses confirmed column names
        const mainStandingsQuery = `
            WITH RelevantPredictions AS (
                SELECT
                    p.user_id,
                    p.points_awarded,
                    p.round_id
                FROM predictions p
                ${isOverall ? 'JOIN rounds r ON p.round_id = r.round_id' : ''} -- Join using round_id
                WHERE ${filterClause}
            ),
            UserStats AS (
                SELECT
                    rp.user_id,
                    COUNT(*) AS totalPredictions,
                    COUNT(*) FILTER (WHERE rp.points_awarded >= 1) AS correctOutcomes,
                    COUNT(*) FILTER (WHERE rp.points_awarded = 3) AS exactScores,
                    SUM(rp.points_awarded) AS totalPoints
                FROM RelevantPredictions rp
                GROUP BY rp.user_id
            ),
            RankedUsers AS (
                 SELECT
                    u.user_id AS user_id, -- Select users.user_id
                    u.name,
                    COALESCE(us.totalPredictions, 0) AS totalPredictions,
                    COALESCE(us.correctOutcomes, 0) AS correctOutcomes,
                    COALESCE(us.exactScores, 0) AS exactScores,
                    COALESCE(us.totalPoints, 0) AS points,
                    RANK() OVER (ORDER BY COALESCE(us.totalPoints, 0) DESC, u.name ASC) AS rank
                FROM
                    users u
                LEFT JOIN UserStats us ON u.user_id = us.user_id -- Join UserStats using user_id
                WHERE u.role = 'PLAYER'
            )
            SELECT * FROM RankedUsers ORDER BY rank;
        `;

        // --- Execute the New Main Query ---
        console.log(`[Standings API Backend] Executing main query for ${isOverall ? 'Overall' : `Round ${requestedRoundId}`}`); // DEBUG LOG
        const standingsResult = await db.query(mainStandingsQuery, queryParams);
        console.log(`[Standings API Backend] Main query returned ${standingsResult.rows.length} rows.`); // DEBUG LOG

        // --- Combine Results & Calculate Movement/Accuracy ---
        const finalStandings = standingsResult.rows.map(row => {
            // row.user_id comes from the query (selected as u.user_id)
            const userId = row.user_id;
            const currentRank = parseInt(row.rank, 10);
            // previousRanksMap was keyed by user_id
            const previousRank = previousRanksMap.get(userId);
            let movement = null;

            if (previousRank !== undefined) {
                movement = previousRank - currentRank;
            }

            const totalPredictions = row.totalpredictions; // These are lowercase from SQL result
            const correctOutcomes = row.correctoutcomes;
            const exactScores = row.exactscores;
            const points = row.points;

            let accuracy = null;
            if (totalPredictions > 0) {
                accuracy = (correctOutcomes * 100.0) / totalPredictions;
            }

            // Return camelCase object for frontend
            return {
                rank: currentRank,
                userId: userId, // Send user_id
                name: row.name,
                points: parseInt(points, 10), // Parse points
                movement: movement,
                totalPredictions: parseInt(totalPredictions, 10),
                correctOutcomes: parseInt(correctOutcomes, 10),
                exactScores: parseInt(exactScores, 10),
                accuracy: accuracy
            };
        });

        console.log(`[Standings API Backend] Sending ${finalStandings.length} standings entries.`); // DEBUG LOG
        res.status(200).json(finalStandings);

    } catch (error) {
        // Keep existing console log
        const errorIdentifier = isOverall ? 'overall' : `round ${requestedRoundId || 'invalid'}`;
        console.error(`[Standings API Backend] CATCH BLOCK Error fetching standings for ${errorIdentifier}:`, error); // DEBUG LOG
        next(error);
    }
});

module.exports = router;