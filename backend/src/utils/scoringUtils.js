// backend/src/utils/scoringUtils.js

const prisma = require('../db.ts').default;
const { Prisma } = require('@prisma/client');

// calculatePoints function (remains the same as you provided)
function calculatePoints(prediction, actualResult) {
    // ... (Your existing implementation) ...
     // Destructure prediction fields (make sure these match DB columns: snake_case)
     const { predicted_home_goals, predicted_away_goals, is_joker } = prediction;
     // Destructure actual result fields (make sure these match DB columns: snake_case)
     const { home_score, away_score } = actualResult;

     // --- Input Validation ---
     if ( predicted_home_goals === null || predicted_away_goals === null || home_score === null || away_score === null ) {
         return 0;
     }
     const predHome = Number(predicted_home_goals);
     const predAway = Number(predicted_away_goals);
     const actualHome = Number(home_score);
     const actualAway = Number(away_score);
     if ( isNaN(predHome) || isNaN(predAway) || isNaN(actualHome) || isNaN(actualAway) || predHome < 0 || predAway < 0 || actualHome < 0 || actualAway < 0 ) {
         console.error("[calculatePoints] Invalid score values:", { prediction, actualResult });
         return 0;
     }
     // --- End Input Validation ---

     // --- Calculate Base Points ---
     let basePoints = 0;
     if (predHome === actualHome && predAway === actualAway) { // Exact Score
         basePoints = 3;
     } else { // Check Outcome
         const predictedOutcome = predHome > predAway ? 'H' : (predHome < predAway ? 'A' : 'D');
         const actualOutcome = actualHome > actualAway ? 'H' : (actualHome < actualAway ? 'A' : 'D');
         if (predictedOutcome === actualOutcome) {
             basePoints = 1;
         }
     }
     // --- End Calculate Base Points ---

     // --- Apply Joker Bonus ---
     const finalPoints = (is_joker === true && basePoints > 0) ? (basePoints * 2) : basePoints;
     // --- End Apply Joker Bonus ---

     // Make sure this return statement is the very last line inside the function
     return finalPoints;
 }

// Helper function to get result outcome string (remains the same)
function getResultString(home, away) {
    if (home === null || away === null) return null;
    if (home > away) return 'H';
    if (away > home) return 'A';
    return 'D';
}


