// backend/routes/predictions.js
const express = require('express');
const db = require('../db'); // Ensure this path is correct
// Make sure this matches the middleware used in your app setup and other routes (e.g., rounds.js)
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// POST /api/predictions - Submit/update predictions for the logged-in user
router.post('/', protect, async (req, res, next) => {
    // Check if user is authenticated and userId is available
    if (!req.user || !req.user.userId) {
         // This should ideally be caught by 'protect' middleware, but serves as a safeguard
         console.error("User ID missing from request after protect middleware.");
         return res.status(401).json({ message: 'User authentication failed or user ID not found.' });
    }
    const userId = req.user.userId; // Extracted from token by middleware

    // Expecting { predictions: [ { fixtureId, predictedHomeGoals, predictedAwayGoals }, ... ] } from frontend
    const { predictions } = req.body;

    // --- Basic Input Validation ---
    if (!Array.isArray(predictions) || predictions.length === 0) {
        return res.status(400).json({ message: 'Invalid input: Predictions array is required and cannot be empty.' });
    }

    // Validate individual prediction objects structure and values (USING CAMELCASE)
    for (const p of predictions) {
        // --- >>>> FIX: Check for camelCase properties <<<< ---
        if (p.fixtureId == null || p.predictedHomeGoals == null || p.predictedAwayGoals == null) {
             // Error message reflects what's expected in the payload
             return res.status(400).json({ message: 'Invalid input: Each prediction must include fixtureId, predictedHomeGoals, and predictedAwayGoals.' });
        }
        // --- >>>> FIX: Use camelCase for validation <<<< ---
        if (!Number.isInteger(p.fixtureId) || p.fixtureId <= 0) {
            return res.status(400).json({ message: `Invalid input: Invalid fixtureId ${p.fixtureId}.` });
        }

        // Use camelCase variables for validation
        const homeGoals = p.predictedHomeGoals;
        const awayGoals = p.predictedAwayGoals;

        // Validate scores are non-negative integers
        if (!Number.isInteger(homeGoals) || homeGoals < 0 ||
            !Number.isInteger(awayGoals) || awayGoals < 0) {
            // Use camelCase fixtureId in error message
            return res.status(400).json({ message: `Invalid input: Scores must be non-negative integers for fixture ${p.fixtureId}.` });
        }
    }
    // --- End Basic Input Validation ---

    // --- >>>> FIX: Use camelCase fixtureId from input <<<< ---
    const fixtureIds = predictions.map(p => p.fixtureId);
    // No need for separate length check here, already checked if array is empty

    const client = await db.pool.connect(); // Get a client for transaction control

    try {
        // --- Advanced Validation (DB Query) ---
        const validationQuery = `
            SELECT
                f.fixture_id,
                f.round_id,
                r.deadline,
                r.status AS round_status
            FROM fixtures f
            JOIN rounds r ON f.round_id = r.round_id
            WHERE f.fixture_id = ANY($1::int[]) -- Use DB snake_case column
        `;
        const { rows: fixtureData } = await client.query(validationQuery, [fixtureIds]);

        // 1. Check if all requested fixtures were found
        if (fixtureData.length !== fixtureIds.length) {
            const foundIds = new Set(fixtureData.map(f => f.fixture_id)); // Use DB snake_case
            const missingIds = fixtureIds.filter(id => !foundIds.has(id));
            console.error(`Validation Error: Fixture IDs not found or invalid for user ${userId}: ${missingIds.join(', ')}`);
            await client.query('ROLLBACK'); client.release();
            return res.status(404).json({ message: `Error: One or more submitted fixtures do not exist: ${missingIds.join(', ')}.` });
        }

        // 2. Check if all fixtures belong to the SAME round
        const roundIds = new Set(fixtureData.map(f => f.round_id)); // Use DB snake_case
        if (roundIds.size > 1) {
            console.error(`Validation Error: Predictions span multiple rounds for user ${userId}. Fixture IDs: ${fixtureIds.join(', ')}`);
            await client.query('ROLLBACK'); client.release();
            return res.status(400).json({ message: 'Error: Predictions must all belong to the same round.' });
        }
        // Use snake_case for DB results
        const commonRoundId = fixtureData[0].round_id;
        const roundDeadline = new Date(fixtureData[0].deadline);
        const roundStatus = fixtureData[0].round_status;

        // 3. Check Deadline
        const now = new Date();
        if (now > roundDeadline) {
            console.warn(`User ${userId} attempted prediction submission after deadline for round ${commonRoundId}.`);
            await client.query('ROLLBACK'); client.release();
            return res.status(403).json({ message: 'The deadline for submitting predictions for this round has passed.' });
        }

        // 4. Check Round Status
        const allowedStatuses = ['OPEN'];
        if (!allowedStatuses.includes(roundStatus)) {
             console.warn(`User ${userId} attempted prediction submission for a round ${commonRoundId} with status ${roundStatus}.`);
             await client.query('ROLLBACK'); client.release();
             return res.status(403).json({ message: `Predictions are not currently accepted for this round (Status: ${roundStatus}).` });
        }
        // --- End Advanced Validation ---

        // --- Database Operation (UPSERT within Transaction) ---
        await client.query('BEGIN'); // Start transaction

        // SQL uses DB column names (_id, _goals)
        const upsertQuery = `
            INSERT INTO predictions (user_id, fixture_id, round_id, predicted_home_goals, predicted_away_goals, submitted_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            ON CONFLICT (user_id, fixture_id)
            DO UPDATE SET
                predicted_home_goals = EXCLUDED.predicted_home_goals,
                predicted_away_goals = EXCLUDED.predicted_away_goals,
                submitted_at = NOW()
            RETURNING prediction_id; -- Optional
        `;

        // Execute the query for each valid prediction
        const upsertPromises = predictions.map(p => {
            // --- >>>> FIX: Pass camelCase values from validated input object p <<<< ---
            // Parameters match VALUES order: user_id, fixture_id, round_id, home_goals, away_goals
            return client.query(upsertQuery, [
                userId,
                p.fixtureId, // Use camelCase from input
                commonRoundId,
                p.predictedHomeGoals, // Use camelCase from input
                p.predictedAwayGoals  // Use camelCase from input
            ]);
        });

        await Promise.all(upsertPromises);
        await client.query('COMMIT'); // Commit transaction

        res.status(201).json({ message: 'Predictions saved successfully.' });

    } catch (error) {
        // Ensure rollback happens on any error during the try block
        // Avoid rolling back if connection is already closed (might happen in edge cases)
        if (client && !client._ending) {
            try {
                 await client.query('ROLLBACK');
            } catch (rollbackError) {
                 console.error('Error during ROLLBACK:', rollbackError);
            }
        }
        console.error(`Error saving predictions for user ${userId}:`, error);
        next(error); // Pass to global error handler
    } finally {
        // ALWAYS release the client back to the pool in a finally block
        if (client) {
             client.release();
        }
    }
});


