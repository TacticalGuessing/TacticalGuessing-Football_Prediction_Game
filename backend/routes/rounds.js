// backend/routes/rounds.js
const express = require('express');
const db = require('../db'); // Assuming db.js exports query function and pool object
const { protect, admin } = require('../middleware/authMiddleware'); // Import middleware
const axios = require('axios'); // <--- Added axios import
const scoringUtils = require('../src/utils/scoringUtils');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const sendEmail = require('../src/utils/sendEmail');
const { fetchRoundResults } = require('../src/controllers/adminRoundController');

//console.log('[rounds.js] Type of imported scoringUtils:', typeof scoringUtils); // Should log 'object'
//console.log('[rounds.js] Type of scoringUtils.calculatePoints:', typeof scoringUtils.calculatePoints); // Should log 'function

// --- TEMPORARY TEST ---
try {
    //console.log('--- Running TEMPORARY calculatePoints test ---');
    const testPrediction = { predicted_home_goals: 1, predicted_away_goals: 0, is_joker: true };
    const testResult = { home_score: 1, away_score: 0 };
    if (typeof scoringUtils.calculatePoints === 'function') {
        const testPoints = scoringUtils.calculatePoints(testPrediction, testResult);
        //console.log('[TEMP TEST] Result:', testPoints, '(Type:', typeof testPoints, ')');
    } else {
        console.error('[TEMP TEST] scoringUtils.calculatePoints is NOT a function!');
    }
    //console.log('--- END TEMPORARY calculatePoints test ---');
} catch (e) {
    console.error("Error during temporary test:", e);
}
// --- END TEMPORARY TEST ---

// ======================================================
// === Specific (Non-Parameterized) Routes First ===
// ======================================================

// --- Round Management (Admin Only) ---

// POST /api/rounds/:roundId/fetch-results
router.post('/:roundId/fetch-results', protect, admin, fetchRoundResults);

