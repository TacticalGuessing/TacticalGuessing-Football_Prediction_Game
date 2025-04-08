// frontend/src/app/(authenticated)/profile/settings/page.tsx
'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'react-hot-toast';
import { setTeamName } from '@/lib/api'; // Import the new API function

export default function ProfileSettingsPage() {
    // Get current user, token, and the function to update the user context
    const { user, token, isLoading: isAuthLoading, updateUserContext } = useAuth();

    // State for the input field, initialized from context
    const [teamNameInput, setTeamNameInput] = useState<string>('');
    // State for loading/saving state
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Effect to initialize input field when user context loads/changes
    useEffect(() => {
        if (user) {
            setTeamNameInput(user.teamName || ''); // Use existing teamName or empty string
        }
    }, [user]); // Re-run if the user object in context changes

    // Handler for form submission
    const handleSaveChanges = async (e: FormEvent) => {
        e.preventDefault();
        if (!token || isSaving) return;

        // Optional: Check if the name actually changed
        if (teamNameInput === (user?.teamName || '')) {
            toast.success("No changes to save.");
            return;
        }

        setIsSaving(true);
        setError(null);
        const originalTeamName = user?.teamName || ''; // Store original for potential revert

        try {
            console.log(`Attempting to set team name to: "${teamNameInput}"`);
            // Call the API function
            const updatedUser = await setTeamName(teamNameInput, token);

            // Update the user data in the global AuthContext
            updateUserContext(updatedUser);

            toast.success('Team Name updated successfully!');
            console.log("Team name update successful:", updatedUser);

        } catch (err: unknown) {
            console.error("Failed to update team name:", err);
            const message = err instanceof Error ? err.message : "An unknown error occurred.";
            setError(message);
            toast.error(`Update failed: ${message}`);
            // Revert input field to original value on error
            setTeamNameInput(originalTeamName);
        } finally {
            setIsSaving(false);
        }
    };

    // --- Render Logic ---

    if (isAuthLoading) {
        return <div className="p-4 md:p-6 text-center">Loading profile...</div>;
    }

    if (!user) {
         // Should be handled by layout/redirect, but good fallback
        return <div className="p-4 md:p-6 text-center text-red-600">User not found. Please log in.</div>;
    }

    return (
        <div className="container mx-auto p-4 md:p-6">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">Profile Settings</h1>

            <div className="bg-white p-4 md:p-6 rounded-lg shadow border border-gray-200 max-w-lg mx-auto">
                <form onSubmit={handleSaveChanges} className="space-y-4">
                    {/* Display non-editable info */}
                    <div className="mb-4">
                        <p className="text-sm text-gray-500">Name: <span className="font-medium text-gray-800">{user.name}</span></p>
                        <p className="text-sm text-gray-500">Email: <span className="font-medium text-gray-800">{user.email}</span></p>
                        <p className="text-sm text-gray-500">Role: <span className="font-medium text-gray-800">{user.role}</span></p>
                    </div>

                    <hr className="my-4"/>

                    {/* Team Name Input */}
                    <div>
                        <label htmlFor="teamName" className="block text-sm font-medium text-gray-700 mb-1">
                            Team Name (Optional)
                        </label>
                        <input
                            type="text"
                            id="teamName"
                            name="teamName"
                            value={teamNameInput}
                            onChange={(e) => setTeamNameInput(e.target.value)}
                            placeholder="Enter your team name"
                            maxLength={50} // Match backend validation
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            disabled={isSaving}
                        />
                        <p className="text-xs text-gray-500 mt-1">This name will be displayed in the standings. Leave blank to use your real name.</p>
                    </div>

                    {/* Display Error */}
                    {error && (
                        <p className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">{error}</p>
                    )}

                    {/* Save Button */}
                    <div className="text-right pt-2">
                        <button
                            type="submit"
                            disabled={isSaving || teamNameInput === (user?.teamName || '')} // Disable if saving or no change
                            className="inline-flex justify-center py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}