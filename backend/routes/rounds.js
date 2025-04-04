// backend/routes/rounds.js
const express = require('express');
const db = require('../db'); // Assuming db.js exports query function and pool object
const { protect, admin } = require('../middleware/authMiddleware'); // Import middleware

const router = express.Router();

// --- Helper function for calculating points ---
// Placed here for clarity and potential reuse within this file
function calculatePoints(prediction, actualResult) {
    // Destructure for easier access and clarity
    const { predicted_home_goals, predicted_away_goals, is_joker } = prediction;
    const { home_score, away_score } = actualResult;

    // Ensure inputs are numbers before comparison
    const predHome = Number(predicted_home_goals);
    const predAway = Number(predicted_away_goals);
    const actualHome = Number(home_score);
    const actualAway = Number(away_score);

    // Basic validation (should not happen if DB constraints are correct, but good practice)
    if (isNaN(predHome) || isNaN(predAway) || isNaN(actualHome) || isNaN(actualAway)) {
        console.error("Invalid non-numeric score detected during calculation:", prediction, actualResult);
        return 0; // Return 0 points if data is corrupt
    }

    let basePoints = 0;

    // Rule 1: Exact Score Match
    if (predHome === actualHome && predAway === actualAway) {
        basePoints = 3;
    } else {
        // Rule 2: Correct Outcome Match (if not exact score)
        const predictedOutcome = predHome > predAway ? 'H' : (predHome < predAway ? 'A' : 'D');
        const actualOutcome = actualHome > actualAway ? 'H' : (actualHome < actualAway ? 'A' : 'D');

        if (predictedOutcome === actualOutcome) {
            basePoints = 1;
        }
        // Rule 3 (Incorrect Prediction) is implicitly handled as basePoints remains 0
    }

    // Apply Joker Bonus (check if is_joker is explicitly true)
    const finalPoints = prediction.is_joker === true ? basePoints * 2 : basePoints;
    return finalPoints;
}


// --- Round Management (Admin Only) ---

// POST /api/rounds - Create a new round
router.post('/', protect, admin, async (req, res, next) => {
    const { name, deadline } = req.body; // Expect name (string) and deadline (ISO 8601 string e.g., "2024-08-15T18:00:00Z")

    if (!name || !deadline) {
        return res.status(400).json({ message: 'Round name and deadline are required.' });
    }

    const deadlineDate = new Date(deadline);
    if (isNaN(deadlineDate)) {
        return res.status(400).json({ message: 'Invalid deadline format. Use ISO 8601 format.' });
    }

    try {
        // Use db.query directly as we don't need a transaction here
        const newRound = await db.query(
            'INSERT INTO rounds (name, deadline, created_by, status) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, deadlineDate, req.user.userId, 'SETUP'] // Default status to SETUP
        );
        res.status(201).json(newRound.rows[0]);
    } catch (err) {
        console.error("Error creating round:", err);
        next(err);
    }
});

