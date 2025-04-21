// backend/src/controllers/leagueController.js
const prisma = require('../db.ts').default; // Adjust path
const { Prisma } = require('@prisma/client');
const crypto = require('crypto'); // For invite code generation
const { calculateStandings } = require('../utils/scoringUtils');



/**
 * @desc    Create a new league
 * @route   POST /api/leagues
 * @access  Private (Requires PLAYER role)
 */
const createLeague = async (req, res) => {
    // Ensure user is logged in (from protect middleware)
    if (!req.user || !req.user.userId) {
        res.status(401); throw new Error('Not authorized');
    }
    // Ensure user has PLAYER role globally to create leagues
    if (req.user.role !== 'PLAYER' && req.user.role !== 'ADMIN') { // Allow ADMIN too?
         res.status(403); throw new Error('Only Players can create leagues.');
    }

    const { name, description } = req.body;
    const creatorUserId = req.user.userId;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        res.status(400); throw new Error('League name is required.');
    }
    if (name.trim().length > 100) {
        res.status(400); throw new Error('League name cannot exceed 100 characters.');
    }
     if (description && typeof description !== 'string') {
          res.status(400); throw new Error('Invalid description format.');
     }
     if (description && description.length > 500) {
         res.status(400); throw new Error('Description cannot exceed 500 characters.');
     }

    // Generate a unique invite code (simple approach, might need retry logic for collisions)
    const generateInviteCode = () => crypto.randomBytes(4).toString('hex').toUpperCase(); // 8-char hex code
    let inviteCode = generateInviteCode();
    let existingLeague = await prisma.league.findUnique({ where: { inviteCode } });
    let retries = 0;
    while (existingLeague && retries < 5) { // Retry a few times if collision occurs
        inviteCode = generateInviteCode();
        existingLeague = await prisma.league.findUnique({ where: { inviteCode } });
        retries++;
    }
    if (existingLeague) { // Highly unlikely, but handle failure to generate unique code
         console.error("Failed to generate unique invite code after multiple retries.");
         throw new Error("Could not create league due to invite code generation issue.");
    }


    try {
        // Use a transaction to create league and add creator as ADMIN member
        const newLeague = await prisma.$transaction(async (tx) => {
            const league = await tx.league.create({
                data: {
                    name: name.trim(),
                    description: description?.trim() || null,
                    creatorUserId: creatorUserId,
                    inviteCode: inviteCode,
                },
                select: { // Select fields needed for response
                     leagueId: true, name: true, description: true, inviteCode: true, createdAt: true
                }
            });

            // Add the creator as the first member with ADMIN role for this league
            await tx.leagueMembership.create({
                data: {
                    leagueId: league.leagueId,
                    userId: creatorUserId,
                    role: 'ADMIN' // Creator is the league admin
                }
            });

            return league; // Return the created league data
        });

        console.log(`User ${creatorUserId} created league ${newLeague.leagueId} (${newLeague.name})`);
        res.status(201).json(newLeague);

    } catch (error) {
        console.error("Error creating league:", error);
         if (error instanceof Prisma.PrismaClientKnownRequestError) {
            // Handle potential unique constraint errors if needed (e.g., invite code unlikely collision)
            if (error.code === 'P2002' && error.meta?.target?.includes('inviteCode')) {
                 throw new Error("Failed to generate a unique invite code. Please try again.");
            }
         }
        throw new Error('Failed to create league.'); // Generic error
    }
};

/**
 * @desc    Get list of leagues the current user is a member of
 * @route   GET /api/leagues/my-leagues
 * @access  Private
 */
const getMyLeagues = async (req, res) => {
     if (!req.user || !req.user.userId) {
        res.status(401); throw new Error('Not authorized');
    }
    const userId = req.user.userId;

    try {
        const memberships = await prisma.leagueMembership.findMany({
            where: { userId: userId },
            select: {
                role: true, // User's role in the league
                league: { // Include league details
                    select: {
                        leagueId: true,
                        name: true,
                        description: true,
                        inviteCode: true, // Include invite code only if user is ADMIN of league?
                        creator: { // Include creator's basic info
                             select: { userId: true, name: true }
                        }
                        // Optionally include member count: _count: { select: { memberships: true } }
                    }
                }
            },
            orderBy: { // Order by league name? or join date?
                 league: { name: 'asc' }
            }
        });

        // Re-map the data if needed for frontend (e.g., flatten structure)
        const myLeagues = memberships.map(m => ({
            ...m.league,
            myLeagueRole: m.role // Add user's role in this league to the object
        }));

        res.status(200).json(myLeagues);

    } catch (error) {
        console.error(`Error fetching leagues for user ${userId}:`, error);
        throw new Error('Failed to retrieve your leagues.');
    }
};


