// backend/src/controllers/adminRoundController.js
const prisma = require('../db.ts').default; // Correct path to Prisma client
const { Prisma } = require('@prisma/client');

/**
 * @desc    Get prediction submission status for all players for a specific round
 * @route   GET /api/admin/rounds/:roundId/prediction-status
 * @access  Private (Admin)
 */
const getPredictionStatusForRound = async (req, res) => {
    const roundIdParam = req.params.roundId;
    const roundId = parseInt(roundIdParam, 10);

    if (isNaN(roundId) || roundId <= 0) {
        res.status(400);
        throw new Error('Invalid Round ID parameter.');
    }

    // 1. Check if round exists
    const round = await prisma.round.findUnique({
        where: { roundId: roundId },
        select: { roundId: true, status: true } // Select status too, maybe useful later
    });
    if (!round) {
        res.status(404);
        throw new Error('Round not found.');
    }
    // Optional: Could add check here if round status must be OPEN/CLOSED

    // 2. Get all users with the PLAYER role
    const players = await prisma.user.findMany({
        where: { role: 'PLAYER' },
        select: { userId: true, name: true, avatarUrl: true },
        orderBy: { name: 'asc' }
    });

    // 3. Get IDs of players who HAVE made at least one prediction for this round
    const predictedUserIds = await prisma.prediction.groupBy({
        by: ['userId'],
        where: { roundId: roundId },
        _count: { userId: true }
    });

    const predictedUserIdSet = new Set(predictedUserIds.map(p => p.userId));

    // 4. Combine player list with prediction status
    const playerStatuses = players.map(player => ({
        userId: player.userId,
        name: player.name,
        avatarUrl: player.avatarUrl,
        hasPredicted: predictedUserIdSet.has(player.userId)
    }));

    res.status(200).json(playerStatuses);
};


// --- Add other Admin Round Management functions here later if needed ---
// e.g., function to list all rounds for admin, update round details, etc.


// --- Export module ---
module.exports = {
    getPredictionStatusForRound,
    // Export other functions as you add them
};