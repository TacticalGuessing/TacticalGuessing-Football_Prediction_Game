// backend/routes/predictions.js
const express = require('express');
const db = require('../db'); // Ensure this path is correct
const { protect } = require('../middleware/authMiddleware'); // Ensure middleware is correct

const router = express.Router();

// POST /api/predictions - Submit/update predictions for the logged-in user
router.post('/', protect, async (req, res, next) => {
    // ... (Existing code for POST / ... )
     if (!req.user || typeof req.user.userId === 'undefined') { // <<< Added typeof check
          console.error("[API /predictions POST] User ID missing from request after protect middleware.");
          return res.status(401).json({ message: 'User authentication failed or user ID not found.' });
     }
     const userId = req.user.userId;
     const { predictions } = req.body;

     if (!Array.isArray(predictions) || predictions.length === 0) {
         return res.status(400).json({ message: 'Invalid input: Predictions array is required and cannot be empty.' });
     }

     for (const p of predictions) {
         if (p.fixtureId == null || p.predictedHomeGoals == null || p.predictedAwayGoals == null) {
              return res.status(400).json({ message: 'Invalid input: Each prediction must include fixtureId, predictedHomeGoals, and predictedAwayGoals.' });
         }
         if (!Number.isInteger(p.fixtureId) || p.fixtureId <= 0) {
             return res.status(400).json({ message: `Invalid input: Invalid fixtureId ${p.fixtureId}.` });
         }
         const homeGoals = p.predictedHomeGoals;
         const awayGoals = p.predictedAwayGoals;
         if (!Number.isInteger(homeGoals) || homeGoals < 0 ||
             !Number.isInteger(awayGoals) || awayGoals < 0) {
             return res.status(400).json({ message: `Invalid input: Scores must be non-negative integers for fixture ${p.fixtureId}.` });
         }
     }
     const fixtureIds = predictions.map(p => p.fixtureId);

     // Use client from the pool for transactions
     // Note: Ensure db object exports a pool or a getClient function
     const getClient = db.getClient || (() => db.pool.connect()); // Adapt based on your db export
     const client = await getClient();

     try {
         const validationQuery = `
             SELECT f.fixture_id, f.round_id, r.deadline, r.status AS round_status
             FROM fixtures f JOIN rounds r ON f.round_id = r.round_id
             WHERE f.fixture_id = ANY($1::int[])
         `;
         const { rows: fixtureData } = await client.query(validationQuery, [fixtureIds]);

         if (fixtureData.length !== fixtureIds.length) {
             const foundIds = new Set(fixtureData.map(f => f.fixture_id));
             const missingIds = fixtureIds.filter(id => !foundIds.has(id));
             console.error(`Validation Error: Fixture IDs not found or invalid for user ${userId}: ${missingIds.join(', ')}`);
             await client.query('ROLLBACK'); client.release();
             return res.status(404).json({ message: `Error: One or more submitted fixtures do not exist: ${missingIds.join(', ')}.` });
         }
         const roundIds = new Set(fixtureData.map(f => f.round_id));
         if (roundIds.size > 1) {
             console.error(`Validation Error: Predictions span multiple rounds for user ${userId}. Fixture IDs: ${fixtureIds.join(', ')}`);
             await client.query('ROLLBACK'); client.release();
             return res.status(400).json({ message: 'Error: Predictions must all belong to the same round.' });
         }
         const commonRoundId = fixtureData[0].round_id;
         const roundDeadline = new Date(fixtureData[0].deadline);
         const roundStatus = fixtureData[0].round_status;
         const now = new Date();
         if (now > roundDeadline) {
             console.warn(`User ${userId} attempted prediction submission after deadline for round ${commonRoundId}.`);
             await client.query('ROLLBACK'); client.release();
             return res.status(403).json({ message: 'The deadline for submitting predictions for this round has passed.' });
         }
         const allowedStatuses = ['OPEN'];
         if (!allowedStatuses.includes(roundStatus)) {
              console.warn(`User ${userId} attempted prediction submission for a round ${commonRoundId} with status ${roundStatus}.`);
              await client.query('ROLLBACK'); client.release();
              return res.status(403).json({ message: `Predictions are not currently accepted for this round (Status: ${roundStatus}).` });
         }

         await client.query('BEGIN');
         const upsertQuery = `
             INSERT INTO predictions (user_id, fixture_id, round_id, predicted_home_goals, predicted_away_goals, submitted_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             ON CONFLICT (user_id, fixture_id)
             DO UPDATE SET predicted_home_goals = EXCLUDED.predicted_home_goals, predicted_away_goals = EXCLUDED.predicted_away_goals, submitted_at = NOW()
             RETURNING prediction_id;
         `;
         const upsertPromises = predictions.map(p => {
             return client.query(upsertQuery, [ userId, p.fixtureId, commonRoundId, p.predictedHomeGoals, p.predictedAwayGoals ]);
         });
         await Promise.all(upsertPromises);
         await client.query('COMMIT');

         res.status(201).json({ message: 'Predictions saved successfully.' });

     } catch (error) {
         if (client && !client._ending) {
             try { await client.query('ROLLBACK'); } catch (rollbackError) { console.error('Error during ROLLBACK:', rollbackError); }
         }
         console.error(`Error saving predictions for user ${userId}:`, error);
         next(error);
     } finally {
         if (client) { client.release(); }
     }
});


