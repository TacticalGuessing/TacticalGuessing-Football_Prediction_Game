// backend/src/controllers/friendsController.js
const prisma = require('../db.ts').default; // Adjust path as needed
const { Prisma } = require('@prisma/client');

/**
 * @desc    Send a friend request to another user
 * @route   POST /api/friends/requests
 * @access  Private
 */
const sendFriendRequest = async (req, res) => {
    const requesterId = req.user.userId; // From protect middleware
    const { addresseeId } = req.body;

    if (!addresseeId || typeof addresseeId !== 'number' || addresseeId <= 0) {
        res.status(400);
        throw new Error('Valid addresseeId is required.');
    }

    if (requesterId === addresseeId) {
        res.status(400);
        throw new Error('You cannot send a friend request to yourself.');
    }

    // Check if addressee user exists
    const addressee = await prisma.user.findUnique({
        where: { userId: addresseeId },
        select: { userId: true } // Only need to check existence
    });
    if (!addressee) {
        res.status(404);
        throw new Error('Recipient user not found.');
    }

    // Check if a friendship (pending or accepted) already exists between them in either direction
    const existingFriendship = await prisma.friendship.findFirst({
        where: {
            OR: [
                { requesterId: requesterId, addresseeId: addresseeId },
                { requesterId: addresseeId, addresseeId: requesterId } // Check reverse
            ],
            status: { in: ['PENDING', 'ACCEPTED'] } // Check for pending or already accepted
        }
    });

    if (existingFriendship) {
        if (existingFriendship.status === 'ACCEPTED') {
             res.status(400);
             throw new Error('You are already friends with this user.');
        } else {
             res.status(400);
             // More specific message depending on who sent the pending request
             if (existingFriendship.requesterId === requesterId) {
                throw new Error('Friend request already sent and is pending.');
             } else {
                 throw new Error('This user has already sent you a friend request. Please accept or reject it.');
             }
        }
    }

    // Create the new PENDING friendship record
    const newFriendship = await prisma.friendship.create({
        data: {
            requesterId: requesterId,
            addresseeId: addresseeId,
            status: 'PENDING'
        }
    });

    console.log(`User ${requesterId} sent friend request to user ${addresseeId}`);
    // Consider sending a notification to the addressee here in the future
    res.status(201).json({ message: 'Friend request sent successfully.', friendship: newFriendship });
};

/**
 * @desc    Get incoming pending friend requests for the logged-in user
 * @route   GET /api/friends/requests/pending
 * @access  Private
 */
const getPendingFriendRequests = async (req, res) => {
    const userId = req.user.userId;

    const pendingRequests = await prisma.friendship.findMany({
        where: {
            addresseeId: userId,
            status: 'PENDING'
        },
        include: { // Include details of the user who sent the request
            requester: {
                select: {
                    userId: true,
                    name: true,
                    avatarUrl: true
                }
            }
        },
        orderBy: {
            createdAt: 'desc' // Show newest requests first
        }
    });

    res.status(200).json(pendingRequests);
};

/**
 * @desc    Accept a pending friend request
 * @route   PATCH /api/friends/requests/:requestId/accept
 * @access  Private
 */
const acceptFriendRequest = async (req, res) => {
    const userId = req.user.userId;
    const requestId = parseInt(req.params.requestId, 10);

    if (isNaN(requestId)) {
        res.status(400); throw new Error('Invalid request ID.');
    }

    // Find the request, ensuring it's pending and addressed to the current user
    const request = await prisma.friendship.findFirst({
        where: {
            id: requestId,
            addresseeId: userId,
            status: 'PENDING'
        }
    });

    if (!request) {
        res.status(404);
        throw new Error('Pending friend request not found or already actioned.');
    }

    // Update the status to ACCEPTED
    const updatedFriendship = await prisma.friendship.update({
        where: { id: requestId },
        data: { status: 'ACCEPTED' }
    });

    console.log(`User ${userId} accepted friend request from user ${request.requesterId}`);
    // Consider sending notifications here
    res.status(200).json({ message: 'Friend request accepted.', friendship: updatedFriendship });
};

