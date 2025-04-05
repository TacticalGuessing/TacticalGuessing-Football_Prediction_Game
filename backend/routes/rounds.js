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
    const { name, deadline } = req.body; // Expect name (string) and deadline (ISO 8601 string e.g., "2024-08-15T18:00:00Z" or YYYY-MM-DDTHH:MM)

    if (!name || !deadline) {
        return res.status(400).json({ message: 'Round name and deadline are required.' });
    }

    const deadlineDate = new Date(deadline);
    if (isNaN(deadlineDate.getTime())) { // Check getTime() for validity
        return res.status(400).json({ message: 'Invalid deadline format. Use ISO 8601 or YYYY-MM-DDTHH:MM format.' });
    }
    // Convert to UTC ISO string for database consistency
    const deadlineISO = deadlineDate.toISOString();

    try {
        // Use db.query directly as we don't need a transaction here
        const newRound = await db.query(
            'INSERT INTO rounds (name, deadline, created_by, status, created_at, updated_at) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *',
            [name, deadlineISO, req.user.userId, 'SETUP'] // Default status to SETUP
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
router.get('/', protect, async (req, res, next) => {
    const { status } = req.query;
    // Return minimal info needed for lists
    let queryString = 'SELECT round_id, name, deadline, status FROM rounds';
    const queryParams = [];
    if (status) {
        queryString += ' WHERE status = $1';
        queryParams.push(status);
    }
    queryString += ' ORDER BY deadline DESC'; // Always order
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

// PUT /api/rounds/:roundId/status - Update round status (e.g., open, close it) (Admin Only)
router.put('/:roundId/status', protect, admin, async (req, res, next) => {
    const { roundId } = req.params;
    const { status } = req.body; // Expect status: 'SETUP', 'OPEN', 'CLOSED', 'COMPLETED'

    const parsedRoundId = parseInt(roundId, 10);
     if (isNaN(parsedRoundId)) {
        return res.status(400).json({ message: 'Round ID must be an integer.' });
    }

    // Added 'SETUP' to valid statuses, removed 'COMPLETED' as it's set by scoring
    if (!status || !['SETUP', 'OPEN', 'CLOSED'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status provided. Use SETUP, OPEN, or CLOSED.' });
    }

    try {
        // Use db.query directly
        const result = await db.query(
            'UPDATE rounds SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE round_id = $2 RETURNING *', // Add updated_at
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


// POST /api/rounds/:roundId/fixtures - Add a fixture to a specific round MANUALLY (Admin Only)
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
        if (isNaN(matchTimeDate.getTime())) { // Check getTime()
            return res.status(400).json({ message: 'Invalid matchTime format. Use ISO 8601 format.' });
        }
    } else {
        // Handle case where matchTime is not provided? Set a default or require it?
        // For now, let's assume it might be optional and DB allows NULL or has default
        console.warn(`Match time not provided for fixture in round ${parsedRoundId}.`);
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
            'INSERT INTO fixtures (round_id, home_team, away_team, match_time, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *', // Added default status and timestamps
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
        const roundResult = await client.query('SELECT status FROM rounds WHERE round_id = $1 FOR UPDATE', [parsedRoundId]); // Add FOR UPDATE
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
                // Also update the updated_at timestamp for the prediction
                return client.query( 'UPDATE predictions SET points_awarded = $1, updated_at = CURRENT_TIMESTAMP WHERE prediction_id = $2', [points, prediction.prediction_id] );
             });
             await Promise.all(updatePromises);
        }

        // 4. --- Update Round Status to COMPLETED ---
        await client.query( "UPDATE rounds SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP WHERE round_id = $1", [parsedRoundId] ); // Add updated_at
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


// POST /api/rounds/:roundId/fixtures/random-results - Generate random results (Admin Only)
router.post('/:roundId/fixtures/random-results', protect, admin, async (req, res, next) => {
    const { roundId } = req.params;
    const parsedRoundId = parseInt(roundId, 10);

    console.log(`Attempting to generate random results for round ID: ${parsedRoundId}`);

    if (isNaN(parsedRoundId)) {
        console.log('Generate results failed: Invalid round ID format.');
        return res.status(400).json({ message: 'Round ID must be an integer.' });
    }

    const client = await db.pool.connect();

    try {
        // 1. Check if round exists and is not COMPLETED (optional check)
        const roundCheck = await client.query('SELECT status FROM rounds WHERE round_id = $1', [parsedRoundId]);
        if (roundCheck.rows.length === 0) {
            client.release();
            return res.status(404).json({ message: 'Round not found.' });
        }
        // Optional: Prevent if already completed
        // if (roundCheck.rows[0].status === 'COMPLETED') {
        //    client.release();
        //    return res.status(400).json({ message: 'Cannot generate results for a COMPLETED round.' });
        // }

        // 2. Get all fixture IDs for this round
        const fixturesResult = await client.query(
            'SELECT fixture_id FROM fixtures WHERE round_id = $1',
            [parsedRoundId]
        );

        if (fixturesResult.rows.length === 0) {
            client.release();
            console.log(`No fixtures found for round ${parsedRoundId}. No results generated.`);
            return res.status(200).json({ message: 'No fixtures found in this round to generate results for.', count: 0 });
        }

        const fixtureIds = fixturesResult.rows.map(row => row.fixture_id);

        // 3. Update fixtures with random scores within a transaction
        await client.query('BEGIN');
        let updatedCount = 0;
        const maxScore = 4; // Max random score (0-4)

        for (const fixtureId of fixtureIds) {
            const randomHomeScore = Math.floor(Math.random() * (maxScore + 1));
            const randomAwayScore = Math.floor(Math.random() * (maxScore + 1));

            const updateResult = await client.query(
                `UPDATE fixtures
                 SET home_score = $1, away_score = $2, status = 'FINISHED', updated_at = CURRENT_TIMESTAMP
                 WHERE fixture_id = $3`, // Add updated_at
                [randomHomeScore, randomAwayScore, fixtureId]
            );
            if (updateResult.rowCount > 0) {
                updatedCount++;
            }
        }

        await client.query('COMMIT');
        console.log(`Successfully generated random results for ${updatedCount} fixtures in round ${parsedRoundId}.`);

        // 4. Respond Success
        res.status(200).json({ message: `Generated random results for ${updatedCount} fixtures.`, count: updatedCount });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Error generating random results for round ${parsedRoundId}:`, error);
        next(error);
    } finally {
        client.release();
    }
});


// DELETE /api/rounds/:roundId - Delete a round and associated data (Admin Only)
router.delete('/:roundId', protect, admin, async (req, res, next) => {
    const { roundId } = req.params;
    const parsedRoundId = parseInt(roundId, 10);

    console.log(`Attempting to delete round ID: ${parsedRoundId}`);

    if (isNaN(parsedRoundId)) {
        console.log('Delete failed: Invalid round ID format.');
        return res.status(400).json({ message: 'Round ID must be an integer.' });
    }

    // Optional: Add checks here? E.g., prevent deleting OPEN/CLOSED/COMPLETED rounds?
    // const checkStatus = await db.query('SELECT status FROM rounds WHERE round_id = $1', [parsedRoundId]);
    // if (checkStatus.rows.length > 0 && checkStatus.rows[0].status !== 'SETUP') {
    //     return res.status(400).json({ message: `Cannot delete round with status: ${checkStatus.rows[0].status}. Only SETUP rounds can be deleted.` });
    // }

    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Delete associated predictions first (using round_id)
         const predictionDeleteResult = await client.query(
             'DELETE FROM predictions WHERE round_id = $1',
             [parsedRoundId]
         );
         console.log(`Deleted ${predictionDeleteResult.rowCount} associated prediction(s) for round ${parsedRoundId}.`);

        // 2. Delete associated fixtures
        const fixtureDeleteResult = await client.query(
            'DELETE FROM fixtures WHERE round_id = $1',
            [parsedRoundId]
        );
        console.log(`Deleted ${fixtureDeleteResult.rowCount} associated fixture(s) for round ${parsedRoundId}.`);

        // 3. Delete the round itself
        const roundDeleteResult = await client.query(
            'DELETE FROM rounds WHERE round_id = $1',
            [parsedRoundId]
        );

        // 4. Check if the round was found and deleted
        if (roundDeleteResult.rowCount === 0) {
            await client.query('ROLLBACK');
            console.log(`Delete failed: Round ID ${parsedRoundId} not found.`);
            return res.status(404).json({ message: 'Round not found.' });
        }

        // 5. Commit
        await client.query('COMMIT');
        console.log(`Successfully deleted round ID ${parsedRoundId} and associated data.`);

        // 6. Respond 204 No Content
        res.status(204).send();

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Error deleting round ${parsedRoundId}:`, error);
        next(error);
    } finally {
        client.release();
    }
});
// --- END DELETE ROUND ROUTE ---

// ========== NEW PUT ROUTE HANDLER STARTS HERE ==========
/**
 * @route   PUT /api/rounds/:roundId
 * @desc    Update round details (name, deadline)
 * @access  Private (Admin only)
 */
router.put('/:roundId', protect, admin, async (req, res, next) => {
    const { roundId } = req.params;
    const { name, deadline } = req.body; // Expect camelCase from frontend api.ts

    // 1. Validate Round ID
    const parsedRoundId = parseInt(roundId, 10);
    if (isNaN(parsedRoundId)) {
        return res.status(400).json({ message: 'Invalid Round ID.' });
    }

    // 2. Validate Payload Fields (if they are provided)
    if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
        // Allow empty string? For now, require non-empty if provided. Adjust if needed.
        return res.status(400).json({ message: 'If provided, round name must be a non-empty string.' });
    }

    let deadlineISO = null; // Variable to hold the correctly formatted deadline for DB
    if (deadline !== undefined) {
        // The 'deadline' from frontend is expected to be in 'YYYY-MM-DDTHH:MM' format (local time) or full ISO
        // We need to parse this and convert it to a full ISO 8601 string (UTC) for the database.
        const parsedDate = new Date(deadline); // This parses the local datetime string or ISO string
        if (isNaN(parsedDate.getTime())) { // Check getTime() for validity
            return res.status(400).json({ message: 'Invalid deadline format. Expected format like YYYY-MM-DDTHH:MM or ISO 8601.' });
        }
        // Convert the parsed date (which represents local time) to a UTC ISO string
        deadlineISO = parsedDate.toISOString();
        console.log(`Received deadline "${deadline}", converted to UTC ISO: "${deadlineISO}" for round ${parsedRoundId}`);
    }

    // 3. Check if Round Exists and Apply Business Logic (e.g., status checks)
    try {
        const roundCheck = await db.query('SELECT status FROM rounds WHERE round_id = $1', [parsedRoundId]);
        if (roundCheck.rows.length === 0) {
            return res.status(404).json({ message: `Round with ID ${parsedRoundId} not found.` });
        }
        const currentStatus = roundCheck.rows[0].status;

        // --- Optional Business Logic: Status Restrictions ---
        // Example: Disallow changing deadline if round is not in SETUP
        if (deadlineISO && currentStatus !== 'SETUP') {
           console.warn(`Attempted to change deadline for round ${parsedRoundId} with status ${currentStatus}. Allowed for now, but consider restricting.`);
           // Uncomment below to restrict:
           // return res.status(400).json({ message: `Deadline cannot be changed once a round is '${currentStatus}'. Only allowed in 'SETUP' status.` });
        }
        // Add more restrictions if needed (e.g., maybe name changes are also restricted after SETUP)

        // 4. Construct Dynamic UPDATE Query
        const fieldsToUpdate = [];
        const queryParams = [];
        let paramIndex = 1;

        // Only add fields to the update query if they were actually provided in the payload
        if (name !== undefined) {
            fieldsToUpdate.push(`name = $${paramIndex++}`);
            queryParams.push(name.trim()); // Use trimmed name
        }
        if (deadlineISO !== null) { // Use the processed ISO string
            fieldsToUpdate.push(`deadline = $${paramIndex++}`);
            queryParams.push(deadlineISO);
        }

        // Check if there's anything to update
        if (fieldsToUpdate.length === 0) {
            // Nothing to update, fetch and return current data to signal success without change
            console.log(`No changes detected for round ${parsedRoundId}. Returning current data.`);
            const currentDataResult = await db.query('SELECT * FROM rounds WHERE round_id = $1', [parsedRoundId]);
             // Check again if round exists in case of race condition (unlikely here)
             if (currentDataResult.rows.length === 0) {
                 return res.status(404).json({ message: `Round with ID ${parsedRoundId} not found.` });
             }
            return res.status(200).json(currentDataResult.rows[0]); // Return snake_case from DB
        }

        // Add updated_at timestamp - always update if other fields change
        fieldsToUpdate.push(`updated_at = CURRENT_TIMESTAMP`);

        // Add round_id for the WHERE clause, it will be the last parameter
        queryParams.push(parsedRoundId);

        const updateQuery = `
            UPDATE rounds
            SET ${fieldsToUpdate.join(', ')}
            WHERE round_id = $${paramIndex}
            RETURNING *; -- Return the full updated row
        `;

        // 5. Execute the Update Query
        console.log(`Executing update for round ${parsedRoundId}: ${updateQuery} with params: ${JSON.stringify(queryParams)}`);
        const result = await db.query(updateQuery, queryParams);

        // 6. Respond with Updated Data
        // The data from `RETURNING *` is already in DB's snake_case format
        console.log(`Successfully updated round ${parsedRoundId}.`);
        res.status(200).json(result.rows[0]);

    } catch (error) {
        // Check for specific errors like unique constraint on name if applicable
        if (error.code === '23505' && error.constraint === 'rounds_name_key') { // Adjust constraint name if needed
             console.error(`Update failed for round ${parsedRoundId}: Name conflict.`);
             return res.status(409).json({ message: 'A round with this name already exists.' });
        }
        console.error(`Error updating round ${parsedRoundId}:`, error);
        next(error); // Pass error to the global error handler
    }
});
// ========== NEW PUT ROUTE HANDLER ENDS HERE ==========


// GET /api/rounds/:roundId - Get details for a specific round, including fixtures (public info, but protected)
// ** MUST BE THE LAST PARAMETERIZED ROUTE FOR /:roundId **
router.get('/:roundId', protect, async (req, res, next) => {
    const { roundId } = req.params;
    // Allow 'active' to pass through to the /active handler if it wasn't caught earlier by server routing order
    // Check for other keywords that might clash if needed
    if (['active', 'import'].includes(roundId)) { // Added 'import' defensively
         console.log(`GET /:roundId - Skipping keyword: ${roundId}`);
         return next(); // Pass to next route handler (should not be needed if routes ordered correctly)
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
        res.status(200).json(responsePayload); // Returns mapped camelCase
    } catch (err) {
        console.error(`Error fetching details for round ${parsedRoundId}:`, err);
        next(err);
    }
});


// Make sure to export the router
module.exports = router;