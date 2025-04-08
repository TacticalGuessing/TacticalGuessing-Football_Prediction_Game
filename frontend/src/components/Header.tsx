// frontend/src/components/Header.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { usePathname } from 'next/navigation';

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
                    <Link href={user ? "/dashboard" : "/"} className="hover:text-gray-300">
                        Predictor Game
                    </Link>
                </div>

                {/* Right Side: Navigation/Auth Links */}
                <div className="flex items-center space-x-3 sm:space-x-4">
                    {isLoading ? ( <span className="text-sm italic">Loading...</span> )
                     : user ? (
                        // Links for Logged-In Users
                        <>
                            <Link href="/predictions" className={`text-sm px-2 py-1 rounded ${isActive('/predictions') ? 'bg-gray-700' : 'hover:bg-gray-700 hover:text-gray-100'}`}>
                                Predictions
                            </Link>
                            {/* === NEW Results Link === */}
                            <Link href="/results" className={`text-sm px-2 py-1 rounded ${isActive('/results') ? 'bg-gray-700' : 'hover:bg-gray-700 hover:text-gray-100'}`}>
                                Match Results
                            </Link>
                            {/* === END NEW LINK === */}
                            <Link href="/standings" className={`text-sm px-2 py-1 rounded ${isActive('/standings') ? 'bg-gray-700' : 'hover:bg-gray-700 hover:text-gray-100'}`}>
                                Standings
                            </Link>
                            <Link href="/profile" className={`text-sm px-2 py-1 rounded ${isActive('/profile') ? 'bg-gray-700' : 'hover:bg-gray-700 hover:text-gray-100'}`}>
                                Profile
                            </Link>
                            {user.role === 'ADMIN' && (
                                 <Link href="/admin" className={`text-sm px-2 py-1 rounded ${pathname?.startsWith('/admin') ? 'bg-yellow-600 text-white' : 'text-yellow-400 hover:bg-yellow-600 hover:text-white'}`}>
                                     Admin Panel
                                 </Link>
                            )}
                            <button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-1 px-3 rounded transition duration-150 ease-in-out" title={`Logout ${user.name}`}>
                                Logout
                            </button>
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