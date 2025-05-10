// backend/src/controllers/adminController.js
const asyncHandler = require('express-async-handler');
const { PrismaClient, Prisma } = require('@prisma/client'); // Import Prisma types if needed
const prisma = new PrismaClient();

// === Admin User Management Functions ===

/**
 * @desc    Get all users for Admin panel (excluding other admins)
 * @route   GET /api/admin/users
 * @access  Private (Admin)
 */
const getAllUsersForAdmin = asyncHandler(async (req, res) => {
    // Fetch users, explicitly excluding users with the 'ADMIN' role
    const users = await prisma.user.findMany({
        where: {
            role: {
                not: 'ADMIN' // Don't show other admins in this list
            }
        },
        select: { // Select fields needed for the admin table
            userId: true,
            name: true,
            email: true,
            role: true,
            emailVerified: true,
            createdAt: true,
            // Add other fields if needed by the admin UI in the future
        },
        orderBy: {
            userId: 'asc' // Or order by name, email, etc.
        }
    });
    res.status(200).json(users); // Prisma returns camelCase
});

/**
 * @desc    Update a user's role (Admin) - Allow setting PLAYER or VISITOR only
 * @route   PATCH /api/admin/users/:userId/role
 * @access  Private (Admin)
 */
const updateUserRoleAdmin = asyncHandler(async (req, res) => {
    const userIdToUpdate = parseInt(req.params.userId, 10);
    const { role: newRole } = req.body;

    if (isNaN(userIdToUpdate)) {
        res.status(400); throw new Error('Invalid User ID.');
    }

    // Explicitly allow only setting PLAYER or VISITOR
    if (newRole !== 'PLAYER' && newRole !== 'VISITOR') {
        res.status(400);
        throw new Error('Invalid role. Only PLAYER or VISITOR can be set via this endpoint.');
    }

    // Optional: Prevent admin from changing their own role here?
    if (userIdToUpdate === req.user.userId) {
        res.status(400); throw new Error("Admins cannot change their own role via this endpoint.");
    }

    try {
        // Check if user exists and is not an admin before updating
        const userToUpdate = await prisma.user.findUnique({ where: { userId: userIdToUpdate } });
        if (!userToUpdate) {
            res.status(404); throw new Error('User not found.');
        }
        if (userToUpdate.role === 'ADMIN') {
             res.status(400); throw new Error('Cannot change the role of an existing Admin via this endpoint.');
        }

        const updatedUser = await prisma.user.update({
            where: { userId: userIdToUpdate },
            data: { role: newRole },
            select: { userId: true, name: true, email: true, role: true, emailVerified: true } // Return needed fields
        });
        console.log(`Admin ${req.user.userId} updated role for user ${userIdToUpdate} to ${newRole}`);
        res.status(200).json(updatedUser);
    } catch (error) {
        console.error(`Error updating role for user ${userIdToUpdate}:`, error);
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') { // Handles case where user disappears between check and update
            res.status(404); throw new Error('User not found.');
        }
        throw error; // Rethrow other errors
    }
});

/**
 * @desc    Update a user's email verification status (Admin)
 * @route   PATCH /api/admin/users/:userId/verification
 * @access  Private (Admin)
 */
const updateUserVerificationStatusAdmin = asyncHandler(async (req, res) => {
    const userIdToUpdate = parseInt(req.params.userId, 10);
    const { isVerified } = req.body;

    if (isNaN(userIdToUpdate)) {
        res.status(400); throw new Error('Invalid User ID.');
    }
    if (typeof isVerified !== 'boolean') {
        res.status(400); throw new Error('Invalid request body. "isVerified" (boolean) is required.');
    }
     // Optional: Prevent admin from unverifying themselves?
     if (userIdToUpdate === req.user.userId && !isVerified) {
        res.status(400); throw new Error('Admin cannot un-verify their own account.');
    }

    try {
        const updatedUser = await prisma.user.update({
            where: { userId: userIdToUpdate },
            data: {
                emailVerified: isVerified,
                emailVerificationToken: isVerified ? null : undefined // Clear token if verifying
            },
            select: { userId: true, name: true, email: true, role: true, emailVerified: true }
        });
        console.log(`Admin ${req.user.userId} updated verification status for user ${userIdToUpdate} to ${isVerified}`);
        res.status(200).json(updatedUser);
    } catch (error) {
        console.error(`Error updating verification status for user ${userIdToUpdate}:`, error);
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            res.status(404); throw new Error('User not found.');
        }
        throw error;
    }
});

