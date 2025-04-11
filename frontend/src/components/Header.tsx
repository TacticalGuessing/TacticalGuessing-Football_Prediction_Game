// frontend/src/components/Header.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { usePathname } from 'next/navigation';

import Avatar from './Avatar'; // Import the Avatar component

export default function Header() {
    const { user, logout, isLoading } = useAuth(); // Get user state and functions from context
    const pathname = usePathname(); // Hook to get the current URL path

    // Function to handle logout action
    const handleLogout = () => {
        logout();
    };

    // Helper function to determine if a navigation link is active
    const isActive = (href: string) => pathname === href;

    return (
        // Header container styling
        <header className="bg-gray-800 text-white shadow-md sticky top-0 z-50">
            {/* Navigation bar layout */}
            <nav className="container mx-auto px-4 py-3 flex justify-between items-center">

                {/* Left Side: Logo/Brand Name */}
                <div className="text-xl font-bold">
                    {/* Link to Dashboard if logged in, otherwise to the home/login page */}
                    <Link href={user ? "/dashboard" : "/"} className="hover:text-gray-300">
                        Predictor Game
                    </Link>
                </div>

                {/* Right Side: Navigation Links & Authentication Status */}
                <div className="flex items-center space-x-3 sm:space-x-4">
                    {/* Display loading indicator while auth state is being determined */}
                    {isLoading ? (
                        <span className="text-sm italic">Loading...</span>
                    )
                    /* Display content based on whether a user is logged in */
                    : user ? (
                        // --- Links and User Info for Logged-In Users ---
                        <>
                            {/* --- Conditional Navigation Links based on Role --- */}

                            {/* Predictions Link: Visible only if user is NOT a VISITOR */}
                            {user.role !== 'VISITOR' && (
                                <Link
                                    href="/predictions"
                                    className={`text-sm px-2 py-1 rounded ${isActive('/predictions') ? 'bg-gray-700' : 'hover:bg-gray-700 hover:text-gray-100'}`}
                                >
                                    Predictions
                                </Link>
                            )}

                            {/* Match Results Link: Visible to ALL logged-in users */}
                            <Link
                                href="/results"
                                className={`text-sm px-2 py-1 rounded ${isActive('/results') ? 'bg-gray-700' : 'hover:bg-gray-700 hover:text-gray-100'}`}
                            >
                                Match Results
                            </Link>

                            {/* Standings Link: Visible to ALL logged-in users */}
                            <Link
                                href="/standings"
                                className={`text-sm px-2 py-1 rounded ${isActive('/standings') ? 'bg-gray-700' : 'hover:bg-gray-700 hover:text-gray-100'}`}
                            >
                                Standings
                            </Link>

                            {/* Profile Link: Visible only if user is NOT a VISITOR */}
                            {user.role !== 'VISITOR' && (
                                <Link
                                    href="/profile"
                                    className={`text-sm px-2 py-1 rounded ${isActive('/profile') || pathname?.startsWith('/profile/settings') ? 'bg-gray-700' : 'hover:bg-gray-700 hover:text-gray-100'}`}
                                >
                                    Profile
                                </Link>
                            )}

                            {/* Admin Panel Link: Visible only if user role is ADMIN */}
                            {user.role === 'ADMIN' && (
                                 <Link
                                     href="/admin"
                                     className={`text-sm px-2 py-1 rounded ${pathname?.startsWith('/admin') ? 'bg-yellow-600 text-white' : 'text-yellow-400 hover:bg-yellow-600 hover:text-white'}`}
                                 >
                                     Admin Panel
                                 </Link>
                            )}
                            {/* --- End Conditional Navigation Links --- */}


                            {/* --- User Avatar and Logout Section --- */}
                            <div className="flex items-center space-x-2 pl-2 border-l border-gray-600"> {/* Optional visual separator */}
                                {/* Display User Avatar */}
                                <Avatar
                                    fullAvatarUrl={user?.avatarUrl} // Use optional chaining for safety
                                    name={user.name}
                                    size="sm" // Specifies the size (w-8 h-8 based on Avatar component)
                                    className="border border-gray-600" // Optional subtle border around avatar
                                />
                                {/* Logout Button */}
                                <button
                                    onClick={handleLogout}
                                    className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-1 px-2 sm:px-3 rounded transition duration-150 ease-in-out"
                                    title={`Logout ${user.name}`} // Tooltip for accessibility
                                >
                                    Logout
                                </button>
                            </div>
                            {/* --- End User Avatar and Logout Section --- */}
                        </>
                    )
                    /* Display links for Logged-Out Users */
                    : (
                        <>
                            <Link href="/login" className={`text-sm px-2 py-1 rounded ${isActive('/login') ? 'bg-gray-700' : 'hover:bg-gray-700 hover:text-gray-100'}`}>
                                Login
                            </Link>
                            <Link href="/register" className={`text-sm px-2 py-1 rounded ${isActive('/register') ? 'bg-gray-700' : 'hover:bg-gray-700 hover:text-gray-100'}`}>
                                Register
                            </Link>
                        </>
                    )}
                </div>
                {/* --- End Right Side --- */}
            </nav>
        </header>
    );
}