// PUT /api/rounds/:roundId/status - Update round status (e.g., open, close it)
router.put('/:roundId/status', protect, admin, async (req, res, next) => {
    const { roundId } = req.params;
    const { status } = req.body; // Expect status: 'SETUP', 'OPEN', 'CLOSED', 'COMPLETED'

    const parsedRoundId = parseInt(roundId, 10);
     if (isNaN(parsedRoundId)) {
        return res.status(400).json({ message: 'Round ID must be an integer.' });
    }

    // Added 'SETUP' to valid statuses
    if (!status || !['SETUP', 'OPEN', 'CLOSED', 'COMPLETED'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status provided. Use SETUP, OPEN, CLOSED, or COMPLETED.' });
    }

    try {
        // Use db.query directly
        const result = await db.query(
            'UPDATE rounds SET status = $1 WHERE round_id = $2 RETURNING *',
            [status, parsedRoundId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Round not found.' });
        }
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error(`Error updating status for round ${parsedRoundId}:`, err);
        next(err);
    }
});

// --- Fixture Management (Admin Only) ---

// POST /api/rounds/:roundId/fixtures - Add a fixture to a specific round
router.post('/:roundId/fixtures', protect, admin, async (req, res, next) => {
    const { roundId } = req.params;
    // >>> Use camelCase matching frontend AddFixturePayload type <<<
    const { homeTeam, awayTeam, matchTime } = req.body;

     const parsedRoundId = parseInt(roundId, 10);
     if (isNaN(parsedRoundId)) {
        return res.status(400).json({ message: 'Round ID must be an integer.' });
    }

    // Use camelCase variables from body
    if (!homeTeam || !awayTeam) {
        return res.status(400).json({ message: 'Home team and away team names are required.' });
    }

    let matchTimeDate = null;
    if (matchTime) { // Use camelCase variable
        matchTimeDate = new Date(matchTime); // Parse ISO string
        if (isNaN(matchTimeDate)) {
            return res.status(400).json({ message: 'Invalid matchTime format. Use ISO 8601 format.' });
        }
    }

    try {
        const roundCheck = await db.query("SELECT round_id, status FROM rounds WHERE round_id = $1", [parsedRoundId]);
        if (roundCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Round not found.' });
        }

        // Insert using DB column names and camelCase variables from body
        const newFixture = await db.query(
            'INSERT INTO fixtures (round_id, home_team, away_team, match_time) VALUES ($1, $2, $3, $4) RETURNING *', // Return DB columns
            [parsedRoundId, homeTeam, awayTeam, matchTimeDate]
        );
        // Return snake_case from DB; frontend api.ts handles mapping if addFixture return type is Fixture
        res.status(201).json(newFixture.rows[0]);
    } catch (err) {
        console.error(`Error adding fixture to round ${parsedRoundId}:`, err);
        next(err);
    }
});


// ======================================================================
// >>>>>>>>>> ADDED THE MISSING ROUTE HANDLER BELOW <<<<<<<<<<<<<<<<<<<<<
// ======================================================================

// GET /api/rounds/:roundId/fixtures - Get all fixtures for a specific round (Admin access)
router.get('/:roundId/fixtures', protect, admin, async (req, res, next) => {
    const { roundId } = req.params;
    const parsedRoundId = parseInt(roundId, 10);

    if (isNaN(parsedRoundId)) {
        return res.status(400).json({ message: 'Round ID must be an integer.' });
    }

    try {
        // Fetch fixtures associated with the roundId using DB column names
        const fixturesResult = await db.query(
             `SELECT
                fixture_id,
                round_id,
                home_team, -- Use DB column names
                away_team, -- Use DB column names
                match_time,
                home_score,
                away_score
            FROM
                fixtures
            WHERE
                round_id = $1
            ORDER BY
                match_time ASC NULLS LAST, fixture_id ASC`, // Consistent ordering
            [parsedRoundId]
        );

        // Return the array of fixtures (even if empty) using DB column names
        // The frontend api.ts function (getRoundFixtures) will handle mapping to camelCase
        res.status(200).json(fixturesResult.rows);

    } catch (err) {
        console.error(`Error fetching fixtures for round ${parsedRoundId}:`, err);
        next(err); // Pass error to global error handler
    }
});
// ======================================================================
// >>>>>>>>>> END OF ADDED ROUTE HANDLER <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
// ======================================================================


// --- Scoring Trigger (Admin Only) ---

/**
 * @route   POST /api/rounds/:roundId/score
 * @desc    Calculate and save points for all predictions in a round.
 *          Requires round status to be 'CLOSED' and all fixtures to have results.
 *          Updates round status to 'COMPLETED' on success.
 * @access  Private/Admin
 */
router.post('/:roundId/score', protect, admin, async (req, res, next) => {
    const { roundId } = req.params;
    const parsedRoundId = parseInt(roundId, 10);

    if (isNaN(parsedRoundId)) {
        return res.status(400).json({ message: 'Round ID must be an integer.' });
    }

    const client = await db.pool.connect();

    try {
        await client.query('BEGIN'); // Start transaction

        // 1. --- Prerequisite Checks ---
        const roundResult = await client.query('SELECT status FROM rounds WHERE round_id = $1', [parsedRoundId]);
        if (roundResult.rows.length === 0) {
            await client.query('ROLLBACK'); client.release(); return res.status(404).json({ message: 'Round not found.' });
        }
        const roundStatus = roundResult.rows[0].status;
        if (roundStatus !== 'CLOSED') {
            await client.query('ROLLBACK'); client.release(); return res.status(400).json({ message: `Scoring can only be initiated for rounds with status 'CLOSED'. Current status: '${roundStatus}'.` });
        }
        const fixturesResult = await client.query( 'SELECT fixture_id, home_score, away_score FROM fixtures WHERE round_id = $1', [parsedRoundId] );
        if (fixturesResult.rows.length === 0) {
             console.log(`No fixtures found for round ${parsedRoundId}. Marking as COMPLETED.`);
        } else {
            const fixturesWithoutResults = fixturesResult.rows.filter( f => f.home_score === null || f.away_score === null );
            if (fixturesWithoutResults.length > 0) {
                await client.query('ROLLBACK'); client.release(); const missingIds = fixturesWithoutResults.map(f => f.fixture_id).join(', '); return res.status(400).json({ message: `Cannot score round. Results missing for fixtures: ${missingIds}. Please enter all results first.` });
            }
        }
        const actualResultsMap = new Map();
        fixturesResult.rows.forEach(f => { actualResultsMap.set(f.fixture_id, { home_score: f.home_score, away_score: f.away_score }); });

        // 2. --- Fetch Predictions ---
        const predictionsResult = await client.query( `SELECT prediction_id, user_id, fixture_id, predicted_home_goals, predicted_away_goals, is_joker FROM predictions WHERE round_id = $1`, [parsedRoundId] );
        const predictions = predictionsResult.rows;
        if (predictions.length === 0 && fixturesResult.rows.length > 0) {
             console.log(`No predictions found for round ${parsedRoundId}. Marking as COMPLETED.`);
        } else if (predictions.length > 0) {
             // 3. --- Calculate and Update Points ---
             const updatePromises = predictions.map(prediction => {
                const actualResult = actualResultsMap.get(prediction.fixture_id);
                if (!actualResult) { console.error(`Critical Error: Actual result not found for fixture ${prediction.fixture_id}. Prediction ${prediction.prediction_id} will NOT be scored.`); return Promise.resolve(); }
                const points = calculatePoints(prediction, actualResult);
                return client.query( 'UPDATE predictions SET points_awarded = $1 WHERE prediction_id = $2', [points, prediction.prediction_id] );
             });
             await Promise.all(updatePromises);
        }

        // 4. --- Update Round Status to COMPLETED ---
        await client.query( "UPDATE rounds SET status = 'COMPLETED' WHERE round_id = $1", [parsedRoundId] );
        // 5. --- Commit Transaction ---
        await client.query('COMMIT');
        res.status(200).json({ message: `Scoring completed successfully for round ${parsedRoundId}. Status updated to COMPLETED.` });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Error scoring round ${parsedRoundId}:`, error);
        next(error);
    } finally {
        client.release();
    }
});


// --- Public/Player Access (Protected by login, not admin) ---

// GET /api/rounds - Get list of rounds, optionally filtered by status
router.get('/', protect, async (req, res, next) => {
    const { status } = req.query;
    let queryString = 'SELECT round_id, name, deadline, status FROM rounds';
    const queryParams = [];
    if (status) {
        queryString += ' WHERE status = $1';
        queryParams.push(status);
        queryString += ' ORDER BY deadline DESC';
    } else {
        queryString += ' ORDER BY deadline DESC';
    }
    try {
        console.log(`Executing rounds query: ${queryString} with params: ${queryParams}`);
        const result = await db.query(queryString, queryParams);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error fetching rounds:", err);
        next(err);
    }
});


// GET /api/rounds/active - Get the single currently active round (status='OPEN') and its fixtures, including user's predictions
router.get('/active', protect, async (req, res, next) => {
    try {
        const activeRoundResult = await db.query( "SELECT round_id, name, deadline, status FROM rounds WHERE status = 'OPEN' ORDER BY deadline ASC LIMIT 1" );
        if (activeRoundResult.rows.length === 0) { return res.status(200).json(null); }
        const activeRound = activeRoundResult.rows[0];
        const roundId = activeRound.round_id;
        const userId = req.user?.userId;
        if (!userId) { console.error("FATAL: User ID not found in req.user for /active route."); return res.status(401).json({ message: "Authentication error: User ID missing." }); }

        // Use aliases directly in the query to match frontend expectation (camelCase) better
        const fixturesResult = await db.query(
            `SELECT
                fixture_id AS "fixtureId",
                round_id AS "roundId",
                home_team AS "homeTeam",
                away_team AS "awayTeam",
                match_time AS "matchTime",
                home_score AS "homeScore",
                away_score AS "awayScore"
            FROM
                fixtures
            WHERE
                round_id = $1
            ORDER BY
                match_time ASC NULLS LAST, fixture_id ASC`,
            [roundId]
        );
        let fixtures = fixturesResult.rows; // Already potentially camelCased by pg driver if configured, or as aliased

        if (fixtures.length > 0) {
            const fixtureIds = fixtures.map(f => f.fixtureId); // Use mapped name
            try {
                const predictionRes = await db.query(
                    `SELECT
                        fixture_id,
                        predicted_home_goals,
                        predicted_away_goals,
                        is_joker
                     FROM predictions
                     WHERE user_id = $1 AND fixture_id = ANY($2::int[])`,
                    [userId, fixtureIds]
                );
                const predictionsMap = new Map();
                predictionRes.rows.forEach(pred => {
                    predictionsMap.set(pred.fixture_id, {
                        predictedHomeGoals: pred.predicted_home_goals, // Map here for consistency
                        predictedAwayGoals: pred.predicted_away_goals,
                        isJoker: pred.is_joker
                    });
                });
                // Merge predictions into fixtures
                fixtures = fixtures.map(fixture => ({
                    ...fixture, // Contains already mapped fixture details
                    predictedHomeGoals: predictionsMap.get(fixture.fixtureId)?.predictedHomeGoals ?? null,
                    predictedAwayGoals: predictionsMap.get(fixture.fixtureId)?.predictedAwayGoals ?? null,
                    // isJoker: predictionsMap.get(fixture.fixtureId)?.isJoker ?? false,
                }));
            } catch (predError) {
                console.error(`Error fetching predictions for user ${userId}, round ${roundId}:`, predError);
                 fixtures = fixtures.map(fixture => ({
                    ...fixture, // Keep basic mapped fixture details
                    predictedHomeGoals: null,
                    predictedAwayGoals: null,
                 }));
            }
        }
        // Map round details to camelCase and attach fixtures
        const responsePayload = {
            roundId: activeRound.round_id,
            name: activeRound.name,
            deadline: activeRound.deadline,
            status: activeRound.status,
            fixtures: fixtures // Use the processed fixtures array
        };
        res.status(200).json(responsePayload);
    } catch (err) { console.error("Error fetching active round:", err); next(err); }
});


// GET /api/rounds/:roundId - Get details for a specific round, including fixtures (public info)
router.get('/:roundId', protect, async (req, res, next) => {
    const { roundId } = req.params;
    if (roundId === 'active') { return next(); } // Skip if 'active'

    const parsedRoundId = parseInt(roundId, 10);
    if (isNaN(parsedRoundId)) { return res.status(400).json({ message: 'Round ID must be an integer.' }); }

    try {
        const roundResult = await db.query('SELECT round_id, name, deadline, status FROM rounds WHERE round_id = $1', [parsedRoundId]);
        if (roundResult.rows.length === 0) { return res.status(404).json({ message: 'Round not found.' }); }
        const round = roundResult.rows[0];

        // Use aliases for direct mapping to camelCase
        const fixturesResult = await db.query(
             `SELECT
                fixture_id AS "fixtureId",
                round_id AS "roundId",
                home_team AS "homeTeam",
                away_team AS "awayTeam",
                match_time AS "matchTime",
                home_score AS "homeScore",
                away_score AS "awayScore"
            FROM
                fixtures
            WHERE
                round_id = $1
            ORDER BY
                match_time ASC NULLS LAST, fixture_id ASC`,
            [parsedRoundId]
        );
        const fixturesMapped = fixturesResult.rows; // Result directly mapped by aliases

        // Map round to camelCase and attach mapped fixtures
        const responsePayload = {
            roundId: round.round_id,
            name: round.name,
            deadline: round.deadline,
            status: round.status,
            fixtures: fixturesMapped
        };
        res.status(200).json(responsePayload);
    } catch (err) { console.error(`Error fetching details for round ${parsedRoundId}:`, err); next(err); }
});


// Make sure to export the router
module.exports = router;