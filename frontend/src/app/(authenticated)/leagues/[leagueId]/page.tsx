// frontend/src/app/(authenticated)/leagues/[leagueId]/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
    getLeagueDetails,
    LeagueDetailsResponse,
    //LeagueMemberInfo, // Type for membership list items
    removeLeagueMember,
    regenerateInviteCodeAdmin,
    // --- Friend/Invite related imports ---
    getMyFriends,
    inviteFriendsToLeague,
    ApiError,
    FriendUser,
    leaveLeague // Type for friend list items
    // --- End imports ---
} from '@/lib/api'; // Adjust path if needed
import { formatDateTime } from '@/utils/formatters'; // Adjust path if needed
import { toast } from 'react-hot-toast';

// UI Components
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card'; // Adjusted path
import Spinner from '@/components/ui/Spinner'; // Adjusted path
import Avatar from '@/components/Avatar'; // Adjusted path
import { Button } from '@/components/ui/Button'; // Adjusted path
import { Checkbox } from '@/components/ui/Checkbox'; // Adjusted path
import { Label } from '@/components/ui/Label'; // Adjusted path
import { FaUserMinus, FaUsers, FaInfoCircle, FaCopy, FaCode, FaSyncAlt, FaUserPlus, FaTimes, FaPaperPlane, FaDoorOpen } from 'react-icons/fa'; // Adjusted path

import ConfirmationModal from '@/components/Modal/ConfirmationModal'; // Adjusted path

// --- Remove InviteFriendsModal Import ---
// import { InviteFriendsModal } from '@/components/Leagues/InviteFriendsModal';

