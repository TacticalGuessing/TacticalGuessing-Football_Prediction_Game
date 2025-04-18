// backend/src/controllers/dashboardController.js
//const prisma = require('../db.ts').default; // Adjust path: this goes from controllers up one level to src, then to db
const dbClient = require('../db.ts').default; // Renamed import
console.log("DB Client Initialized:", dbClient ? 'OK' : 'UNDEFINED'); // Log confirmation

const { Prisma } = require('@prisma/client'); // Import Prisma if needed for error types

/**
 * Calculates standings (either for a specific round or overall).
 * @param {number | null} roundId - The ID of the round, or null for overall standings.
 * @returns {Promise<Array<{ userId: number, name: string, avatarUrl: string | null, totalPoints: number, rank: number }>>} - Ranked list of players.
 */
async function calculateStandings(roundId = null) {
    console.log(`Calculating standings: ${roundId !== null ? `for round ${roundId}` : 'overall'}...`);
    try { // Add try...catch within helper for better isolation
        const pointsAggregation = await dbClient.prediction.groupBy({
            by: ['userId'],
            _sum: { pointsAwarded: true },
            where: {
                ...(roundId !== null && { roundId: roundId }),
                pointsAwarded: { not: null },
                user: { // Filter directly for PLAYER role in the related user
                    role: 'PLAYER'
                }
            },
            orderBy: { _sum: { pointsAwarded: 'desc' } },
        });

        const allPlayers = await dbClient.user.findMany({
            where: { role: 'PLAYER' },
            select: { userId: true, name: true, avatarUrl: true },
        });

        const playersWithPoints = allPlayers.map(player => {
            const pointsData = pointsAggregation.find(agg => agg.userId === player.userId);
            const totalPoints = pointsData?._sum?.pointsAwarded ?? 0;
            return { ...player, totalPoints: totalPoints };
        });

        playersWithPoints.sort((a, b) => b.totalPoints - a.totalPoints);

        let currentRank = 0;
        let lastTotalPoints = -1;
        const rankedPlayers = playersWithPoints.map((player, index) => {
            if (player.totalPoints !== lastTotalPoints) {
                currentRank = index + 1;
                lastTotalPoints = player.totalPoints;
            }
            return { ...player, rank: currentRank };
        });

        console.log(`Calculated standings: Found ${rankedPlayers.length} players.`);
        return rankedPlayers;
     } catch (error) {
         console.error(`Error in calculateStandings (roundId: ${roundId}):`, error);
         throw error; // Re-throw to be caught by the main handler
     }
}


/**
 * @desc    Get aggregated data for dashboard highlights
 * @route   GET /api/dashboard/highlights
 * @access  Private
 */
const getDashboardHighlights = async (req, res) => {
    // Ensure req.user exists and has userId (from protect middleware)
    if (!req.user || typeof req.user.userId === 'undefined') {
         console.error("User not found in request after protect middleware");
         return res.status(401).json({ message: 'Not authorized, user data missing' });
    }
     const userId = req.user.userId;

    try {
        let lastRoundHighlights = null;
        let userLastRoundStats = null;
        let overallLeader = null;

        const lastCompletedRound = await dbClient.round.findFirst({
            where: { status: 'COMPLETED' },
            orderBy: { roundId: 'desc' },
            select: { roundId: true, name: true }
        });

        // Use Promise.all to run calculations concurrently where possible
        const [overallStandings, lastRoundStandings] = await Promise.all([
            calculateStandings(), // Calculate overall standings
            lastCompletedRound ? calculateStandings(lastCompletedRound.roundId) : Promise.resolve([]), // Calculate last round standings only if a last round exists
        ]);


        // Process Overall Leader
        if (overallStandings.length > 0) {
            const leadingScore = overallStandings[0].totalPoints;
            const leaders = overallStandings
                .filter(u => u.totalPoints === leadingScore)
                .map(({ userId, name, avatarUrl, totalPoints }) => ({ userId, name, avatarUrl, totalPoints }));

            overallLeader = { leaders: leaders, leadingScore: leadingScore };
        }

        // Process Last Round Highlights (if applicable)
        if (lastCompletedRound && lastRoundStandings.length > 0) {
             const roundId = lastCompletedRound.roundId;
             const topScore = lastRoundStandings[0].totalPoints;
             const topScorers = lastRoundStandings
                 .filter(u => u.totalPoints === topScore)
                 .map(({ userId, name, avatarUrl, totalPoints }) => ({ userId, name, avatarUrl, score: totalPoints }));

            lastRoundHighlights = {
                roundId: roundId,
                roundName: lastCompletedRound.name,
                topScorers: topScorers
            };

            const userRankInfo = lastRoundStandings.find(u => u.userId === userId);
            if (userRankInfo) {
                userLastRoundStats = {
                    roundId: roundId,
                    score: userRankInfo.totalPoints,
                    rank: userRankInfo.rank
                };
            }
        }

        res.status(200).json({
            lastRoundHighlights,
            userLastRoundStats,
            overallLeader
        });

    } catch (error) {
        console.error("Error fetching dashboard highlights:", error);
        res.status(500).json({ message: "Failed to fetch dashboard highlights." });
    }
};

