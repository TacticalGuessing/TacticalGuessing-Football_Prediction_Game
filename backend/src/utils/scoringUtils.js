// backend/src/utils/scoringUtils.js

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

module.exports = {
    calculatePoints,
};