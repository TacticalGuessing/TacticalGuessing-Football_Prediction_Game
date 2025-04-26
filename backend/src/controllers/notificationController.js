// backend/src/controllers/notificationController.js
const asyncHandler = require('express-async-handler');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * @desc    Get current user's notification settings
 * @route   GET /api/notifications/settings
 * @access  Private
 */
const getNotificationSettings = asyncHandler(async (req, res) => {
    const userId = req.user.userId; // Available from 'protect' middleware

    const settings = await prisma.user.findUnique({
        where: { userId: userId },
        select: {
            notifiesNewRound: true,
            notifiesDeadlineReminder: true,
            notifiesRoundResults: true,
        }
    });

    if (!settings) {
        // This shouldn't happen if user exists, but handle defensively
        res.status(404);
        throw new Error('User settings not found.');
    }

    res.status(200).json(settings); // Returns camelCase as Prisma model uses it
});

/**
 * @desc    Update current user's notification settings
 * @route   PUT /api/notifications/settings
 * @access  Private
 */
const updateNotificationSettings = asyncHandler(async (req, res) => {
    const userId = req.user.userId; // Available from 'protect' middleware
    const { notifiesNewRound, notifiesDeadlineReminder, notifiesRoundResults } = req.body;

    const dataToUpdate = {};

    // Validate and add fields to update object IF they are present in the body
    if (typeof notifiesNewRound === 'boolean') {
        dataToUpdate.notifiesNewRound = notifiesNewRound;
    }
    if (typeof notifiesDeadlineReminder === 'boolean') {
        dataToUpdate.notifiesDeadlineReminder = notifiesDeadlineReminder;
    }
    if (typeof notifiesRoundResults === 'boolean') {
        dataToUpdate.notifiesRoundResults = notifiesRoundResults;
    }

    // Check if there's anything to update
    if (Object.keys(dataToUpdate).length === 0) {
        return res.status(400).json({ message: 'No valid settings provided to update.' });
    }

    try {
        const updatedUser = await prisma.user.update({
            where: { userId: userId },
            data: dataToUpdate,
            select: { // Select all fields needed by frontend context
                userId: true, name: true, email: true, role: true,
                teamName: true, avatarUrl: true, emailVerified: true,
                createdAt: true, updatedAt: true, subscriptionTier: true,
                notifiesNewRound: true, // Return updated settings
                notifiesDeadlineReminder: true,
                notifiesRoundResults: true,
            }
        });
        console.log(`User ${userId} updated notification settings:`, dataToUpdate);
        res.status(200).json(updatedUser); // Return full updated user data for context update
    } catch (error) {
        console.error(`Error updating settings for user ${userId}:`, error);
        res.status(500);
        throw new Error('Failed to update settings.');
    }
});

module.exports = {
    getNotificationSettings,
    updateNotificationSettings,
};