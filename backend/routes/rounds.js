// backend/routes/rounds.js
const express = require('express');
const db = require('../db'); // Assuming db.js exports query function and pool object
const { protect, admin } = require('../middleware/authMiddleware'); // Import middleware
const axios = require('axios'); // <--- Added axios import
const { calculatePoints } = require('../src/utils/scoringUtils');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
// --- Helper function for calculating points ---
// Placed here for clarity and potential reuse within this file



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

// --- NEW: GET /api/rounds/latest-completed ---
/**
 * @route   GET /api/rounds/latest-completed
 * @desc    Get the ID and Name of the most recently completed round
 * @access  Protected (Any logged-in user)
 */
router.get('/latest-completed', protect, async (req, res, next) => {
    console.log(`[${new Date().toISOString()}] User ${req.user.userId} requesting latest completed round.`);
    try {
        const latestCompleted = await prisma.round.findFirst({
            where: { status: 'COMPLETED' },
            orderBy: { deadline: 'desc' }, // Order by deadline descending to get the latest
            select: {
                roundId: true, // Use model field name
                name: true     // Use model field name
            }
        });

        if (!latestCompleted) {
            console.log(`[${new Date().toISOString()}] No completed rounds found.`);
            // Send 204 No Content instead of 404, as it's not an error, just no data yet
            return res.status(204).send();
        }

        console.log(`[${new Date().toISOString()}] Found latest completed round: ID ${latestCompleted.roundId}`);
        res.status(200).json(latestCompleted); // Returns { roundId, name }

    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error fetching latest completed round:`, error);
        next(error);
    }
});
// --- END NEW ROUTE ---

// --- Round Management (Admin Only) ---
// POST /api/rounds
// ... (rest of the file) ...

module.exports = router;

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
router.get('/:roundId/fixtures', protect, async (req, res, next) => {
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
    // <<< LOG 1: Start >>>
    console.log(`--- [SCORING] Starting scoring for Round ID: ${parsedRoundId} ---`);

    if (isNaN(parsedRoundId)) { /* ... */ }

    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // 1. --- Prerequisite Checks ---
        const roundResult = await client.query( /* ... check round status ... */ );
        if (roundResult.rows.length === 0) { /* ... */ }
        const roundStatus = roundResult.rows[0].status;
        if (roundStatus !== 'CLOSED') { /* ... */ }

        const fixturesResult = await client.query( /* ... fetch fixtures ... */ );
        // <<< LOG 2: Fetched Fixtures >>>
        console.log(`[SCORING] Fetched ${fixturesResult.rows.length} fixtures for round ${parsedRoundId}.`);

        if (fixturesResult.rows.length === 0) { /* ... handle no fixtures ... */ }
        else {
            const fixturesWithoutResults = fixturesResult.rows.filter( f => f.home_score === null || f.away_score === null );
            if (fixturesWithoutResults.length > 0) { /* ... handle missing results ... */ }

            const actualResultsMap = new Map();
            fixturesResult.rows.forEach(f => { actualResultsMap.set(f.fixture_id, { home_score: f.home_score, away_score: f.away_score }); });

            // 2. --- Fetch Predictions ---
            const predictionsResult = await client.query( /* ... fetch predictions ... */ );
            const predictions = predictionsResult.rows;
            // <<< LOG 3: Fetched Predictions >>>
            console.log(`[SCORING] Found ${predictions.length} predictions for round ${parsedRoundId}.`);

            if (predictions.length === 0) { /* ... handle no predictions ... */ }
            else {
                 console.log(`[SCORING] Calculating and updating scores for ${predictions.length} predictions...`);

                 // --- 3. Calculate and Prepare Updates ---
                 const updatePromises = predictions.map(prediction => {
                    const actualResult = actualResultsMap.get(prediction.fixture_id);

                    // <<< LOG 4: Processing Prediction >>>
                    console.log(`\n[SCORING] Processing Prediction ID: ${prediction.prediction_id}, User: ${prediction.user_id}, Fixture: ${prediction.fixture_id}`);
                    console.log(`  Pred: ${prediction.predicted_home_goals}-${prediction.predicted_away_goals}, Joker: ${prediction.is_joker}`);

                    if (!actualResult) {
                        console.error(`  [SCORING] Critical Error: Actual result not found for fixture ${prediction.fixture_id}. Prediction ${prediction.prediction_id} will NOT be scored.`);
                        return Promise.resolve(); // Skip update for this prediction
                    }

                    console.log(`  Fixture Result: ${actualResult.home_score}-${actualResult.away_score}`);

                    let points = 0;
                    try {
                        // Call calculatePoints
                        points = calculatePoints(prediction, actualResult);
                        // <<< LOG 5: Points Calculated >>>
                        console.log(`  [SCORING] Calculated points: ${points}`);
                    } catch(calcError) {
                         console.error(`  [SCORING] ERROR calculating points for prediction ${prediction.prediction_id}:`, calcError);
                         points = 0; // Default to 0 on error
                    }

                    // <<< LOG 6: Preparing DB Update >>>
                    console.log(`  [SCORING] Preparing update for prediction ${prediction.prediction_id} with points: ${points}`);

                    // Return the promise for the update query
                    return client.query(
                        'UPDATE predictions SET points_awarded = $1 WHERE prediction_id = $2',
                        [points, prediction.prediction_id]
                    );
                 }); // End predictions.map

                 // --- Execute Updates ---
                 console.log(`[SCORING] Attempting to execute ${updatePromises.length} prediction updates...`);
                 try {
                      const updateResults = await Promise.all(updatePromises);
                      // <<< LOG 7: Updates Finished >>>
                      // Note: updateResults for client.query might just be result objects, length is useful
                      console.log(`[SCORING] Finished prediction updates execution. Results array length: ${updateResults.length}`);
                 } catch (updateError) {
                      // <<< LOG 8: Update Error >>>
                      console.error(`[SCORING] ERROR during Promise.all for prediction updates:`, updateError);
                      throw updateError; // Re-throw to trigger rollback
                 }
                 console.log(`Finished calculating and preparing updates for round ${parsedRoundId}.`); // Moved log
            } // End else (predictions.length > 0)
        } // End else (fixturesResult.rows.length > 0)

        // 4. --- Update Round Status ---
        console.log(`Updating round ${parsedRoundId} status to COMPLETED.`);
        await client.query( /* ... update round status ... */ );

        // 5. --- Commit Transaction ---
        await client.query('COMMIT');
        console.log(`Transaction committed for scoring round ${parsedRoundId}.`);
        res.status(200).json({ message: `Scoring completed successfully for round ${parsedRoundId}. Status updated to COMPLETED.` });

    } catch (error) {
        // <<< LOG 9: Rollback >>>
        console.error(`[SCORING] Transaction Error for round ${parsedRoundId}, attempting rollback:`, error);
        try { await client.query('ROLLBACK'); } catch (rbError) { console.error('[SCORING] Rollback failed:', rbError);}
        next(error);
    } finally {
        client.release();
        console.log(`Database client released for round ${parsedRoundId} scoring.`);
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

// --- NEW: GET /api/rounds/:roundId/summary ---
/**
 * @route   GET /api/rounds/:roundId/summary
 * @desc    Get summary statistics for a specific completed round
 * @access  Protected (Any logged-in user)
 */
router.get('/:roundId/summary', protect, async (req, res, next) => {
    const { roundId: roundIdParam } = req.params;
    const requestingUserId = req.user.userId; // For logging

    console.log(`[${new Date().toISOString()}] User ${requestingUserId} requesting summary for Round ${roundIdParam}`);

    const roundId = parseInt(roundIdParam, 10);
    if (isNaN(roundId) || roundId <= 0) {
        return res.status(400).json({ message: 'Invalid Round ID.' });
    }

    try {
        // 1. Verify Round exists and is COMPLETED
        const round = await prisma.round.findUnique({
            where: { roundId: roundId },
            select: { roundId: true, name: true, status: true } // Fetch name too
        });

        if (!round) {
             console.log(`[${new Date().toISOString()}] Summary request failed: Round ${roundId} not found.`);
            return res.status(404).json({ message: 'Round not found.' });
        }
        if (round.status !== 'COMPLETED') {
             console.log(`[${new Date().toISOString()}] Summary request failed: Round ${roundId} not COMPLETED (Status: ${round.status}).`);
            return res.status(400).json({ message: `Summary is only available for COMPLETED rounds. This round status is: ${round.status}` });
        }

        console.log(`[${new Date().toISOString()}] Fetching summary data for Round ${roundId}...`);

        // 2. Fetch data in parallel using Prisma transaction
        // NOTE: Order matters for accessing results below
        const [
            // Query 0: Top Scorers THIS ROUND
            rawTopScorers,
            // Query 1: Overall Leaders (All completed rounds)
            rawOverallLeaders,
            // Query 2: Top Joker Players (Count successful jokers overall)
            rawTopJokers,
            // Query 3: All predictions for this specific round (for stats)
            allRoundPredictions
        ] = await prisma.$transaction([
            // Query 0: Top Scorers THIS ROUND
            prisma.prediction.groupBy({
                by: ['userId'],
                where: { roundId: roundId },
                _sum: { pointsAwarded: true }, // Sum points for THIS round
                orderBy: { _sum: { pointsAwarded: 'desc' } },
                take: 3
            }),
            // Query 1: Overall Leaders (Sum points across ALL completed rounds)
            prisma.prediction.groupBy({
                by: ['userId'],
                where: { round: { status: 'COMPLETED' } },
                _sum: { pointsAwarded: true }, // Sum points across all completed
                orderBy: { _sum: { pointsAwarded: 'desc' } },
                take: 3
            }),
            // Query 2: Top Joker Players (Count successful jokers overall)
            prisma.prediction.groupBy({
                by: ['userId'],
                where: {
                    isJoker: true,
                    pointsAwarded: { gt: 0 }, // Points > 0 means successful
                    round: { status: 'COMPLETED' } // Only from completed rounds
                },
                _count: { userId: true }, // Count the successful joker predictions per user
                orderBy: { _count: { userId: 'desc' } },
                take: 3
            }),
            // Query 3: Fetch all predictions for this round (for exact/joker counts THIS round)
             prisma.prediction.findMany({
                where: { roundId: roundId },
                select: { pointsAwarded: true, isJoker: true }
            })
        ]);

        // Post-process the data
        console.log(`[${new Date().toISOString()}] Raw summary data fetched for Round ${roundId}. Processing...`);

        // --- Calculate Round Stats from allRoundPredictions (Index 3) ---
        let exactScoresCount = 0;
        let successfulJokersCount = 0;
        allRoundPredictions.forEach(p => {
            if (p?.pointsAwarded === 3) {
                exactScoresCount++;
            }
            // A successful joker requires points > 0 AND isJoker = true
            // The Joker score itself might be 2 or 6, so check > 0
            if (p?.isJoker === true && p?.pointsAwarded !== null && p.pointsAwarded > 0) {
                successfulJokersCount++;
            }
        });
        // --- End Calculate Round Stats ---

        // Extract User IDs from all groupBy results (Indices 0, 1, 2)
        const userIdsToFetch = new Set();
        rawTopScorers.forEach(item => { if (item && item.userId) userIdsToFetch.add(item.userId); });
        rawOverallLeaders.forEach(item => { if (item && item.userId) userIdsToFetch.add(item.userId); });
        rawTopJokers.forEach(item => { if (item && item.userId) userIdsToFetch.add(item.userId); });

        // Fetch user names
        let userMap = new Map();
        if (userIdsToFetch.size > 0) {
             const userIdsArray = Array.from(userIdsToFetch);
             console.log(`[${new Date().toISOString()}] Fetching names for user IDs: ${userIdsArray}`);
            const users = await prisma.user.findMany({
                where: { userId: { in: userIdsArray } },
                select: { userId: true, name: true }
            });
            users.forEach(user => userMap.set(user.userId, user.name));
             console.log(`[${new Date().toISOString()}] User names fetched.`);
        }

        // --- DEBUG LOGS (Keep temporarily) ---
         console.log("--- DEBUG: Raw Data Before Mapping ---");
         console.log("Raw topScorersThisRoundData (Idx 0):", JSON.stringify(rawTopScorers, null, 2));
         console.log("Raw overallLeadersData (Idx 1):", JSON.stringify(rawOverallLeaders, null, 2));
         console.log("Raw topJokerPlayersData (Idx 2):", JSON.stringify(rawTopJokers, null, 2));
         console.log("User Map:", userMap);
         console.log("--------------------------------------");
         // --- END DEBUG LOGS ---


        // Map results to final format
        const topScorersThisRound = rawTopScorers.map(item => ({
            userId: item?.userId,
            name: userMap.get(item?.userId) || 'Unknown User',
            points: item?._sum?.pointsAwarded ?? 0 // Sum of points for THIS round
        }));

        const overallLeaders = rawOverallLeaders.map(item => ({
            userId: item?.userId,
            name: userMap.get(item?.userId) || 'Unknown User',
            totalPoints: item?._sum?.pointsAwarded ?? 0 // Sum of points across ALL completed rounds
        }));

        // Access the count correctly from the rawTopJokers result (Index 2)
        const topJokerPlayers = rawTopJokers.map(item => ({
             userId: item?.userId,
             name: userMap.get(item?.userId) || 'Unknown User',
             // The count is directly under _count based on the groupBy query structure
             successfulJokers: item?._count?.userId ?? 0
        }));


        // Assemble the final response payload
        const responsePayload = {
            roundId: round.roundId,
            roundName: round.name,
            roundStats: {
                exactScoresCount: exactScoresCount,
                successfulJokersCount: successfulJokersCount,
                totalPredictions: allRoundPredictions.length,
            },
            topScorersThisRound: topScorersThisRound,
            overallLeaders: overallLeaders,
            topJokerPlayers: topJokerPlayers,
        };

        console.log(`[${new Date().toISOString()}] Sending final summary payload for Round ${roundId}.`);
        res.status(200).json(responsePayload); // Send placeholder for now

    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error fetching summary for Round ${roundId}:`, error);
        next(error);
    }
});
// --- END NEW ROUTE ---


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

