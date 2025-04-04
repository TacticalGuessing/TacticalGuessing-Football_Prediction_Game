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
        homeScoreInt < 0 ||
        awayScore === undefined || // Check if camelCase key existed
        isNaN(awayScoreInt) ||
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
        // Also update status to 'FINISHED'
        const updateQuery = `
            UPDATE fixtures
            SET home_score = $1, away_score = $2, status = 'FINISHED'
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
}); // <<< Closing bracket for the PUT route handler


// --- NEW DELETE FIXTURE ROUTE ---
// *** ENSURE THIS IS SEPARATE FROM THE PUT ROUTE ABOVE ***
router.delete('/:fixtureId', protect, admin, async (req, res, next) => {
    const { fixtureId } = req.params;
    const parsedFixtureId = parseInt(fixtureId, 10);

    console.log(`Attempting to delete fixture ID: ${parsedFixtureId}`); // Log entry

    if (isNaN(parsedFixtureId)) {
        console.log('Delete failed: Invalid fixture ID format.');
        return res.status(400).json({ message: 'Fixture ID must be an integer.' });
    }

    const client = await db.pool.connect(); // Use pool for transaction

    try {
        await client.query('BEGIN');

        // 1. Delete associated predictions (handle potential orphans)
        const predictionDeleteResult = await client.query(
            'DELETE FROM predictions WHERE fixture_id = $1',
            [parsedFixtureId]
        );
        console.log(`Deleted ${predictionDeleteResult.rowCount} associated prediction(s) for fixture ${parsedFixtureId}.`);

        // 2. Delete the fixture itself
        const fixtureDeleteResult = await client.query(
            'DELETE FROM fixtures WHERE fixture_id = $1',
            [parsedFixtureId]
        );

        // 3. Check if the fixture was actually found and deleted
        if (fixtureDeleteResult.rowCount === 0) {
            await client.query('ROLLBACK'); // Rollback transaction
            console.log(`Delete failed: Fixture ID ${parsedFixtureId} not found.`);
            return res.status(404).json({ message: 'Fixture not found.' });
        }

        // 4. Commit the transaction
        await client.query('COMMIT');
        console.log(`Successfully deleted fixture ID ${parsedFixtureId} and associated predictions.`);

        // Send success response - 204 No Content is standard for successful DELETE
        res.status(204).send();

    } catch (error) {
        // Rollback transaction on any error
        await client.query('ROLLBACK');
        console.error(`Error deleting fixture ${parsedFixtureId}:`, error);
        next(error); // Pass error to global handler
    } finally {
        client.release(); // Release client back to pool
    }
});
// --- END DELETE FIXTURE ROUTE ---


// Other potential fixture-related routes can be added here later

module.exports = router;