// --- Add JoinLeague, GetLeagueDetails later ---


/**
 * @desc    Join a league using an invite code
 * @route   POST /api/leagues/join/:inviteCode
 * @access  Private (Requires PLAYER role)
 */
const joinLeagueByInviteCode = async (req, res) => {
    if (!req.user || !req.user.userId) {
        res.status(401); throw new Error('Not authorized');
    }
     if (req.user.role !== 'PLAYER' && req.user.role !== 'ADMIN') { // Must be PLAYER or ADMIN to join
         res.status(403); throw new Error('Only Players can join leagues.');
     }

    const userId = req.user.userId;
    const inviteCode = req.params.inviteCode; // Get code from URL parameter

    if (!inviteCode || typeof inviteCode !== 'string') {
        res.status(400); throw new Error('Invite code is required.');
    }

    try {
        // 1. Find the league by invite code
        const league = await prisma.league.findUnique({
            where: { inviteCode: inviteCode.toUpperCase() }, // Store/compare codes case-insensitively if desired
            select: { leagueId: true, name: true /* Add maxMembers if implemented */ }
        });

        if (!league) {
            res.status(404); throw new Error('League not found or invite code is invalid.');
        }

        // 2. Check if user is already a member
        const existingMembership = await prisma.leagueMembership.findUnique({
            where: {
                leagueId_userId: { // Using the @@unique constraint name
                    leagueId: league.leagueId,
                    userId: userId
                }
            }
        });

        if (existingMembership) {
            res.status(400); throw new Error('You are already a member of this league.');
        }

        // 3. Optional: Check for league member limits
        // if (league.maxMembers) {
        //     const memberCount = await prisma.leagueMembership.count({ where: { leagueId: league.leagueId } });
        //     if (memberCount >= league.maxMembers) {
        //         res.status(400); throw new Error('League is full.');
        //     }
        // }

        // 4. Create the league membership record
        const newMembership = await prisma.leagueMembership.create({
            data: {
                leagueId: league.leagueId,
                userId: userId,
                role: 'MEMBER' // New joiners are members
            },
            select: { // Select relevant data to return
                membershipId: true,
                role: true,
                joinedAt: true,
                league: { select: { leagueId: true, name: true } }
            }
        });

        console.log(`User ${userId} joined league ${league.leagueId} (${league.name})`);
        res.status(200).json({ message: `Successfully joined league: ${league.name}`, membership: newMembership });

    } catch (error) {
        console.error(`Error joining league with code ${inviteCode} for user ${userId}:`, error);
        // Handle potential transaction errors if needed
        throw new Error('Failed to join league.');
    }
};


/**
 * @desc    Get details and members of a specific league
 * @route   GET /api/leagues/:leagueId
 * @access  Private (Requires membership in the league)
 */