// =======================================================================
// ===== NEW ROUTE: Import Selected External Fixtures into Round ========
// =======================================================================
/**
 * @route   POST /api/rounds/:roundId/import-selected
 * @desc    Import specific fixtures (fetched previously from external source) into this round
 * @access  Private (Admin only)
 */
router.post('/:roundId/import-selected', protect, admin, async (req, res, next) => {
    const { roundId } = req.params;
    // Expecting: { fixturesToImport: [{ homeTeam: string, awayTeam: string, matchTime: string (ISO), externalId?: number }, ...] }
    const { fixturesToImport } = req.body;

    // --- Input Validation ---
    const parsedRoundId = parseInt(roundId, 10);
    if (isNaN(parsedRoundId)) {
        return res.status(400).json({ message: 'Invalid Round ID.' });
    }
    if (!Array.isArray(fixturesToImport) || fixturesToImport.length === 0) {
        return res.status(400).json({ message: 'Fixtures to import must be provided as a non-empty array.' });
    }
    // Basic validation of fixture objects (can be more detailed if needed)
    for (const fix of fixturesToImport) {
        if (!fix.homeTeam || !fix.awayTeam || !fix.matchTime) {
             return res.status(400).json({ message: 'Each fixture to import must have homeTeam, awayTeam, and matchTime.' });
        }
        // Check if matchTime is a valid ISO string (basic check)
         if (isNaN(new Date(fix.matchTime).getTime())) {
             return res.status(400).json({ message: `Invalid matchTime format for fixture ${fix.homeTeam} vs ${fix.awayTeam}. ISO format required.` });
         }
    }
    // --- End Validation ---

    // Use client from pool for transaction
    const getClient = db.getClient || (() => db.pool.connect());
    const client = await getClient();

    try {
        console.log(`[API /rounds/:roundId/import-selected] Starting import for round ${parsedRoundId}, ${fixturesToImport.length} fixtures.`);

        // 1. Verify Round Exists and is in suitable status (e.g., SETUP or OPEN)
        const roundCheckRes = await client.query(
            "SELECT status FROM rounds WHERE round_id = $1",
            [parsedRoundId]
        );
        if (roundCheckRes.rows.length === 0) {
            return res.status(404).json({ message: `Round with ID ${parsedRoundId} not found.` });
        }
        const roundStatus = roundCheckRes.rows[0].status;
        if (roundStatus !== 'SETUP' && roundStatus !== 'OPEN') {
             return res.status(400).json({ message: `Fixtures can only be imported into rounds with status SETUP or OPEN. Current status: ${roundStatus}` });
        }

        // 2. Start Transaction
        await client.query('BEGIN');

        // 3. Insert Fixtures (handle potential duplicates)
        const insertQuery = `
            INSERT INTO fixtures (round_id, home_team, away_team, match_time, status)
            VALUES ($1, $2, $3, $4, 'SCHEDULED')
            ON CONFLICT (round_id, home_team, away_team, match_time) -- Example constraint, adjust if yours is different!
            DO NOTHING; -- Or DO UPDATE if you want to overwrite based on the constraint
        `;
        // Note: The ON CONFLICT requires a unique constraint in your DB on these columns.
        // If you don't have one, you'd need to SELECT first to check for existence, which is less efficient.
        // A constraint like (round_id, external_id) would be better if you stored external_id.
        // Using (round_id, home_team, away_team, match_time) is a fallback but less robust if team names change slightly.

        let successfullyImportedCount = 0;
        for (const fixture of fixturesToImport) {
            const result = await client.query(insertQuery, [
                parsedRoundId,
                fixture.homeTeam,
                fixture.awayTeam,
                fixture.matchTime // Already validated as valid ISO string
            ]);
            if (result.rowCount > 0) { // Check if a row was actually inserted (not skipped by ON CONFLICT)
                successfullyImportedCount++;
            }
        }

        // 4. Commit Transaction
        await client.query('COMMIT');

        console.log(`[API /rounds/:roundId/import-selected] Completed import for round ${parsedRoundId}. Inserted ${successfullyImportedCount} new fixtures out of ${fixturesToImport.length} selected.`);

        res.status(201).json({
            message: `Successfully imported ${successfullyImportedCount} fixtures into round ${parsedRoundId}. ${fixturesToImport.length - successfullyImportedCount} were already present or skipped.`,
            count: successfullyImportedCount
         });

    } catch (error) {
        if (client && !client._ending) {
            try { await client.query('ROLLBACK'); } catch (rollbackError) { console.error('Error during ROLLBACK:', rollbackError); }
        }
        console.error(`[API /rounds/:roundId/import-selected] Error importing fixtures into round ${parsedRoundId}:`, error);
        next(error);
    } finally {
        if (client) { client.release(); }
    }
});
// =======================================================================


// Make sure to export the router
module.exports = router;