// GET /api/predictions/round/:roundId/me - Get current user's predictions for a specific round
router.get('/round/:roundId/me', protect, async (req, res, next) => {
    // ... (Existing code for GET /round/:roundId/me ...)
     if (!req.user || typeof req.user.userId === 'undefined') { // <<< Added typeof check
         return res.status(401).json({ message: 'User authentication failed or user ID not found.' });
     }
     const userId = req.user.userId;
     const { roundId } = req.params;
     const parsedRoundId = parseInt(roundId, 10);
     if (isNaN(parsedRoundId) || parsedRoundId <= 0) {
         return res.status(400).json({ message: 'Invalid Round ID provided.' });
     }

     try {
         const result = await db.query(
            `SELECT
                 p.prediction_id AS "predictionId", p.predicted_home_goals AS "predictedHomeGoals", p.predicted_away_goals AS "predictedAwayGoals",
                 p.points_awarded AS "pointsAwarded", p.submitted_at AS "submittedAt", p.is_joker AS "isJoker",
                 f.fixture_id AS "fixtureId", COALESCE(f.home_team, 'N/A') AS "homeTeam", COALESCE(f.away_team, 'N/A') AS "awayTeam",
                 f.match_time AS "matchTime", f.home_score AS "homeScore", f.away_score AS "awayScore"
             FROM predictions p JOIN fixtures f ON p.fixture_id = f.fixture_id
             WHERE p.user_id = $1 AND f.round_id = $2
             ORDER BY f.match_time ASC NULLS LAST, f.fixture_id ASC`,
             [userId, parsedRoundId]
         );
         res.status(200).json(result.rows);
     } catch (err) {
         console.error(`Error fetching predictions for user ${userId}, round ${roundId}:`, err);
         next(err);
     }
});


// =======================================================================
// ===== NEW ROUTE: Generate Random Predictions for Active Round ========
// =======================================================================
/**
 * @route   POST /api/predictions/random
 * @desc    Generate random predictions (0-4) for the current user for all fixtures in the 'OPEN' round.
 *          This will overwrite any existing predictions the user has for this round.
 * @access  Private (Logged-in users)
 */
