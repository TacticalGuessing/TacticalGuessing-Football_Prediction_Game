// ==== REPLACE ENTIRE CONTENTS of backend/routes/predictions.js WITH THIS ====

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { protect } = require('../middleware/authMiddleware');
const { calculatePoints } = require('../src/utils/scoringUtils');

const prisma = new PrismaClient();
const router = express.Router();

// --- Test Route (Keep for verification) ---
router.get('/test', (req, res) => {
  console.log(`[${new Date().toISOString()}] GET /test hit!`);
  res.status(200).send('Predictions test route OK');
});

// --- POST /random ---
/**
 * @route   POST /api/predictions/random
 * @desc    Generate random predictions (0-4 goals) for the active 'OPEN' round fixtures for the user
 * @access  Protected
 */
router.post('/random', protect, async (req, res, next) => {
    const userId = req.user?.userId;
    if (!userId) {
        return res.status(401).json({ message: 'Authentication error: User ID missing.' });
    }

    // *** ADD THIS ROLE CHECK ***
    if (req.user.role !== 'PLAYER') {
        console.warn(`[${new Date().toISOString()}] Admin user ${userId} forbidden attempt POST /predictions/random`);
        return res.status(403).json({ message: 'Forbidden: Admins cannot submit predictions.' });
    }
    // *** END ROLE CHECK ***

    console.log(`[${new Date().toISOString()}] User ${userId} calling /random`);

    try {
        // Find active round including fixtures
        console.log(`[${new Date().toISOString()}] Finding active round for /random...`);
        const activeRound = await prisma.round.findFirst({
            where: { status: 'OPEN' },
            include: { fixtures: true }, // Include all fixture data
            orderBy: { deadline: 'asc' },
        });
        console.log(`[${new Date().toISOString()}] Active round query completed for /random.`);

        if (!activeRound) {
            console.log(`[${new Date().toISOString()}] No active round found for /random.`);
            return res.status(400).json({ message: 'No active round found for generating predictions.' });
        }

        // Access model field names (camelCase)
        const roundId = activeRound.roundId;
        const deadline = activeRound.deadline;
        const fixtures = activeRound.fixtures;
        console.log(`[${new Date().toISOString()}] Found active round ${roundId} for /random.`);

        if (!fixtures || fixtures.length === 0) {
            console.log(`[${new Date().toISOString()}] No fixtures found in active round ${roundId} for /random.`);
            return res.status(400).json({ message: 'No fixtures found in the active round to predict.' });
        }
        const fixtureIds = fixtures.map(f => f.fixtureId); // Use camelCase fixtureId
        console.log(`[${new Date().toISOString()}] Fixture IDs for /random: ${fixtureIds.join(', ')}`);

        // Validate roundId
        if (typeof roundId !== 'number' || roundId <= 0) {
             console.error(`[${new Date().toISOString()}] FATAL: Invalid roundId (${roundId}) in /random.`);
             return res.status(500).json({ message: 'Internal server error: Invalid round ID.' });
        }

        // Check deadline
        const now = new Date();
        if (!deadline || now > new Date(deadline)) {
            console.log(`[${new Date().toISOString()}] Deadline passed or missing for round ${roundId} in /random.`);
            return res.status(400).json({ message: 'Prediction deadline has passed or is invalid.' });
        }

        // Prepare upsert operations
        const maxRandomScore = 4;
        console.log(`[${new Date().toISOString()}] Preparing ${fixtureIds.length} upsert operations for /random.`);
        const upsertOperations = fixtureIds.map(fixtureId => {
            const randomHomeGoals = Math.floor(Math.random() * (maxRandomScore + 1));
            const randomAwayGoals = Math.floor(Math.random() * (maxRandomScore + 1));

            return prisma.prediction.upsert({
                where: {
                    userId_fixtureId: {
                        userId: userId,
                        fixtureId: fixtureId,
                    }
                },
                create: {
                    userId: userId,
                    fixtureId: fixtureId,
                    roundId: roundId,
                    // *** CORRECTED: Use camelCase model field names ***
                    predictedHomeGoals: randomHomeGoals,
                    predictedAwayGoals: randomAwayGoals,
                    // --- End Correction ---
                    isJoker: false,
                },
                update: {
                    // *** CORRECTED: Use camelCase model field names ***
                    predictedHomeGoals: randomHomeGoals,
                    predictedAwayGoals: randomAwayGoals,
                    // --- End Correction ---
                    isJoker: false,
                    
                },
            });
        });

        // Execute transaction
        console.log(`[${new Date().toISOString()}] Executing transaction for /random...`);
        const result = await prisma.$transaction(upsertOperations);
        console.log(`[${new Date().toISOString()}] Transaction completed for /random. Result count: ${result.length}`);

        console.log(`[${new Date().toISOString()}] User ${userId} generated random predictions for ${result.length} fixtures in round ${roundId}.`);
        res.status(200).json({ message: 'Random predictions generated successfully.', count: result.length });

    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error in /random handler for user ${userId}:`, error);
        next(error);
    }
}); // End of POST /random


// --- POST / ---
/**
 * @route   POST /api/predictions
 * @desc    Submit or update predictions for the active 'OPEN' round
 * @access  Protected
 */
router.post('/', protect, async (req, res, next) => {
    const { predictions } = req.body;
    const userId = req.user?.userId;

    console.log(`[${new Date().toISOString()}] User ${userId} calling POST /predictions with ${predictions?.length ?? 0} predictions.`);

    // Basic validation
    if (!userId) { return res.status(401).json({ message: 'Authentication error: User ID missing.' }); }

    // *** ADD THIS ROLE CHECK ***
    if (req.user.role !== 'PLAYER') {
        console.warn(`[${new Date().toISOString()}] Admin user ${userId} forbidden attempt POST /predictions`);
        return res.status(403).json({ message: 'Forbidden: Admins cannot submit predictions.' });
    }
    // *** END ROLE CHECK ***

    if (!Array.isArray(predictions)) { return res.status(400).json({ message: 'Invalid request format: "predictions" must be an array.' }); }

    // Payload validation
    for (const pred of predictions) {
        if (typeof pred.fixtureId !== 'number' || pred.fixtureId <= 0) {
            console.warn(`[${new Date().toISOString()}] Invalid fixtureId in payload:`, pred);
            return res.status(400).json({ message: 'Invalid fixture ID found in predictions.' });
        }
        if (pred.predictedHomeGoals !== null && (!Number.isInteger(pred.predictedHomeGoals) || pred.predictedHomeGoals < 0)) {
            console.warn(`[${new Date().toISOString()}] Invalid home goals in payload:`, pred);
            return res.status(400).json({ message: `Invalid predicted home goals for fixture ${pred.fixtureId}. Must be null or a non-negative integer.` });
        }
        if (pred.predictedAwayGoals !== null && (!Number.isInteger(pred.predictedAwayGoals) || pred.predictedAwayGoals < 0)) {
            console.warn(`[${new Date().toISOString()}] Invalid away goals in payload:`, pred);
            return res.status(400).json({ message: `Invalid predicted away goals for fixture ${pred.fixtureId}. Must be null or a non-negative integer.` });
        }
        if (pred.isJoker !== undefined && typeof pred.isJoker !== 'boolean') {
            console.warn(`[${new Date().toISOString()}] Invalid isJoker in payload:`, pred);
            return res.status(400).json({ message: `Invalid isJoker value for fixture ${pred.fixtureId}. Must be true or false if provided.` });
        }
    }

    try {
        // Find active round
        console.log(`[${new Date().toISOString()}] Finding active round for POST /predictions...`);
        const activeRound = await prisma.round.findFirst({
            where: { status: 'OPEN' },
            select: { roundId: true, deadline: true },
            orderBy: { deadline: 'asc' },
        });
        console.log(`[${new Date().toISOString()}] Active round query completed for POST /predictions.`);

        if (!activeRound) {
            console.log(`[${new Date().toISOString()}] No active round found for POST /predictions.`);
            return res.status(400).json({ message: 'No active round found for submitting predictions.' });
        }
        const roundId = activeRound.roundId;
        const deadline = activeRound.deadline;
        console.log(`[${new Date().toISOString()}] Found active round ${roundId} for POST /predictions.`);

        // Validate roundId
        if (typeof roundId !== 'number' || roundId <= 0) {
            console.error(`[${new Date().toISOString()}] FATAL: Invalid roundId (${roundId}) in POST /predictions.`);
            return res.status(500).json({ message: 'Internal server error: Invalid round ID.' });
        }

        // Check deadline
        const now = new Date();
        if (!deadline || now > new Date(deadline)) {
            console.log(`[${new Date().toISOString()}] Deadline passed or missing for round ${roundId} in POST /predictions.`);
            return res.status(400).json({ message: 'Prediction deadline has passed or is invalid.' });
        }

        // Validate Joker Count
        const jokerPredictionsCount = predictions.filter(p => p.isJoker === true).length;
        if (jokerPredictionsCount > 1) {
             console.warn(`[${new Date().toISOString()}] User ${userId} attempted to submit ${jokerPredictionsCount} jokers for round ${roundId}.`);
             return res.status(400).json({ message: 'You can only mark one prediction as a Joker per round.' });
        }

        // Prepare upsert operations
        console.log(`[${new Date().toISOString()}] Preparing ${predictions.length} upsert operations for POST /predictions.`);
        const upsertOperations = predictions.map(prediction => {
            const homeGoals = prediction.predictedHomeGoals === null ? null : Number(prediction.predictedHomeGoals);
            const awayGoals = prediction.predictedAwayGoals === null ? null : Number(prediction.predictedAwayGoals);
            const isJokerValue = prediction.isJoker ?? false;

            return prisma.prediction.upsert({
                where: {
                    userId_fixtureId: {
                        userId: userId,
                        fixtureId: prediction.fixtureId,
                    }
                },
                create: {
                    userId: userId,
                    fixtureId: prediction.fixtureId,
                    roundId: roundId,
                    // *** CORRECTED: Use camelCase model field names ***
                    predictedHomeGoals: homeGoals,
                    predictedAwayGoals: awayGoals,
                    // --- End Correction ---
                    isJoker: isJokerValue,
                },
                update: {
                    // *** CORRECTED: Use camelCase model field names ***
                    predictedHomeGoals: homeGoals,
                    predictedAwayGoals: awayGoals,
                    // --- End Correction ---
                    isJoker: isJokerValue,
                    
                },
            });
        });

        // Execute transaction
        console.log(`[${new Date().toISOString()}] Executing transaction for POST /predictions...`);
        const result = await prisma.$transaction(upsertOperations);
        console.log(`[${new Date().toISOString()}] Transaction completed for POST /predictions. Result count: ${result.length}`);

        const message = result.length > 0 ? 'Predictions submitted successfully.' : 'No prediction data needed updating.';
        console.log(`[${new Date().toISOString()}] User ${userId} successful POST /predictions for round ${roundId}.`);
        res.status(200).json({ message: message, count: result.length });

    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error in POST /predictions handler for user ${userId}:`, error);
        if (error.code === 'P2003') {
             const field = error.meta?.field_name;
             console.error(`[${new Date().toISOString()}] Foreign key constraint violation potentially on field: ${field}`);
             return res.status(400).json({ message: `Invalid input: One or more fixture IDs provided do not belong to the active round.` });
         }
        next(error);
    }
}); // End of POST /


