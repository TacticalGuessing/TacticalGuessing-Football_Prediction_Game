// frontend/src/components/Header.tsx
'use client';

import React from 'react'; // Removed useContext as useAuth hook is used
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { usePathname } from 'next/navigation';

import Avatar from './Avatar'; // <<< Import the new Avatar component

export default function Header() {
    const { user, logout, isLoading } = useAuth();
    const pathname = usePathname();

    const handleLogout = () => { logout(); };
    const isActive = (href: string) => pathname === href;

    

    return (
        <header className="bg-gray-800 text-white shadow-md sticky top-0 z-50">
            <nav className="container mx-auto px-4 py-3 flex justify-between items-center">
                {/* Left Side: Logo/Brand */}
                <div className="text-xl font-bold">
                    {/* Link to Dashboard if logged in, otherwise home */}
                    <Link href={user ? "/dashboard" : "/"} className="hover:text-gray-300">
                        Predictor Game
                    </Link>
                </div>

                {/* Right Side: Navigation/Auth Links */}
                <div className="flex items-center space-x-3 sm:space-x-4">
                    {isLoading ? (
                        <span className="text-sm italic">Loading...</span>
                    ) : user ? (
                        // Links and User Info for Logged-In Users
                        <>
                            {/* Navigation Links */}
                            <Link href="/predictions" className={`text-sm px-2 py-1 rounded ${isActive('/predictions') ? 'bg-gray-700' : 'hover:bg-gray-700 hover:text-gray-100'}`}>
                                Predictions
                            </Link>
                            <Link href="/results" className={`text-sm px-2 py-1 rounded ${isActive('/results') ? 'bg-gray-700' : 'hover:bg-gray-700 hover:text-gray-100'}`}>
                                Match Results
                            </Link>
                            <Link href="/standings" className={`text-sm px-2 py-1 rounded ${isActive('/standings') ? 'bg-gray-700' : 'hover:bg-gray-700 hover:text-gray-100'}`}>
                                Standings
                            </Link>
                            <Link href="/profile" className={`text-sm px-2 py-1 rounded ${isActive('/profile') || pathname?.startsWith('/profile/settings') ? 'bg-gray-700' : 'hover:bg-gray-700 hover:text-gray-100'}`}>
                                Profile
                            </Link>
                            {user.role === 'ADMIN' && (
                                 <Link href="/admin" className={`text-sm px-2 py-1 rounded ${pathname?.startsWith('/admin') ? 'bg-yellow-600 text-white' : 'text-yellow-400 hover:bg-yellow-600 hover:text-white'}`}>
                                     Admin Panel
                                 </Link>
                            )}

                            {/* User Avatar and Logout Button */}
                            <div className="flex items-center space-x-2 pl-2 border-l border-gray-600"> {/* Optional separator */}
                                {/* Display Avatar */}
                                <Avatar
                                    fullAvatarUrl={user?.avatarUrl}
                                    name={user.name}
                                    size="sm" // w-8 h-8
                                    className="border border-gray-600" // Optional subtle border
                                />
                                {/* Logout Button */}
                                <button
                                    onClick={handleLogout}
                                    className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-1 px-2 sm:px-3 rounded transition duration-150 ease-in-out"
                                    title={`Logout ${user.name}`} // Tooltip remains useful
                                >
                                    Logout
                                </button>
                            </div>
                        </>
                    ) : (
                        // Links for Logged-Out Users
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
            </nav>
        </header>
    );
}