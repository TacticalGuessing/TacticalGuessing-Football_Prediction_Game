// backend/routes/fixtures.js
const express = require('express');
const axios = require('axios'); // <<< Added axios import
const db = require('../db');
// <<< Ensure both 'protect' and 'admin' (or 'isAdmin') are imported >>>
// Assuming your authMiddleware exports an 'admin' function for checking role
const { protect, admin } = require('../middleware/authMiddleware');
// <<< If your admin middleware is separate, import it instead: >>>
// const { isAdmin } = require('../middleware/adminMiddleware');
// <<< *** USE 'admin' OR 'isAdmin' below CONSISTENTLY based on your import *** >>>

const router = express.Router();

/**
 * @route   PUT /api/fixtures/:fixtureId/result
 * @desc    Enter or update the result for a specific fixture
 * @access  Private/Admin
 */
// <<< Using 'admin' from authMiddleware based on your original code >>>
router.put('/:fixtureId/result', protect, admin, async (req, res, next) => {
    const { fixtureId } = req.params;
    const { homeScore, awayScore } = req.body; // Expect camelCase

    // --- Validation ---
    const parsedFixtureId = parseInt(fixtureId, 10);
    if (isNaN(parsedFixtureId)) { /* ... */ }
    const homeScoreInt = parseInt(homeScore, 10);
    const awayScoreInt = parseInt(awayScore, 10);
    if ( homeScore === undefined || isNaN(homeScoreInt) || homeScoreInt < 0 ||
         awayScore === undefined || isNaN(awayScoreInt) || awayScoreInt < 0 ) {
       return res.status(400).json({ message: 'Home score and away score must be provided as valid non-negative integers.' });
    }
    // --- End Validation ---

    try {
        const updateQuery = `
            UPDATE fixtures SET home_score = $1, away_score = $2, status = 'FINISHED'
            WHERE fixture_id = $3 RETURNING *;
        `;
        const values = [homeScoreInt, awayScoreInt, parsedFixtureId];
        const result = await db.query(updateQuery, values); // <<< Assuming db.query handles connection pooling

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Fixture not found.' });
        }
        res.status(200).json(result.rows[0]); // Respond with DB snake_case

    } catch (error) {
        console.error(`Error updating result for fixture ${parsedFixtureId}:`, error);
        next(error);
    }
});


/**
 * @route   DELETE /api/fixtures/:fixtureId
 * @desc    Delete a fixture and its associated predictions
 * @access  Private/Admin
 */
// <<< Using 'admin' from authMiddleware based on your original code >>>
router.delete('/:fixtureId', protect, admin, async (req, res, next) => {
    const { fixtureId } = req.params;
    const parsedFixtureId = parseInt(fixtureId, 10);
    //console.log(`Attempting to delete fixture ID: ${parsedFixtureId}`);

    if (isNaN(parsedFixtureId)) { /* ... */ }

    // Use client from pool for transaction
    // <<< Adapt based on how your db object provides clients >>>
    const getClient = db.getClient || (() => db.pool.connect());
    const client = await getClient();

    try {
        await client.query('BEGIN');
        const predictionDeleteResult = await client.query('DELETE FROM predictions WHERE fixture_id = $1', [parsedFixtureId]);
        //console.log(`Deleted ${predictionDeleteResult.rowCount} prediction(s) for fixture ${parsedFixtureId}.`);
        const fixtureDeleteResult = await client.query('DELETE FROM fixtures WHERE fixture_id = $1', [parsedFixtureId]);
        if (fixtureDeleteResult.rowCount === 0) {
            await client.query('ROLLBACK');
            //console.log(`Delete failed: Fixture ID ${parsedFixtureId} not found.`);
            return res.status(404).json({ message: 'Fixture not found.' });
        }
        await client.query('COMMIT');
        //console.log(`Successfully deleted fixture ID ${parsedFixtureId} and associated predictions.`);
        res.status(204).send();

    } catch (error) {
        if (client && !client._ending) { // Check _ending property if using pg Pool client
            try { await client.query('ROLLBACK'); } catch (rollbackError) { console.error('Error during ROLLBACK:', rollbackError); }
        }
        console.error(`Error deleting fixture ${parsedFixtureId}:`, error);
        next(error);
    } finally {
        if (client) { client.release(); }
    }
});


// =======================================================================
// ===== NEW ROUTE: Fetch Potential Fixtures by Date Range =============
// =======================================================================
/**
 * @route   POST /api/fixtures/fetch-external
 * @desc    Fetch potential fixtures from football-data.org based on filters
 * @access  Private (Admin only)
 */
// <<< Using 'admin' from authMiddleware based on your original code >>>
router.post('/fetch-external', protect, admin, async (req, res, next) => {
    const { competitionCode, dateFrom, dateTo } = req.body;

    // --- Input Validation ---
    if (!competitionCode || !dateFrom || !dateTo) {
        return res.status(400).json({ message: 'Competition code, start date, and end date are required.' });
    }
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateFrom) || !dateRegex.test(dateTo)) {
         return res.status(400).json({ message: 'Dates must be in YYYY-MM-DD format.' });
    }
    // --- End Validation ---

    const externalApiUrl = 'https://api.football-data.org/v4/matches';
    const apiToken = process.env.FOOTBALL_DATA_API_KEY;

    if (!apiToken) {
        console.error("Security Error: FOOTBALL_DATA_API_KEY is not set in environment variables.");
        return res.status(500).json({ message: 'Server configuration error: Missing external API token.' });
    }

    //console.log(`[API /fixtures/fetch-external] Fetching matches for ${competitionCode} from ${dateFrom} to ${dateTo}`);

    try {
        const response = await axios.get(externalApiUrl, {
            headers: { 'X-Auth-Token': apiToken },
            params: {
                competitions: competitionCode,
                dateFrom: dateFrom,
                dateTo: dateTo,
                // status: 'SCHEDULED,TIMED' // Optional: Consider if you want only upcoming
            }
        });

        if (!response.data || !Array.isArray(response.data.matches)) {
             console.error(`[API /fixtures/fetch-external] Unexpected response structure from football-data.org for ${competitionCode}:`, response.data);
             throw new Error('Received invalid data structure from external API.');
        }

        // Map response to desired frontend format (camelCase)
        const potentialFixtures = response.data.matches.map(match => {
             if (!match || !match.homeTeam || !match.awayTeam || !match.utcDate || !match.id) {
                 console.warn(`[API /fixtures/fetch-external] Skipping match due to missing data: ${JSON.stringify(match)}`);
                 return null;
             }
             return {
                 externalId: match.id,
                 homeTeam: match.homeTeam.name || 'N/A',
                 awayTeam: match.awayTeam.name || 'N/A',
                 matchTime: match.utcDate, // ISO string
             };
        }).filter(fixture => fixture !== null);

        //console.log(`[API /fixtures/fetch-external] Found ${potentialFixtures.length} potential fixtures for ${competitionCode}.`);
        res.status(200).json(potentialFixtures);

    } catch (error) {
        console.error(`[API /fixtures/fetch-external] Error fetching from football-data.org for ${competitionCode}:`, error.response?.data || error.message);
        let status = 500;
        let message = 'Failed to fetch fixtures from external source.';
        if (error.response) {
             status = error.response.status === 403 ? 403 : error.response.status === 404 ? 404 : 500;
             message = error.response.data?.message || message;
             if (status === 403) message = 'Access denied by external API (check API token or plan limits).'
             if (status === 404) message = 'Competition code not found or no matches in date range from external source.'
        }
        res.status(status).json({ message });
    }
});
// =======================================================================


module.exports = router;