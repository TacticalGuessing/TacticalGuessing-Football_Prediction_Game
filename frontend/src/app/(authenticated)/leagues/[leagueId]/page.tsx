// frontend/src/app/(authenticated)/leagues/[leagueId]/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation'; // Import notFound for error handling
import { useAuth } from '@/context/AuthContext';
import {
    getLeagueDetails,
    LeagueDetailsResponse,
    LeagueMemberInfo, // <-- Make sure this was added
    removeLeagueMember,
    regenerateInviteCodeAdmin, // <-- Ensure this is present and spelled correctly
    ApiError
} from '@/lib/api';
import { formatDateTime } from '@/utils/formatters';
import { toast } from 'react-hot-toast';

// UI Components
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import Spinner from '@/components/ui/Spinner';
import Avatar from '@/components/Avatar';
import { Button } from '@/components/ui/Button';
import { FaUserMinus, FaUsers, FaInfoCircle, FaCopy, FaCode, FaSyncAlt } from 'react-icons/fa'; // Add relevant icons

import ConfirmationModal from '@/components/Modal/ConfirmationModal';

export default function LeagueDetailsPage() {
    const { token, isLoading: isAuthLoading, user: currentUser } = useAuth();
    const params = useParams();
    const leagueIdParam = params.leagueId; // Can be string or string[]

    // --- ADD State for Remove Member Modal ---
    const [memberToRemove, setMemberToRemove] = useState<LeagueMemberInfo['user'] | null>(null); // Store the user object of the member to remove
    const [isRemovingMemberId, setIsRemovingMemberId] = useState<number | null>(null); // Track which member ID is being removed
    const [isConfirmRemoveOpen, setIsConfirmRemoveOpen] = useState(false);
    const [isRegeneratingCode, setIsRegeneratingCode] = useState(false);
    // --- END State ---

    // State
    const [leagueDetails, setLeagueDetails] = useState<LeagueDetailsResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Extract and validate leagueId
    const leagueId = typeof leagueIdParam === 'string' ? parseInt(leagueIdParam, 10) : NaN;

    // Fetch League Details
    const fetchDetails = useCallback(async () => {
        if (!token || isNaN(leagueId)) {
             setIsLoading(false);
             // Don't set error if leagueId is just not ready yet
             if(isNaN(leagueId) && leagueIdParam) setError("Invalid League ID.");
             return;
        }

        setIsLoading(true);
        setError(null);
        try {
            console.log(`Fetching details for league ID: ${leagueId}`);
            const data = await getLeagueDetails(leagueId, token);
            setLeagueDetails(data);
        } catch (err) {
            console.error(`Error fetching league details ${leagueId}:`, err);
             const message = err instanceof ApiError ? err.message : "Could not load league details.";
            // If forbidden, maybe redirect or show specific message
            if (err instanceof ApiError && err.status === 403) {
                 setError("You are not a member of this league.");
                 // Optionally redirect: router.push('/dashboard');
            } else if (err instanceof ApiError && err.status === 404) {
                 setError("League not found.");
                 // Can use Next.js notFound() for standard 404 page
                 // notFound(); // Uncomment if using App Router's notFound convention
            } else {
                 setError(message);
            }
             setLeagueDetails(null); // Clear any stale data
        } finally {
            setIsLoading(false);
        }
    }, [token, leagueId, leagueIdParam]); // Add leagueIdParam for robustness

    // Fetch on mount / token change / leagueId change
    useEffect(() => {
        if (token && !isAuthLoading && !isNaN(leagueId)) {
            fetchDetails();
        }
         // Handle case where leagueId is invalid from URL immediately
        else if (leagueIdParam && isNaN(leagueId)) {
             setError("Invalid League ID in URL.");
             setIsLoading(false);
        }
    }, [token, isAuthLoading, leagueId, leagueIdParam, fetchDetails]);

    // Copy Invite Code Handler
    const handleCopyCode = () => {
        if (leagueDetails?.inviteCode) {
            navigator.clipboard.writeText(leagueDetails.inviteCode)
                .then(() => toast.success("Invite code copied to clipboard!"))
                .catch(err => {
                    console.error('Failed to copy invite code: ', err);
                    toast.error("Failed to copy code.");
                });
        }
    };

    // --- ADD Remove Member Handlers ---
    const openRemoveConfirmation = (memberUser: LeagueMemberInfo['user']) => {
        setMemberToRemove(memberUser);
        setIsConfirmRemoveOpen(true);
    };

    const handleRemoveMember = async () => {
        if (!memberToRemove || !token || !leagueDetails) return; // Ensure data is available

        const memberId = memberToRemove.userId;
        const leagueIdToRemoveFrom = leagueDetails.leagueId; // Get leagueId from details

        setIsRemovingMemberId(memberId);
        setIsConfirmRemoveOpen(false);
        const toastId = toast.loading(`Removing ${memberToRemove.name} from league...`);

        try {
            await removeLeagueMember(leagueIdToRemoveFrom, memberId, token); // Call API
            toast.success(`${memberToRemove.name} removed successfully.`, { id: toastId });
            setMemberToRemove(null);
            // Refresh league details to update member list
            fetchDetails(); // Re-call fetch function
        } catch (err) {
            console.error(`Failed to remove member ${memberId}:`, err);
            const message = err instanceof ApiError ? err.message : "Failed to remove member.";
            toast.error(`Error: ${message}`, { id: toastId });
        } finally {
            setIsRemovingMemberId(null); // Clear loading state
        }
    };

    // --- ADD Regenerate Code Handler ---
    const handleRegenerateCode = async () => {
        if (!token || !leagueDetails || !isLeagueAdmin) return; // Check rights

        if (!window.confirm("Are you sure? Regenerating the code will invalidate the current one.")) {
            return;
        }

        setIsRegeneratingCode(true);
        const toastId = toast.loading("Regenerating invite code...");

        try {
            const response = await regenerateInviteCodeAdmin(leagueDetails.leagueId, token);
            // Update the displayed code in local state immediately
            setLeagueDetails(prevDetails => {
                if (!prevDetails) return null;
                return { ...prevDetails, inviteCode: response.inviteCode };
            });
            toast.success(response.message || "Invite code regenerated!", { id: toastId });
        } catch (err) {
             console.error("Regenerate code error:", err);
             const msg = err instanceof ApiError ? err.message : "Failed to regenerate code.";
             toast.error(`Error: ${msg}`, { id: toastId });
        } finally {
             setIsRegeneratingCode(false);
        }
    };
    // --- END Regenerate Code Handler ---
    // --- END Remove Member Handlers ---

    // --- Render Logic ---
    if (isLoading || isAuthLoading) {
        return <div className="p-6 text-center"><Spinner /> Loading League Details...</div>;
    }

     if (error) {
        // You might want a more prominent error display for a full page
        return <div className="p-6 text-center text-red-400 border border-red-700 bg-red-900/30 rounded-md">{error}</div>;
    }

    if (!leagueDetails) {
        // This case handles if fetch completed but data is still null (e.g., 404 was handled gently)
        return <div className="p-6 text-center text-gray-400 italic">League data not available.</div>;
    }

    // Determine if current user is the league admin for display purposes
    const currentUserLeagueRole = leagueDetails.memberships.find(m => m.userId === currentUser?.userId)?.role;
    const isLeagueAdmin = currentUserLeagueRole === 'ADMIN';


    return (
        <div className="space-y-6 p-4 md:p-6">
            {/* Page Title */}
            <h1 className="text-2xl md:text-3xl font-bold text-gray-100 break-words">
                League: {leagueDetails.name}
            </h1>

            {/* Details Card */}
            <Card className="dark:bg-gray-800 border border-gray-700">
                 <CardHeader>
                     <CardTitle className="flex items-center"><FaInfoCircle className="mr-2 text-blue-400"/>Details</CardTitle>
                 </CardHeader>
                 <CardContent className="space-y-3 text-sm">
                     {leagueDetails.description && (
                        <p className="text-gray-300">{leagueDetails.description}</p>
                     )}
                     <p className="text-gray-400">
                        Created by: <span className="text-gray-200">{leagueDetails.creator.name}</span>
                     </p>
                      <p className="text-gray-400">
                        Created on: <span className="text-gray-200">{formatDateTime(leagueDetails.createdAt)}</span>
                     </p>

                     {/* Display Invite Code ONLY if user is League Admin */}
     {isLeagueAdmin && leagueDetails.inviteCode && (
         <div className="pt-3 border-t border-gray-700 mt-3 space-y-2"> {/* Added space-y-2 */}
              <p className="text-gray-400 font-medium text-sm flex items-center"> {/* Adjusted text size */}
                  <FaCode className="mr-2 h-4 w-4"/> Invite Code:
              </p>
             <div className="flex items-center space-x-2 bg-gray-700 p-2 rounded">
                 <span className="text-sky-300 font-mono text-base flex-grow"> {/* Adjusted text size */}
                     {leagueDetails.inviteCode}
                 </span>
                 {/* Copy Button */}
                 <Button variant="ghost" size="sm" onClick={handleCopyCode} title="Copy Code">
                    <FaCopy className="h-4 w-4"/>
                </Button>
                 {/* Regenerate Button */}
                 <Button
                     variant="ghost" size="sm"
                     onClick={handleRegenerateCode}
                     disabled={isRegeneratingCode}
                     isLoading={isRegeneratingCode} // Assumes Button handles isLoading prop
                     title="Regenerate Invite Code (Invalidates Old Code)"
                     className="text-yellow-400 hover:text-yellow-300"
                 >
                    <FaSyncAlt className={`h-4 w-4 ${isRegeneratingCode ? 'animate-spin' : ''}`}/> {/* Basic spin */}
                </Button>
             </div>
             <p className="text-xs text-gray-500 italic">Only league admins can see and manage the invite code.</p>
         </div>
     )}

                 </CardContent>
            </Card>

             {/* Members Card */}
             <Card className="dark:bg-gray-800 border border-gray-700">
                 <CardHeader>
                     <CardTitle className="flex items-center">
                         <FaUsers className="mr-2 text-purple-400"/> Members ({leagueDetails.memberships.length})
                    </CardTitle>
                 </CardHeader>
                 <CardContent>
                 <ul className="space-y-3 max-h-96 overflow-y-auto pr-2">
         {leagueDetails.memberships.map(member => {
              // Determine if button should be shown/enabled
              const isCurrentUser = member.userId === currentUser?.userId;
              const isCreator = member.userId === leagueDetails.creator.userId;
              const canRemove = isLeagueAdmin && !isCurrentUser && !isCreator; // Admin can remove others, not self, not creator

              return (
                 <li key={member.userId} className="flex items-center justify-between bg-gray-700/50 p-2 rounded">
                     <div className="flex items-center space-x-3 overflow-hidden">
                         <Avatar size="sm" name={member.user.name} fullAvatarUrl={member.user.avatarUrl}/>
                         <span className="text-gray-100 truncate">{member.user.name}</span>
                     </div>
                     <div className="flex items-center space-x-2 flex-shrink-0"> {/* Container for role and button */}
                         <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${member.role === 'ADMIN' ? 'bg-blue-600 text-blue-100' : 'bg-gray-600 text-gray-200'}`}>
                             {member.role}
                         </span>
                         {/* --- ADD Remove Button Conditionally --- */}
                         {canRemove && (
                            <Button
                                variant="ghost" size="icon" title="Remove Member"
                                className="text-red-500 hover:text-red-400 hover:bg-red-900/30 h-7 w-7 p-1"
                                onClick={() => openRemoveConfirmation(member.user)} // Pass the user object
                                disabled={isRemovingMemberId === member.userId}
                                isLoading={isRemovingMemberId === member.userId}
                            >
                                 {isRemovingMemberId !== member.userId && <FaUserMinus className="h-3.5 w-3.5"/>}
                            </Button>
                         )}
                         {/* --- END Remove Button --- */}
                     </div>
                 </li>
             );
         })}
     </ul>
                 </CardContent>
             </Card>

             <ConfirmationModal
             isOpen={isConfirmRemoveOpen}
             onClose={() => setIsConfirmRemoveOpen(false)}
             onConfirm={handleRemoveMember} // Call the remove handler
             title="Confirm Member Removal"
             message={
                 <span>Are you sure you want to remove <strong className="text-red-300">{memberToRemove?.name}</strong> from the league?</span>
             }
             confirmText="Remove Member"
             confirmButtonVariant="danger"
             isConfirming={isRemovingMemberId === memberToRemove?.userId} // Show loading on confirm button
         />

             

        </div>
    );
}