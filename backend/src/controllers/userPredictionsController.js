// backend/src/controllers/userPredictionsController.js
const prisma = require('../db.ts').default; // Adjust path if needed
const { Prisma } = require('@prisma/client');

/**
 * @desc    Get predictions for the logged-in user for a specific round
 * @route   GET /api/users/me/predictions/:roundId
 * @access  Private
 */
const getUserPredictionsForRound = async (req, res) => {
    if (!req.user || typeof req.user.userId === 'undefined') {
        console.error("User context missing in getUserPredictionsForRound");
        return res.status(401).json({ message: 'Not authorized, user data missing' });
    }
    const userId = req.user.userId;
    const roundIdParam = req.params.roundId;

    let targetRoundId = null;
    let resolvedRound = null;

    try {
        // Resolve roundId: Check for 'current'/'active' or parse integer
        if (roundIdParam.toLowerCase() === 'current' || roundIdParam.toLowerCase() === 'active') {
            console.log(`User ${userId} requesting predictions for current/active round`);
            resolvedRound = await prisma.round.findFirst({
                where: { status: 'OPEN' }, // Assuming 'OPEN' is the active status
                orderBy: { deadline: 'asc' }, // Get the one with the soonest deadline if multiple open?
                select: { roundId: true, name: true, status: true }
            });
            if (resolvedRound) {
                targetRoundId = resolvedRound.roundId;
                console.log(`Resolved active round to ID: ${targetRoundId}`);
            } else {
                console.log(`No active/open round found for user ${userId}`);
                // Return empty results if no active round exists
                 return res.status(200).json({
                    roundInfo: null, // Indicate no specific round found
                    predictions: []
                });
            }
        } else {
            targetRoundId = parseInt(roundIdParam, 10);
            if (isNaN(targetRoundId) || targetRoundId <= 0) {
                return res.status(400).json({ message: 'Invalid Round ID parameter.' });
            }
            console.log(`User ${userId} requesting predictions for specific round ID: ${targetRoundId}`);
            // Fetch specific round info
            resolvedRound = await prisma.round.findUnique({
                where: { roundId: targetRoundId },
                select: { roundId: true, name: true, status: true }
            });
        }

        // Check if the resolved round exists
        if (!resolvedRound) {
            // If specific ID was requested and not found
            if (!isNaN(parseInt(roundIdParam, 10))) {
                 return res.status(404).json({ message: 'Round not found.' });
            }
            // If 'current' was requested but somehow resolvedRound is null (should have been handled above)
             return res.status(404).json({ message: 'Active round could not be determined.' });
        }

        // Fetch user predictions for the target round
        const userPredictions = await prisma.prediction.findMany({
            where: {
                userId: userId,
                roundId: targetRoundId
            },
            select: {
                predictionId: true,
                fixtureId: true,
                predictedHomeGoals: true,
                predictedAwayGoals: true,
                isJoker: true,
                pointsAwarded: true,
                fixture: {
                    select: {
                        homeTeam: true,
                        awayTeam: true,
                        matchTime: true,
                        homeScore: true,
                        awayScore: true
                    }
                }
            },
            orderBy: {
                fixture: {
                    matchTime: 'asc' // Order by match time within the round
                }
            }
        });

        console.log(`Found ${userPredictions.length} predictions for user ${userId} in round ${targetRoundId}`);

        // Format and send response
        res.status(200).json({
            roundInfo: {
                roundId: resolvedRound.roundId,
                roundName: resolvedRound.name,
                status: resolvedRound.status
            },
            predictions: userPredictions
        });

    } catch (error) {
        console.error(`Error fetching predictions for user ${userId}, roundParam ${roundIdParam}:`, error);
        res.status(500).json({ message: "Failed to fetch user predictions." });
    }
};

module.exports = {
    getUserPredictionsForRound,
};