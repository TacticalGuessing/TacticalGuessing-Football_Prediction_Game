// backend/src/controllers/adminRoundController.js
const prisma = require('../db.ts').default; // Correct path to Prisma client
const { Prisma } = require('@prisma/client');
const axios = require('axios');
const asyncHandler = require('express-async-handler');

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

/**
 * @desc    Fetch latest results for unfinished fixtures in a round from external API
 * @route   POST /api/admin/rounds/:roundId/fetch-results
 * @access  Private/Admin
 */
const fetchRoundResults = asyncHandler(async (req, res) => {
    const { roundId } = req.params;
    const parsedRoundId = parseInt(roundId);
    // ... (validation, logging) ...

    // 1. Get round details and UNFINISHED fixtures WITH EXTERNAL IDs
    const localUnfinishedFixtures = await prisma.fixture.findMany({
         where: {
             roundId: parsedRoundId,
             status: { not: 'FINISHED' },
             matchTime: { lt: new Date() },
             externalId: { not: null } // <<< Only fetch those with an external ID
         },
         select: {
             fixtureId: true,
             externalId: true, // <<< Select externalId >>>
             homeTeam: true,   // Still useful for logging/context
             awayTeam: true
         }
    });

    if (localUnfinishedFixtures.length === 0) {
        //console.log(`[FETCH RESULTS] No unfinished past fixtures with external IDs found for round ${parsedRoundId}.`);
        res.status(200).json({ message: 'No pending fixtures with external IDs found needing results.', updatedCount: 0 });
        return;
    }

    const externalIdsToCheck = localUnfinishedFixtures.map(f => f.externalId);
    //console.log(`[FETCH RESULTS] Found ${localUnfinishedFixtures.length} unfinished fixtures with external IDs to check:`, externalIdsToCheck);

    // 2. Fetch results from Football-Data.org BY IDs
    const apiKey = process.env.FOOTBALL_DATA_API_KEY;
    if (!apiKey) { /* ... handle missing key ... */ }

    const externalApiUrl = `https://api.football-data.org/v4/matches`;
    //console.log(`[FETCH RESULTS] Querying external API for match IDs: ${externalIdsToCheck.join(',')}...`);

    let externalMatches = [];
    try {
        const response = await axios.get(externalApiUrl, {
            headers: { 'X-Auth-Token': apiKey },
            params: {
                // <<< Use the 'ids' parameter >>>
                ids: externalIdsToCheck.join(',')
            }
        });
        // The response for multiple IDs is still under the "matches" key
        externalMatches = response.data?.matches || [];
        //console.log(`[FETCH RESULTS] External API returned ${externalMatches.length} matches for the requested IDs.`);
    } catch (apiErr) { /* ... handle API errors ... */ }

    // 3. Process and Update Local Fixtures
    let updatedCount = 0;
    const updatePromises = [];

    // Map external results by their ID for quick lookup
    const externalResultsMap = new Map();
    externalMatches.forEach(match => {
        if (match && match.id && match.status === 'FINISHED' && match.score?.fullTime) { // Ensure needed data exists
             externalResultsMap.set(match.id, match);
        }
    });

    for (const localFixture of localUnfinishedFixtures) {
         // Find matching external result using externalId
         const externalMatch = externalResultsMap.get(localFixture.externalId); // Match using the ID

        // Check if a FINISHED match was found for this externalId
        if (externalMatch) {
            const homeScore = externalMatch.score.fullTime.home;
            const awayScore = externalMatch.score.fullTime.away;

            if (typeof homeScore === 'number' && typeof awayScore === 'number') {
                //console.log(`  [FETCH RESULTS] Updating Fixture ID ${localFixture.fixtureId} (External: ${localFixture.externalId}) with result: ${homeScore}-${awayScore}`);
                updatePromises.push(prisma.fixture.update({
                    where: { fixtureId: localFixture.fixtureId },
                    data: {
                        homeScore: homeScore,
                        awayScore: awayScore,
                        status: 'FINISHED'
                    }
                }));
                updatedCount++;
            } else {
                 console.warn(`  [FETCH RESULTS] Found finished match for External ID ${localFixture.externalId} but scores were invalid:`, externalMatch.score.fullTime);
            }
        } else {
             //console.log(`  [FETCH RESULTS] No FINISHED result found on external API for External ID ${localFixture.externalId} yet.`);
        }
    }

    // Execute updates if any
    if (updatePromises.length > 0) {
        // <<< LOG BEFORE TRANSACTION >>>
        //console.log(`[FETCH RESULTS] Attempting to execute ${updatePromises.length} fixture updates via transaction...`);
       try {
           // Use transaction for atomicity
           // <<< Is this using Prisma client or pg client? Need consistency! >>>
           // Assuming Prisma:
           await prisma.$transaction(updatePromises);
           // Assuming pg pool client (less likely if using Prisma elsewhere):
           // await client.query('BEGIN'); // Already inside a transaction? No, fetch results is separate.
           // await Promise.all(updatePromises.map(p => client.query(p.text, p.values))); // If promises were {text, values}
           // await client.query('COMMIT');

           // <<< LOG AFTER TRANSACTION >>>
           console.log(`[FETCH RESULTS] Database updates transaction seemingly successful.`);
       } catch (dbError) {
           // <<< LOG DB ERROR >>>
           //console.error(`[FETCH RESULTS] Error updating fixtures in database during transaction:`, dbError);
           // Don't throw here, maybe just report partial success? Or throw specific error?
           // Let the error propagate up if needed, or adjust response message.
           // For now, re-throwing to ensure client knows something went wrong
           throw new Error('Failed to save updated results to database.');
       }
   }
    else { console.log(`[FETCH RESULTS] No matching finished results found on external API requiring local update.`); }

    res.status(200).json({ message: `Result fetch complete. ${updatedCount} fixtures updated.`, updatedCount: updatedCount });
});
// --- Add other Admin Round Management functions here later if needed ---
// e.g., function to list all rounds for admin, update round details, etc.


// --- Export module ---
module.exports = {
    getPredictionStatusForRound,
    fetchRoundResults
    // Export other functions as you add them
};