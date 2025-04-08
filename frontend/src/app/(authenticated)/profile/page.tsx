// frontend/src/app/(authenticated)/profile/page.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function ProfilePage() {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return <div className="p-4 md:p-6 text-center">Loading profile...</div>;
    }

    if (!user) {
        return <div className="p-4 md:p-6 text-center text-red-600">Please log in to view your profile.</div>;
    }

    return (
        <div className="container mx-auto p-4 md:p-6">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">
                Your Profile ({user.teamName || user.name}) {/* Display team name or real name */}
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Placeholder for Stats/History */}
                <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-700 mb-3">Prediction Stats & History</h2>
                    <p className="text-sm text-gray-500 italic mb-4">(Coming Soon)</p>
                    {/* Link to history page (when created) */}
                    {/* <Link href="/profile/history" className="text-blue-600 hover:underline">View Prediction History</Link> */}
                </div>

                {/* Link to Settings */}
                <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-700 mb-3">Settings</h2>
                    <Link href="/profile/settings" className="text-blue-600 hover:underline font-medium">
                        Change Team Name / Avatar →
                    </Link>
                     <p className="text-sm text-gray-500 mt-1">Update your display name and profile picture.</p>
                </div>
            </div>
        </div>
    );
}