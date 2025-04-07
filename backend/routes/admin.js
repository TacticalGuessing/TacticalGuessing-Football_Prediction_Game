// backend/routes/admin.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { protect, admin } = require('../middleware/authMiddleware'); // Import middleware

const prisma = new PrismaClient();
const router = express.Router();

// Middleware: Apply protect and admin checks to all routes in this file
router.use(protect);
router.use(admin);

// --- Admin Routes will go here ---

// Example Test Route
router.get('/test', (req, res) => {
    console.log(`[${new Date().toISOString()}] Admin Test Route accessed by User ID: ${req.user.userId}`);
    res.status(200).json({ message: 'Admin route test successful', adminUser: req.user.name });
});

// --- NEW: GET /api/admin/users ---
/**
 * @route   GET /api/admin/users
 * @desc    Get a list of all users (ID and Name) for admin purposes
 * @access  Private (Admin Only - already applied via router.use)
 */
router.get('/users', async (req, res, next) => {
    console.log(`[${new Date().toISOString()}] Admin request GET /users by User ID: ${req.user.userId}`);
    try {
        const users = await prisma.user.findMany({
            select: {
                userId: true, // Select model field name (camelCase)
                name: true    // Select model field name
            },
            orderBy: {
                name: 'asc' // Order alphabetically by name
            }
        });

        // Prisma returns data matching the model (camelCase)
        res.status(200).json(users);

    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error fetching users for admin:`, error);
        next(error); // Pass to global error handler
    }
});
// --- END NEW ROUTE ---

// --- NEW: GET /api/admin/users/:userId/predictions/:roundId ---
/**
 * @route   GET /api/admin/users/:userId/predictions/:roundId
 * @desc    Get detailed predictions vs results for a specific user and completed round
 * @access  Private (Admin Only - already applied via router.use)
 */
router.get('/users/:userId/predictions/:roundId', async (req, res, next) => {
    const requestingAdminId = req.user.userId;
    const { userId: targetUserIdParam, roundId: roundIdParam } = req.params;

    console.log(`[${new Date().toISOString()}] Admin ${requestingAdminId} requesting predictions for User ${targetUserIdParam}, Round ${roundIdParam}`);

    // Validate parameters
    const targetUserId = parseInt(targetUserIdParam, 10);
    const roundId = parseInt(roundIdParam, 10);

    if (isNaN(targetUserId) || targetUserId <= 0) {
        return res.status(400).json({ message: 'Invalid User ID parameter.' });
    }
    if (isNaN(roundId) || roundId <= 0) {
        return res.status(400).json({ message: 'Invalid Round ID parameter.' });
    }

    try {
        // 1. Verify target user exists
        const targetUser = await prisma.user.findUnique({
            where: { userId: targetUserId }, // Use model field name
            select: { userId: true } // Only need to check existence
        });
        if (!targetUser) {
            console.log(`[${new Date().toISOString()}] Target user ${targetUserId} not found.`);
            return res.status(404).json({ message: `User with ID ${targetUserId} not found.` });
        }

        // 2. Verify round exists and is COMPLETED
        const round = await prisma.round.findUnique({
            where: { roundId: roundId }, // Use model field name
            select: { status: true }
        });
        if (!round) {
            console.log(`[${new Date().toISOString()}] Target round ${roundId} not found.`);
            return res.status(404).json({ message: `Round with ID ${roundId} not found.` });
        }
        if (round.status !== 'COMPLETED') {
             console.log(`[${new Date().toISOString()}] Target round ${roundId} is not COMPLETED (Status: ${round.status}).`);
            return res.status(400).json({ message: `Round ${roundId} is not completed. Audit is only available for completed rounds.` });
        }

        // 3. Fetch the predictions with included fixture details
        console.log(`[${new Date().toISOString()}] Fetching predictions for User ${targetUserId}, Round ${roundId}...`);
        const predictions = await prisma.prediction.findMany({
            where: {
                userId: targetUserId, // Use model field name
                roundId: roundId      // Use model field name
            },
            select: { // Select specific fields using model names (camelCase)
                fixtureId: true,
                predictedHomeGoals: true,
                predictedAwayGoals: true,
                isJoker: true,
                pointsAwarded: true,
                fixture: { // Include related fixture data
                    select: {
                        homeTeam: true,
                        awayTeam: true,
                        homeScore: true,
                        awayScore: true,
                        matchTime: true
                    }
                }
            },
            orderBy: { // Order by match time for consistent display
                fixture: {
                    matchTime: 'asc'
                }
            }
        });
        console.log(`[${new Date().toISOString()}] Found ${predictions.length} predictions.`);

        // Data is returned by Prisma using model field names (camelCase)
        res.status(200).json(predictions);

    } catch (error) {
         console.error(`[${new Date().toISOString()}] Error fetching prediction audit for User ${targetUserId}, Round ${roundId}:`, error);
         next(error); // Pass to global error handler
    }
});
// --- END NEW ROUTE ---

module.exports = router;