// --- GET /points/:roundId ---
/**
 * @route   GET /api/predictions/points/:roundId
 * @desc    Get points awarded for a specific COMPLETED round for the logged-in user
 * @access  Protected
 */
router.get('/points/:roundId', protect, async (req, res, next) => {
    const userId = req.user?.userId;
    const { roundId: roundIdParam } = req.params;

    if (!userId) { return res.status(401).json({ message: 'Authentication error: User ID missing.' }); }
    const roundId = parseInt(roundIdParam, 10);
    if (isNaN(roundId)) { return res.status(400).json({ message: 'Invalid Round ID.' }); }

    // <<< --- ADD ROLE CHECK HERE --- >>>
    if (req.user.role === 'VISITOR') {
        res.status(403); // Forbidden
        throw new Error('Visitors cannot view points breakdowns.');
    }
    // <<< --- END ROLE CHECK --- >>>

    try {
        // Verify Round exists and is COMPLETED
        const round = await prisma.round.findUnique({
            where: { roundId: roundId }, // Use model field name
            select: { status: true }
        });

        if (!round) { return res.status(404).json({ message: 'Round not found.' }); }
        if (round.status !== 'COMPLETED') { return res.status(400).json({ message: `Points are only available for COMPLETED rounds. This round status is: ${round.status}` }); }

        // Fetch predictions
        const predictions = await prisma.prediction.findMany({
            where: { userId: userId, roundId: roundId }, // Use model field names
            select: {
                fixtureId: true,
                predictedHomeGoals: true, // model field name
                predictedAwayGoals: true, // model field name
                pointsAwarded: true,      // model field name
                isJoker: true,
                fixture: {
                    select: {
                        homeTeam: true,   // model field name
                        awayTeam: true,   // model field name
                        homeScore: true,  // model field name
                        awayScore: true,  // model field name
                        matchTime: true   // model field name
                    }
                }
            },
            orderBy: { fixture: { matchTime: 'asc' } } // Use model field names
        });

        // Calculate total points
        const totalPoints = predictions.reduce((sum, pred) => sum + (pred.pointsAwarded ?? 0), 0);

        // Map to response
        const responseData = {
            roundId: roundId,
            totalPoints: totalPoints,
            predictions: predictions.map(p => ({
                fixtureId: p.fixtureId,
                predictedHomeGoals: p.predictedHomeGoals,
                predictedAwayGoals: p.predictedAwayGoals,
                pointsAwarded: p.pointsAwarded,
                isJoker: p.isJoker,
                homeTeam: p.fixture.homeTeam,
                awayTeam: p.fixture.awayTeam,
                homeScore: p.fixture.homeScore,
                awayScore: p.fixture.awayScore,
                matchTime: p.fixture.matchTime
            }))
        };

        res.status(200).json(responseData);

    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error fetching points for user ${userId}, round ${roundId}:`, error);
        next(error);
    }
}); // End of GET /points/:roundId

module.exports = router;

// =======================================================================