// --- ADD THIS FUNCTION DEFINITION ---
/**
 * @desc    Create a new news item
 * @route   POST /api/admin/news
 * @access  Private (Admin Only - Middleware applied in adminRoutes.js)
 */
const createNewsItem = async (req, res) => {
    const { content } = req.body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
        res.status(400);
        throw new Error('News item content cannot be empty.');
    }

    // Ensure req.user is available from admin middleware
    if (!req.user || typeof req.user.userId === 'undefined') {
         console.error("Admin user context missing in createNewsItem");
         res.status(401);
         throw new Error('Not authorized, admin user data missing.');
    }

    const adminUserId = req.user.userId;

    try {
        const newsItem = await dbClient.newsItem.create({
            data: {
                content: content.trim(),
                postedByUserId: adminUserId,
                // postedByUserId: req.user.userId, // Uncomment if relation is added
            },
            select: {
                newsItemId: true,
                content: true,
                createdAt: true,
                postedBy: { select: { name: true } }
            }
        });
        console.log(`Admin ${req.user.userId} created news item ${newsItem.newsItemId}`);
        res.status(201).json(newsItem);
    } catch (error) {
        console.error("Error creating news item:", error);
        // Let the default error handler manage the 500 response
        throw error;
    }
};
// --- END FUNCTION DEFINITION ---


// --- Existing getNewsItems function (simplified version) ---
const getNewsItems = async (req, res) => {
    console.log("Attempting to fetch news items...");
    console.log("Value of prisma inside getNewsItems:", dbClient);
    console.log("Value of dbClient.newsItem:", dbClient.newsItem ? 'Model OK' : 'Model UNDEFINED');

     // --- DEFINE limit HERE ---
    // Use type assertion for query param if using TypeScript, or keep as is for JS
    // Ensure 'req.query.limit' exists and handle potential type issues if using TS directly
    const limit = parseInt(req.query.limit, 10) || 5; // Default to 5 latest
    console.log(`Fetching news with limit: ${limit}`); // Optional: Log the limit used
    // --- END DEFINE limit ---

    try {
        const newsItems = await dbClient.newsItem.findMany({ // Use dbClient or prisma
            take: limit,
            orderBy: { createdAt: 'desc' },
            select: {
                newsItemId: true,
                content: true,
                createdAt: true,
                postedBy: { // --- INCLUDE AUTHOR NAME ---
                    select: { // <-- Nested select is needed
                        name: true // <-- Specify the field(s) you want, e.g., name
                    }
                } // --- END INCLUDE ---
            }
        });
        console.log("News items fetched:", newsItems);
        res.status(200).json(newsItems);
    } catch (error) {
        console.error("!!! Error in getNewsItems controller:", error);
        throw error; // Re-throw for default handler
    }
};

/**
 * @desc    Delete a news item
 * @route   DELETE /api/admin/news/:newsItemId <-- Add to admin routes
 * @access  Private (Admin Only)
 */
const deleteNewsItem = async (req, res) => {
    const newsItemId = parseInt(req.params.newsItemId, 10);

    if (isNaN(newsItemId)) {
        res.status(400);
        throw new Error("Invalid news item ID.");
    }

     // Ensure req.user is available from admin middleware
     if (!req.user || typeof req.user.userId === 'undefined') {
        console.error("Admin user context missing in deleteNewsItem");
        res.status(401);
        throw new Error('Not authorized, admin user data missing.');
   }

    try {
        // Verify item exists before deleting (optional but good practice)
        const item = await dbClient.newsItem.findUnique({ where: { newsItemId } });
        if (!item) {
            res.status(404);
            throw new Error("News item not found.");
        }

        await dbClient.newsItem.delete({
            where: { newsItemId: newsItemId },
        });

        console.log(`Admin ${req.user.userId} deleted news item ${newsItemId}`);
        res.status(200).json({ message: "News item deleted successfully." });
    } catch (error) {
         console.error(`Error deleting news item ${newsItemId}:`, error);
         if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
             res.status(404); // Handle case where item is already deleted
             throw new Error('News item not found.');
         }
         // Let default handler manage other errors (like 500)
        throw error;
    }
};

module.exports = {
    getDashboardHighlights,
    createNewsItem,
    getNewsItems,
    deleteNewsItem, // <-- Export delete function
};

