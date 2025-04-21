// backend/src/controllers/userController.js
const prisma = require('../db.ts').default; // Adjust path if needed
const { Prisma } = require('@prisma/client');

/**
 * @desc    Search for users by name or email, excluding self and existing/pending friends
 * @route   GET /api/users/search?query=...
 * @access  Private
 */
const searchUsers = async (req, res) => {
    const loggedInUserId = req.user.userId;
    // FIX 1: Remove 'as string' type assertion
    const query = req.query.query;

    // Keep validation
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
        return res.status(200).json([]);
    }

    const searchTerm = query.trim();
    console.log(`User ${loggedInUserId} searching for users matching: "${searchTerm}"`);

    try {
        // 1. Find IDs of users already connected (friends or pending)
        const existingConnections = await prisma.friendship.findMany({
            where: {
                OR: [
                    { requesterId: loggedInUserId },
                    { addresseeId: loggedInUserId }
                ],
            },
            select: {
                requesterId: true,
                addresseeId: true
            }
        });

        // FIX 2: Remove <number> generic type from Set initialization
        const connectedUserIds = new Set(); // Standard JavaScript Set
        existingConnections.forEach(f => {
            connectedUserIds.add(f.requesterId);
            connectedUserIds.add(f.addresseeId);
        });
         connectedUserIds.add(loggedInUserId); // Exclude self

        console.log(`Excluding user IDs: ${[...connectedUserIds]}`);


        // 2. Search users matching the term, excluding connected IDs and self
        const foundUsers = await prisma.user.findMany({
            where: {
                OR: [
                    { name: { contains: searchTerm, mode: 'insensitive' } },
                    { email: { contains: searchTerm, mode: 'insensitive' } }
                ],
                userId: {
                    notIn: [...connectedUserIds] // Convert Set to array
                },
            },
            select: {
                userId: true,
                name: true,
                avatarUrl: true
            },
            take: 10
        });

        console.log(`Found ${foundUsers.length} potential users.`);
        res.status(200).json(foundUsers);

    } catch (error) {
        console.error(`Error searching users for query "${searchTerm}":`, error);
        res.status(500).json({ message: "Failed to search users." });
    }
};


module.exports = {
    searchUsers,
};