// frontend/src/app/(authenticated)/profile/page.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import Avatar from '@/components/Avatar';

export default function ProfilePage() {
    const { user, isLoading } = useAuth(); // Get user data

    // --- Render Logic ---
    if (isLoading) {
        return <div className="p-4 md:p-6 text-center">Loading profile...</div>;
    }

    if (!user) {
        // Should be handled by layout/redirect
        return <div className="p-4 md:p-6 text-center text-red-600">User not found. Please log in.</div>;
    }

     // --- Construct Avatar URL (with detailed checks) ---
     const apiBaseUrlForImages = process.env.NEXT_PUBLIC_API_BASE_URL_FOR_IMAGES || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
     // Ensure initial baseUrlForImages *only* contains the base (e.g., http://localhost:5000)
     const initialBaseUrl = apiBaseUrlForImages.replace(/\/api\/?$/, '').replace(/\/$/, ''); // Use const

     let currentAvatarSrc: string | null = null; // Initialize as null

     // Only proceed if user and user.avatarUrl exist
     if (user?.avatarUrl) {
         const avatarPath = user.avatarUrl;

         // Log the raw parts before any modification
         console.log("[ProfilePage] RAW user.avatarUrl:", JSON.stringify(avatarPath));
         console.log("[ProfilePage] RAW apiBaseUrlForImages:", apiBaseUrlForImages);
         console.log("[ProfilePage] Initial initialBaseUrl (after replace):", initialBaseUrl);

         // Check if avatarPath *already* starts with http
         if (avatarPath.startsWith('http://') || avatarPath.startsWith('https://')) {
             console.warn("[ProfilePage] avatarUrl seems to be an absolute URL already, using it directly:", avatarPath);
             currentAvatarSrc = avatarPath;
         }
         // Check if avatarPath starts correctly with the expected relative path
         else if (avatarPath.startsWith('/uploads/avatars/')) {
              console.log("[ProfilePage] avatarUrl is relative, concatenating.");
             // --- Use initialBaseUrl here and adjust concatenation ---
             if (initialBaseUrl.endsWith('/')) {
                 if (avatarPath.startsWith('/')) {
                    currentAvatarSrc = `${initialBaseUrl}${avatarPath.substring(1)}`; // Combine, remove leading / from path
                 } else {
                    currentAvatarSrc = `${initialBaseUrl}${avatarPath}`; // Combine directly
                 }
             } else {
                 if (avatarPath.startsWith('/')) {
                    currentAvatarSrc = `${initialBaseUrl}${avatarPath}`; // Combine directly
                 } else {
                    currentAvatarSrc = `${initialBaseUrl}/${avatarPath}`; // Combine, add missing /
                 }
             }
             // --- End adjustment ---
         } else {
             // Handle unexpected avatarUrl format
             console.error("[ProfilePage] Unexpected avatarUrl format received:", avatarPath);
             currentAvatarSrc = null;
         }
     } else {
         console.log("[ProfilePage] user.avatarUrl is null or undefined.");
     }

     // Log the final result being passed to the Avatar component
     console.log("[ProfilePage] FINAL Constructed currentAvatarSrc:", currentAvatarSrc);
     // --- End Construct Avatar URL ---


    return (
        <div className="container mx-auto p-4 md:p-6">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">My Profile</h1>

            {/* Profile Information Card */}
            <div className="bg-white p-6 rounded-lg shadow border border-gray-200 max-w-md mx-auto text-center">

                {/* Avatar Display */}
                <div className="mb-4 inline-block">
                <Avatar
                    fullAvatarUrl={currentAvatarSrc} // <<< CHANGE THIS PROP NAME
                    name={user.name}
                    size="xl"
                    className="border-2 border-indigo-200"
                />
            </div>

                {/* User Details (Keep as is) */}
                <h2 className="text-xl font-semibold text-gray-900">{user.name}</h2>
                <p className="text-sm text-gray-500 mb-1">{user.email}</p>
                {user.teamName && (
                     <p className="text-md text-indigo-700 font-medium mt-1">Team: {user.teamName}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">Role: {user.role}</p>

                <hr className="my-6"/>

                {/* Links (Keep as is) */}
                <div className="space-y-3">
                    <Link href="/profile/settings" className="block ...">
                        Edit Profile Settings (Team Name / Avatar)
                    </Link>
                    <button disabled className="block ...">
                        View Prediction History (Planned)
                    </button>
                    <button disabled className="block ...">
                        View Statistics (Planned)
                    </button>
                </div>
            </div>
        </div>
    );
}