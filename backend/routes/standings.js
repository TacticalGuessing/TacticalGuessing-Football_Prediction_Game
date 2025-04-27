// backend/routes/standings.js
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
        return (targetIndex !== -1 && targetIndex < completedRounds.length - 1) ? completedRounds[targetIndex + 1].round_id : null;
    } else {
        return (completedRounds.length >= 2) ? completedRounds[1].round_id : null;
    }
}
// =======================================================================

// =======================================================================
// ===== HELPER FUNCTION: Fetch Ranks for a Specific Round ========
// =======================================================================
async function fetchRanksForRound(roundId, dbPoolOrClient) {
    // *** Include team_name in this query if needed for tie-breaking, otherwise not strictly necessary here ***
    // For now, keep it simple, assuming rank only depends on points and name for tie-breaking
    const query = `
        WITH PlayerPredictions AS (
            SELECT
                u.user_id,
                u.name, -- Keep original name for tie-breaking if needed
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
        return new Map(); // Return empty map on error
    }
}
// ================== END HELPER FUNCTION ================================


/**
 * @route   GET /api/standings
 * @desc    Get ranked user standings with stats and movement, either overall or for a specific completed round
 * @access  Private (Logged-in users)
 * @query   roundId (optional) - The ID of the round.
 */
router.get('/', protect, async (req, res, next) => {
    const { roundId: requestedRoundIdStr } = req.query;
    const requestedRoundId = requestedRoundIdStr ? parseInt(requestedRoundIdStr, 10) : null;
    let isOverall = !requestedRoundId;
    let previousRoundId = null;

    if (requestedRoundIdStr && isNaN(requestedRoundId)) {
        return res.status(400).json({ message: 'Query parameter roundId must be an integer.' });
    }

    try {
        // Determine previous round ID
        previousRoundId = await determinePreviousRoundId(requestedRoundId, db);
        //console.log(`[Standings API] PrevRoundId: ${previousRoundId} for requested: ${requestedRoundId}`);

        // Validate specific round request
        if (!isOverall) {
            const roundCheck = await db.query('SELECT status FROM rounds WHERE round_id = $1', [requestedRoundId]);
            if (roundCheck.rows.length === 0) return res.status(404).json({ message: 'Round not found.' });
            if (roundCheck.rows[0].status !== 'COMPLETED') {
                 return res.status(400).json({ message: `Standings only available for COMPLETED rounds.` });
            }
        }

        // Fetch Previous Ranks
        let previousRanksMap = new Map();
        if (previousRoundId) {
            //console.log(`[Standings API] Fetching prev ranks for round: ${previousRoundId}`);
            previousRanksMap = await fetchRanksForRound(previousRoundId, db);
            //console.log(`[Standings API] Fetched ${previousRanksMap.size} prev ranks.`);
        }

        // --- Main Standings Query ---
        const queryParams = [];
        let filterClause = '';
        if (isOverall) {
            filterClause = `r.status = 'COMPLETED'`;
        } else {
            filterClause = `p.round_id = $1`;
            queryParams.push(requestedRoundId);
        }

        // *** MODIFIED QUERY: Add team_name from users table ***
        const mainStandingsQuery = `
            WITH RelevantPredictions AS (
                SELECT p.user_id, p.points_awarded, p.round_id
                FROM predictions p
                ${isOverall ? 'JOIN rounds r ON p.round_id = r.round_id' : ''}
                WHERE ${filterClause}
            ),
            UserStats AS (
                SELECT
                    rp.user_id,
                    COUNT(*) AS totalPredictions,
                    COUNT(*) FILTER (WHERE rp.points_awarded >= 1) AS correctOutcomes,
                    COUNT(*) FILTER (WHERE rp.points_awarded = 3) AS exactScores,
                    SUM(COALESCE(rp.points_awarded, 0)) AS totalPoints -- Handle potential nulls before sum
                FROM RelevantPredictions rp
                GROUP BY rp.user_id
            ),
            RankedUsers AS (
                 SELECT
                    u.user_id,
                    u.name,         -- <<< Real name
                    u.team_name,    -- <<< Team name
                    u.avatar_url,   -- <<< THIS WAS ADDED
                    COALESCE(us.totalPredictions, 0) AS totalPredictions,
                    COALESCE(us.correctOutcomes, 0) AS correctOutcomes,
                    COALESCE(us.exactScores, 0) AS exactScores,
                    COALESCE(us.totalPoints, 0) AS points,
                    RANK() OVER (ORDER BY COALESCE(us.totalPoints, 0) DESC, u.name ASC) AS rank
                FROM users u
                LEFT JOIN UserStats us ON u.user_id = us.user_id
                WHERE u.role = 'PLAYER'
            )
            SELECT * FROM RankedUsers ORDER BY rank;
        `;
        // --- END MODIFIED QUERY ---

        //console.log(`[Standings API] Executing main query for ${isOverall ? 'Overall' : `Round ${requestedRoundId}`}`);
        const standingsResult = await db.query(mainStandingsQuery, queryParams);
        //console.log(`[Standings API] Main query returned ${standingsResult.rows.length} rows.`);

        // --- Combine Results & Calculate Movement/Accuracy ---
        const finalStandings = standingsResult.rows.map(row => {
            const userId = row.user_id;
            const currentRank = parseInt(row.rank, 10);
            const previousRank = previousRanksMap.get(userId);
            let movement = null;
            if (previousRank !== undefined) {
                movement = previousRank - currentRank;
            }

            const totalPredictions = parseInt(row.totalpredictions, 10);
            const correctOutcomes = parseInt(row.correctoutcomes, 10);
            const exactScores = parseInt(row.exactscores, 10);
            let accuracy = null;
            if (totalPredictions > 0) {
                accuracy = (correctOutcomes * 100.0) / totalPredictions;
            }

            // *** USE team_name if available, otherwise use original name ***
            const displayName = row.team_name || row.name || `User ${userId}`; // Fallback logic

            // Return camelCase object for frontend
            return {
                rank: currentRank,
                userId: userId,
                name: row.name,          // <<< Ensure this is user's REAL name
                teamName: row.team_name, // <<< ADDED/Ensure this is included
                avatarUrl: row.avatar_url, // <<< ADDED THIS
                points: parseInt(row.points, 10),
                movement: movement,
                totalPredictions: totalPredictions,
                correctOutcomes: correctOutcomes,
                exactScores: exactScores,
                accuracy: accuracy
            };
        });

        //console.log(`[Standings API] Sending ${finalStandings.length} standings entries.`);
        res.status(200).json(finalStandings); // Already camelCase from mapping logic

    } catch (error) {
        const errorIdentifier = isOverall ? 'overall' : `round ${requestedRoundId || 'invalid'}`;
        console.error(`[Standings API] CATCH BLOCK Error fetching standings for ${errorIdentifier}:`, error);
        next(error);
    }
});

module.exports = router;