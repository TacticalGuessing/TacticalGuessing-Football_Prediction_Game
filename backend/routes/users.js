// backend/routes/users.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { protect } = require('../middleware/authMiddleware'); // Only need 'protect'

const prisma = new PrismaClient();
const router = express.Router();

// Apply 'protect' middleware to all routes in this file
router.use(protect);

// --- User Profile Routes ---

/**
 * @route   POST /api/users/profile/team-name
 * @desc    Set or update the logged-in user's team name
 * @access  Private (Protected)
 */
router.post('/profile/team-name', async (req, res, next) => {
    const userId = req.user.userId;
    const { teamName } = req.body; // Expecting { teamName: "New Team Name" }

    console.log(`[${new Date().toISOString()}] User ${userId} attempting to set team name to: "${teamName}"`);

    // Validation
    if (typeof teamName !== 'string') {
         return res.status(400).json({ message: 'Team name must be a string.' });
    }
    const trimmedTeamName = teamName.trim();
    if (trimmedTeamName.length === 0) {
         // Allow setting empty string to REMOVE team name? Yes.
         // Or require non-empty? Let's allow empty for now.
         // Adjust validation if non-empty is required:
         // if (trimmedTeamName.length === 0 || trimmedTeamName.length > 50) { // Example length limit
         //    return res.status(400).json({ message: 'Team name must be between 1 and 50 characters.' });
         // }
         console.log(`[${new Date().toISOString()}] User ${userId} setting team name to empty.`);
    } else if (trimmedTeamName.length > 50) { // Example max length
         return res.status(400).json({ message: 'Team name cannot exceed 50 characters.' });
    }
    // Optional: Add profanity filter or other validation here

    try {
        const updatedUser = await prisma.user.update({
            where: { userId: userId }, // Use model field name
            data: {
                teamName: trimmedTeamName === '' ? null : trimmedTeamName // Store null if empty, otherwise trimmed name
            },
            select: { // Return only relevant fields
                userId: true,
                name: true,
                teamName: true,
                email: true,
                role: true
            }
        });

        console.log(`[${new Date().toISOString()}] User ${userId} successfully updated team name.`);
        res.status(200).json(updatedUser); // Return updated user info (camelCase)

    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error setting team name for User ${userId}:`, error);
         // Handle potential errors like user not found (though 'protect' should prevent)
        if (error.code === 'P2025') { // Record not found
            return res.status(404).json({ message: 'User not found.' });
        }
        next(error);
    }
});


// --- TODO: Add other profile routes later (e.g., POST /profile/avatar) ---


module.exports = router;