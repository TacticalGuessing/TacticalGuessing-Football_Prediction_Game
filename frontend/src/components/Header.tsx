// frontend/src/components/Header.tsx
'use client'; // This component uses hooks, so it must be a Client Component

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext'; // Adjust path if your context is elsewhere

export default function Header() {
    const { user, logout, isLoading } = useAuth(); // Get user, logout function, and loading state

    const handleLogout = () => {
        logout();
        // No need to manually redirect here, AuthContext/protected routes should handle it
    };

    return (
        // ***** UPDATED LINE *****
        // Added sticky, top-0, and z-50 to make the header stick to the top
        <header className="bg-gray-800 text-white shadow-md sticky top-0 z-50">
            <nav className="container mx-auto px-4 py-3 flex justify-between items-center">
                {/* Left Side: Logo/Brand */}
                <div className="text-xl font-bold">
                    <Link href={user ? "/dashboard" : "/"} className="hover:text-gray-300"> {/* Link to dashboard if logged in, home otherwise */}
                        Predictor Game
                    </Link>
                </div>

                {/* Right Side: Navigation/Auth Links */}
                <div className="flex items-center space-x-4">
                    {isLoading ? (
                        <span className="text-sm italic">Loading...</span>
                    ) : user ? (
                        // Links for Logged-In Users
                        <>
                            <span className="text-sm hidden sm:inline">Welcome, {user.name}!</span>
                            <Link href="/dashboard" className="text-sm hover:text-gray-300">
                                Dashboard
                            </Link>
                            <Link href="/standings" className="text-sm hover:text-gray-300">
                                Standings
                            </Link>
                            {/* Add other user links here if needed (e.g., Profile) */}
                            {user.role === 'ADMIN' && (
                                 <Link href="/admin" className="text-sm text-yellow-400 hover:text-yellow-300">
                                     Admin
                                 </Link>
                            )}
                            <button
                                onClick={handleLogout}
                                className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-1 px-3 rounded transition duration-150 ease-in-out"
                            >
                                Logout
                            </button>
                        </>
                    ) : (
                        // Links for Logged-Out Users
                        <>
                            <Link href="/login" className="text-sm hover:text-gray-300">
                                Login
                            </Link>
                            <Link href="/register" className="text-sm hover:text-gray-300">
                                Register
                            </Link>
                        </>
                    )}
                </div>
            </nav>
        </header>
    );
}