// --- Enhanced calculateStandings Function ---
async function calculateStandings(roundId = null, filterUserIds = null) {
    console.log(`Calculating enhanced standings: ${roundId !== null ? `for round ${roundId}` : 'overall'}... ${filterUserIds ? `Filtering for ${filterUserIds.length} users.` : ''}`);
    try {
        // --- Prepare Base Where Clause ---
        const predictionWhereClause = {
            // Only include points from COMPLETED rounds with actual scores entered
            round: { status: 'COMPLETED' },
            fixture: { homeScore: { not: null }, awayScore: { not: null } },
            // Only include PLAYER roles in standings
            user: { role: 'PLAYER' }
        };
        // Apply round filter if provided
        if (roundId !== null) {
            predictionWhereClause.roundId = roundId;
        }
        // Apply user filter if provided
        if (filterUserIds && filterUserIds.length > 0) {
            predictionWhereClause.userId = { in: filterUserIds };
        } else if (filterUserIds && filterUserIds.length === 0) {
            // If filtering for an empty list of users, return empty array immediately
            return [];
        }

        // 1. Fetch all necessary predictions for the filtered scope
        const userPredictions = await prisma.prediction.findMany({
            where: predictionWhereClause,
            select: {
                userId: true,
                roundId: true, // <<< Need roundId for per-round aggregation
                predictedHomeGoals: true,
                predictedAwayGoals: true,
                pointsAwarded: true,
                isJoker: true, // <<< Need isJoker
                fixture: {
                    select: {
                        homeScore: true,
                        awayScore: true
                    }
                }
            }
        });

        // If no predictions found for the scope, return empty array
        if (userPredictions.length === 0) {
            console.log("No relevant predictions found for standings calculation.");
            return [];
        }

        // Get the set of user IDs who actually made predictions in this scope
        const participatingUserIds = [...new Set(userPredictions.map(p => p.userId))];

        // 2. Fetch relevant player details for those participants
        const relevantPlayers = await prisma.user.findMany({
            where: {
                userId: { in: participatingUserIds }
                // No need to filter by role again, predictionWhereClause already did
            },
            select: { userId: true, name: true, avatarUrl: true, teamName: true }
        });

        // Create a map for quick player lookup
        const playerMap = new Map(relevantPlayers.map(p => [p.userId, p]));

        // 3. Process predictions & aggregate stats per user
        const userStatsAgg = {};

        userPredictions.forEach(p => {
            const userId = p.userId;
            const roundId = p.roundId;
            const points = p.pointsAwarded ?? 0;

            // Initialize user stats if not present
            if (!userStatsAgg[userId]) {
                userStatsAgg[userId] = {
                    points: 0,
                    totalPredictions: 0,
                    correctOutcomes: 0,
                    exactScores: 0,
                    successfulJokers: 0,
                    pointsPerRound: {},
                };
            }

            // Aggregate overall stats
            userStatsAgg[userId].points += points;
            userStatsAgg[userId].totalPredictions += 1;

            // Aggregate accuracy stats
            const actualResult = getResultString(p.fixture.homeScore, p.fixture.awayScore);
            const predictedResult = getResultString(p.predictedHomeGoals, p.predictedAwayGoals);
            if (actualResult !== null && predictedResult === actualResult) {
                userStatsAgg[userId].correctOutcomes += 1;
            }
            // Check for exact score (points === 3 assumes base points before joker)
            // A more robust check might be direct score comparison if calculatePoints changes
            if (p.predictedHomeGoals === p.fixture.homeScore && p.predictedAwayGoals === p.fixture.awayScore) {
                 userStatsAgg[userId].exactScores += 1;
            }

            // Aggregate successful jokers
            if (p.isJoker === true && points > 0) {
                userStatsAgg[userId].successfulJokers += 1;
            }

            // Aggregate points per round
            userStatsAgg[userId].pointsPerRound[roundId] = (userStatsAgg[userId].pointsPerRound[roundId] || 0) + points;
        });

        // 4. Combine player info with aggregated stats and calculate derived stats
        const standingsArray = Object.entries(userStatsAgg).map(([userIdStr, stats]) => {
            const userId = parseInt(userIdStr, 10);
            const playerInfo = playerMap.get(userId);

            const roundsPlayed = Object.keys(stats.pointsPerRound).length;
            const averagePointsPerRound = roundsPlayed > 0 ? parseFloat((stats.points / roundsPlayed).toFixed(1)) : 0;
            const accuracy = stats.totalPredictions > 0 ? parseFloat(((stats.correctOutcomes / stats.totalPredictions) * 100).toFixed(1)) : null;
            const bestRoundScore = roundsPlayed > 0 ? Math.max(...Object.values(stats.pointsPerRound)) : 0;

            return {
                userId: userId,
                name: playerInfo?.name ?? 'Unknown User', // Use name from playerMap
                teamName: playerInfo?.teamName ?? null, // Use teamName from playerMap
                avatarUrl: playerInfo?.avatarUrl ?? null, // Use avatarUrl from playerMap
                points: stats.points,
                totalPredictions: stats.totalPredictions,
                correctOutcomes: stats.correctOutcomes,
                exactScores: stats.exactScores, // Use aggregated exactScores
                accuracy: accuracy,
                averagePointsPerRound: averagePointsPerRound, // ADDED
                roundsPlayed: roundsPlayed,                   // ADDED
                bestRoundScore: bestRoundScore,               // ADDED
                totalSuccessfulJokers: stats.successfulJokers // ADDED
            };
        });

        // 5. Sort by points (desc), then by name (asc)
        standingsArray.sort((a, b) => {
             if (b.points !== a.points) return b.points - a.points;
             // Add tie-breakers if needed (e.g., exact scores, accuracy)
             if (b.exactScores !== a.exactScores) return b.exactScores - a.exactScores; // Example tie-breaker
             return a.name.localeCompare(b.name); // Final tie-breaker
        });

        // 6. Assign Rank (handling ties)
        let currentRank = 0;
        let lastPoints = -Infinity;
        let lastExactScores = -Infinity; // Include tie-breaker in rank assignment
        const rankedStandings = standingsArray.map((player, index) => {
             // Rank changes if points OR exact scores differ from the previous player
             if (player.points !== lastPoints || player.exactScores !== lastExactScores) {
                 currentRank = index + 1;
                 lastPoints = player.points;
                 lastExactScores = player.exactScores;
             }
             return {
                 ...player, // Spread all calculated stats
                 rank: currentRank,
                 movement: 0, // Movement calculation requires previous round data - keep as 0 for now
             };
         });

        console.log(`Calculated enhanced standings: Returning ${rankedStandings.length} players.`);
        return rankedStandings; // Contains all data needed for player cards

    } catch (error) {
        console.error("Error calculating enhanced standings:", error);
        // Re-throw a more specific error or handle as needed
        throw new Error('Failed to calculate standings.');
    }
}
// --- END Enhanced calculateStandings ---

// --- Update Exports ---
module.exports = {
    calculatePoints,
    calculateStandings, // Export the enhanced function
};