router.post('/random', protect, async (req, res, next) => {
    // Ensure req.user and req.user.userId are populated by 'protect' middleware
    if (!req.user || typeof req.user.userId === 'undefined') { // <<< Added typeof check
         console.error('[API /predictions/random] User ID not found in request after protect middleware.');
         return res.status(401).json({ message: "Authentication error: User ID missing." });
    }
    const userId = req.user.userId;

    // Use client from the pool for transactions
    const getClient = db.getClient || (() => db.pool.connect()); // Adapt based on your db export
    const client = await getClient();

    try {
        console.log(`[API /predictions/random] User ${userId} requested random predictions.`);

        // 1. Find the 'OPEN' round (using round_id)
        const openRoundRes = await client.query(
            "SELECT round_id FROM rounds WHERE status = 'OPEN' LIMIT 1"
        );

        if (openRoundRes.rows.length === 0) {
            console.log(`[API /predictions/random] No 'OPEN' round found for user ${userId}.`);
            return res.status(404).json({ message: "No active round currently open for predictions." });
        }
        const openRoundId = openRoundRes.rows[0].round_id;
        console.log(`[API /predictions/random] Found OPEN round ${openRoundId}.`);

        // 2. Find all fixtures for the 'OPEN' round (using fixture_id, round_id)
        const fixturesRes = await client.query(
            "SELECT fixture_id FROM fixtures WHERE round_id = $1",
            [openRoundId]
        );
        const fixtureIds = fixturesRes.rows.map(f => f.fixture_id);

        if (fixtureIds.length === 0) {
            console.log(`[API /predictions/random] No fixtures found for OPEN round ${openRoundId}.`);
            return res.status(200).json({ message: "Active round has no fixtures, no predictions generated.", count: 0 });
        }
        console.log(`[API /predictions/random] Found ${fixtureIds.length} fixtures for round ${openRoundId}.`);

        // 3. Generate random scores and UPSERT predictions within a transaction
        await client.query('BEGIN'); // Start transaction

        let generatedCount = 0;
        const maxScore = 4; // Generate scores from 0 to 4

        for (const fixtureId of fixtureIds) {
            const randomHomeGoals = Math.floor(Math.random() * (maxScore + 1)); // 0 to maxScore inclusive
            const randomAwayGoals = Math.floor(Math.random() * (maxScore + 1)); // 0 to maxScore inclusive

            // Upsert using confirmed column names and unique constraint
            // Constraint based on Prisma: predictions_user_id_fixture_id_key on (user_id, fixture_id)
            const upsertQuery = `
                INSERT INTO predictions (user_id, fixture_id, round_id, predicted_home_goals, predicted_away_goals, submitted_at)
                VALUES ($1, $2, $3, $4, $5, NOW())
                ON CONFLICT (user_id, fixture_id) -- Assumes constraint is on these columns
                DO UPDATE SET
                    predicted_home_goals = EXCLUDED.predicted_home_goals,
                    predicted_away_goals = EXCLUDED.predicted_away_goals,
                    submitted_at = NOW();
            `;
            await client.query(upsertQuery, [userId, fixtureId, openRoundId, randomHomeGoals, randomAwayGoals]);
            generatedCount++;
        }

        await client.query('COMMIT'); // Commit transaction
        console.log(`[API /predictions/random] Successfully generated/updated ${generatedCount} predictions for user ${userId}, round ${openRoundId}.`);

        res.status(200).json({
            message: `Successfully generated random predictions for ${generatedCount} fixtures.`,
            count: generatedCount
        });

    } catch (error) {
        // Ensure rollback happens on any error during the try block
        if (client && !client._ending) { // Add check for client._ending
            try { await client.query('ROLLBACK'); } catch (rollbackError) { console.error('Error during ROLLBACK:', rollbackError); }
        }
        console.error(`[API /predictions/random] Error generating random predictions for user ${userId}:`, error);
        next(error); // Pass error to global handler
    } finally {
        // ALWAYS release the client back to the pool in a finally block
        if (client) { client.release(); }
    }
});
// =======================================================================


module.exports = router; // Ensure router is exported