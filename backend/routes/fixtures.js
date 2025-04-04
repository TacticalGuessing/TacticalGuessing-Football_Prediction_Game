// backend/routes/fixtures.js
const express = require('express');
const db = require('../db'); // Assuming db.js exports query function or pool
const { protect, admin } = require('../middleware/authMiddleware'); // Import middleware

const router = express.Router();

/**
 * @route   PUT /api/fixtures/:fixtureId/result
 * @desc    Enter or update the result for a specific fixture
 * @access  Private/Admin
 */
router.put('/:fixtureId/result', protect, admin, async (req, res, next) => {
    const { fixtureId } = req.params;
    // --- >>> FIX: Expect camelCase from req.body <<< ---
    const { homeScore, awayScore } = req.body;

    // --- Validation ---
    const parsedFixtureId = parseInt(fixtureId, 10);
    if (isNaN(parsedFixtureId)) {
        return res.status(400).json({ message: 'Fixture ID must be an integer.' });
    }

    // --- >>> FIX: Use camelCase variables for parsing <<< ---
    const homeScoreInt = parseInt(homeScore, 10);
    const awayScoreInt = parseInt(awayScore, 10);

    // Validate scores using camelCase variables
    if (
        homeScore === undefined || // Check if camelCase key existed
        isNaN(homeScoreInt) ||
        // Optional stricter check: String(homeScore) !== String(homeScoreInt) || // Could fail if frontend sends number
        homeScoreInt < 0 ||
        awayScore === undefined || // Check if camelCase key existed
        isNaN(awayScoreInt) ||
        // Optional stricter check: String(awayScore) !== String(awayScoreInt) ||
        awayScoreInt < 0
       ) {
        // Updated error message slightly for clarity
        return res.status(400).json({ message: 'Home score and away score must be provided as valid non-negative integers.' });
    }
    // --- End Validation ---


    try {
        // Optional: Add a check here to see if the round associated with this fixture is 'CLOSED' or 'COMPLETED'
        /*
        const fixtureCheck = await db.query(
            `SELECT r.status
             FROM fixtures f
             JOIN rounds r ON f.round_id = r.round_id
             WHERE f.fixture_id = $1`,
            [parsedFixtureId]
        );

        if (fixtureCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Fixture not found.' });
        }

        const roundStatus = fixtureCheck.rows[0].status;
        if (roundStatus !== 'CLOSED' && roundStatus !== 'COMPLETED') {
             return res.status(400).json({ message: `Cannot enter results for a fixture in a round with status '${roundStatus}'. Round must be CLOSED or COMPLETED.` });
        }
        */

        // Update the fixture using DB column names (snake_case)
        const updateQuery = `
            UPDATE fixtures
            SET home_score = $1, away_score = $2
            WHERE fixture_id = $3
            RETURNING *; -- Return the updated fixture row (uses DB column names)
        `;
        // Use the validated integer values
        const values = [homeScoreInt, awayScoreInt, parsedFixtureId];

        const result = await db.query(updateQuery, values);

        if (result.rows.length === 0) {
            // Fixture with the given ID wasn't found
            return res.status(404).json({ message: 'Fixture not found.' });
        }

        // Respond with the updated fixture data (using DB snake_case column names)
        // Frontend api.ts function enterFixtureResult can map this if needed
        res.status(200).json(result.rows[0]);

    } catch (error) {
        console.error(`Error updating result for fixture ${parsedFixtureId}:`, error);
        next(error); // Pass to global error handler
    }
});

// Other potential fixture-related routes can be added here later

module.exports = router;