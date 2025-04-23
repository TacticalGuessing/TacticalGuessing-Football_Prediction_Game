// backend/src/controllers/leagueInviteController.js
const prisma = require('../db.ts').default; // Use your Prisma import path
const asyncHandler = require('express-async-handler'); // Use asyncHandler

/**
 * @desc    Get pending league invitations for the logged-in user
 * @route   GET /api/leagues/invites/pending
 * @access  Private
 */
const getPendingLeagueInvites = asyncHandler(async (req, res) => {
    const userId = req.user.userId; // Use your user ID access

    const invites = await prisma.leagueMembership.findMany({
        where: {
            userId: userId,
            status: 'INVITED', // Find only pending invites for the user
        },
        include: {
            league: { // Include details about the league they are invited to
                select: {
                    leagueId: true,
                    name: true,
                    description: true,
                    creator: { select: { userId: true, name: true } } // Include creator info
                }
            }
        },
        orderBy: {
            invitedAt: 'desc', // Show newest invites first
        },
    });

    res.status(200).json(invites);
});

/**
 * @desc    Accept a pending league invitation
 * @route   PATCH /api/leagues/invites/:membershipId/accept
 * @access  Private
 */
const acceptLeagueInvite = asyncHandler(async (req, res) => {
    const membershipId = parseInt(req.params.membershipId);
    const userId = req.user.userId; // Use your user ID access

    if (isNaN(membershipId)) {
        res.status(400); throw new Error('Invalid invitation ID format.');
    }

    // Fetch the specific invitation to verify ownership/status before updating
    const invite = await prisma.leagueMembership.findUnique({
        where: { membershipId: membershipId },
    });

    // Verification
    if (!invite) {
        res.status(404); throw new Error('Invitation not found.');
    }
    if (invite.userId !== userId) {
        // Ensure only the invited user can accept
        res.status(403); throw new Error('You are not authorized to accept this invitation.');
    }
    if (invite.status !== 'INVITED') {
        // Ensure it hasn't already been accepted/rejected
        res.status(400); throw new Error('This invitation is not pending acceptance.');
    }

    // Update the membership status and set joinedAt timestamp
    const updatedMembership = await prisma.leagueMembership.update({
        where: { membershipId: membershipId },
        data: {
            status: 'ACCEPTED',
            joinedAt: new Date(), // Set joinedAt timestamp upon acceptance
        },
        include: { // Return league info for frontend context
             league: { select: { leagueId: true, name: true }}
        }
    });

    console.log(`User ${userId} accepted invite ${membershipId} for league ${updatedMembership.league.leagueId}`);
    res.status(200).json({
        message: `Successfully joined league: ${updatedMembership.league.name}`,
        membership: updatedMembership // Send back the updated membership record
     });
});

/**
 * @desc    Reject (delete) a pending league invitation
 * @route   DELETE /api/leagues/invites/:membershipId/reject
 * @access  Private
 */
const rejectLeagueInvite = asyncHandler(async (req, res) => {
    const membershipId = parseInt(req.params.membershipId);
    const userId = req.user.userId; // Use your user ID access

    if (isNaN(membershipId)) {
        res.status(400); throw new Error('Invalid invitation ID format.');
    }

    // Find the invite first to verify ownership and status before deleting
    const invite = await prisma.leagueMembership.findUnique({
        where: { membershipId: membershipId },
        select: { userId: true, status: true, leagueId: true } // Select fields needed for validation/logging
    });

    // Verification
    if (!invite) {
        res.status(404); throw new Error('Invitation not found.');
    }
    if (invite.userId !== userId) {
        // Ensure only the invited user can reject
        res.status(403); throw new Error('You are not authorized to reject this invitation.');
    }
    if (invite.status !== 'INVITED') {
        // Ensure it hasn't already been accepted/rejected
        res.status(400); throw new Error('This invitation is not pending rejection.');
    }

    // Delete the invitation record completely
    await prisma.leagueMembership.delete({
        where: { membershipId: membershipId },
    });

    console.log(`User ${userId} rejected invite ${membershipId} for league ${invite.leagueId}`);
    res.status(204).send(); // 204 No Content is standard for successful DELETE with no body
});

// Export all functions
module.exports = {
    getPendingLeagueInvites,
    acceptLeagueInvite,
    rejectLeagueInvite,
};