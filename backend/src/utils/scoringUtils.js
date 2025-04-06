// backend/src/utils/scoringUtils.js

function calculatePoints(prediction, actualResult) {
    const { predicted_home_goals, predicted_away_goals, is_joker } = prediction;
    const { home_score, away_score } = actualResult;

    // --- MODIFIED VALIDATION ---
    // Check for null explicitly FIRST, before checking number properties
    if (
        predicted_home_goals === null || predicted_away_goals === null ||
        home_score === null || away_score === null
    ) {
        return 0; // Return 0 if any essential score is missing
    }

    // Now convert to numbers
    const predHome = Number(predicted_home_goals);
    const predAway = Number(predicted_away_goals);
    const actualHome = Number(home_score);
    const actualAway = Number(away_score);

    // Check if conversion resulted in NaN or if scores are negative
    if (
        isNaN(predHome) || isNaN(predAway) || isNaN(actualHome) || isNaN(actualAway) ||
        predHome < 0 || predAway < 0 || actualHome < 0 || actualAway < 0
    ) {
        // Log only if it wasn't caught by the null check but is still invalid
        console.error("Invalid non-numeric score detected after null check:", prediction, actualResult);
        return 0;
    }
    // --- END MODIFIED VALIDATION ---


    let basePoints = 0;

    // Rule 1: Exact Score Match
    if (predHome === actualHome && predAway === actualAway) {
        basePoints = 3;
    } else {
        // Rule 2: Correct Outcome Match
        const predictedOutcome = predHome > predAway ? 'H' : (predHome < predAway ? 'A' : 'D');
        const actualOutcome = actualHome > actualAway ? 'H' : (actualHome < actualAway ? 'A' : 'D');

        if (predictedOutcome === actualOutcome) {
            basePoints = 1;
        }
    }

    // Apply Joker Bonus
    const finalPoints = is_joker === true ? basePoints * 2 : basePoints;
    return finalPoints;
}

module.exports = {
    calculatePoints,
};