// backend/src/utils/scoringUtils.js

const prisma = require('../db.ts').default; // Adjust path if needed
const { Prisma } = require('@prisma/client'); // Keep if needed

/**
 * Calculates the points awarded for a single prediction based on the actual result.
 * - Exact Score: 3 base points
 * - Correct Outcome (Win/Draw/Loss): 1 base point
 * - Joker: Doubles the base points IF base points > 0.
 *
 * @param {object} prediction - The user's prediction object. Expected properties:
 *                              predicted_home_goals (number | null),
 *                              predicted_away_goals (number | null),
 *                              is_joker (boolean)
 * @param {object} actualResult - The actual fixture result object. Expected properties:
 *                                home_score (number | null),
 *                                away_score (number | null)
 * @returns {number} The calculated points (integer).
 */
function calculatePoints(prediction, actualResult) {
    // Destructure prediction fields including is_joker
    const { predicted_home_goals, predicted_away_goals, is_joker } = prediction;
    // Destructure actual result fields
    const { home_score, away_score } = actualResult;

    // --- Input Validation ---
    // Ensure all necessary score values are present and non-null
    if (
        predicted_home_goals === null || predicted_away_goals === null ||
        home_score === null || away_score === null
    ) {
        // If any required score is missing (e.g., prediction not made, or result not entered), award 0 points.
        return 0;
    }

    // Convert scores to numbers for comparison
    const predHome = Number(predicted_home_goals);
    const predAway = Number(predicted_away_goals);
    const actualHome = Number(home_score);
    const actualAway = Number(away_score);

    // Further validation: Ensure scores are valid non-negative numbers after conversion
    if (
        isNaN(predHome) || isNaN(predAway) || isNaN(actualHome) || isNaN(actualAway) ||
        predHome < 0 || predAway < 0 || actualHome < 0 || actualAway < 0
    ) {
        // Log an error if scores are invalid (e.g., negative numbers, non-numeric strings passed validation)
        console.error("Invalid score values encountered during point calculation:", { prediction, actualResult });
        return 0; // Award 0 points for invalid data
    }
    // --- End Input Validation ---

    // --- Calculate Base Points ---
    let basePoints = 0;

    // Rule 1: Exact Score Match
    if (predHome === actualHome && predAway === actualAway) {
        basePoints = 3;
    } else {
        // Rule 2: Correct Outcome Match (if not an exact score match)
        const predictedOutcome = predHome > predAway ? 'H' : (predHome < predAway ? 'A' : 'D'); // Home win, Away win, Draw
        const actualOutcome = actualHome > actualAway ? 'H' : (actualHome < actualAway ? 'A' : 'D');

        if (predictedOutcome === actualOutcome) {
            basePoints = 1;
        }
        // Otherwise, basePoints remains 0 (incorrect outcome and not exact match)
    }
    // --- End Calculate Base Points ---


    // --- Apply Joker Bonus ---
    // Double the points ONLY if the joker was used AND base points were earned (i.e., prediction was correct in some way)
    const finalPoints = (is_joker === true && basePoints > 0) ? (basePoints * 2) : basePoints;
    // --- End Apply Joker Bonus ---

    return finalPoints; // Return the final calculated points
}

// --- Helper Function ---
// FIX: Remove TS type annotations from parameters/return if this is pure JS
function getResultString(home, away) { // Removed ': number | null' etc.
    if (home === null || away === null) return null;
    if (home > away) return 'H';
    if (away > home) return 'A';
    return 'D';
}
// --- End Helper ---


