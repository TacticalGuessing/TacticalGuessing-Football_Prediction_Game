// frontend/src/components/Admin/EditRoundModal.tsx
'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import { Round } from '@/lib/api'; // Import the Round type
// Removed LoadingSpinner import

interface EditRoundModalProps {
    isOpen: boolean;
    round: Round; // The round data to pre-fill the form
    onClose: () => void;
    onSave: (updatedData: { name: string; deadline: string }) => Promise<void> | void; // Function to call on save
    error: string | null; // Error message to display
    isLoading: boolean; // Loading state for the save action
}

// Helper function to format ISO string to datetime-local compatible string
// YYYY-MM-DDTHH:MM
const formatISOToDateTimeLocal = (isoString: string): string => {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        // Adjust for timezone offset to get local time correctly formatted
        const timezoneOffset = date.getTimezoneOffset() * 60000; // offset in milliseconds
        const localISOTime = new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
        return localISOTime;
    } catch (e) {
        console.error("Error formatting date:", e);
        return ''; // Return empty string on error
    }
};

export default function EditRoundModal({
    isOpen,
    round,
    onClose,
    onSave,
    error,
    isLoading
}: EditRoundModalProps) {
    const [name, setName] = useState(round.name);
    // Initialize deadline state with formatted value for the input
    const [deadline, setDeadline] = useState(formatISOToDateTimeLocal(round.deadline));

    // Effect to reset form state when the 'round' prop changes (e.g., opening modal for a different round)
    useEffect(() => {
        if (round) {
            setName(round.name);
            setDeadline(formatISOToDateTimeLocal(round.deadline));
        }
    }, [round]); // Dependency array includes round

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        await onSave({ name, deadline: deadline });
    };

    if (!isOpen) {
        return null;
    }

    return (
        // Modal backdrop
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-100 p-4">
            {/* Modal content */}
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h2 className="text-xl font-bold mb-4">Edit Round Details (ID: {round.roundId})</h2>

                <form onSubmit={handleSubmit}>
                    {/* Error Display */}
                    {error && (
                        <p className="text-red-500 bg-red-100 p-3 rounded mb-4 text-sm">{error}</p>
                    )}

                    {/* Round Name Input */}
                    <div className="mb-4">
                        <label htmlFor="roundName" className="block text-sm font-medium text-gray-700 mb-1">
                            Round Name
                        </label>
                        <input
                            type="text"
                            id="roundName"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            required
                        />
                    </div>

                    {/* Deadline Input */}
                    <div className="mb-6">
                        <label htmlFor="roundDeadline" className="block text-sm font-medium text-gray-700 mb-1">
                            Prediction Deadline
                        </label>
                        <input
                            type="datetime-local"
                            id="roundDeadline"
                            value={deadline}
                            onChange={(e) => setDeadline(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            required
                        />
                         <p className="text-xs text-gray-500 mt-1">Note: Deadline is in your local time.</p>
                         {round.status !== 'SETUP' && (
                              <p className="text-xs text-orange-600 mt-1">
                                  Warning: Modifying the deadline for a round that is not in &apos;SETUP&apos; status might have unintended consequences.
                              </p>
                         )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end space-x-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isLoading}
                            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        >
                             {/* Removed LoadingSpinner */}
                            {isLoading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}