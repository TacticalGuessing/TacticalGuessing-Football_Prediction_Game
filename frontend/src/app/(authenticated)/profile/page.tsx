// frontend/src/app/(authenticated)/profile/page.tsx
'use client';

import React from 'react';
// Removed Link import as it's no longer used here
import { useAuth } from '@/context/AuthContext';
import Avatar from '@/components/Avatar'; // Assuming this is your display component
import { FaTrophy, FaAward } from 'react-icons/fa';
import { GiCardJoker } from 'react-icons/gi';
// Removed Button import
import { FaUser } from 'react-icons/fa';

export default function ProfilePage() {
    const { user, isLoading } = useAuth();

    if (isLoading) return <div className="p-6 text-center text-gray-400">Loading profile...</div>;
    if (!user) return <div className="p-6 text-center text-red-400">User not found. Please log in again.</div>;

    const cardClasses = "bg-gray-800 rounded-lg shadow-xl border border-gray-700 p-6 max-w-md mx-auto text-center";
    const finalAvatarUrl = user.avatarUrl || null;

     // --- FIX: Double check role display logic ---
     // Add a console log here to verify what `user.role` contains when the page renders
     console.log("[ProfilePage] User object:", user);
     const displayRole = user.role ? user.role.toLowerCase() : 'N/A'; // Ensure user.role exists before toLowerCase

     return (
        // Assuming layout provides main page padding (like p-4 md:p-6)
        <div className="space-y-6"> {/* Added vertical spacing */}

            {/* Page Title with Icon */}
            <h1 className="text-2xl md:text-3xl font-bold text-gray-100 flex items-center justify-center md:justify-start">
                <FaUser className="mr-3 text-gray-400" /> {/* Added icon */}
                My Profile
            </h1>

            {/* Profile Information Card */}
            <div className={cardClasses}> {/* cardClasses defined above */}

                {/* Avatar Display */}
                <div className="mb-5 inline-block relative group">
                     <Avatar
                        fullAvatarUrl={finalAvatarUrl}
                        name={user.name}
                        size="xl" // Using larger size
                        className="border-2 border-gray-600 group-hover:border-accent transition-colors"
                    />
                </div>

                {/* User Details */}
                <h2 className="text-xl font-semibold text-gray-100 mb-1">{user.name}</h2>
                {user.teamName && (
                     <p className="text-md text-accent font-medium mb-1">Team: {user.teamName}</p>
                )}
                <p className="text-sm text-gray-400 mb-2">{user.email}</p>
                {/* Use displayRole which handles potential undefined */}
                <p className="text-xs text-gray-500 mt-1 capitalize">Role: {displayRole}</p>

                {/* --- Divider --- */}
                <hr className="my-4 border-gray-600"/>

                {/* --- User Info Placeholders (Joined/Rank) --- */}
                <div className="text-sm text-left space-y-2 text-gray-300 mb-4">
                    <p className="italic text-gray-500">[Placeholder: Joined Date]</p>
                    <p className="italic text-gray-500">[Placeholder: Overall Points/Rank]</p>
                </div>

                {/* --- Trophy Placeholder Section --- */}
                <div className="border-t border-gray-600 pt-4">
                    <h3 className="text-sm font-medium text-gray-400 mb-3 text-left">Achievements</h3>
                    <div className="flex justify-center items-center space-x-4">
                        {/* Placeholder: League Winner Trophy */}
                        <div className="text-center" title="League Champion (Example)">
                            <FaTrophy className="w-6 h-6 text-yellow-400 mx-auto" />
                            <span className="text-xs text-gray-500 block mt-1">League</span>
                        </div>
                        {/* Placeholder: Cup Winner Award */}
                        <div className="text-center" title="Cup Winner (Example)">
                            <FaAward className="w-6 h-6 text-gray-400 mx-auto" /> {/* Dimmed color example */}
                            <span className="text-xs text-gray-500 block mt-1">Cup</span>
                        </div>
                        {/* Placeholder: Most Jokers Award */}
                        <div className="text-center" title="Most Jokers Played (Example)">
                            <GiCardJoker className="w-6 h-6 text-gray-400 mx-auto" /> {/* Dimmed color example */}
                             <span className="text-xs text-gray-500 block mt-1">Jokers</span>
                        </div>
                        {/* Add more placeholders as needed */}
                    </div>
                </div>
                {/* --- End Trophy Placeholder Section --- */}

                 {/* Links/Buttons were previously removed */}

            </div> {/* End Profile Information Card div */}
        </div> // End main container
    );
}