// POST /api/rounds - Create a new round
router.post('/', protect, admin, async (req, res, next) => {
    const { name, deadline, jokerLimit } = req.body; // Expect name (string) and deadline (ISO 8601 string e.g., "2024-08-15T18:00:00Z" or YYYY-MM-DDTHH:MM)

    if (!name || !deadline) {
        return res.status(400).json({ message: 'Round name and deadline are required.' });
    }

    // Validate jokerLimit if provided
   let limit = 1; // Default value
   if (jokerLimit !== undefined) {
       const parsedLimit = parseInt(jokerLimit, 10);
       // Must be a non-negative integer
       if (isNaN(parsedLimit) || !Number.isInteger(parsedLimit) || parsedLimit < 0) {
           return res.status(400).json({ message: 'If provided, Jokers Allowed must be a non-negative integer (0 or more).' });
       }
       limit = parsedLimit;
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
            'INSERT INTO rounds (name, deadline, created_by, status, joker_limit, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *', // Add joker_limit column
           [name, deadlineISO, req.user.userId, 'SETUP', limit]
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
    //console.log('--- Received /import/fixtures request ---');
    //console.log('Request Body:', req.body);
    //console.log('Type of roundId:', typeof req.body.roundId);
    //console.log('Type of competitionCode:', typeof req.body.competitionCode);
    //console.log('Type of matchday:', typeof req.body.matchday);
    //console.log('-------------------------------------------');

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
        // Let's log the structure of one match object to be sure
        .filter((match, index) => {
            if (index === 0) { // Log the first match structure for debugging
                console.log("--- Debug: First match object from API ---");
                console.log(JSON.stringify(match, null, 2));
                console.log("-----------------------------------------");
            }
            // Original filter criteria - check if names and date exist
            const hasRequiredData = match.homeTeam?.name && match.awayTeam?.name && match.utcDate;
            // Check if crest URLs exist (and are strings)
            const hasHomeCrest = typeof match.homeTeam?.crest === 'string' && match.homeTeam.crest.length > 0;
            const hasAwayCrest = typeof match.awayTeam?.crest === 'string' && match.awayTeam.crest.length > 0;

            if (!hasHomeCrest || !hasAwayCrest) {
                console.warn(`Skipping match: ${match.homeTeam?.name} vs ${match.awayTeam?.name} due to missing crest URL(s). Home: ${match.homeTeam?.crest}, Away: ${match.awayTeam?.crest}`);
            }
            // Keep the match only if basic data AND BOTH crests are present and valid strings
            return hasRequiredData && hasHomeCrest && hasAwayCrest;
        })
        .map(match => ({
            round_id: parsedRoundId,
            home_team: match.homeTeam.name,
            away_team: match.awayTeam.name,
            home_team_crest_url: match.homeTeam.crest, // Assumes structure is correct
            away_team_crest_url: match.awayTeam.crest, // Assumes structure is correct
            match_time: match.utcDate,
            status: 'SCHEDULED',
            home_score: null,
            away_score: null,
            external_id: match.id
        }));

    if (fixturesToInsert.length === 0) {
         console.log("No valid matches with required data AND non-empty crest URLs found in API response after filtering.");
         // Respond appropriately, maybe indicate that crests were missing
         return res.status(200).json({ message: 'No valid matches with necessary data and crest URLs found in API response.', count: 0 });
    }
    console.log(`Prepared ${fixturesToInsert.length} fixtures with crests for insertion.`);

    // --- Insert Data into Database ---
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        let insertedCount = 0; // Count actual successful inserts
        for (const fixture of fixturesToInsert) {
            // Log parameters right before query
            const queryParams = [
                fixture.round_id,
                fixture.home_team,
                fixture.away_team,
                fixture.home_team_crest_url, // Param $4
                fixture.away_team_crest_url, // Param $5
                fixture.match_time,
                fixture.status,
                fixture.home_score,
                fixture.away_score,
                fixture.external_id         // Param $10
            ];
            console.log(`Inserting fixture: ${fixture.home_team} vs ${fixture.away_team} with crests: ${fixture.home_team_crest_url}, ${fixture.away_team_crest_url}`); // Log values being inserted
            const insertQuery = `
                INSERT INTO fixtures (round_id, home_team, away_team, home_team_crest_url, away_team_crest_url, match_time, status, home_score, away_score, external_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (round_id, home_team, away_team, match_time) DO NOTHING`;

            const insertResult = await client.query(insertQuery, queryParams);
            if (insertResult.rowCount > 0) {
                 insertedCount++; // Only count if row was actually inserted
            }
        }

        await client.query('COMMIT');
        console.log(`Successfully inserted ${insertedCount} new fixtures for round ${parsedRoundId}.`);
        res.status(201).json({ message: `Successfully imported ${insertedCount} new fixtures.`, count: insertedCount });

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
    let queryString = 'SELECT round_id, name, deadline, status, joker_limit FROM rounds';
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
        const activeRoundResult = await db.query( "SELECT round_id, name, deadline, status, joker_limit FROM rounds WHERE status = 'OPEN' ORDER BY deadline ASC LIMIT 1" );
        if (activeRoundResult.rows.length === 0) { return res.status(200).json(null); } // Return null if no active round
        const activeRound = activeRoundResult.rows[0];
        const roundId = activeRound.round_id;
        const userId = req.user?.userId;
        if (!userId) { console.error("FATAL: User ID not found in req.user for /active route."); return res.status(401).json({ message: "Authentication error: User ID missing." }); }

        // Fetch fixtures for the active round (snake_case)
        const fixturesResult = await db.query(
            `SELECT
                fixture_id, round_id, home_team, away_team,
               home_team_crest_url, away_team_crest_url, -- <<< ADD THESE
                match_time, home_score, away_score, status
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
                homeTeamCrestUrl: fixture.home_team_crest_url, // <<< ADD MAPPING
                awayTeamCrestUrl: fixture.away_team_crest_url, // <<< ADD MAPPING
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
            jokerLimit: activeRound.joker_limit,
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
    //console.log(`[${new Date().toISOString()}] User ${req.user.userId} requesting latest completed round.`);
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
            //console.log(`[${new Date().toISOString()}] No completed rounds found.`);
            // Send 204 No Content instead of 404, as it's not an error, just no data yet
            return res.status(204).send();
        }

        //console.log(`[${new Date().toISOString()}] Found latest completed round: ID ${latestCompleted.roundId}`);
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
    const { status } = req.body; // Expect status: 'SETUP', 'OPEN', 'CLOSED'
    //console.log(`--- PUT /:roundId/status ---`); // <<< ADD
    //console.log(`Received Round ID: ${roundId}`); // <<< ADD
    //console.log(`Received Status from req.body: '${status}' (Type: ${typeof status})`);

    const parsedRoundId = parseInt(roundId, 10);
    if (isNaN(parsedRoundId)) {
        return res.status(400).json({ message: 'Round ID must be an integer.' });
    }

    const validStatuses = ['SETUP', 'OPEN', 'CLOSED'];
    if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ message: `Invalid status provided. Use ${validStatuses.join(', ')}.` });
    }

    // --- Get current status BEFORE update ---
    let currentStatus = null;
    try {
        const roundCheck = await db.query('SELECT status FROM rounds WHERE round_id = $1', [parsedRoundId]);
        if (roundCheck.rows.length === 0) {
             return res.status(404).json({ message: 'Round not found.' });
        }
        currentStatus = roundCheck.rows[0].status;
         // Prevent re-opening an already open round triggering emails again (optional check)
         if (currentStatus === 'OPEN' && status === 'OPEN') {
             console.log(`Round ${parsedRoundId} is already OPEN. Status update skipped.`);
             // Just return the current state or a specific message
             const currentRoundData = await db.query('SELECT * FROM rounds WHERE round_id = $1', [parsedRoundId]);
             return res.status(200).json(currentRoundData.rows[0]);
         }

    } catch (err) {
         console.error(`Error fetching current status for round ${parsedRoundId}:`, err);
         return next(err); // Use return to stop execution
    }
    // --- End current status check ---


    try {
        // Update the round status using pg pool
        const result = await db.query(
            'UPDATE rounds SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE round_id = $2 RETURNING *',
            [status, parsedRoundId]
        );
        if (result.rows.length === 0) {
            // This check is somewhat redundant due to the check above, but keep for safety
            return res.status(404).json({ message: 'Round not found during update.' });
        }
        const updatedRound = result.rows[0]; // Contains snake_case fields

        // --- Trigger Email Notification ONLY if status changed TO 'OPEN' ---
        if (status === 'OPEN' && currentStatus !== 'OPEN') {
            console.log(`Round ${parsedRoundId} status changed to OPEN. Triggering notifications...`);

            // Fetch round details and fixtures using Prisma for easier relations/mapping
            const roundDetails = await prisma.round.findUnique({
                where: { roundId: parsedRoundId },
                include: {
                    fixtures: {
                        orderBy: { matchTime: 'asc' } // Order fixtures by time
                    }
                }
            });

            if (roundDetails) {
                // Fetch users who want this notification
                const usersToNotify = await prisma.user.findMany({
                    where: {
                        // emailVerified: true, // Optional: Only notify verified users?
                        notifiesNewRound: true // Check preference
                    },
                    select: { email: true, name: true }
                });

                console.log(`Found ${usersToNotify.length} users subscribed to new round notifications.`);

                // Construct generic part of email
                const deadlineFormatted = new Date(roundDetails.deadline).toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' }); // Example format
                const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'; // Fallback needed
                const predictionsLink = `${frontendUrl}/predictions`;
                const fixturesHtml = roundDetails.fixtures.length > 0
                    ? '<ul>' + roundDetails.fixtures.map(f => `<li>${f.homeTeam} vs ${f.awayTeam} (${new Date(f.matchTime).toLocaleDateString('en-GB', {weekday: 'short', month: 'short', day: 'numeric'})})</li>`).join('') + '</ul>'
                    : '<p>Fixtures will be added soon.</p>';

                // Send email to each user (consider background job for many users)
                usersToNotify.forEach(async (user) => {
                    const emailSubject = `⚽ New Round Open: ${roundDetails.name}!`;
                    const emailHtml = `
                        <h1>Round Open: ${roundDetails.name}</h1>
                        <p>Hello ${user.name || 'Player'},</p>
                        <p>A new prediction round, <strong>${roundDetails.name}</strong>, is now open!</p>
                        <p><strong>Deadline:</strong> ${deadlineFormatted}</p>
                        <p><strong>Jokers Allowed:</strong> ${roundDetails.jokerLimit}</p>
                        <h2>Fixtures:</h2>
                        ${fixturesHtml}
                        <p>Get your predictions in!</p>
                        <a href="${predictionsLink}" target="_blank" style="background-color: #3B82F6; color: white; padding: 10px 20px; text-align: center; text-decoration: none; display: inline-block; border-radius: 4px;">Make Predictions</a>
                        <br><br>
                        <p><small>To change your notification preferences, visit your profile settings.</small></p>
                    `;

                    try {
                        // Use await here if sending sequentially, or manage promises if parallel
                        await sendEmail({
                            to: user.email,
                            subject: emailSubject,
                            html: emailHtml,
                            // text: optional plain text version
                        });
                    } catch (emailError) {
                        console.error(`Failed to send new round notification to ${user.email} for round ${parsedRoundId}:`, emailError);
                    }
                });

            } else {
                 console.error(`Failed to fetch details for round ${parsedRoundId} after status update. Cannot send notifications.`);
            }
        }
        // --- End Trigger Email ---

        res.status(200).json(updatedRound); // Return updated round (snake_case)

    } catch (err) {
        console.error(`Error updating status or sending notifications for round ${parsedRoundId}:`, err);
        next(err);
    }
});


// POST /api/rounds/:roundId/fixtures - Add a fixture to a specific round MANUALLY (Admin Only)
router.post('/:roundId/score', protect, admin, async (req, res, next) => {
    const { roundId } = req.params;
    const parsedRoundId = parseInt(roundId, 10);
    console.log(`--- [SCORING] Starting scoring for Round ID: ${parsedRoundId} ---`);

    if (isNaN(parsedRoundId)) {
        return res.status(400).json({ message: 'Round ID must be an integer.' });
    }

    let client; // Declare client for finally block access
    try {
        client = await db.pool.connect();
        console.log('[SCORING] Obtained client:', client ? 'Object obtained' : 'NULL/UNDEFINED');

        console.log('[SCORING] Attempting BEGIN...');
        await client.query('BEGIN');
        console.log('[SCORING] BEGIN successful.');

        // 1. --- Prerequisite Checks ---
        const roundResult = await client.query('SELECT status, name FROM rounds WHERE round_id = $1 FOR UPDATE', [parsedRoundId]);
        if (roundResult.rows.length === 0) {
            await client.query('ROLLBACK');
            // client.release(); // <<< REMOVED
            console.log(`[SCORING] Prerequisite failed: Round ${parsedRoundId} not found.`);
            return res.status(404).json({ message: 'Round not found.' });
        }
        const roundStatus = roundResult.rows[0].status;
        // const roundNameForNotification = roundResult.rows[0].name; // Name fetched later

        if (roundStatus !== 'CLOSED') {
            await client.query('ROLLBACK');
            // client.release(); // <<< REMOVED
            console.log(`[SCORING] Prerequisite failed: Round ${parsedRoundId} status is '${roundStatus}', not 'CLOSED'.`);
            return res.status(400).json({ message: `Scoring can only be initiated for rounds with status 'CLOSED'. Current status: '${roundStatus}'.` });
        }

        const fixturesResult = await client.query(
            'SELECT fixture_id, home_score, away_score FROM fixtures WHERE round_id = $1',
            [parsedRoundId]
        );
        console.log(`[SCORING] Fetched ${fixturesResult.rows.length} fixtures for round ${parsedRoundId}.`);

        if (fixturesResult.rows.length === 0) {
             console.log(`[SCORING] No fixtures found for round ${parsedRoundId}. Marking as COMPLETED immediately.`);
             // Skip prediction processing
        } else {
            const fixturesWithoutResults = fixturesResult.rows.filter( f => f.home_score === null || f.away_score === null );
            if (fixturesWithoutResults.length > 0) {
                await client.query('ROLLBACK');
                // client.release(); // <<< REMOVED
                const missingIds = fixturesWithoutResults.map(f => f.fixture_id).join(', ');
                console.log(`[SCORING] Prerequisite failed: Results missing for fixtures: ${missingIds}.`);
                return res.status(400).json({ message: `Cannot score round. Results missing for fixtures: ${missingIds}. Please enter all results first.` });
            }

            const actualResultsMap = new Map();
            fixturesResult.rows.forEach(f => {
                actualResultsMap.set(f.fixture_id, { home_score: f.home_score, away_score: f.away_score });
            });

            // 2. --- Fetch Predictions ---
            const predictionsResult = await client.query(
                `SELECT prediction_id, user_id, fixture_id, predicted_home_goals, predicted_away_goals, is_joker
                 FROM predictions
                 WHERE round_id = $1`,
                [parsedRoundId]
            );
            const predictions = predictionsResult.rows;
            console.log(`[SCORING] Found ${predictions.length} predictions for round ${parsedRoundId}.`);

            if (predictions.length === 0) {
                 console.log(`[SCORING] No predictions found for round ${parsedRoundId}, but fixtures exist. Proceeding to mark round as COMPLETED.`);
            } else {
                 console.log(`[SCORING] Calculating and preparing updates for ${predictions.length} predictions...`);

                 // --- 3. Calculate and Prepare Updates ---
                 const updatePromises = predictions.map(prediction => {
                    const actualResult = actualResultsMap.get(prediction.fixture_id);
                    let points = 0;
                    if (!actualResult) {
                        console.error(`  [SCORING LOOP] Critical Error: Actual result not found for fixture ${prediction.fixture_id}. Setting points to 0.`);
                        points = 0;
                    } else {
                         try {
                              if (typeof scoringUtils?.calculatePoints === 'function') {
                                  points = scoringUtils.calculatePoints(prediction, actualResult);
                              } else {
                                   console.error(`  [SCORING LOOP] ERROR: scoringUtils.calculatePoints is not a function!`);
                                   points = 0;
                              }
                         } catch(calcError) {
                              console.error(`  [SCORING LOOP] ERROR calculating points for prediction ${prediction.prediction_id}:`, calcError);
                              points = 0;
                         }
                    }
                    const queryText = 'UPDATE predictions SET points_awarded = $1 WHERE prediction_id = $2';
                    const finalPointsForUpdate = (typeof points === 'number' && !isNaN(points)) ? points : 0;
                    const queryParams = [finalPointsForUpdate, prediction.prediction_id];
                    if (typeof prediction.prediction_id === 'undefined' || prediction.prediction_id === null) {
                        console.error(`  [SCORING LOOP] ERROR: prediction_id is null or undefined! Skipping update.`);
                        return Promise.resolve();
                    }
                    return client.query(queryText, queryParams);
                 }); // End map

                 // --- Execute Updates ---
                 console.log(`[SCORING] Attempting to execute ${updatePromises.length} prediction updates...`);
                 try {
                      await Promise.all(updatePromises);
                      console.log(`[SCORING] Finished prediction updates execution.`);
                 } catch (updateError) {
                      console.error(`[SCORING] ERROR during Promise.all for prediction updates:`, updateError);
                      throw updateError; // Re-throw to trigger rollback
                 }
            } // End else (predictions.length > 0)
        } // End else (fixturesResult.rows.length > 0)

        // 4. --- Update Round Status ---
        console.log(`[SCORING] Updating round ${parsedRoundId} status to COMPLETED.`);
        await client.query( "UPDATE rounds SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP WHERE round_id = $1", [parsedRoundId] );

        // 5. --- Commit Transaction ---
        await client.query('COMMIT');
        console.log(`[SCORING] Transaction committed for scoring round ${parsedRoundId}.`);

        // --- Send Response Immediately ---
        res.status(200).json({ message: `Scoring completed successfully for round ${parsedRoundId}. Status updated to COMPLETED. Result notifications are being sent.` });

        // --- 6. Trigger Results Notifications Asynchronously ---
        setImmediate(async () => {
            console.log(`[RESULTS NOTIFICATION] Starting async notification process for scored round ${parsedRoundId}...`);
            try {
                // Re-fetch round details reliably using Prisma AFTER commit
                const scoredRound = await prisma.round.findUnique({
                    where: { roundId: parsedRoundId },
                    select: { name: true } // Just need the name
                });
                if (!scoredRound) {
                    console.error(`[RESULTS NOTIFICATION] Could not re-fetch round ${parsedRoundId} details after commit.`);
                    return; // Stop if round details are missing
                }
                const currentRoundName = scoredRound.name; // Use this name

                // Find users who participated AND opted-in
                const participatingUserIds = await prisma.prediction.groupBy({
                    by: ['userId'],
                    where: { roundId: parsedRoundId },
                });
                const userIdList = participatingUserIds.map(p => p.userId);

                if (userIdList.length > 0) {
                    const usersToNotify = await prisma.user.findMany({
                        where: {
                            userId: { in: userIdList }, // Only those who participated
                            notifiesRoundResults: true // Check preference
                        },
                        select: { userId: true, email: true, name: true }
                    });

                    console.log(`[RESULTS NOTIFICATION] Found ${usersToNotify.length} users to notify for round ${parsedRoundId} - ${currentRoundName}.`);
                    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'; // Fallback

                    for (const user of usersToNotify) {
                        try { // Try-catch for each user's processing/email sending
                            const userPredictions = await prisma.prediction.findMany({
                                where: { userId: user.userId, roundId: parsedRoundId },
                                include: {
                                    fixture: {
                                        select: { homeTeam: true, awayTeam: true, homeScore: true, awayScore: true, matchTime: true }
                                    }
                                },
                                orderBy: { fixture: { matchTime: 'asc' } }
                            });

                            const totalRoundScore = userPredictions.reduce((sum, p) => sum + (p.pointsAwarded ?? 0), 0);

                            // Build HTML table for predictions
                            let predictionsTableHtml = `
                                <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%;">
                                <thead>
                                    <tr>
                                    <th>Fixture</th>
                                    <th>Your Prediction</th>
                                    <th>Actual Result</th>
                                    <th>Points</th>
                                    </tr>
                                </thead>
                                <tbody>
                            `;
                            userPredictions.forEach(p => {
                                const actualScore = (p.fixture.homeScore !== null && p.fixture.awayScore !== null)
                                    ? `${p.fixture.homeScore} - ${p.fixture.awayScore}`
                                    : 'N/A';
                                const yourPrediction = (p.predictedHomeGoals !== null && p.predictedAwayGoals !== null)
                                    ? `${p.predictedHomeGoals} - ${p.predictedAwayGoals}`
                                    : 'No Prediction';
                                const points = p.pointsAwarded ?? 0;
                                const isJokerText = p.isJoker ? ' <strong style="color: #EAB308;">(Joker!)</strong>' : '';

                                predictionsTableHtml += `
                                    <tr>
                                    <td>${p.fixture.homeTeam} vs ${p.fixture.awayTeam}</td>
                                    <td>${yourPrediction}${isJokerText}</td>
                                    <td>${actualScore}</td>
                                    <td>${points}</td>
                                    </tr>
                                `;
                            });
                            predictionsTableHtml += '</tbody></table>';

                            // Construct Email using the correct round name
                            const resultsLink = `${frontendUrl}/results/${parsedRoundId}`;
                            const emailSubject = `🏆 Results are in for ${currentRoundName}!`;
                            const emailHtml = `
                                <h1>Results for ${currentRoundName}</h1>
                                <p>Hello ${user.name || 'Player'},</p>
                                <p>The results for <strong>${currentRoundName}</strong> have been calculated!</p>
                                <p><strong>Your total score for this round: ${totalRoundScore} points</strong></p>
                                <h2>Your Predictions:</h2>
                                ${predictionsTableHtml}
                                <br>
                                <p>View the full round standings and details:</p>
                                <a href="${resultsLink}" target="_blank" style="background-color: #3B82F6; color: white; padding: 10px 20px; text-align: center; text-decoration: none; display: inline-block; border-radius: 4px;">View Round Results</a>
                                <br><br>
                                <p><small>To change your notification preferences, visit your profile settings.</small></p>
                            `;

                            // Send Email
                            await sendEmail({
                                to: user.email,
                                subject: emailSubject,
                                html: emailHtml,
                            });
                            console.log(`[RESULTS NOTIFICATION] Successfully sent results email to ${user.email} for round ${parsedRoundId}.`);

                        } catch (userEmailError) {
                             // Log error for specific user but continue the loop
                            console.error(`[RESULTS NOTIFICATION] Failed processing or sending results email to ${user.email} for round ${parsedRoundId}:`, userEmailError);
                        }
                    } // end for loop
                } else {
                    console.log(`[RESULTS NOTIFICATION] No users participated or opted-in for round ${parsedRoundId}. No notifications sent.`);
                }
            } catch (notificationError) {
                console.error(`[RESULTS NOTIFICATION] Error during background notification process for round ${parsedRoundId}:`, notificationError);
            }
        }); // --- End setImmediate wrapper ---

    } catch (error) {
        console.error(`[SCORING] Transaction Error for round ${parsedRoundId}, attempting rollback:`, error);
        try {
            // Check if client exists and seems usable before rollback
            if (client && typeof client.query === 'function') {
                console.log('[SCORING] Attempting ROLLBACK...');
                await client.query('ROLLBACK');
                console.log('[SCORING] Rollback successful.');
            } else {
                console.warn('[SCORING] Client object invalid or disconnected, skipping ROLLBACK.');
            }
        } catch (rbError) {
            console.error('[SCORING] Rollback failed:', rbError);
        }
        // Pass the original error to the next error handler
        next(error);
    } finally {
        // Release client *only once* if it was successfully obtained
        if (client) {
            client.release();
            console.log(`[SCORING] Database client released for round ${parsedRoundId} scoring.`);
        } else {
             console.log(`[SCORING] Client was not available for release for round ${parsedRoundId} scoring.`);
        }
    }
}); // End router.post('/:roundId/score', ...)


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
                home_team_crest_url,
                away_team_crest_url,
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

    if (isNaN(parsedRoundId)) {
        return res.status(400).json({ message: 'Round ID must be an integer.' });
    }

    const client = await db.pool.connect(); // Use pool
    // <<< LOG: Client Obtained >>>
    console.log('[SCORING] Obtained client:', client ? 'Object obtained' : 'NULL/UNDEFINED');

    try {
        // <<< LOG: Attempting BEGIN >>>
        console.log('[SCORING] Attempting BEGIN...');
        await client.query('BEGIN'); // Start transaction
        console.log('[SCORING] BEGIN successful.');

        // 1. --- Prerequisite Checks ---
        // Check round status and lock the row
        const roundResult = await client.query('SELECT status FROM rounds WHERE round_id = $1 FOR UPDATE', [parsedRoundId]);
        if (roundResult.rows.length === 0) {
            await client.query('ROLLBACK'); // Rollback before releasing
            client.release();
            return res.status(404).json({ message: 'Round not found.' });
        }
        const roundStatus = roundResult.rows[0].status;
        if (roundStatus !== 'CLOSED') {
            await client.query('ROLLBACK'); // Rollback before releasing
            client.release();
            return res.status(400).json({ message: `Scoring can only be initiated for rounds with status 'CLOSED'. Current status: '${roundStatus}'.` });
        }

        // Check fixtures HAVE results (home_score/away_score not null)
        const fixturesResult = await client.query(
            'SELECT fixture_id, home_score, away_score FROM fixtures WHERE round_id = $1',
            [parsedRoundId]
        );
        // <<< LOG 2: Fetched Fixtures >>>
        console.log(`[SCORING] Fetched ${fixturesResult.rows.length} fixtures for round ${parsedRoundId}.`);

        // Handle case where round has no fixtures
        if (fixturesResult.rows.length === 0) {
             console.log(`[SCORING] No fixtures found for round ${parsedRoundId}. Marking as COMPLETED immediately.`);
             // Skip fetching predictions and scoring, jump to updating round status
        } else {
            // Check if all fixtures *that exist* have results
            const fixturesWithoutResults = fixturesResult.rows.filter( f => f.home_score === null || f.away_score === null );
            if (fixturesWithoutResults.length > 0) {
                await client.query('ROLLBACK'); // Rollback before releasing
                client.release();
                const missingIds = fixturesWithoutResults.map(f => f.fixture_id).join(', ');
                return res.status(400).json({ message: `Cannot score round. Results missing for fixtures: ${missingIds}. Please enter all results first.` });
            }

            // Store actual results in a Map for quick lookup
            const actualResultsMap = new Map();
            fixturesResult.rows.forEach(f => {
                actualResultsMap.set(f.fixture_id, { home_score: f.home_score, away_score: f.away_score });
            });

            // 2. --- Fetch Predictions ---
            const predictionsResult = await client.query(
                // Select necessary fields for scoring
                `SELECT prediction_id, user_id, fixture_id, predicted_home_goals, predicted_away_goals, is_joker
                 FROM predictions
                 WHERE round_id = $1`,
                [parsedRoundId]
            );
            const predictions = predictionsResult.rows;
            // <<< LOG 3: Fetched Predictions >>>
            console.log(`[SCORING] Found ${predictions.length} predictions for round ${parsedRoundId}.`);

            // Handle case where round has fixtures but no predictions
            if (predictions.length === 0) {
                 console.log(`[SCORING] No predictions found for round ${parsedRoundId}, but fixtures exist. Proceeding to mark round as COMPLETED.`);
                 // Skip scoring updates, jump to updating round status
            } else {
                 // 3. --- Calculate and Prepare Updates ---
                 console.log(`[SCORING] Calculating and preparing updates for ${predictions.length} predictions...`);
                 const updatePromises = predictions.map(prediction => {
                    const actualResult = actualResultsMap.get(prediction.fixture_id);

                    // <<< LOG 4: Processing Prediction >>>
                    console.log(`\n[SCORING] Processing Prediction ID: ${prediction.prediction_id}, User: ${prediction.user_id}, Fixture: ${prediction.fixture_id}`);
                    console.log(`  Pred: ${prediction.predicted_home_goals}-${prediction.predicted_away_goals}, Joker: ${prediction.is_joker}`);

                    if (!actualResult) {
                        // This case should ideally not happen if all fixtures were checked, but good to log
                        console.error(`  [SCORING] Critical Error: Actual result not found for fixture ${prediction.fixture_id} during scoring. Prediction ${prediction.prediction_id} will NOT be scored.`);
                        return Promise.resolve(); // Resolve promise to not break Promise.all, but don't update DB
                    }

                    console.log(`  Fixture Result: ${actualResult.home_score}-${actualResult.away_score}`);

                    let points = 0;
                    try {
                        // Calculate points using the utility function
                        // Pass prediction object and actual result (ensure calculatePoints handles snake_case from DB)
                        points = scoringUtils.calculatePoints(prediction, actualResult);
                        // <<< LOG 5: Points Calculated >>>
                        console.log(`  [SCORING] Calculated points: ${points}`);
                    } catch(calcError) {
                         console.error(`  [SCORING] ERROR calculating points for prediction ${prediction.prediction_id}:`, calcError);
                         points = 0; // Default to 0 on error
                    }

                     // <<< LOG 6: Preparing DB Update >>>
                     // Check values right before the query
                     const queryText = 'UPDATE predictions SET points_awarded = $1 WHERE prediction_id = $2';
                     const queryParams = [points, prediction.prediction_id];
                     console.log(`  [SCORING] PRE-QUERY Check - Text: ${queryText ? 'OK' : 'NULL/UNDEFINED'}, Params: ${JSON.stringify(queryParams)}, Points Type: ${typeof points}, ID Type: ${typeof prediction.prediction_id}`);

                     // Ensure prediction_id is valid
                     if (typeof prediction.prediction_id === 'undefined' || prediction.prediction_id === null) {
                         console.error(`  [SCORING] ERROR: prediction_id is null or undefined for prediction being processed! Skipping update.`);
                         return Promise.resolve(); // Avoid sending bad query
                     }
                      // Ensure points is a number (or null if your DB allows null points_awarded)
                     if (typeof points !== 'number' || isNaN(points)) {
                          console.warn(`  [SCORING] WARNING: Calculated points is NaN or not a number (${points}). Setting to 0 for update.`);
                          queryParams[0] = 0; // Use 0 instead of NaN/undefined
                     }

                    // Return the promise for the update query
                    return client.query(queryText, queryParams);

                 }); // End predictions.map

                 // --- Execute Updates ---
                 console.log(`[SCORING] Attempting to execute ${updatePromises.length} prediction updates...`);
                 try {
                      const updateResults = await Promise.all(updatePromises);
                      // <<< LOG 7: Updates Finished >>>
                      console.log(`[SCORING] Finished prediction updates execution. Results array length: ${updateResults.length}`);
                 } catch (updateError) {
                      // <<< LOG 8: Update Error >>>
                      console.error(`[SCORING] ERROR during Promise.all for prediction updates:`, updateError);
                      throw updateError; // Re-throw to trigger rollback
                 }
                 console.log(`[SCORING] Finished calculating and preparing updates for round ${parsedRoundId}.`);
            } // End else (predictions.length > 0)
        } // End else block for checking fixtures

        // 4. --- Update Round Status to COMPLETED ---
        // Always update round status if prerequisites passed, regardless of predictions
        console.log(`[SCORING] Updating round ${parsedRoundId} status to COMPLETED.`);
        await client.query(
            "UPDATE rounds SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP WHERE round_id = $1", // Keep updated_at for the ROUNDS table
            [parsedRoundId]
        );

        // 5. --- Commit Transaction ---
        await client.query('COMMIT');
        console.log(`[SCORING] Transaction committed for scoring round ${parsedRoundId}.`);

        res.status(200).json({ message: `Scoring completed successfully for round ${parsedRoundId}. Status updated to COMPLETED.` });

    } catch (error) {
        // <<< LOG 9: Rollback >>>
        console.error(`[SCORING] Transaction Error for round ${parsedRoundId}, attempting rollback:`, error);
        try {
            // Check if client exists and seems usable before rollback
            if (client && typeof client.query === 'function') {
                console.log('[SCORING] Attempting ROLLBACK...');
                await client.query('ROLLBACK');
                console.log('[SCORING] Rollback successful.');
            } else {
                console.warn('[SCORING] Client object invalid or disconnected, skipping ROLLBACK.');
            }
        } catch (rbError) {
            console.error('[SCORING] Rollback failed:', rbError);
        }
        // Pass the original error to the next error handler
        next(error);
    } finally {
        // Release client if it exists
        if (client) {
            client.release();
            console.log(`Database client released for round ${parsedRoundId} scoring.`);
        } else {
             console.log(`Client was not available for release for round ${parsedRoundId} scoring.`);
        }
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
    const { name, deadline, jokerLimit } = req.body; // Expect camelCase from frontend api.ts

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

    let limitToUpdate = null;
   if (jokerLimit !== undefined) {
       const parsedLimit = parseInt(jokerLimit, 10);
       if (isNaN(parsedLimit) || !Number.isInteger(parsedLimit) || parsedLimit < 0) {
            return res.status(400).json({ message: 'If provided, Jokers Allowed must be a non-negative integer.' });
       }
       limitToUpdate = parsedLimit;
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

        if (limitToUpdate !== null) {
                       fieldsToUpdate.push(`joker_limit = $${paramIndex++}`);
                       queryParams.push(limitToUpdate);
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

    //console.log(`[${new Date().toISOString()}] User ${requestingUserId} requesting summary for Round ${roundIdParam}`);

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
             //console.log(`[${new Date().toISOString()}] Summary request failed: Round ${roundId} not found.`);
            return res.status(404).json({ message: 'Round not found.' });
        }
        if (round.status !== 'COMPLETED') {
             //console.log(`[${new Date().toISOString()}] Summary request failed: Round ${roundId} not COMPLETED (Status: ${round.status}).`);
            return res.status(400).json({ message: `Summary is only available for COMPLETED rounds. This round status is: ${round.status}` });
        }

        //console.log(`[${new Date().toISOString()}] Fetching summary data for Round ${roundId}...`);

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
        //console.log(`[${new Date().toISOString()}] Raw summary data fetched for Round ${roundId}. Processing...`);

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
             //console.log(`[${new Date().toISOString()}] Fetching names for user IDs: ${userIdsArray}`);
            const users = await prisma.user.findMany({
                where: { userId: { in: userIdsArray } },
                select: { userId: true, name: true }
            });
            users.forEach(user => userMap.set(user.userId, user.name));
             //console.log(`[${new Date().toISOString()}] User names fetched.`);
        }

        // --- DEBUG LOGS (Keep temporarily) ---
        // console.log("--- DEBUG: Raw Data Before Mapping ---");
         //console.log("Raw topScorersThisRoundData (Idx 0):", JSON.stringify(rawTopScorers, null, 2));
         //console.log("Raw overallLeadersData (Idx 1):", JSON.stringify(rawOverallLeaders, null, 2));
        // console.log("Raw topJokerPlayersData (Idx 2):", JSON.stringify(rawTopJokers, null, 2));
         //console.log("User Map:", userMap);
         //console.log("--------------------------------------");
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
        // --- MODIFY Insert Query (Same as before) ---
        const insertQuery = `
            INSERT INTO fixtures (round_id, external_id, home_team, away_team, home_team_crest_url, away_team_crest_url, match_time, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'SCHEDULED')
            ON CONFLICT (round_id, home_team, away_team, match_time) -- Or use external_id if unique constraint exists
            DO NOTHING;
        `;

        let successfullyImportedCount = 0;
        for (const fixture of fixturesToImport) {
            // Log the parameters being used
            const queryParams = [
                parsedRoundId,
                fixture.externalId || null,
                fixture.homeTeam,
                fixture.awayTeam,
                fixture.homeTeamCrestUrl || null, // Use value from payload
                fixture.awayTeamCrestUrl || null, // Use value from payload
                fixture.matchTime
            ];
            console.log(`[import-selected] Inserting ${fixture.homeTeam} vs ${fixture.awayTeam} with Crests: ${queryParams[4]}, ${queryParams[5]}`); // <<< ADD LOG HERE

            const result = await client.query(insertQuery, queryParams);
            if (result.rowCount > 0) {
                successfullyImportedCount++;
            }
        }
        // --- END Insert Modification ---
        // --- END Insert Modification ---

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