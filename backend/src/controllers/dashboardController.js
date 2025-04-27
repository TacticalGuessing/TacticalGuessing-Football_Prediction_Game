// backend/src/controllers/dashboardController.js
//const prisma = require('../db.ts').default; // Adjust path: this goes from controllers up one level to src, then to db
const dbClient = require('../db.ts').default; // Renamed import
//console.log("DB Client Initialized:", dbClient ? 'OK' : 'UNDEFINED'); // Log confirmation

const { Prisma } = require('@prisma/client'); // Import Prisma if needed for error types
const { calculateStandings } = require('../utils/scoringUtils');




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

    //console.log(`[createNewsItem] Value of dbClient BEFORE try:`, dbClient ? 'OK' : 'UNDEFINED'); // <-- ADD LOG
    //console.log(`[createNewsItem] Value of dbClient.newsItem BEFORE try:`, dbClient?.newsItem ? 'Model OK' : 'Model UNDEFINED'); // <-- ADD LOG

    try {
        //console.log(`[createNewsItem] Value of dbClient INSIDE try:`, dbClient ? 'OK' : 'UNDEFINED'); // <-- ADD LOG
        //console.log(`[createNewsItem] Value of dbClient.newsItem INSIDE try:`, dbClient?.newsItem ? 'Model OK' : 'Model UNDEFINED');
        const newsItem = await dbClient.newsItem.create({
            data: {
                content: content.trim(),
                postedByUserId: adminUserId,
                // postedByUserId: req.user.userId, // Uncomment if relation is added Adding a change to fore redeploy
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
    //console.log("Attempting to fetch news items...");
    //console.log("Value of prisma inside getNewsItems:", dbClient);
    //console.log("Value of dbClient.newsItem:", dbClient.newsItem ? 'Model OK' : 'Model UNDEFINED');

     // --- DEFINE limit HERE ---
    // Use type assertion for query param if using TypeScript, or keep as is for JS
    // Ensure 'req.query.limit' exists and handle potential type issues if using TS directly
    const limit = parseInt(req.query.limit, 10) || 5; // Default to 5 latest
    //console.log(`Fetching news with limit: ${limit}`); // Optional: Log the limit used
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
        //console.log("News items fetched:", newsItems);
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