/**
 * @desc    Reject (or Delete) a pending friend request
 * @route   PATCH /api/friends/requests/:requestId/reject  OR DELETE /api/friends/requests/:requestId
 * @access  Private
 */
const rejectFriendRequest = async (req, res) => {
    const userId = req.user.userId;
    const requestId = parseInt(req.params.requestId, 10);

     if (isNaN(requestId)) {
        res.status(400); throw new Error('Invalid request ID.');
    }

    // Find the request, ensuring it's pending and addressed to the current user
    const request = await prisma.friendship.findFirst({
        where: {
            id: requestId,
            addresseeId: userId, // Only the recipient can reject
            status: 'PENDING'
        },
        select: { id: true, requesterId: true } // Only need ID for deletion
    });

     if (!request) {
        res.status(404);
        throw new Error('Pending friend request not found or already actioned.');
    }

    // Option 1: Delete the request row entirely
    await prisma.friendship.delete({
        where: { id: requestId }
    });
    console.log(`User ${userId} rejected/deleted friend request from user ${request.requesterId}`);
    res.status(200).json({ message: 'Friend request rejected.' });

    // Option 2: Update status to 'DECLINED' (if you want to track rejections)
    /*
    await prisma.friendship.update({
        where: { id: requestId },
        data: { status: 'DECLINED' }
    });
    console.log(`User ${userId} declined friend request from user ${request.requesterId}`);
    res.status(200).json({ message: 'Friend request declined.' });
    */
};


/**
 * @desc    Get list of accepted friends for the logged-in user
 * @route   GET /api/friends
 * @access  Private
 */
const getMyFriends = async (req, res) => {
    const userId = req.user.userId;

    const friendships = await prisma.friendship.findMany({
        where: {
            status: 'ACCEPTED',
            OR: [
                { requesterId: userId },
                { addresseeId: userId }
            ]
        },
        include: { // Include details of the OTHER user in the friendship
            requester: {
                select: { userId: true, name: true, avatarUrl: true }
            },
            addressee: {
                select: { userId: true, name: true, avatarUrl: true }
            }
        }
    });

    // Process the results to return a simple list of friend user objects
    const friends = friendships.map(friendship => {
        // If the logged-in user was the requester, return the addressee's details
        if (friendship.requesterId === userId) {
            return friendship.addressee;
        }
        // Otherwise, return the requester's details
        else {
            return friendship.requester;
        }
    });

    // Optional: Sort friends alphabetically by name
    friends.sort((a, b) => a.name.localeCompare(b.name));

    res.status(200).json(friends); // Returns array of User-like objects
};


/**
 * @desc    Remove a friend (unfriend)
 * @route   DELETE /api/friends/:friendUserId
 * @access  Private
 */
const removeFriend = async (req, res) => {
    const userId = req.user.userId;
    const friendUserId = parseInt(req.params.friendUserId, 10);

     if (isNaN(friendUserId)) {
        res.status(400); throw new Error('Invalid friend user ID.');
    }
     if (userId === friendUserId) {
        res.status(400); throw new Error('You cannot unfriend yourself.');
     }

    // Find the accepted friendship record between the two users (in either direction)
    const friendship = await prisma.friendship.findFirst({
         where: {
            status: 'ACCEPTED',
            OR: [
                { requesterId: userId, addresseeId: friendUserId },
                { requesterId: friendUserId, addresseeId: userId }
            ]
        },
         select: { id: true } // Only need the ID to delete it
    });

    if (!friendship) {
        res.status(404);
        throw new Error('Friendship not found.');
    }

    // Delete the friendship record
    await prisma.friendship.delete({
        where: { id: friendship.id }
    });

    console.log(`User ${userId} removed friend ${friendUserId}`);
    res.status(200).json({ message: 'Friend removed successfully.' });
};


// --- Export all functions ---
module.exports = {
    sendFriendRequest,
    getPendingFriendRequests,
    acceptFriendRequest,
    rejectFriendRequest,
    getMyFriends,
    removeFriend,
};