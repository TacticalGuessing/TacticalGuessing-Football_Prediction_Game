// backend/routes/rounds.js
const express = require('express');
const db = require('../db'); // Assuming db.js exports query function and pool object
const { protect, admin } = require('../middleware/authMiddleware'); // Import middleware
const axios = require('axios'); // <--- Added axios import

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
    // NOTE: Your DB query selects is_joker, make sure it's used if joker feature is active
    const finalPoints = prediction.is_joker === true ? basePoints * 2 : basePoints;
    return finalPoints;
}


// ======================================================
// === Specific (Non-Parameterized) Routes First ===
// ======================================================

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
        res.status(201).json(newRound.rows[0]); // Returns snake_case from DB
    } catch (err) {
        console.error("Error creating round:", err);
        // Add specific error check for unique constraint violation if 'name' should be unique
        if (err.code === '23505') { // Check for unique violation error code
            return res.status(409).json({ message: 'A round with this name may already exist.' });
        }
        next(err);
    }
});


// --- Fixture Import (Admin Only) ---
// POST /api/rounds/import/fixtures - Import fixtures from football-data.org (Admin only)
// ** MOVED EARLIER **
router.post('/import/fixtures', protect, admin, async (req, res, next) => {
    // Log incoming request body and types
    console.log('--- Received /import/fixtures request ---');
    console.log('Request Body:', req.body);
    console.log('Type of roundId:', typeof req.body.roundId);
    console.log('Type of competitionCode:', typeof req.body.competitionCode);
    console.log('Type of matchday:', typeof req.body.matchday);
    console.log('-------------------------------------------');

    // Expecting camelCase from frontend
    const { roundId, competitionCode, matchday } = req.body;
    const apiKey = process.env.FOOTBALL_DATA_API_KEY;

    // --- Input Validation --- (Using parseInt again)
    const parsedRoundId = parseInt(roundId, 10); // Use parseInt
    const matchdayNum = parseInt(matchday, 10); // Parse matchday

    // Validate Round ID
    if (isNaN(parsedRoundId) || parsedRoundId <= 0) { // Check if parsing failed or result is not positive
        console.error('Validation failed: Could not parse roundId as positive integer. Received:', roundId);
        return res.status(400).json({ message: 'Round ID must be a positive integer.' });
    }

    // Validate Competition Code
    if (!competitionCode || typeof competitionCode !== 'string' || competitionCode.trim() === '') {
        console.error('Validation failed: Competition Code invalid. Received:', competitionCode);
        return res.status(400).json({ message: 'Competition Code must be a non-empty string.' });
    }

    // Validate Matchday
    if (isNaN(matchdayNum) || matchdayNum <= 0) {
        console.error('Validation failed: Could not parse matchday as positive integer. Received:', matchday);
        return res.status(400).json({ message: 'Matchday must be a positive integer.' });
    }

    // Validate API Key (Keep this check)
    if (!apiKey) {
        console.error('FOOTBALL_DATA_API_KEY is not set in environment variables.');
        return res.status(500).json({ message: 'Server configuration error.' });
    }
    // --- End of Updated Input Validation ---


    // --- Check if Round Exists (using parsedRoundId) --- // Ensure this uses parsedRoundId
    let roundStatus;
    try {
        // Use parsedRoundId which is the validated integer
        const roundCheck = await db.query('SELECT status FROM rounds WHERE round_id = $1', [parsedRoundId]);
        if (roundCheck.rows.length === 0) {
            return res.status(404).json({ message: `Round with ID ${parsedRoundId} not found.` });
        }
        roundStatus = roundCheck.rows[0].status;
        // Optional: Add check for round status (e.g., only allow import in 'SETUP')
        // if (roundStatus !== 'SETUP') {
        //     return res.status(400).json({ message: 'Fixtures can only be imported when the round is in SETUP status.' });
        // }
    } catch (dbErr) {
        console.error(`Error checking round status for ID ${parsedRoundId}:`, dbErr);
        return next(dbErr); // Use global error handler
    }

    // --- Fetch Data from External API ---
    // Use matchdayNum (the parsed integer) in the API URL
    const apiUrl = `https://api.football-data.org/v4/competitions/${competitionCode.trim().toUpperCase()}/matches?matchday=${matchdayNum}`;
    let externalData;
    try {
        console.log(`Fetching data from: ${apiUrl}`);
        const response = await axios.get(apiUrl, {
            headers: { 'X-Auth-Token': apiKey }
        });
        externalData = response.data; // Contains {..., matches: [...] }
        console.log(`Successfully fetched ${externalData?.matches?.length || 0} matches from external API.`);

        if (!externalData || !externalData.matches || externalData.matches.length === 0) {
             console.warn('No matches found in the external API response for the given parameters.');
             // Use matchdayNum in the message
             return res.status(404).json({ message: `No matches found on football-data.org for ${competitionCode.trim().toUpperCase()} and matchday ${matchdayNum}.` });
        }

    } catch (apiErr) {
        // Use matchdayNum in the error message
        console.error(`Error fetching data from football-data.org for ${competitionCode.trim().toUpperCase()}, matchday ${matchdayNum}:`, apiErr.response?.status, apiErr.response?.data || apiErr.message);
        if (apiErr.response) {
             const status = apiErr.response.status;
             const message = apiErr.response.data?.message || 'Error fetching data from external API.';
             if (status === 403) { return res.status(500).json({ message: 'External API access denied. Check API key or subscription plan.' }); }
             else if (status === 404) { return res.status(404).json({ message: 'Competition or matchday not found on external API.' }); }
             return res.status(status < 500 ? 400 : 502).json({ message: `External API Error (${status}): ${message}` });
        } else {
             // Network or other errors
             return res.status(500).json({ message: 'Failed to connect to external API.' });
        }
    }

    // --- Map and Prepare Data for Insertion ---
    // Use DB column names (snake_case) here for insertion
    const fixturesToInsert = externalData.matches
        .filter(match => match.homeTeam?.name && match.awayTeam?.name && match.utcDate) // Basic validation
        .map(match => ({
            round_id: parsedRoundId, // Use the validated integer ID
            home_team: match.homeTeam.name,
            away_team: match.awayTeam.name,
            match_time: match.utcDate,
            status: 'SCHEDULED',
            home_score: null,
            away_score: null
        }));

    if (fixturesToInsert.length === 0) {
         console.log("No valid matches found in API response after filtering.");
         return res.status(200).json({ message: 'No valid matches found in API response to import.', count: 0 });
    }

    // --- Insert Data into Database (using transaction from pool) ---
    const client = await db.pool.connect(); // Use pool for transaction
    try {
        await client.query('BEGIN');

        // ** Behavior Decision: Append vs Replace **
        // Option A: Append (Current implementation)
        // Option B: Replace - Uncomment the line below
        // console.log(`Deleting existing fixtures for round ${parsedRoundId} before import...`);
        // const deleteResult = await client.query('DELETE FROM fixtures WHERE round_id = $1', [parsedRoundId]);
        // console.log(`Deleted ${deleteResult.rowCount} existing fixtures.`);

        let insertedCount = 0;
        for (const fixture of fixturesToInsert) {
            try {
                 await client.query(
                     `INSERT INTO fixtures (round_id, home_team, away_team, match_time, status, home_score, away_score)
                      VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                     [
                         fixture.round_id,
                         fixture.home_team,
                         fixture.away_team,
                         fixture.match_time,
                         fixture.status,
                         fixture.home_score,
                         fixture.away_score
                     ]
                 );
                 insertedCount++;
            } catch (insertErr) {
                 console.error('Error inserting fixture:', fixture, insertErr);
                 throw insertErr;
            }
        }

        await client.query('COMMIT');
        console.log(`Successfully inserted ${insertedCount} fixtures for round ${parsedRoundId}.`);
        res.status(201).json({ message: `Successfully imported ${insertedCount} fixtures.`, count: insertedCount });

    } catch (dbErr) {
        await client.query('ROLLBACK');
        console.error(`Database error during fixture import for round ${parsedRoundId}:`, dbErr);
        next(dbErr);
    } finally {
        client.release();
    }
});
// --- END OF IMPORT ROUTE ---


// --- Public/Player Access (Non-Parameterized) ---

// GET /api/rounds - Get list of rounds, optionally filtered by status
// ** MOVED EARLIER **
router.get('/', protect, async (req, res, next) => {
    const { status } = req.query;
    // Return minimal info needed for lists
    let queryString = 'SELECT round_id, name, deadline, status FROM rounds';
    const queryParams = [];
    if (status) {
        queryString += ' WHERE status = $1';
        queryParams.push(status);
        queryString += ' ORDER BY deadline DESC'; // Order for display
    } else {
        queryString += ' ORDER BY deadline DESC'; // Order for display
    }
    try {
        // console.log(`Executing rounds query: ${queryString} with params: ${queryParams}`);
        const result = await db.query(queryString, queryParams);
        // Returns snake_case, frontend mapping needed if desired
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error fetching rounds:", err);
        next(err);
    }
});

// GET /api/rounds/active - Get the single currently active round (status='OPEN') and its fixtures, including user's predictions
// ** MOVED EARLIER **
router.get('/active', protect, async (req, res, next) => {
    try {
        // Fetch active round (snake_case)
        const activeRoundResult = await db.query( "SELECT round_id, name, deadline, status FROM rounds WHERE status = 'OPEN' ORDER BY deadline ASC LIMIT 1" );
        if (activeRoundResult.rows.length === 0) { return res.status(200).json(null); } // Return null if no active round
        const activeRound = activeRoundResult.rows[0];
        const roundId = activeRound.round_id;
        const userId = req.user?.userId;
        if (!userId) { console.error("FATAL: User ID not found in req.user for /active route."); return res.status(401).json({ message: "Authentication error: User ID missing." }); }

        // Fetch fixtures for the active round (snake_case)
        const fixturesResult = await db.query(
            `SELECT
                fixture_id, round_id, home_team, away_team, match_time, home_score, away_score, status
            FROM
                fixtures
            WHERE
                round_id = $1
            ORDER BY
                match_time ASC NULLS LAST, fixture_id ASC`,
            [roundId]
        );
        let fixtures_snake = fixturesResult.rows; // Array of fixtures in snake_case

        let fixtures_camel = []; // Prepare array for final camelCase output

        if (fixtures_snake.length > 0) {
            const fixtureIds = fixtures_snake.map(f => f.fixture_id);
            let predictionsMap = new Map();

            try {
                // Fetch predictions (snake_case)
                const predictionRes = await db.query(
                    `SELECT
                        fixture_id, predicted_home_goals, predicted_away_goals, is_joker
                     FROM predictions
                     WHERE user_id = $1 AND fixture_id = ANY($2::int[])`,
                    [userId, fixtureIds]
                );
                predictionRes.rows.forEach(pred => {
                    predictionsMap.set(pred.fixture_id, {
                        predictedHomeGoals: pred.predicted_home_goals, // Map to camelCase here
                        predictedAwayGoals: pred.predicted_away_goals,
                        isJoker: pred.is_joker
                    });
                });
            } catch (predError) {
                console.error(`Error fetching predictions for user ${userId}, round ${roundId}:`, predError);
                // Continue without predictions if fetching fails
            }

            // Map fixtures to camelCase and merge predictions
            fixtures_camel = fixtures_snake.map(fixture => ({
                fixtureId: fixture.fixture_id,
                roundId: fixture.round_id,
                homeTeam: fixture.home_team,
                awayTeam: fixture.away_team,
                matchTime: fixture.match_time,
                homeScore: fixture.home_score,
                awayScore: fixture.away_score,
                status: fixture.status,
                // Merge prediction data (already camelCased)
                predictedHomeGoals: predictionsMap.get(fixture.fixture_id)?.predictedHomeGoals ?? null,
                predictedAwayGoals: predictionsMap.get(fixture.fixture_id)?.predictedAwayGoals ?? null,
                isJoker: predictionsMap.get(fixture.fixture_id)?.isJoker ?? false, // Default to false if no prediction or joker not set
            }));

        } // End if fixtures exist

        // Map round details to camelCase and attach mapped fixtures
        const responsePayload = {
            roundId: activeRound.round_id,
            name: activeRound.name,
            deadline: activeRound.deadline,
            status: activeRound.status,
            fixtures: fixtures_camel // Use the fully processed camelCase fixtures array
        };
        res.status(200).json(responsePayload);

    } catch (err) {
        console.error("Error fetching active round:", err);
        next(err);
    }
});


// ======================================================
// === Parameterized Routes (:roundId) Last ===
// ======================================================


// PUT /api/rounds/:roundId/status - Update round status (e.g., open, close it)
// ** MOVED LATER **
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
        res.status(200).json(result.rows[0]); // Returns snake_case from DB
    } catch (err) {
        console.error(`Error updating status for round ${parsedRoundId}:`, err);
        next(err);
    }
});


// POST /api/rounds/:roundId/fixtures - Add a fixture to a specific round MANUALLY
// ** MOVED LATER **
router.post('/:roundId/fixtures', protect, admin, async (req, res, next) => {
    const { roundId } = req.params;
    // Expecting camelCase from frontend AddFixturePayload type
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
        // Optional: Check if round status is 'SETUP' before allowing additions
        // if (roundCheck.rows[0].status !== 'SETUP') {
        //     return res.status(400).json({ message: 'Fixtures can only be added when the round is in SETUP status.' });
        // }

        // Insert using DB column names (home_team, away_team, match_time) and camelCase variables from body
        const newFixture = await db.query(
            'INSERT INTO fixtures (round_id, home_team, away_team, match_time, status) VALUES ($1, $2, $3, $4, $5) RETURNING *', // Added default status
            [parsedRoundId, homeTeam, awayTeam, matchTimeDate, 'SCHEDULED'] // Set default status
        );
        // Return snake_case from DB; frontend api.ts handles mapping if needed
        res.status(201).json(newFixture.rows[0]);
    } catch (err) {
        console.error(`Error adding fixture to round ${parsedRoundId}:`, err);
        next(err);
    }
});


// GET /api/rounds/:roundId/fixtures - Get all fixtures for a specific round (Admin access)
// ** MOVED LATER **
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
                away_score,
                status       -- Also fetch status
            FROM
                fixtures
            WHERE
                round_id = $1
            ORDER BY
                match_time ASC NULLS LAST, fixture_id ASC`, // Consistent ordering
            [parsedRoundId]
        );

        // Return the array of fixtures (even if empty) using DB column names (snake_case)
        // The frontend api.ts function (getRoundFixtures) will handle mapping to camelCase
        res.status(200).json(fixturesResult.rows);

    } catch (err) {
        console.error(`Error fetching fixtures for round ${parsedRoundId}:`, err);
        next(err); // Pass error to global error handler
    }
});


// POST /api/rounds/:roundId/score - Trigger scoring for a round (Admin only)
// ** MOVED LATER **
router.post('/:roundId/score', protect, admin, async (req, res, next) => {
    const { roundId } = req.params;
    const parsedRoundId = parseInt(roundId, 10);

    if (isNaN(parsedRoundId)) {
        return res.status(400).json({ message: 'Round ID must be an integer.' });
    }

    const client = await db.pool.connect(); // Use pool

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
        // Check fixtures HAVE results (home_score/away_score not null)
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
        // Ensure points_awarded column exists in predictions table
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
                // Assuming 'points_awarded' is the column name in your predictions table
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
        next(error); // Use global error handler
    } finally {
        client.release(); // Release client back to pool
    }
});


// GET /api/rounds/:roundId - Get details for a specific round, including fixtures (public info, but protected)
// ** MOVED LATER - MUST BE LAST **
router.get('/:roundId', protect, async (req, res, next) => {
    const { roundId } = req.params;
    // Allow 'active' to pass through to the /active handler if it wasn't caught earlier by server routing order
    // Also check for 'import' here explicitly, although the POST should differentiate, belt-and-braces
    if (roundId === 'active' || roundId === 'import') {
         console.log(`GET /:roundId - Skipping keyword: ${roundId}`);
         return next();
    }

    const parsedRoundId = parseInt(roundId, 10);
    if (isNaN(parsedRoundId)) { return res.status(400).json({ message: 'Round ID must be an integer.' }); }

    try {
        // Fetch round (snake_case)
        const roundResult = await db.query('SELECT round_id, name, deadline, status FROM rounds WHERE round_id = $1', [parsedRoundId]);
        if (roundResult.rows.length === 0) { return res.status(404).json({ message: 'Round not found.' }); }
        const round_snake = roundResult.rows[0];

        // Fetch fixtures (snake_case)
        const fixturesResult = await db.query(
             `SELECT
                fixture_id, round_id, home_team, away_team, match_time, home_score, away_score, status
            FROM
                fixtures
            WHERE
                round_id = $1
            ORDER BY
                match_time ASC NULLS LAST, fixture_id ASC`,
            [parsedRoundId]
        );
        const fixtures_snake = fixturesResult.rows;

        // Map fixtures to camelCase for the response
        const fixtures_camel = fixtures_snake.map(fixture => ({
            fixtureId: fixture.fixture_id,
            roundId: fixture.round_id,
            homeTeam: fixture.home_team,
            awayTeam: fixture.away_team,
            matchTime: fixture.match_time,
            homeScore: fixture.home_score,
            awayScore: fixture.away_score,
            status: fixture.status
         }));

        // Map round to camelCase and attach mapped fixtures
        const responsePayload = {
            roundId: round_snake.round_id,
            name: round_snake.name,
            deadline: round_snake.deadline,
            status: round_snake.status,
            fixtures: fixtures_camel // Use mapped fixtures
        };
        res.status(200).json(responsePayload);
    } catch (err) {
        console.error(`Error fetching details for round ${parsedRoundId}:`, err);
        next(err);
    }
});


// Make sure to export the router
module.exports = router;