// frontend/src/components/Header.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { usePathname} from 'next/navigation';
import Avatar from './Avatar'; // Your Avatar component
import { Button } from './ui/Button'; // Using Button from ui directory
// Import icons needed now and for next steps
import { FaHome, FaClipboardList, FaPoll, FaTrophy, FaUserCog, FaSignOutAlt } from 'react-icons/fa';
import { clsx } from 'clsx'; // Import clsx for easier class management

export default function Header() {
    // <<< Destructure the new notification flags from useAuth >>>
    const { user, logout, isLoading, hasPendingFriendRequests, hasPendingLeagueInvites } = useAuth();
    const pathname = usePathname();
    //const router = useRouter();

    

    const handleLogout = () => {
        logout();
        // Redirect is handled within logout function in AuthContext
    };

    // Updated isActive to handle base dashboard route specifically
    const isActive = (href: string) => {
        if (href === '/admin') {
            return pathname?.startsWith(href);
        }
        if (href === '/dashboard') { // Exact match for dashboard/home
             return pathname === href;
        }
        // Exact match for others by default (can adjust if needed)
        return pathname === href;
    };

    // Link styling classes - Using rounded-sm
    const linkBaseClasses = "text-sm px-3 py-1.5 rounded-sm transition-colors duration-150 ease-in-out flex items-center"; // Use rounded-sm
    const linkInactiveClasses = "text-gray-300";
    const linkActiveClasses = "bg-gray-700 text-white font-medium";
    // Admin link styles removed as Button component handles variants

    // <<< Combine notification flags >>>
    const hasNotifications = hasPendingFriendRequests || hasPendingLeagueInvites;

    return (
        <header className="bg-gray-800 border-b border-gray-700 shadow-sm sticky top-0 z-50 h-16">
            <nav className="w-full px-4 md:px-6 py-2 flex justify-between items-center h-full">

                {/* Left Side: Logo */}
                <div className="flex-shrink-0">
                    <Link href={user ? "/dashboard" : "/"} className="block" title="Tactical Guessing Home">
                         <Image src="/tactical-guessing-logo.png" alt="Tactical Guessing Logo" width={180} height={36} priority />
                    </Link>
                </div>

                {/* Right Side: Navigation Links & Authentication Status */}
                <div className="flex items-center space-x-1 md:space-x-2">
                    {/* Loading State */}
                    {isLoading ? (
                        <div className="flex items-center space-x-4">
                            <div className="h-5 w-16 bg-gray-700 rounded animate-pulse"></div>
                            <div className="h-8 w-8 bg-gray-700 rounded-full animate-pulse"></div>
                        </div>
                    )
                    /* Logged-in User View */
                    : user ? (
                        <>
                            {/* --- Navigation Links (Keep as is) --- */}
                             <Link href="/dashboard" className={`${linkBaseClasses} ${isActive('/dashboard') ? linkActiveClasses : linkInactiveClasses} hover:bg-gray-700 hover:text-white`}>
                                <FaHome className="mr-1.5 h-4 w-4" /> Home
                             </Link>
                            {user.role !== 'VISITOR' && (
                                <Link href="/predictions" className={`${linkBaseClasses} ${isActive('/predictions') ? linkActiveClasses : linkInactiveClasses} hover:bg-gray-700 hover:text-white`}>
                                    <FaClipboardList className="mr-1.5 h-4 w-4" /> Predictions
                                </Link>
                            )}
                            <Link href="/results" className={`${linkBaseClasses} ${isActive('/results') ? linkActiveClasses : linkInactiveClasses} hover:bg-gray-700 hover:text-white`}>
                            <FaPoll className="mr-1.5 h-4 w-4" /> Results
                            </Link>
                            <Link href="/standings" className={`${linkBaseClasses} ${isActive('/standings') ? linkActiveClasses : linkInactiveClasses} hover:bg-gray-700 hover:text-white`}>
                            <FaTrophy className="mr-1.5 h-4 w-4" /> Standings
                            </Link>
                            {/* --- End Navigation Links --- */}


                            {/* --- Admin/User/Logout Section --- */}
                            <div className="flex items-center space-x-2 pl-2 md:pl-3 border-l border-gray-600">

                                {/* Admin Panel Icon Button (Keep as is) */}
                                {user.role === 'ADMIN' && (
                                    <Link href="/admin" passHref legacyBehavior>
                                         <Button
                                            variant="ghost"
                                            size="icon"
                                            title="Admin Panel"
                                            aria-label="Admin Panel"
                                            className={clsx(
                                                'text-gray-300 hover:bg-gray-700 hover:text-white',
                                                isActive('/admin') && 'bg-gray-700 text-white'
                                            )}
                                         >
                                             <FaUserCog className="h-5 w-5" />
                                         </Button>
                                    </Link>
                                )}

                                {/* --- Avatar Link to Profile with Notification Ring --- */}
                                <Link
                                    href={user.role !== 'VISITOR' ? "/profile" : "#"}
                                    className={clsx(
                                        "relative block rounded-full", // Add relative and rounded-full here
                                        user.role === 'VISITOR' && 'pointer-events-none',
                                        // Conditionally apply ring styles
                                        hasNotifications && "ring-2 ring-red-500 ring-offset-2 ring-offset-gray-800" // Adjust ring/offset color
                                    )}
                                    title="View Profile"
                                >
                                     {/* Apply styles directly to Avatar or keep wrapper? Wrapper is often safer for ring offset */}
                                     <Avatar
                                        fullAvatarUrl={user?.avatarUrl}
                                        name={user.name}
                                        size="sm"
                                        className="border-2 border-gray-600 hover:border-accent transition-colors" // Keep existing Avatar styles
                                    />
                                </Link>
                                {/* --- End Avatar Link --- */}


                                {/* Logout Icon Button (Keep as is) */}
                               <Button
                                   variant="ghost"
                                   size="icon"
                                   onClick={handleLogout}
                                   disabled={isLoading}
                                   className="text-gray-300 hover:bg-gray-700 hover:text-white"
                                   title="Logout" aria-label="Logout"
                               >
                                   <FaSignOutAlt className="h-5 w-5"/>
                               </Button>
                            </div>
                            {/* --- End Admin/User/Logout Section --- */}
                        </>
                    )
                    /* Logged-Out User View (Keep as is) */
                    : (
                        <>
                            <Link href="/login" className={`${linkBaseClasses} ${isActive('/login') ? linkActiveClasses : linkInactiveClasses}`}> Login </Link>
                            <Link href="/register" className={`${linkBaseClasses} ${isActive('/register') ? linkActiveClasses : linkInactiveClasses}`}> Register </Link>
                        </>
                    )}
                </div>
                {/* --- End Right Side --- */}
            </nav>
        </header>
    );
}