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
    ApiError
} from '@/lib/api';

// Import UI Components & Icons
import { Button } from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import CreateLeagueModal from '@/components/Leagues/CreateLeagueModal';
import JoinLeagueModal from '@/components/Leagues/JoinLeagueModal';
import {
    FaUser, FaCog, FaListAlt, FaChartBar, FaUserFriends, FaPlus, FaSignInAlt, FaChevronDown, FaChevronRight, FaTrophy
} from 'react-icons/fa';

// Define NavLink interface
interface ProfileNavLink {
    href: string;
    label: string;
    icon: IconType;
}

export default function ProfileSidebar() {
    const pathname = usePathname();
    const { token } = useAuth();

    // State for leagues and modals
    const [myLeagues, setMyLeagues] = useState<MyLeagueInfo[]>([]);
    const [isLoadingLeagues, setIsLoadingLeagues] = useState(true);
    const [leaguesError, setLeaguesError] = useState<string | null>(null);
    const [isCreateLeagueModalOpen, setIsCreateLeagueModalOpen] = useState(false);
    const [isJoinLeagueModalOpen, setIsJoinLeagueModalOpen] = useState(false);
    const [showLeagues, setShowLeagues] = useState(true);

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
        { href: '/profile/statistics', label: 'Statistics', icon: FaChartBar },
        { href: '/profile/friends', label: 'Friends', icon: FaUserFriends },
    ];

    const baseLinkClasses = 'flex items-center p-2 rounded-lg text-gray-300 hover:bg-gray-700 group w-full text-left';
    const activeLinkClasses = 'bg-gray-600 text-white';

    return (
        <> {/* Use Fragment */}
            <aside id="profile-sidebar" className="fixed top-0 left-0 z-40 w-64 h-screen transition-transform -translate-x-full sm:translate-x-0" aria-label="Profile Sidebar">
                <div className="h-full px-3 py-4 overflow-y-auto bg-gray-800 border-r border-gray-700 flex flex-col">

                    {/* Main Navigation */}
                    <nav className="mb-4">
                        <ul className="space-y-1 font-medium">
                            {mainNavItems.map((item) => (
                                <li key={item.href}>
                                    <Link
                                        href={item.href}
                                        className={clsx(baseLinkClasses, pathname === item.href && activeLinkClasses)}
                                    >
                                        <item.icon className="w-5 h-5 text-gray-500 transition duration-75 group-hover:text-gray-200" />
                                        <span className="ms-3 flex-1 whitespace-nowrap">{item.label}</span>
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
                            className={clsx(baseLinkClasses, "justify-between")}
                         >
                             <span className='flex items-center'>
                                 <FaTrophy className="w-5 h-5 text-gray-500 transition duration-75 group-hover:text-gray-200" />
                                <span className="ms-3 flex-1 whitespace-nowrap font-medium">My Leagues</span>
                             </span>
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
                                                     <li key={league.leagueId} className="text-xs">
                                                         {/* --- MODIFICATION: Wrap in Link --- */}
                                                         <Link
                                                            href={`/leagues/${league.leagueId}`} // Link to league details page
                                                            className={clsx(
                                                                "flex items-center justify-between p-1.5 rounded-lg text-gray-300 hover:bg-gray-700/50 group w-full text-left",
                                                                // Optionally highlight active league page?
                                                                // pathname === `/leagues/${league.leagueId}` && "bg-gray-600 text-white"
                                                            )}
                                                         >
                                                            {/* League Name */}
                                                            <span className="ms-1 flex-grow whitespace-nowrap truncate" title={league.name}>
                                                                {league.name}
                                                            </span>
                                                            {/* Role Badge */}
                                                             <span className={`ml-2 flex-shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${league.myLeagueRole === 'ADMIN' ? 'bg-blue-600 text-blue-100' : 'bg-gray-600 text-gray-200'}`}>
                                                                {league.myLeagueRole}
                                                             </span>
                                                         </Link>
                                                         {/* --- END Link --- */}

                                                         {/* Conditionally show Invite Code for Admins */}
                                                         {league.myLeagueRole === 'ADMIN' && league.inviteCode && (
                                                            <div className="pl-4 pr-1.5 py-0.5 text-xs text-sky-300 bg-gray-700 rounded-b-md -mt-1 flex items-center justify-between">
                                                                <span>Code: <strong className="font-mono">{league.inviteCode}</strong></span>
                                                                {/* Add copy button here if desired later */}
                                                            </div>
                                                         )}
                                                     </li>
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
        </>
    );
}