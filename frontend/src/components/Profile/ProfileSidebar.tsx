// frontend/src/components/Profile/ProfileSidebar.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { IconType } from 'react-icons'; // Correct type for icons
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { useAuth } from '@/context/AuthContext';

// Import API functions and types
import {
    getMyLeagues,
    MyLeagueInfo, // Make sure this type includes leagueId, name, myLeagueRole, inviteCode?
    ApiError,
    deleteLeagueAdmin
} from '@/lib/api';

// Import UI Components & Icons
import { Button } from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import CreateLeagueModal from '@/components/Leagues/CreateLeagueModal';
import ConfirmationModal from '@/components/Modal/ConfirmationModal';
import JoinLeagueModal from '@/components/Leagues/JoinLeagueModal';
import {
    FaUser, FaCog, FaListAlt, FaChartBar, FaUserFriends, FaPlus, FaSignInAlt, FaChevronDown, FaChevronRight, FaTrophy, FaTrashAlt
} from 'react-icons/fa';

import { toast } from 'react-hot-toast'; // <<< Import toast

// --- ADD Notification Dot Component ---
const NotificationDot = () => (
    // Positioned relative to the parent Link (needs parent `relative` class)
    <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-red-500 ring-1 ring-red-500 z-10"></span> // Adjusted ring offset color
);
// --- END Notification Dot Component ---

// Define NavLink interface
interface ProfileNavLink {
    href: string;
    label: string;
    icon: IconType;
    notify?: boolean; // <<< ADDED Optional notify flag
}