// GET /api/predictions/round/:roundId/me - Get current user's predictions for a specific round
router.get('/round/:roundId/me', protect, async (req, res, next) => {
    // Check user ID
    if (!req.user || !req.user.userId) {
        return res.status(401).json({ message: 'User authentication failed or user ID not found.' });
    }
    const userId = req.user.userId;
    const { roundId } = req.params;

    const parsedRoundId = parseInt(roundId, 10);
    if (isNaN(parsedRoundId) || parsedRoundId <= 0) {
        return res.status(400).json({ message: 'Invalid Round ID provided.' });
    }

    try {
        // Use aliases to return camelCase directly if preferred by frontend, otherwise map later
        const result = await db.query(
           `SELECT
                p.prediction_id AS "predictionId", -- Alias
                p.predicted_home_goals AS "predictedHomeGoals", -- Alias
                p.predicted_away_goals AS "predictedAwayGoals", -- Alias
                p.points_awarded AS "pointsAwarded", -- Alias
                p.submitted_at AS "submittedAt", -- Alias
                p.is_joker AS "isJoker", -- Alias
                f.fixture_id AS "fixtureId", -- Alias
                COALESCE(f.home_team, 'N/A') AS "homeTeam", -- Alias
                COALESCE(f.away_team, 'N/A') AS "awayTeam", -- Alias
                f.match_time AS "matchTime", -- Alias
                f.home_score AS "homeScore", -- Alias (result)
                f.away_score AS "awayScore" -- Alias (result)
            FROM predictions p
            JOIN fixtures f ON p.fixture_id = f.fixture_id
            WHERE p.user_id = $1 AND f.round_id = $2
            ORDER BY f.match_time ASC NULLS LAST, f.fixture_id ASC`,
            [userId, parsedRoundId]
        );
        // Result rows should now have camelCase keys due to aliases
        res.status(200).json(result.rows);
    } catch (err) {
        console.error(`Error fetching predictions for user ${userId}, round ${roundId}:`, err);
        next(err);
    }
});

module.exports = router;