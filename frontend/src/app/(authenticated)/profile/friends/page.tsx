// frontend/src/app/(authenticated)/profile/friends/page.tsx
'use client';

// --- Imports ---
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
    getMyFriends,
    getPendingRequests,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,
    searchUsers,         // <-- Ensure imported
    sendFriendRequest,   // <-- Ensure imported
    FriendUser,
    PendingFriendRequest,
    ApiError
} from '@/lib/api';
import { toast } from 'react-hot-toast';
//import { formatDistanceToNow } from 'date-fns'; // Keep if needed for request timestamps

import { PendingLeagueInvites } from '@/components/Leagues/PendingLeagueInvites'; // Adjust path if needed

// Import UI Components
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import Spinner from '@/components/ui/Spinner';
import Avatar from '@/components/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FaUserPlus, FaUserCheck, FaUserTimes, FaUserMinus, FaUsers } from 'react-icons/fa';
import ConfirmationModal from '@/components/Modal/ConfirmationModal';

// --- Debounce Helper ---
// FIX: Disable eslint rule for 'any' type in this helper
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    
    return (...args: Parameters<F>): void => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            func(...args);
        }, waitFor);
    };
}


// --- Component ---
export default function FriendsPage() {
    const { user, token, isLoading: isAuthLoading, refreshNotificationStatus } = useAuth();

    // --- State ---
    const [myFriends, setMyFriends] = useState<FriendUser[]>([]);
    const [isLoadingFriends, setIsLoadingFriends] = useState(true);
    const [friendsError, setFriendsError] = useState<string | null>(null);

    const [pendingRequests, setPendingRequests] = useState<PendingFriendRequest[]>([]);
    const [isLoadingRequests, setIsLoadingRequests] = useState(true);
    const [requestsError, setRequestsError] = useState<string | null>(null);

    // State for actions
    const [actioningRequestId, setActioningRequestId] = useState<number | null>(null); // For accept/reject
    const [removingFriendId, setRemovingFriendId] = useState<number | null>(null);   // For remove confirmation
    const [friendToRemove, setFriendToRemove] = useState<FriendUser | null>(null);   // For remove confirmation modal
    const [isConfirmRemoveOpen, setIsConfirmRemoveOpen] = useState(false);         // For remove confirmation modal

    // State for Add Friend search
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<FriendUser[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [addingFriendId, setAddingFriendId] = useState<number | null>(null); // For add friend button loading

    // --- Fetch Functions ---
    const fetchMyFriends = useCallback(async () => {
        if (!token) return;
        setIsLoadingFriends(true); setFriendsError(null);
        try {
            const data = await getMyFriends(token);
            setMyFriends(data);
        } catch (err) {
            const msg = err instanceof ApiError ? err.message : "Could not load friends list.";
            setFriendsError(msg); console.error("Error fetching friends:", err);
        } finally { setIsLoadingFriends(false); }
    }, [token]);

    const fetchPendingRequests = useCallback(async () => {
        if (!token) return;
        setIsLoadingRequests(true); setRequestsError(null);
        try {
            const data = await getPendingRequests(token);
            setPendingRequests(data);
        } catch (err) {
             const msg = err instanceof ApiError ? err.message : "Could not load friend requests.";
            setRequestsError(msg); console.error("Error fetching requests:", err);
        } finally { setIsLoadingRequests(false); }
    }, [token]);

     // --- Debounced Search Function ---
     // eslint-disable-next-line react-hooks/exhaustive-deps
     const debouncedSearch = useCallback(
         debounce(async (query: string, authToken: string) => {
             if (query.trim().length < 2) {
                 setSearchResults([]);
                 setIsSearching(false);
                 setSearchError(null); // Clear error on short query
                 return;
             }
             setIsSearching(true);
             setSearchError(null);
             try {
                 const results = await searchUsers(query, authToken);
                 setSearchResults(results);
             } catch (err) {
                 const msg = err instanceof ApiError ? err.message : "Search failed.";
                 setSearchError(msg);
                 setSearchResults([]);
             } finally {
                 setIsSearching(false);
             }
         }, 500), // 500ms debounce delay
     [token]); // Include token if needed by searchUsers, otherwise empty array

     // --- Handler Functions (Modify Accept/Reject, Keep Others) ---
     const handleAcceptRequest = useCallback(async (requestId: number) => {
        if (!token || actioningRequestId) return;
        setActioningRequestId(requestId);
        try {
            await acceptFriendRequest(requestId, token);
            toast.success("Friend request accepted!");
            fetchMyFriends();
            fetchPendingRequests();
            refreshNotificationStatus?.(); // <<< ADD THIS CALL
        } catch (err) { const msg = err instanceof ApiError ? err.message : "Failed to accept request."; toast.error(msg); }
        finally { setActioningRequestId(null); }
        // <<< ADD refreshNotificationStatus to dependencies >>>
   }, [token, fetchMyFriends, fetchPendingRequests, actioningRequestId, refreshNotificationStatus]);

   const handleRejectRequest = useCallback(async (requestId: number) => {
    if (!token || actioningRequestId) return;
    setActioningRequestId(requestId);
    try {
        await rejectFriendRequest(requestId, token);
        toast.success("Friend request rejected.");
        fetchPendingRequests();
        refreshNotificationStatus?.(); // <<< ADD THIS CALL
    } catch (err) { const msg = err instanceof ApiError ? err.message : "Failed to reject request."; toast.error(msg); }
    finally { setActioningRequestId(null); }
    // <<< ADD refreshNotificationStatus to dependencies >>>
}, [token, fetchPendingRequests, actioningRequestId, refreshNotificationStatus]);

    const openRemoveConfirmation = (friend: FriendUser) => {
        setFriendToRemove(friend);
        setIsConfirmRemoveOpen(true);
    };

    const handleRemoveFriend = async () => {
        if (!friendToRemove || !token) return;
        const friendId = friendToRemove.userId;
        setRemovingFriendId(friendId);
        setIsConfirmRemoveOpen(false);
        const toastId = toast.loading(`Removing friend ${friendToRemove.name}...`);
        try {
            await removeFriend(friendId, token);
            toast.success("Friend removed.", { id: toastId });
             fetchMyFriends(); // Refetch friends
             setFriendToRemove(null);
        } catch (err) { const msg = err instanceof ApiError ? err.message : "Failed to remove friend."; toast.error(msg, { id: toastId }); }
        finally { setRemovingFriendId(null); }
    };

    // Handler for search input change
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;
        setSearchQuery(query);
        if (token) {
             // Trigger debounced search
             debouncedSearch(query, token);
        } else {
             // Clear results if no token or query is cleared by user
             setSearchResults([]);
             setIsSearching(false);
             setSearchError(null);
        }
    };

    // Handler for Add Friend button click
    const handleAddFriendClick = async (userIdToAdd: number) => {
         if (!token) return;
         setAddingFriendId(userIdToAdd);
         try {
             await sendFriendRequest(userIdToAdd, token);
             toast.success("Friend request sent!");
             setSearchResults(prevResults => prevResults.filter(u => u.userId !== userIdToAdd));
             // Optionally clear search query?
             // setSearchQuery('');
             // Optionally refetch pending sent requests if displaying them?
         } catch (err) {
             const msg = err instanceof ApiError ? err.message : "Failed to send request.";
             toast.error(msg);
             console.error("Add friend error:", err);
         } finally {
             setAddingFriendId(null);
         }
     };

    // --- Initial Data Fetch Effect ---
    useEffect(() => {
        if (token && !isAuthLoading) {
            fetchMyFriends();
            fetchPendingRequests();
        }
    }, [token, isAuthLoading, fetchMyFriends, fetchPendingRequests]); // Include all fetch functions

    // --- >>> ADD Callback for Invite Actions <<< ---
    const handleInviteAction = useCallback(() => {
        console.log("FriendsPage: handleInviteAction called. Calling refreshNotificationStatus..."); // <<< ADD LOG
        refreshNotificationStatus?.(); // Refresh notifications via context
    // Ensure refreshNotificationStatus is stable or included in dependencies if needed elsewhere
    }, [refreshNotificationStatus]);
    // --- End Callback ---

    // --- Render Logic ---
    if (isAuthLoading) {
        return <div className="p-6 text-center"><Spinner /> Loading...</div>;
    }
     if (!user) { // Should be handled by layout protection, but good fallback
          return <p className="p-4 text-red-400">Please log in to manage friends.</p>;
     }

    return (
        <div className="space-y-6 p-4 md:p-6">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-100 flex items-center">
                <FaUsers className="mr-3 text-gray-400" /> Friends
            </h1>

            {/* --- >>> ADD Pending League Invites Component Rendering <<< --- */}
             {/* Place it strategically, e.g., before the main grid */}
             <PendingLeagueInvites onInviteAction={handleInviteAction} />
             {/* --- End Render Component --- */}

            {/* Main Grid for Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Column 1: My Friends List */}
                <Card className="dark:bg-gray-800 border border-gray-700 flex flex-col"> {/* Added flex flex-col */}
                    <CardHeader>
                        <CardTitle>My Friends ({myFriends.length})</CardTitle>
                    </CardHeader>
                    {/* Make content scrollable */}
                    <CardContent className="flex-grow overflow-y-auto max-h-[calc(100vh-300px)] pr-2"> {/* Adjusted max-h, added flex-grow */}
                        {isLoadingFriends ? <div className="pt-4 text-center"><Spinner/></div> : friendsError ? <p className="text-red-400 text-sm">{friendsError}</p> : (
                            <ul className="space-y-3">
                                {myFriends.length === 0 ? (
                                    <li className="text-gray-400 italic text-sm">Search for users to add friends.</li>
                                ) : (
                                    myFriends.map(friend => (
                                        <li key={friend.userId} className="flex items-center justify-between bg-gray-700/50 p-2 rounded">
                                            <div className="flex items-center space-x-3 overflow-hidden"> {/* Added overflow-hidden */}
                                                <Avatar size="sm" name={friend.name} fullAvatarUrl={friend.avatarUrl}/>
                                                <span className="text-gray-100 truncate">{friend.name}</span> {/* Added truncate */}
                                            </div>
                                            <Button
                                                variant="ghost" size="icon" title="Remove Friend"
                                                className="text-red-500 hover:text-red-400 hover:bg-red-900/30 h-7 w-7 p-1 flex-shrink-0" // Added flex-shrink-0
                                                onClick={() => openRemoveConfirmation(friend)}
                                                disabled={removingFriendId === friend.userId}
                                                isLoading={removingFriendId === friend.userId}
                                            >
                                                 {removingFriendId !== friend.userId && <FaUserMinus className="h-3.5 w-3.5"/>}
                                            </Button>
                                        </li>
                                    ))
                                )}
                            </ul>
                        )}
                    </CardContent>
                </Card>

                {/* Column 2: Pending Requests & Add Friend */}
                <div className="space-y-6">
                     {/* Pending Incoming Requests Card */}
                     <Card className="dark:bg-gray-800 border border-gray-700 flex flex-col"> {/* Added flex flex-col */}
                         <CardHeader>
                             <CardTitle>Pending Friend Requests ({pendingRequests.length})</CardTitle>
                         </CardHeader>
                         <CardContent className="flex-grow overflow-y-auto max-h-60 pr-2"> {/* Adjusted max-h, added flex-grow */}
                            {isLoadingRequests ? <div className="pt-4 text-center"><Spinner/></div> : requestsError ? <p className="text-red-400 text-sm">{requestsError}</p> : (
                                <ul className="space-y-3">
                                    {pendingRequests.length === 0 ? (
                                         <li className="text-gray-400 italic text-sm">No pending requests.</li>
                                    ) : (
                                        pendingRequests.map(req => (
                                            <li key={req.id} className="flex items-center justify-between bg-gray-700/50 p-2 rounded">
                                                 <div className="flex items-center space-x-3 overflow-hidden"> {/* Added overflow-hidden */}
                                                     <Avatar size="sm" name={req.requester.name} fullAvatarUrl={req.requester.avatarUrl}/>
                                                     <span className="text-gray-100 truncate">{req.requester.name}</span> {/* Added truncate */}
                                                 </div>
                                                 <div className="flex space-x-2 flex-shrink-0"> {/* Added flex-shrink-0 */}
                                                     <Button variant="ghost" size="icon" title="Accept" className="text-green-500 hover:text-green-400 hover:bg-green-900/30 h-7 w-7 p-1" onClick={() => handleAcceptRequest(req.id)} disabled={actioningRequestId === req.id} isLoading={actioningRequestId === req.id}><FaUserCheck className="h-3.5 w-3.5"/></Button>
                                                     <Button variant="ghost" size="icon" title="Reject" className="text-red-500 hover:text-red-400 hover:bg-red-900/30 h-7 w-7 p-1" onClick={() => handleRejectRequest(req.id)} disabled={actioningRequestId === req.id} isLoading={actioningRequestId === req.id}><FaUserTimes className="h-3.5 w-3.5"/></Button>
                                                 </div>
                                            </li>
                                        ))
                                    )}
                                </ul>
                            )}
                         </CardContent>
                    </Card>

                    {/* Add Friend Card */}
                     <Card className="dark:bg-gray-800 border border-gray-700">
                         <CardHeader>
                            <CardTitle>Add Friend</CardTitle>
                            <CardDescription>Search by name or email (min. 2 chars).</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {/* Search Input */}
                            <div className="flex space-x-2 items-center"> {/* Added items-center */}
                                <Input
                                    type="text"
                                    placeholder="Enter username or email..."
                                    className="flex-grow"
                                    value={searchQuery}
                                    onChange={handleSearchChange}
                                 />
                                 {isSearching && <Spinner className="h-5 w-5 text-gray-400"/>}
                             </div>

                            {/* Search Results / Error */}
                            {/* Give results area a defined height and scroll */}
                            <div className="min-h-[100px] max-h-48 overflow-y-auto pr-2 border-t border-gray-700 pt-3">
                                 {searchError && <p className="text-red-400 text-sm">{searchError}</p>}
                                 {!isSearching && !searchError && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                                     <p className="text-gray-400 italic text-sm">No matching users found.</p>
                                 )}
                                 {!isSearching && searchResults.length > 0 && (
                                     <ul className="space-y-2">
                                         {searchResults.map(foundUser => (
                                             <li key={foundUser.userId} className="flex items-center justify-between bg-gray-700/50 p-2 rounded text-sm">
                                                  <div className="flex items-center space-x-2 overflow-hidden">
                                                     <Avatar size="sm" name={foundUser.name} fullAvatarUrl={foundUser.avatarUrl}/>
                                                     <span className="text-gray-100 truncate">{foundUser.name}</span>
                                                 </div>
                                                 <Button
                                                     variant="outline"
                                                     size="sm"
                                                     className="text-xs flex-shrink-0" // Added flex-shrink-0
                                                     onClick={() => handleAddFriendClick(foundUser.userId)}
                                                     disabled={addingFriendId === foundUser.userId}
                                                     isLoading={addingFriendId === foundUser.userId}
                                                 >
                                                     <FaUserPlus className="mr-1.5 h-3 w-3"/> Add
                                                 </Button>
                                             </li>
                                         ))}
                                     </ul>
                                 )}
                             </div>
                         </CardContent>
                     </Card>
                     {/* End Add Friend Card */}
                </div> {/* End Column 2 */}

            </div> {/* End Grid */}

            {/* Confirmation Modal for Removing Friend */}
             <ConfirmationModal
                 isOpen={isConfirmRemoveOpen}
                 onClose={() => setIsConfirmRemoveOpen(false)}
                 onConfirm={handleRemoveFriend}
                 title="Remove Friend"
                 message={
                     <span>Are you sure you want to remove <strong className="text-red-300">{friendToRemove?.name}</strong> as a friend?</span>
                 }
                 confirmText="Remove"
                 confirmButtonVariant="danger"
                 isConfirming={removingFriendId === friendToRemove?.userId}
             />

        </div> // End Page Container
    );
}