export default function ProfileSidebar() {
    const pathname = usePathname();
    const { token, hasPendingFriendRequests, hasPendingLeagueInvites } = useAuth();

    console.log('[ProfileSidebar Render] Friend Status:', hasPendingFriendRequests, 'League Status:', hasPendingLeagueInvites);

    // State for leagues and modals
    const [myLeagues, setMyLeagues] = useState<MyLeagueInfo[]>([]);
    const [isLoadingLeagues, setIsLoadingLeagues] = useState(true);
    const [leaguesError, setLeaguesError] = useState<string | null>(null);
    const [isCreateLeagueModalOpen, setIsCreateLeagueModalOpen] = useState(false);
    const [isJoinLeagueModalOpen, setIsJoinLeagueModalOpen] = useState(false);
    const [showLeagues, setShowLeagues] = useState(true);
    const [leagueToDelete, setLeagueToDelete] = useState<MyLeagueInfo | null>(null);
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
    const [isDeletingLeague, setIsDeletingLeague] = useState(false);

    // Fetch Leagues Function
    const fetchMyLeagues = useCallback(async () => {
        if (!token) { setIsLoadingLeagues(false); return; }
        setLeaguesError(null);
        try {
            const data = await getMyLeagues(token);
            setMyLeagues(data);
        } catch (err) {
            const msg = err instanceof ApiError ? err.message : "Could not load your leagues.";
            setLeaguesError(msg); console.error("[Sidebar] Error fetching leagues:", err);
        } finally {
            setIsLoadingLeagues(false);
        }
    }, [token]);

    // Initial Fetch for Leagues
    useEffect(() => {
        if (token) {
            setIsLoadingLeagues(true);
            fetchMyLeagues();
        }
    }, [token, fetchMyLeagues]);


    // --- Main Navigation Links ---
    const mainNavItems: ProfileNavLink[] = [
        { href: '/profile', label: 'View Profile', icon: FaUser },
        { href: '/profile/settings', label: 'Settings', icon: FaCog },
        { href: '/profile/predictions', label: 'My Predictions', icon: FaListAlt },
        { href: '/profile/settings/statistics', label: 'Statistics', icon: FaChartBar },
        { href: '/profile/friends', label: 'Friends', icon: FaUserFriends, notify: hasPendingFriendRequests || hasPendingLeagueInvites },
    ];

    const baseLinkClasses = 'flex items-center p-2 text-gray-300 hover:bg-gray-700 group w-full text-left';
    const activeLinkClasses = 'bg-gray-600 text-white';

    // --- ADD Delete League Handlers ---
    const openDeleteConfirmation = (league: MyLeagueInfo) => {
        setLeagueToDelete(league);
        setIsConfirmDeleteOpen(true);
    };

    const handleDeleteLeague = async () => {
        if (!leagueToDelete || !token || isDeletingLeague) return;

        const leagueId = leagueToDelete.leagueId;
        setIsDeletingLeague(true);
        setIsConfirmDeleteOpen(false);
        const toastId = toast.loading(`Deleting league "${leagueToDelete.name}"...`);

        try {
            // <<< Call the new API function (to be created) >>>
            await deleteLeagueAdmin(leagueId, token);
            toast.success(`League "${leagueToDelete.name}" deleted successfully.`, { id: toastId });
            setLeagueToDelete(null);
            // Refresh league list
            fetchMyLeagues();
        } catch (err) {
             console.error(`Failed to delete league ${leagueId}:`, err);
             const message = err instanceof ApiError ? err.message : "Failed to delete league.";
             toast.error(`Error: ${message}`, { id: toastId });
        } finally {
            setIsDeletingLeague(false);
        }
    };
    // --- END Delete League Handlers ---

    // --- >>> ADD RENDER LOG <<< ---
    console.log('[ProfileSidebar Render] Friend Status:', hasPendingFriendRequests, 'League Status:', hasPendingLeagueInvites);

    return (
        <> {/* Use Fragment */}
            <aside id="profile-sidebar" className="fixed top-0 left-0 z-40 w-64 h-screen transition-transform -translate-x-full sm:translate-x-0" aria-label="Profile Sidebar">
                <div className="h-full px-3 py-4 overflow-y-auto bg-gray-800 border-r border-gray-700 flex flex-col">

                    {/* Main Navigation */}
                    <nav className="mb-4 mt-4">
                        <ul className="space-y-1 font-medium">
                            {mainNavItems.map((item) => (
                                <li key={item.href}>
                                     <Link
                                        href={item.href}
                                        className={clsx(baseLinkClasses, pathname === item.href && activeLinkClasses, "relative")} // Added relative class
                                    >
                                        <item.icon className="w-5 h-5 text-gray-500 transition duration-75 group-hover:text-gray-200" />
                                        <span className="ms-3 flex-1 whitespace-nowrap">{item.label}</span>
                                        {/* <<< Conditionally render the dot >>> */}
                                        {item.notify && <NotificationDot />}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </nav>

                    {/* Divider */}
                    <hr className="my-3 border-gray-600" />

                    {/* My Leagues Section */}
                    <div className="flex-grow flex flex-col min-h-0">
                        {/* Toggle Button */}
                         <button
                            onClick={() => setShowLeagues(!showLeagues)}
                            className={clsx(baseLinkClasses, "justify-between", "relative")}
                         >
                              <span className='flex items-center'>
                                 <FaTrophy className="w-5 h-5 text-gray-500 transition duration-75 group-hover:text-gray-200" />
                                <span className="ms-3 flex-1 whitespace-nowrap font-medium">My Leagues</span>
                             </span>
                             {/* <<< Conditionally render the dot on the toggle button >>> */}
                             
                             {showLeagues ? <FaChevronDown className="w-3 h-3"/> : <FaChevronRight className="w-3 h-3"/>}
                         </button>

                        {/* League List - Conditionally Rendered */}
                        {showLeagues && (
                            <div className="mt-2 space-y-1 flex-grow overflow-y-auto pr-1"> {/* Reduced space-y */}
                                {isLoadingLeagues ? (
                                    <div className="text-center py-2">
                                        <Spinner className="h-4 w-4 text-gray-400 inline-block"/>
                                    </div>
                                ) : leaguesError ? (
                                    <p className="text-xs text-red-400 px-2">{leaguesError}</p>
                                ) : (
                                    <>
                                        {myLeagues.length === 0 ? (
                                            <p className="text-xs text-gray-400 italic px-2">No leagues joined yet.</p>
                                        ) : (
                                            <ul className="space-y-1">
                                                {myLeagues.map(league => (
                                                     // <<< MODIFY li content >>>
                                                     <li key={league.leagueId} className="group text-xs flex items-center justify-between hover:bg-gray-700/30 rounded-lg"> {/* Add group hover */}
                                                         {/* Delete Button (Admin Only) */}
                                                         {league.myLeagueRole === 'ADMIN' && (
                                                             <Button
                                                                 variant="ghost"
                                                                 size="icon"
                                                                 className="text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-1 flex-shrink-0" // Show on hover
                                                                 onClick={(e) => { e.stopPropagation(); openDeleteConfirmation(league); }} // Prevent link navigation
                                                                 disabled={isDeletingLeague}
                                                                 aria-label={`Delete league ${league.name}`}
                                                                 title="Delete League"
                                                             >
                                                                 <FaTrashAlt className="h-3 w-3" />
                                                             </Button>
                                                         )}
                                                          {/* Filler space if not admin to keep alignment */}
                                                         {league.myLeagueRole !== 'ADMIN' && (
                                                            <div className="w-6 h-6 flex-shrink-0"></div>
                                                         )}

                                                         {/* Link to League */}
                                                         <Link
                                                            href={`/leagues/${league.leagueId}`}
                                                            className="flex-grow flex items-center justify-between p-1.5 text-gray-300 group-hover:text-white" // Adjusted classes for inner link
                                                         >
                                                            <span className="ms-1 flex-grow whitespace-nowrap truncate" title={league.name}>
                                                                {league.name}
                                                            </span>
                                                            <span className={`ml-2 flex-shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${league.myLeagueRole === 'ADMIN' ? 'bg-blue-600 text-blue-100' : 'bg-gray-600 text-gray-200'}`}>
                                                                {league.myLeagueRole}
                                                             </span>
                                                         </Link>

                                                         {/* --- REMOVE Invite Code Div --- */}
                                                         {/* {league.myLeagueRole === 'ADMIN' && league.inviteCode && ( ... )} */}
                                                         {/* --- END REMOVAL --- */}
                                                     </li>
                                                    // <<< END MODIFY li content >>>
                                                ))}
                                            </ul>
                                        )}
                                    </>
                                )}
                             </div>
                         )}

                        {/* Create/Join Buttons */}
                         <div className="mt-auto pt-4 space-y-2">
                            <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => setIsJoinLeagueModalOpen(true)}>
                                <FaSignInAlt className="mr-2 h-3 w-3"/> Join League
                             </Button>
                             <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => setIsCreateLeagueModalOpen(true)}>
                                 <FaPlus className="mr-2 h-3 w-3"/> Create League
                            </Button>
                         </div>
                    </div>
                </div>
            </aside>

            {/* Render Modals */}
            <CreateLeagueModal
                isOpen={isCreateLeagueModalOpen}
                onClose={() => setIsCreateLeagueModalOpen(false)}
                onLeagueCreated={fetchMyLeagues}
            />
            <JoinLeagueModal
                 isOpen={isJoinLeagueModalOpen}
                 onClose={() => setIsJoinLeagueModalOpen(false)}
                 onLeagueJoined={fetchMyLeagues}
            />

            {/* --- ADD Delete League Confirmation Modal --- */}
            <ConfirmationModal
                isOpen={isConfirmDeleteOpen}
                onClose={() => setIsConfirmDeleteOpen(false)}
                onConfirm={handleDeleteLeague}
                title="Confirm League Deletion"
                message={
                    <span>Are you sure you want to permanently delete the league <strong className="text-red-300">“{leagueToDelete?.name}“</strong>? This action cannot be undone.</span>
                }
                confirmText="Delete League"
                confirmButtonVariant="danger"
                isConfirming={isDeletingLeague}
            />
            {/* --- END Delete Modal --- */}
        </>
    );
}