const getLeagueDetails = async (req, res) => {
     if (!req.user || !req.user.userId) {
        res.status(401); throw new Error('Not authorized');
    }
    const userId = req.user.userId;
    const leagueId = parseInt(req.params.leagueId, 10);

     if (isNaN(leagueId)) {
        res.status(400); throw new Error('Invalid League ID.');
    }

    try {
         // 1. Verify user is a member of this league before showing details
         const membership = await prisma.leagueMembership.findUnique({
            where: { leagueId_userId: { leagueId, userId } },
            select: { role: true } // Just need to confirm membership exists
         });

         if (!membership) {
             res.status(403); // Forbidden
             throw new Error('You are not a member of this league.');
         }

         // 2. Fetch league details, creator info, and member list
         const leagueDetails = await prisma.league.findUnique({ // Using prisma or dbClient
            where: { leagueId: leagueId },
            select: {
                // --- Select fields from the LEAGUE model ---
                leagueId: true,
                name: true,
                description: true,
                // Conditionally select inviteCode based on the fetched membership role
                inviteCode: membership.role === 'ADMIN',
                createdAt: true,
                // --- Select fields from the related LEAGUE CREATOR (User model) ---
                creator: {
                    select: {
                        userId: true,
                        name: true
                    }
                },
                // --- Select the list of memberships ---
                memberships: {
                    // --- Inside memberships, select fields FROM LeagueMembership model ---
                    select: {
                        membershipId: true, // From LeagueMembership
                        userId: true,       // From LeagueMembership
                        role: true,         // From LeagueMembership
                        joinedAt: true,     // From LeagueMembership

                        // --- Select fields from the related MEMBER (User model) ---
                        user: {             // Relation 'user' on LeagueMembership model
                            select: {
                                userId: true,
                                name: true,
                                avatarUrl: true
                            }
                        }
                        // --- DO NOT select League fields like name, description, inviteCode, etc. here ---
                    },
                    orderBy: [ // Correct orderBy array
                        { role: 'asc' },
                        { joinedAt: 'asc' }
                    ]
                } // --- End memberships select ---
            } // --- End top-level select ---
         });

         if (!leagueDetails) {
             res.status(404); // Should be rare if membership check passed, but possible
             throw new Error('League not found.');
         }

         // Optional: Re-map members structure if needed
         // const members = leagueDetails.memberships.map(m => ({ ...m.user, leagueRole: m.role, joinedAt: m.joinedAt }));

        res.status(200).json(leagueDetails);

    } catch (error) {
         console.error(`Error fetching details for league ${leagueId}:`, error);
         throw new Error('Failed to retrieve league details.');
    }
};

/**
 * @desc    Get standings for a specific league
 * @route   GET /api/leagues/:leagueId/standings
 * @access  Private (Requires membership)
 */
const getLeagueStandings = async (req, res) => {
    if (!req.user || !req.user.userId) {
        res.status(401); throw new Error('Not authorized');
    }
    const userId = req.user.userId;
    const leagueId = parseInt(req.params.leagueId, 10);

    if (isNaN(leagueId)) {
        res.status(400); throw new Error('Invalid League ID.');
    }

    try {
        // 1. Verify user is a member of this league
        const members = await prisma.leagueMembership.findMany({
           where: { leagueId: leagueId },
           select: { userId: true }
        });

        const memberIds = members.map(m => m.userId);

        if (!memberIds.includes(userId)) {
            res.status(403); // Forbidden
            throw new Error('You are not a member of this league.');
        }

        // 2. Calculate standings filtered by members of this league
        // Note: We are calculating overall standings for now.
        // To calculate for a specific round, pass roundId from req.query if needed.
        const leagueStandings = await calculateStandings(null, memberIds); // Pass null for roundId (overall), and memberIds for filtering

        res.status(200).json(leagueStandings);

   } catch (error) {
        console.error(`Error fetching standings for league ${leagueId}:`, error);
        throw new Error('Failed to retrieve league standings.');
   }
};

/**
 * @desc    Remove a member from a league by the League Admin
 * @route   DELETE /api/leagues/:leagueId/members/:memberUserId
 * @access  Private (Requires League Admin role for that league)
 */
