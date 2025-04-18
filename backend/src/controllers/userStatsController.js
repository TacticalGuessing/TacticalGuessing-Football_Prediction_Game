// backend/src/controllers/userStatsController.js
const prisma = require('../db.ts').default; // Adjust path if needed, uses .default for TS default export
const { Prisma } = require('@prisma/client');

/**
 * Helper function to determine prediction outcome compared to actual result
 * @param {object} prediction - Prediction object with predictedHomeGoals, predictedAwayGoals
 * @param {object} fixture - Fixture object with homeScore, awayScore
 * @returns {'CORRECT_OUTCOME' | 'INCORRECT_OUTCOME' | null} - Null if fixture result is missing
 */
function getPredictionOutcome(prediction, fixture) {
    const { predictedHomeGoals, predictedAwayGoals } = prediction;
    const { homeScore, awayScore } = fixture;

    // Cannot determine outcome if actual scores are missing
    if (homeScore === null || awayScore === null) {
        return null;
    }

    const predictedResult = predictedHomeGoals > predictedAwayGoals ? 'H' : (predictedHomeGoals < predictedAwayGoals ? 'A' : 'D');
    const actualResult = homeScore > awayScore ? 'H' : (homeScore < awayScore ? 'A' : 'D');

    return predictedResult === actualResult ? 'CORRECT_OUTCOME' : 'INCORRECT_OUTCOME';
}


/**
 * @desc    Get prediction statistics for the logged-in user
 * @route   GET /api/users/me/stats/predictions
 * @access  Private
 */
const getUserPredictionStats = async (req, res) => {
    // Ensure req.user exists (from protect middleware)
    if (!req.user || typeof req.user.userId === 'undefined') {
        console.error("User not found in request for stats");
        return res.status(401).json({ message: 'Not authorized, user data missing' });
    }
    const userId = req.user.userId;
    console.log(`Fetching prediction stats for user ${userId}`);

    try {
        // 1. Fetch all COMPLETED predictions for the user, including fixture and round details
        const userPredictions = await prisma.prediction.findMany({
            where: {
                userId: userId,
                round: {
                    status: 'COMPLETED' // Only consider completed rounds for stats
                },
                // Ensure fixture results are available to calculate accuracy
                fixture: {
                    homeScore: { not: null },
                    awayScore: { not: null }
                }
            },
            include: {
                fixture: { // Need actual scores
                    select: { homeScore: true, awayScore: true }
                },
                round: { // Need round info for grouping and naming
                    select: { roundId: true, name: true }
                }
            },
            orderBy: [
                { roundId: 'asc' },
                { submittedAt: 'asc' } // Or fixture: { matchTime: 'asc' } if preferred
            ]
        });

        console.log(`Found ${userPredictions.length} completed predictions with results for user ${userId}`);

        // Initialize stats
        let overallAccuracy = 0;
        let averagePointsPerRound = 0;
        let bestRound = null;
        const pointsPerRoundHistory = [];
        let totalPointsSum = 0;
        let correctOutcomeCount = 0;
        const roundPointsMap = new Map(); // Map<roundId, { name: string, points: number }>

        // 2. Process predictions if any exist
        if (userPredictions.length > 0) {
            let completedPredictionsCount = 0; // Count only those where outcome could be determined

            userPredictions.forEach(p => {
                // Calculate points per round
                const currentRoundPoints = roundPointsMap.get(p.roundId) || { name: p.round.name, points: 0 };
                currentRoundPoints.points += (p.pointsAwarded ?? 0); // Sum points (handle null)
                roundPointsMap.set(p.roundId, currentRoundPoints);

                // Calculate accuracy
                const outcome = getPredictionOutcome(p, p.fixture);
                if (outcome !== null) { // Only count if outcome is determinable
                    completedPredictionsCount++;
                    if (outcome === 'CORRECT_OUTCOME') {
                        correctOutcomeCount++;
                    }
                }
            });

            // Finalize Accuracy
            if (completedPredictionsCount > 0) {
                overallAccuracy = correctOutcomeCount / completedPredictionsCount;
            }

            // Finalize Points History & Best Round
            let bestRoundPoints = -1;
            roundPointsMap.forEach((roundData, roundId) => {
                const roundInfo = {
                    roundId: roundId,
                    roundName: roundData.name,
                    points: roundData.points
                };
                pointsPerRoundHistory.push(roundInfo);
                totalPointsSum += roundData.points;

                if (roundData.points > bestRoundPoints) {
                    bestRoundPoints = roundData.points;
                    bestRound = roundInfo; // Store the best round info object
                }
            });

            // Sort history by roundId for the chart
            pointsPerRoundHistory.sort((a, b) => a.roundId - b.roundId);

            // Finalize Average Points
            if (roundPointsMap.size > 0) {
                averagePointsPerRound = totalPointsSum / roundPointsMap.size;
            }
        }

        // 3. Format and Send Response
        res.status(200).json({
            overallAccuracy: parseFloat(overallAccuracy.toFixed(2)), // Format to 2 decimal places
            averagePointsPerRound: parseFloat(averagePointsPerRound.toFixed(1)), // Format to 1 decimal place
            bestRound: bestRound, // This will be the object or null
            pointsPerRoundHistory: pointsPerRoundHistory // Array of objects
        });

    } catch (error) {
        console.error(`Error fetching prediction stats for user ${userId}:`, error);
        res.status(500).json({ message: "Failed to fetch user prediction statistics." });
    }
};

// --- Export module ---
module.exports = {
    getUserPredictionStats,
};