// --- Refactored calculateStandings Function ---
async function calculateStandings(roundId = null, filterUserIds = null) {
    console.log(`Calculating standings (Utils): ${roundId !== null ? `for round ${roundId}` : 'overall'}... ${filterUserIds ? `Filtering for ${filterUserIds.length} users.` : ''}`);
    try {
        // --- Prepare Base Where Clause ---
        // FIX 1: Remove ': any'
        let predictionWhereClause = {
            round: { status: 'COMPLETED' },
            fixture: { homeScore: { not: null }, awayScore: { not: null } },
            user: { role: 'PLAYER' }
        };
        if (roundId !== null) predictionWhereClause.roundId = roundId;
        if (filterUserIds && filterUserIds.length > 0) predictionWhereClause.userId = { in: filterUserIds };
        else if (filterUserIds && filterUserIds.length === 0) return [];

        // 1. Fetch predictions
        const userPredictions = await prisma.prediction.findMany({
            where: predictionWhereClause,
            select: { /* ... fields needed for stats ... */
                userId: true,
                predictedHomeGoals: true,
                predictedAwayGoals: true,
                pointsAwarded: true,
                fixture: { select: { homeScore: true, awayScore: true } },
            }
        });

        // 2. Fetch relevant players
         const relevantPlayers = await prisma.user.findMany({
            where: {
                userId: filterUserIds ? { in: filterUserIds } : undefined,
                role: 'PLAYER'
            },
            select: { userId: true, name: true, avatarUrl: true, teamName: true }
        });
         if (relevantPlayers.length === 0) return [];

        // 3. Process data per user - Initialize stats map
        // FIX 2: Remove <number, ...> from Map constructor
        const statsMap = new Map();
        relevantPlayers.forEach(p => { statsMap.set(p.userId, { ...p, points: 0, totalPredictions: 0, correctOutcomes: 0, exactScores: 0 }); });

        // 4. Iterate through predictions to calculate stats
        userPredictions.forEach(p => {
            const stats = statsMap.get(p.userId);
            if (stats) {
                stats.totalPredictions += 1;
                stats.points += (p.pointsAwarded ?? 0);
                // Use the JS-compatible helper
                const actualResult = getResultString(p.fixture.homeScore, p.fixture.awayScore);
                const predictedResult = getResultString(p.predictedHomeGoals, p.predictedAwayGoals);
                const predictedScore = `${p.predictedHomeGoals}-${p.predictedAwayGoals}`;
                const actualScore = `${p.fixture.homeScore}-${p.fixture.awayScore}`;
                if (actualResult !== null && predictedResult === actualResult) stats.correctOutcomes += 1;
                if (predictedScore === actualScore) stats.exactScores += 1;
            }
        });

        // 5. Convert map, calculate accuracy, sort, rank
        const standingsArray = Array.from(statsMap.values()).map(stats => ({
            ...stats,
            accuracy: stats.totalPredictions > 0 ? parseFloat(((stats.correctOutcomes / stats.totalPredictions) * 100).toFixed(1)) : null,
            exactScores: stats.exacts
        }));
        standingsArray.sort((a, b) => {
             if (b.points !== a.points) return b.points - a.points;
             return a.name.localeCompare(b.name);
        });

         let currentRank = 0;
         let lastPoints = -Infinity;
         const rankedStandings = standingsArray.map((player, index) => {
             if (player.points !== lastPoints) {
                 currentRank = index + 1;
                 lastPoints = player.points;
             }
             return {
                 userId: player.userId, name: player.name, teamName: player.teamName,
                 avatarUrl: player.avatarUrl, rank: currentRank, points: player.points,
                 movement: 0, totalPredictions: player.totalPredictions,
                 correctOutcomes: player.correctOutcomes, exactScores: player.exactScores,
                 accuracy: player.accuracy,
             };
         });

        console.log(`Calculated standings (Utils): Returning ${rankedStandings.length} players.`);
        return rankedStandings;

    } catch (error) {
        console.error(`Error in calculateStandings (Utils) (roundId: ${roundId}, filterUsers: ${filterUserIds?.length}):`, error);
        throw new Error('Failed to calculate standings.');
    }
}
// --- END calculateStandings ---

// Keep original calculatePoints function
function calculatePoints(prediction, actualResult) {
    // ... your existing function code ...
}


// --- Update Exports ---
module.exports = {
    calculatePoints, // Keep existing export
    calculateStandings, // Add new export
};