/**
 * @desc    Delete a user (Admin) - IMPLEMENT SOFT DELETE LATER
 * @route   DELETE /api/admin/users/:userId
 * @access  Private (Admin)
 */
const deleteUserAdmin = asyncHandler(async (req, res) => {
    const userIdToDelete = parseInt(req.params.userId, 10);

    if (isNaN(userIdToDelete)) {
        res.status(400); throw new Error('Invalid User ID.');
    }
    if (userIdToDelete === req.user.userId) {
        res.status(400); throw new Error('Admin cannot delete their own account.');
    }

    // --- Placeholder for SOFT DELETE Logic ---
    // TODO: Replace this with prisma.user.update({ where: { userId }, data: { isActive: false, ... } })
    //       after adding isActive field to schema and updating all other queries.
    // For now, we know the hard delete below will likely fail due to constraints.
    console.warn(`[ADMIN DELETE USER] Attempting HARD delete for user ${userIdToDelete}. This will likely fail if user has related data. Implement soft delete.`);
    // --- End Placeholder ---

    try {
        // Check if user exists and is not an admin before deleting
        const userToDelete = await prisma.user.findUnique({ where: { userId: userIdToDelete } });
        if (!userToDelete) {
            res.status(404); throw new Error('User not found.');
        }
        if (userToDelete.role === 'ADMIN') {
             res.status(400); throw new Error('Cannot delete an Admin account.');
        }

        // --- Current HARD DELETE attempt (will fail on constraints) ---
        await prisma.user.delete({
            where: { userId: userIdToDelete },
        });
        // --- End HARD DELETE ---

        console.log(`Admin ${req.user.userId} deleted user ${userIdToDelete}. (Note: This was a hard delete attempt).`);
        res.status(200).json({ message: 'User deleted successfully.' }); // Or use 204 No Content

    } catch (error) {
        console.error(`Error deleting user ${userIdToDelete}:`, error);
         if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') { // Record not found
            res.status(404); throw new Error('User not found.');
         }
         if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') { // Foreign key constraint
             res.status(409); // Conflict
             throw new Error('Cannot delete user. User has existing predictions, league memberships, or other related data. Consider disabling the account instead.');
         }
        throw error; // Rethrow other errors
    }
});

/**
 * @desc    Get prediction submission status for all players for a given round (Admin)
 * @route   GET /api/admin/rounds/:roundId/prediction-status
 * @access  Private (Admin)
 */
const getRoundPredictionStatus = asyncHandler(async (req, res) => {
    const roundId = parseInt(req.params.roundId, 10);

    if (isNaN(roundId)) {
        res.status(400);
        throw new Error('Invalid Round ID.');
    }

    // 1. Get all users with the 'PLAYER' role
    const players = await prisma.user.findMany({
        where: {
            role: 'PLAYER'
            // Optionally, filter by isActive: true if implementing soft delete
        },
        select: {
            userId: true,
            name: true,
            avatarUrl: true
        }
    });

    if (players.length === 0) {
        return res.status(200).json([]); // No players, so no status to report
    }

    // 2. Get all predictions for the given round
    const predictionsInRound = await prisma.prediction.findMany({
        where: {
            roundId: roundId,
            userId: { in: players.map(p => p.userId) } // Only consider predictions from players
        },
        select: {
            userId: true // We only need to know WHO predicted
        }
    });

    // 3. Create a set of user IDs who have predicted in this round for quick lookup
    const usersWhoPredicted = new Set(predictionsInRound.map(p => p.userId));

    // 4. Map player data to include prediction status
    const playerStatuses = players.map(player => ({
        userId: player.userId,
        name: player.name,
        avatarUrl: player.avatarUrl,
        hasPredicted: usersWhoPredicted.has(player.userId)
    }));

    console.log(`[Admin Prediction Status] Found ${playerStatuses.length} players, ${usersWhoPredicted.size} predicted for round ${roundId}.`);
    res.status(200).json(playerStatuses); // Returns camelCase as Prisma model fields are camelCase
});


// --- Export all admin functions ---
module.exports = {
    getAllUsersForAdmin,
    updateUserRoleAdmin,
    updateUserVerificationStatusAdmin,
    deleteUserAdmin,
    getRoundPredictionStatus,
    // Add other admin controller functions here later (e.g., admin dashboard data)
};