export default function LeagueDetailsPage() {
    const { token, isLoading: isAuthLoading, user: currentUser } = useAuth();
    const params = useParams();
    const router = useRouter();
    const leagueIdParam = params.leagueId;

    // States for remove member confirmation
    const [memberToRemove, setMemberToRemove] = useState<FriendUser | null>(null); // Use FriendUser or appropriate type for member.user
    const [isRemovingMemberId, setIsRemovingMemberId] = useState<number | null>(null);
    const [isConfirmRemoveOpen, setIsConfirmRemoveOpen] = useState(false);
    const [isRegeneratingCode, setIsRegeneratingCode] = useState(false);

    // --- State for INLINE Invite Section ---
    const [showInviteSection, setShowInviteSection] = useState(false);
    const [invitableFriends, setInvitableFriends] = useState<FriendUser[]>([]);
    const [selectedFriendIds, setSelectedFriendIds] = useState<number[]>([]);
    const [isLoadingFriends, setIsLoadingFriends] = useState(false);
    const [inviteError, setInviteError] = useState<string | null>(null);
    const [isSendingInvites, setIsSendingInvites] = useState(false);
    // --- End Invite Section State ---

    // --- ADD State for Leaving ---
    const [isLeavingLeague, setIsLeavingLeague] = useState(false);
    const [isConfirmLeaveOpen, setIsConfirmLeaveOpen] = useState(false);
    const [showLeaveTooltip, setShowLeaveTooltip] = useState(false);
    // --- END State ---

    // General page state
    const [leagueDetails, setLeagueDetails] = useState<LeagueDetailsResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const leagueId = typeof leagueIdParam === 'string' ? parseInt(leagueIdParam, 10) : NaN;

    // Fetch League Details
    const fetchDetails = useCallback(async () => {
        if (!token || isNaN(leagueId)) {
             setIsLoading(false);
             if(isNaN(leagueId) && leagueIdParam) setError("Invalid League ID.");
             return;
        }
        setIsLoading(true); setError(null);
        try {
            const data = await getLeagueDetails(leagueId, token);
            setLeagueDetails(data);
        } catch (err) {
            console.error(`Error fetching league details ${leagueId}:`, err);
            const message = err instanceof ApiError ? err.message : "Could not load league details.";
            if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
                setError("League not found or you are not a member.");
            } else { setError(message); }
            setLeagueDetails(null);
        } finally { setIsLoading(false); }
    }, [token, leagueId, leagueIdParam]);

    // Fetch on mount
    useEffect(() => {
        if (token && !isAuthLoading && !isNaN(leagueId)) { fetchDetails(); }
        else if (leagueIdParam && isNaN(leagueId)) { setError("Invalid League ID in URL."); setIsLoading(false); }
    }, [token, isAuthLoading, leagueId, leagueIdParam, fetchDetails]);

    // Copy Invite Code Handler
    const handleCopyCode = () => {
        if (leagueDetails?.inviteCode) {
            navigator.clipboard.writeText(leagueDetails.inviteCode)
                .then(() => toast.success("Invite code copied!"))
                .catch(err => { // Keep err here
                    console.error('Failed to copy invite code: ', err); // Use err
                    toast.error("Failed to copy code.");
                });
        }
    };

    // Remove Member Handlers
    const openRemoveConfirmation = (memberUser: FriendUser) => { // Use FriendUser or appropriate type
        setMemberToRemove(memberUser);
        setIsConfirmRemoveOpen(true);
    };
    const handleRemoveMember = async () => {
        if (!memberToRemove || !token || !leagueDetails) return;
        const memberId = memberToRemove.userId;
        setIsRemovingMemberId(memberId); setIsConfirmRemoveOpen(false);
        const toastId = toast.loading(`Removing ${memberToRemove.name}...`);
        try {
            await removeLeagueMember(leagueDetails.leagueId, memberId, token);
            toast.success(`${memberToRemove.name} removed.`, { id: toastId });
            setMemberToRemove(null);
            fetchDetails(); // Refresh list
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Failed to remove member.", { id: toastId });
        } finally { setIsRemovingMemberId(null); }
    };

    // Regenerate Code Handler
    const handleRegenerateCode = async () => {
        if (!token || !leagueDetails || !isLeagueAdmin) return;
        if (!window.confirm("Regenerating will invalidate the current code. Continue?")) return;
        setIsRegeneratingCode(true); const toastId = toast.loading("Regenerating...");
        try {
            const response = await regenerateInviteCodeAdmin(leagueDetails.leagueId, token);
            setLeagueDetails(prev => prev ? { ...prev, inviteCode: response.inviteCode } : null);
            toast.success(response.message || "Code regenerated!", { id: toastId });
        } catch (err) {
             toast.error(err instanceof ApiError ? err.message : "Failed to regenerate.", { id: toastId });
        } finally { setIsRegeneratingCode(false); }
    };

    // --- Invite Friends Logic ---
    const fetchFriendsForInvite = useCallback(async () => {
        if (!token || !leagueDetails) return;
        setIsLoadingFriends(true); setInviteError(null);
        try {
            const fetchedFriends = await getMyFriends(token);
            const currentMemberUserIds = leagueDetails.memberships.map(m => m.userId);
            const filteredFriends = fetchedFriends.filter(friend => !currentMemberUserIds.includes(friend.userId));
            setInvitableFriends(filteredFriends);
        } catch (err) {
            const msg = err instanceof ApiError ? err.message : 'Failed to load friends.';
            setInviteError(msg); toast.error(msg);
        } finally { setIsLoadingFriends(false); }
    }, [token, leagueDetails]);

    const toggleInviteSection = () => {
        const becomingVisible = !showInviteSection;
        setShowInviteSection(becomingVisible);
        if (becomingVisible) { fetchFriendsForInvite(); setSelectedFriendIds([]); setInviteError(null); }
    };

    const handleFriendCheckboxChange = (friendId: number, checked: boolean | 'indeterminate') => {
        const isChecked = checked === true;
        setSelectedFriendIds(prev => isChecked ? [...prev, friendId] : prev.filter(id => id !== friendId));
    };

    const handleSendInvites = async () => {
        if (!token || selectedFriendIds.length === 0 || !leagueDetails || isSendingInvites) return;
        setIsSendingInvites(true); setInviteError(null);
        try {
            const result = await inviteFriendsToLeague(leagueDetails.leagueId, selectedFriendIds, token);
            toast.success(result.message || `${result.count} invitation(s) sent!`);
            setSelectedFriendIds([]); setShowInviteSection(false);
            // fetchDetails(); // Optionally refresh league details
        } catch (err) {
            const errorMsg = err instanceof ApiError ? err.message : 'Failed to send invitations.';
            setInviteError(errorMsg); toast.error(errorMsg);
        } finally { setIsSendingInvites(false); }
    };
    // --- End Invite Friends Logic ---

    // --- ADD Leave League Handler ---
    const handleLeaveLeagueConfirm = async () => {
        if (!token || !leagueDetails || isLeavingLeague) return;

        setIsLeavingLeague(true);
        setIsConfirmLeaveOpen(false);
        const toastId = toast.loading("Leaving league...");

       try {
           const result = await leaveLeague(leagueDetails.leagueId, token);
           toast.success(result.message || "Successfully left league.", { id: toastId });
           // Redirect user away from the league page after leaving
           router.push('/dashboard'); // Or maybe '/leagues' if you create a list page
       } catch (err) {
            console.error("Leave league error:", err);
            const msg = err instanceof ApiError ? err.message : "Failed to leave league.";
            toast.error(`Error: ${msg}`, { id: toastId });
            setIsLeavingLeague(false); // Reset loading state on error
       }
       // No finally needed here as we navigate away on success
   };
   // --- END Leave League Handler ---

    // Render Logic
    if (isLoading || isAuthLoading) { return <div className="p-6 text-center"><Spinner /> Loading League Details...</div>; }
    if (error) { return <div className="p-6 text-center text-red-400 border border-red-700 bg-red-900/30 rounded-md">{error}</div>; }
    if (!leagueDetails) { return <div className="p-6 text-center text-gray-400 italic">League data not available.</div>; }

    const currentUserLeagueRole = leagueDetails.memberships.find(m => m.userId === currentUser?.userId)?.role;
    const isLeagueAdmin = currentUserLeagueRole === 'ADMIN';
    const isLeagueMember = currentUserLeagueRole === 'MEMBER';

    return (
        <div className="space-y-6 p-4 md:p-6">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-100 break-words"> League: {leagueDetails.name} </h1>

            {/* Details Card */}
            <Card className="dark:bg-gray-800 border border-gray-700">
                 {/* --- MODIFIED CardHeader --- */}
                 <CardHeader className="flex flex-row justify-between items-start">
                     {/* Container for title */}
                    <div>
                        <CardTitle className="flex items-center"><FaInfoCircle className="mr-2 text-blue-400"/>Details</CardTitle>
                    </div>

                    {/* --- Leave League Button Area --- */}
                    {isLeagueMember && !isLeagueAdmin && (
                         // <<< STEP 1: Add Relative Container >>>
                        <div className="relative inline-block">
                            {/* Your existing Button with handlers */}
                            <Button
                                variant="danger"
                                size="sm"
                                onClick={() => setIsConfirmLeaveOpen(true)}
                                disabled={isLeavingLeague}
                                isLoading={isLeavingLeague}
                                onMouseEnter={() => setShowLeaveTooltip(true)}
                                onMouseLeave={() => setShowLeaveTooltip(false)}
                                aria-describedby="leave-tooltip"
                            >
                                <FaDoorOpen className="mr-1.5 h-4 w-4" />
                                <span className="hidden sm:inline"></span>
                                <span className="sm:hidden">Leave</span>
                            </Button>

                            {/* --- STEP 2: Add Conditionally Rendered Tooltip Div --- */}
                            {showLeaveTooltip && (
                                <div
                                    id="leave-tooltip" // Match aria-describedby
                                    role="tooltip"
                                    // Tailwind classes for styling and positioning
                                    className="absolute z-20 bottom-full left-1/2 mb-2 -translate-x-1/2 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md shadow-sm dark:bg-gray-700 whitespace-nowrap"
                                >
                                    Leave this league (cannot be undone easily)
                                    {/* Optional Arrow */}
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-900 dark:border-t-gray-700"></div>
                                </div>
                            )}
                            {/* --- End Tooltip Div --- */}

                        </div>
                         // <<< End Relative Container >>>
                    )}
                    {/* --- End Leave League Button Area --- */}
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                    {leagueDetails.description && <p className="text-gray-300">{leagueDetails.description}</p>}
                    <p className="text-gray-400"> Created by: <span className="text-gray-200">{leagueDetails.creator.name}</span> </p>
                    <p className="text-gray-400"> Created on: <span className="text-gray-200">{formatDateTime(leagueDetails.createdAt)}</span> </p>
                    {isLeagueAdmin && leagueDetails.inviteCode && (
                        <div className="pt-3 border-t border-gray-700 mt-3 space-y-2">
                            <p className="text-gray-400 font-medium text-sm flex items-center"> <FaCode className="mr-2 h-4 w-4"/> Invite Code: </p>
                            <div className="flex items-center space-x-2 bg-gray-700 p-2 rounded">
                                <span className="text-sky-300 font-mono text-base flex-grow"> {leagueDetails.inviteCode} </span>
                                <Button variant="ghost" size="sm" onClick={handleCopyCode} title="Copy Code"><FaCopy className="h-4 w-4"/></Button>
                                <Button variant="ghost" size="sm" onClick={handleRegenerateCode} disabled={isRegeneratingCode} isLoading={isRegeneratingCode} title="Regenerate Invite Code" className="text-yellow-400 hover:text-yellow-300">
                                    <FaSyncAlt className={`h-4 w-4 ${isRegeneratingCode ? 'animate-spin' : ''}`}/>
                                </Button>
                            </div>
                            <p className="text-xs text-gray-500 italic">Only league admins can see and manage the invite code.</p>
                        </div>
                    )}
                </CardContent>
                {isLeagueAdmin && (
                    <CardFooter className="flex justify-start">
                        <Button onClick={toggleInviteSection} variant="secondary">
                            <FaUserPlus className="mr-2 h-4 w-4" />
                            {showInviteSection ? 'Cancel Invite' : 'Invite Friends'}
                        </Button>
                    </CardFooter>
                )}
            </Card>

            {/* --- Conditionally Rendered Invite Section --- */}
            {isLeagueAdmin && showInviteSection && (
                <Card className="dark:bg-gray-800 border border-gray-700">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center justify-between">
                            Select Friends to Invite
                             <Button onClick={toggleInviteSection} variant="ghost" size="sm" className="text-gray-400 hover:text-red-400 p-1 h-auto"> <FaTimes /> </Button>
                         </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoadingFriends && <div className="p-4 text-center"><Spinner /> Loading friends...</div>}
                        {inviteError && <div className="p-4 text-center text-red-400">{inviteError}</div>}
                        {!isLoadingFriends && !inviteError && invitableFriends.length === 0 && (
                             <p className="text-center text-gray-400 p-4"> No friends available to invite. </p>
                        )}
                        {!isLoadingFriends && !inviteError && invitableFriends.length > 0 && (
                            <div className="space-y-2 max-h-[300px] overflow-y-auto border border-gray-600 rounded p-3">
                                {invitableFriends.map((friend) => (
                                    <div key={friend.userId} className="flex items-center space-x-3 p-1.5 rounded hover:bg-gray-700/50 transition-colors">
                                        <Checkbox
                                            id={`friend-invite-${friend.userId}`}
                                            checked={selectedFriendIds.includes(friend.userId)}
                                            onCheckedChange={(checked) => handleFriendCheckboxChange(friend.userId, checked)}
                                            disabled={isSendingInvites}
                                            className="border-gray-500 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white"
                                        />
                                        <Avatar size="sm" name={friend.name} fullAvatarUrl={friend.avatarUrl} />
                                        <Label htmlFor={`friend-invite-${friend.userId}`} className="font-normal cursor-pointer text-gray-200"> {friend.name} </Label>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                    {!isLoadingFriends && !inviteError && invitableFriends.length > 0 && (
                        <CardFooter className="flex justify-end border-t border-gray-700 pt-4 mt-4">
                             <Button variant="primary" onClick={handleSendInvites} disabled={selectedFriendIds.length === 0 || isSendingInvites} isLoading={isSendingInvites}>
                                <FaPaperPlane className="mr-2 h-4 w-4" /> Send Invites ({selectedFriendIds.length})
                            </Button>
                        </CardFooter>
                    )}
                </Card>
            )}
            {/* --- End Conditional Invite Section --- */}

            {/* Members Card */}
             <Card className="dark:bg-gray-800 border border-gray-700">
                 <CardHeader>
                     <CardTitle className="flex items-center"> <FaUsers className="mr-2 text-purple-400"/> Members ({leagueDetails.memberships.length}) </CardTitle>
                 </CardHeader>
                 <CardContent>
                     <ul className="space-y-3 max-h-96 overflow-y-auto pr-2">
                         {leagueDetails.memberships.map(member => { // 'member' is a LeagueMembership object
                            const memberUser = member.user; // Get the nested user object
                            if (!memberUser) return null; // Skip if user data is missing

                            const isCurrentUser = member.userId === currentUser?.userId;
                            const isCreator = member.userId === leagueDetails.creator.userId;
                            const canRemove = isLeagueAdmin && !isCurrentUser && !isCreator;

                            return (
                                <li key={member.userId} className="flex items-center justify-between bg-gray-700/50 p-2 rounded">
                                    <div className="flex items-center space-x-3 overflow-hidden">
                                        <Avatar size="sm" name={memberUser.name} fullAvatarUrl={memberUser.avatarUrl}/>
                                        <span className="text-gray-100 truncate">{memberUser.name}</span>
                                    </div>
                                    <div className="flex items-center space-x-2 flex-shrink-0">
                                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${member.role === 'ADMIN' ? 'bg-blue-600 text-blue-100' : 'bg-gray-600 text-gray-200'}`}> {member.role} </span>
                                        {canRemove && (
                                           <Button variant="ghost" size="icon" title="Remove Member" className="text-red-500 hover:text-red-400 hover:bg-red-900/30 h-7 w-7 p-1"
                                                onClick={() => openRemoveConfirmation(memberUser)} // Pass the user object
                                                disabled={isRemovingMemberId === member.userId} isLoading={isRemovingMemberId === member.userId} >
                                                {isRemovingMemberId !== member.userId && <FaUserMinus className="h-3.5 w-3.5"/>}
                                           </Button>
                                        )}
                                    </div>
                                </li>
                            );
                         })}
                     </ul>
                 </CardContent>
             </Card>

             {/* --- ADD Leave League Confirmation Modal --- */}
            <ConfirmationModal
                isOpen={isConfirmLeaveOpen}
                onClose={() => setIsConfirmLeaveOpen(false)}
                onConfirm={handleLeaveLeagueConfirm}
                title="Confirm Leave League"
                message={
                    <span>Are you sure you want to leave the league <strong className="text-amber-300">&ldquo;{leagueDetails?.name}&ldquo;</strong>? You will need a new invite code or friend invitation to rejoin.</span>
                }
                confirmText="Leave League"
                confirmButtonVariant="danger" // Use danger variant
                isConfirming={isLeavingLeague}
             />
            {/* --- END Leave League Modal --- */}

            {/* Confirmation Modal for Removing Member */}
             <ConfirmationModal
                isOpen={isConfirmRemoveOpen}
                onClose={() => setIsConfirmRemoveOpen(false)}
                onConfirm={handleRemoveMember}
                title="Confirm Member Removal"
                message={ <span>Are you sure you want to remove <strong className="text-red-300">{memberToRemove?.name}</strong>?</span> }
                confirmText="Remove Member"
                confirmButtonVariant="danger"
                isConfirming={isRemovingMemberId === memberToRemove?.userId}
            />

        </div>
    );
}