const removeLeagueMember = async (req, res) => {
    const requestingUserId = req.user.userId; // User making the request (must be League Admin)
    const leagueId = parseInt(req.params.leagueId, 10);
    const memberUserIdToRemove = parseInt(req.params.memberUserId, 10);

    if (isNaN(leagueId) || isNaN(memberUserIdToRemove)) {
        res.status(400); throw new Error('Invalid League or Member ID.');
    }
    if (requestingUserId === memberUserIdToRemove) {
         res.status(400); throw new Error('You cannot remove yourself from the league.');
    }

    try {
        // 1. Find the league and verify the requesting user is the ADMIN
        const league = await prisma.league.findUnique({
            where: { leagueId },
            select: { creatorUserId: true } // Need creator ID to prevent removing them
        });

        if (!league) {
            res.status(404); throw new Error('League not found.');
        }

         // Check if requester is the league creator/admin (assuming creator is sole admin for now)
        if (league.creatorUserId !== requestingUserId) {
             // More robust check: Query LeagueMembership for requesting user's role
             const adminMembership = await prisma.leagueMembership.findUnique({
                 where: { leagueId_userId: { leagueId, userId: requestingUserId } }
             });
             if (!adminMembership || adminMembership.role !== 'ADMIN') {
                 res.status(403); throw new Error('Only the league admin can remove members.');
             }
        }

        // 2. Prevent removing the league creator
        if (memberUserIdToRemove === league.creatorUserId) {
             res.status(400); throw new Error('The league creator cannot be removed.');
        }

        // 3. Find the specific membership record to delete
        const membershipToDelete = await prisma.leagueMembership.findUnique({
            where: {
                leagueId_userId: {
                    leagueId: leagueId,
                    userId: memberUserIdToRemove
                }
            },
             select: { membershipId: true } // Only need ID to delete
        });

        if (!membershipToDelete) {
            res.status(404); throw new Error('User is not a member of this league.');
        }

        // 4. Delete the membership record
        await prisma.leagueMembership.delete({
            where: { membershipId: membershipToDelete.membershipId }
        });

        console.log(`League Admin ${requestingUserId} removed user ${memberUserIdToRemove} from league ${leagueId}`);
        res.status(200).json({ message: 'Member removed successfully.' });

    } catch (error) {
        console.error(`Error removing member ${memberUserIdToRemove} from league ${leagueId}:`, error);
         if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
             res.status(404); throw new Error('Membership record not found.'); // Should be caught earlier ideally
         }
        throw new Error('Failed to remove league member.');
    }
};


/**
 * @desc    Regenerate the invite code for a league
 * @route   PATCH /api/leagues/:leagueId/invite-code
 * @access  Private (Requires League Admin role)
 */
const regenerateInviteCode = async (req, res) => {
    const requestingUserId = req.user.userId;
    const leagueId = parseInt(req.params.leagueId, 10);

    if (isNaN(leagueId)) {
        res.status(400); throw new Error('Invalid League ID.');
    }

    try {
        // 1. Find the league and verify the requesting user is the ADMIN
        const league = await prisma.league.findUnique({
            where: { leagueId },
            // Also fetch membership to check role in one go? Less efficient if only checking creator...
            // Let's stick to checking creator first, then fallback to membership query if needed.
            select: { creatorUserId: true }
        });

        if (!league) {
            res.status(404); throw new Error('League not found.');
        }

        // Verify admin role (assuming creator is admin for now)
        if (league.creatorUserId !== requestingUserId) {
             const adminMembership = await prisma.leagueMembership.findUnique({
                 where: { leagueId_userId: { leagueId, userId: requestingUserId } }
             });
             if (!adminMembership || adminMembership.role !== 'ADMIN') {
                 res.status(403); throw new Error('Only the league admin can regenerate the invite code.');
             }
        }

        // 2. Generate a NEW unique invite code
        const generateInviteCode = () => crypto.randomBytes(4).toString('hex').toUpperCase();
        let newInviteCode = generateInviteCode();
        let existingLeague = await prisma.league.findUnique({ where: { inviteCode: newInviteCode } });
        let retries = 0;
        while (existingLeague && retries < 5) { // Retry loop for collisions
            newInviteCode = generateInviteCode();
            existingLeague = await prisma.league.findUnique({ where: { inviteCode: newInviteCode } });
            retries++;
        }
        if (existingLeague) { // Collision persisted
             console.error("Failed to generate unique invite code after multiple retries for regeneration.");
             throw new Error("Could not regenerate invite code due to generation issue.");
        }

        // 3. Update the league with the new code
        const updatedLeague = await prisma.league.update({
            where: { leagueId: leagueId },
            data: { inviteCode: newInviteCode },
            select: { inviteCode: true } // Only return the new code
        });

        console.log(`League Admin ${requestingUserId} regenerated invite code for league ${leagueId}`);
        res.status(200).json({ message: 'Invite code regenerated successfully.', inviteCode: updatedLeague.inviteCode });

    } catch (error) {
        console.error(`Error regenerating invite code for league ${leagueId}:`, error);
        // Handle P2002 unique constraint error if needed (highly unlikely with retry)
        throw new Error('Failed to regenerate invite code.');
    }
};


// --- Update Exports ---
module.exports = {
    createLeague,
    getMyLeagues,
    joinLeagueByInviteCode,
    getLeagueDetails,
    getLeagueStandings,
    removeLeagueMember,
    regenerateInviteCode, // <-- Add new function
};