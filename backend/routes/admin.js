// backend/routes/admin.js
const express = require('express');
const { PrismaClient, Prisma } = require('@prisma/client'); // Add Prisma here
const asyncHandler = require('express-async-handler'); // Add asyncHandler
const { protect, admin, } = require('../middleware/authMiddleware'); // Import middleware
const dashboardController = require('../src/controllers/dashboardController');

const adminRoundController = require('../src/controllers/adminRoundController');


const prisma = new PrismaClient();
const router = express.Router();

// --- ADD Controller import ---
const { handleResetGameData } = require('../src/controllers/adminDevController.js'); // Correct path

// Middleware: Apply protect and admin checks to all routes in this file
router.use(protect);
router.use(admin);

// --- Admin Routes will go here ---

router.post('/news', asyncHandler(dashboardController.createNewsItem));
router.delete('/news/:newsItemId', asyncHandler(dashboardController.deleteNewsItem));

// --- Define the NEW Dev Reset Route ---
// Use isAdmin middleware specifically for this route
router.post('/dev/reset-game-data', asyncHandler(handleResetGameData)); // Added asyncHandler wrap
// --- End New Route ---

// Example Test Route
router.get('/test', (req, res) => {
    console.log(`[${new Date().toISOString()}] Admin Test Route accessed by User ID: ${req.user.userId}`);
    res.status(200).json({ message: 'Admin route test successful', adminUser: req.user.name });
});

router.get('/rounds/:roundId/prediction-status', asyncHandler(adminRoundController.getPredictionStatusForRound));

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
                name: true,    // Select model field name
                email: true,
                role: true
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

// --- NEW: Update User Role Endpoint ---
/**
 * @route   PATCH /api/admin/users/:userId/role
 * @desc    Update a user's role (PLAYER or VISITOR)
 * @access  Admin
 */
router.patch('/users/:userId/role', protect, asyncHandler(async (req, res) => {
    // 1. Authorization: Ensure only Admins can perform this
    if (req.user.role !== 'ADMIN') {
        res.status(403); // Forbidden
        throw new Error('Not authorized to change user roles.');
    }

    // 2. Get userId from path parameters
    const userIdToUpdate = parseInt(req.params.userId, 10);
    if (isNaN(userIdToUpdate)) {
         res.status(400);
         throw new Error('Invalid user ID provided.');
    }

    // 3. Get new role from request body and validate
    const { role: newRole } = req.body;
    const validRoles = ['PLAYER', 'VISITOR']; // Only allow changing to these roles

    if (!newRole || typeof newRole !== 'string' || !validRoles.includes(newRole.toUpperCase())) {
        res.status(400);
        throw new Error(`Invalid role provided. Must be one of: ${validRoles.join(', ')}.`);
    }

    // 4. Prevent admin from changing their own role or another admin's role via this endpoint (optional safety)
    if (userIdToUpdate === req.user.userId) {
         res.status(400);
         throw new Error('Admins cannot change their own role via this endpoint.');
    }

     // Optional: Check if target user is also an Admin
     const targetUser = await prisma.user.findUnique({ where: { userId: userIdToUpdate }, select: { role: true }});
     if (!targetUser) {
         res.status(404);
         throw new Error('User not found.');
     }
     if (targetUser.role === 'ADMIN') {
          res.status(400);
          throw new Error('Cannot change the role of another Admin via this endpoint.');
     }


    // 5. Update the user's role in the database
    try {
        const updatedUser = await prisma.user.update({
            where: { userId: userIdToUpdate },
            data: { role: newRole.toUpperCase() }, // Ensure role is saved in uppercase if needed by checks
            select: { // Return relevant fields
                userId: true,
                name: true,
                email: true,
                role: true,
                teamName: true,
                avatarUrl: true
            }
        });
        console.log(`Admin ${req.user.userId} updated role for user ${userIdToUpdate} to ${newRole.toUpperCase()}`);
        res.status(200).json(updatedUser);

    } catch (error) {
        console.error(`Error updating role for user ${userIdToUpdate}:`, error);
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
             res.status(404); // Record not found (might happen if deleted between check and update)
             throw new Error('User not found.');
        }
        // Re-throw other errors for global handler
        throw error;
    }
}));
// --- END NEW Endpoint ---

/**
 * @route   DELETE /api/admin/users/:userId
 * @desc    Delete a non-admin user
 * @access  Admin
 */
router.delete('/users/:userId', asyncHandler(async (req, res) => {
    // Note: protect and admin middleware are already applied via router.use()

    // 1. Get userId from path parameters
    const userIdToDelete = parseInt(req.params.userId, 10);
    if (isNaN(userIdToDelete)) {
        res.status(400);
        throw new Error('Invalid user ID provided.');
    }

    // 2. Prevent admin from deleting themselves
    if (userIdToDelete === req.user.userId) {
        res.status(400);
        throw new Error('Admins cannot delete their own account via this interface.');
    }

    // 3. Check if target user is an Admin (prevent deletion)
    const targetUser = await prisma.user.findUnique({
        where: { userId: userIdToDelete },
        select: { role: true }
    });

    if (!targetUser) {
        res.status(404); // Not Found is appropriate if user doesn't exist
        throw new Error('User not found.');
    }

    if (targetUser.role === 'ADMIN') {
        res.status(403); // Forbidden
        throw new Error('Cannot delete another Admin account.');
    }

    // 4. Perform the deletion
    // IMPORTANT: Consider cascading deletes in schema.prisma or manually delete related data (predictions) first if needed!
    // Assuming predictions should be deleted when a user is deleted (add onDelete: Cascade to schema or handle here)
    try {
        // Example: If cascade delete isn't set for predictions, delete them first
        // await prisma.prediction.deleteMany({ where: { userId: userIdToDelete } });

        // Now delete the user
        await prisma.user.delete({
            where: { userId: userIdToDelete },
        });

        console.log(`Admin ${req.user.userId} deleted user ${userIdToDelete}`);
        res.status(200).json({ message: `User ID ${userIdToDelete} deleted successfully.` });

    } catch (error) {
        console.error(`Error deleting user ${userIdToDelete}:`, error);
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            res.status(404); // Record to delete not found
            throw new Error('User not found.');
        }
        // Re-throw other errors for global handler
        throw error;
    }
}));

module.exports = router;