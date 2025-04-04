// frontend/src/app/admin/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
// Import triggerScoring
import { getRounds, createRound, updateRoundStatus, triggerScoring, Round } from '@/lib/api'; // Ensure triggerScoring is imported

type SettableRoundStatus = 'SETUP' | 'OPEN' | 'CLOSED';

export default function AdminRoundsPage() {
    const { token, isLoading: isAuthLoading } = useAuth();
    const [rounds, setRounds] = useState<Round[]>([]);
    const [isLoadingRounds, setIsLoadingRounds] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Form specific state
    const [roundName, setRoundName] = useState('');
    const [roundDeadline, setRoundDeadline] = useState('');
    const [isCreatingRound, setIsCreatingRound] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [formSuccess, setFormSuccess] = useState<string | null>(null);

    // Status update specific state
    const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);
    const [statusUpdateError, setStatusUpdateError] = useState<string | null>(null);

    // --- State for Scoring ---
    const [scoringRoundId, setScoringRoundId] = useState<number | null>(null); // Track which round is being scored
    const [scoringError, setScoringError] = useState<string | null>(null); // Error specific to scoring trigger

    // --- Fetch Rounds ---
    const fetchRounds = useCallback(async () => {
        if (!token) { setError("Authentication token not found."); setIsLoadingRounds(false); return; }
        setIsLoadingRounds(true);
        // Clear errors before fetching
        setError(null); setStatusUpdateError(null); setScoringError(null);
        try {
            const data = await getRounds(token);
            setRounds(data || []);
        } catch (err: unknown) {
            console.error("Fetch rounds error:", err);
            let message = 'Failed to fetch rounds.';
            if (err instanceof Error) message = err.message;
            setError(message);
            setRounds([]);
        } finally {
            setIsLoadingRounds(false);
        }
    }, [token]);

    // --- useEffect for Initial Fetch ---
    useEffect(() => {
        if (!isAuthLoading) {
            if (token) {
                 fetchRounds();
            } else {
                 setError("You must be logged in as an Admin to view this page.");
                 setIsLoadingRounds(false);
                 setRounds([]);
            }
        }
    }, [token, isAuthLoading, fetchRounds]);

    // --- Create Round ---
    const handleCreateRound = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null); setFormSuccess(null); setStatusUpdateError(null); setScoringError(null); // Clear all errors
        if (!token) { setFormError("Authentication error. Cannot create round."); return; }
        if (!roundName.trim() || !roundDeadline) { setFormError("Please provide both a name and a deadline."); return; }
        let deadlineISO: string;
        try {
            deadlineISO = new Date(roundDeadline).toISOString();
            if (isNaN(new Date(deadlineISO).getTime())) { throw new Error("Invalid date"); }
        } catch { setFormError("Invalid deadline date/time format."); return; }
        setIsCreatingRound(true);
        try {
            const newRound = await createRound({ name: roundName.trim(), deadline: deadlineISO }, token);
            setFormSuccess(`Round "${newRound.name}" created successfully!`);
            setRoundName(''); setRoundDeadline('');
            await fetchRounds(); // Refresh list
        } catch (err: unknown) {
            console.error("Create round error:", err);
            let message = 'Failed to create round. Check details or admin privileges.';
            if (err instanceof Error) message = err.message;
            setFormError(message);
        } finally {
            setIsCreatingRound(false);
        }
    };

    // --- Update Round Status Handler ---
    const handleUpdateStatus = async (roundIdToUpdate: number, newStatus: SettableRoundStatus) => {
        if (!token) { setStatusUpdateError(`Round ${roundIdToUpdate}: Authentication error.`); return; }
        if (scoringRoundId !== null || updatingStatusId !== null) return; // Prevent action if another is in progress

        setUpdatingStatusId(roundIdToUpdate);
        // Clear other errors
        setStatusUpdateError(null); setFormError(null); setFormSuccess(null); setScoringError(null);
        try {
            await updateRoundStatus(roundIdToUpdate, { status: newStatus }, token);
            // Update local state optimistically BEFORE refetch (smoother UI)
            setRounds(prevRounds =>
                prevRounds.map(r =>
                    r.roundId === roundIdToUpdate ? { ...r, status: newStatus } : r
                )
            );
            await fetchRounds(); // Refetch for consistency (optional if optimistic is reliable)
        } catch (err: unknown) {
            console.error(`Error updating status for round ${roundIdToUpdate} to ${newStatus}:`, err);
            let message = `Failed to update status to ${newStatus}.`;
            if (err instanceof Error) message = err.message;
            setStatusUpdateError(`Round ${roundIdToUpdate}: ${message}`);
            // Optional: Revert optimistic update on error by fetching again
            // await fetchRounds();
        } finally {
            setUpdatingStatusId(null);
        }
    };

     // --- Handler for Trigger Scoring ---
    const handleTriggerScoring = async (roundIdToScore: number) => {
        if (!token) { setScoringError(`Round ${roundIdToScore}: Authentication error.`); return; }
        if (scoringRoundId !== null || updatingStatusId !== null) return; // Prevent action if another is in progress

        setScoringRoundId(roundIdToScore);
        // Clear other errors
        setScoringError(null); setStatusUpdateError(null); setFormError(null); setFormSuccess(null);

        try {
            console.log(`Triggering scoring for round ${roundIdToScore}...`);
            await triggerScoring(roundIdToScore, token); // Make sure triggerScoring is imported from api.ts
            console.log(`Scoring triggered successfully for round ${roundIdToScore}. Refetching rounds...`);
            await fetchRounds(); // Refresh list to show 'COMPLETED' status
        } catch (err: unknown) {
            console.error(`Error triggering scoring for round ${roundIdToScore}:`, err);
            const message = (err instanceof Error) ? err.message : 'Failed to trigger scoring.';
            setScoringError(`Round ${roundIdToScore}: ${message}`);
        } finally {
            setScoringRoundId(null);
        }
    };


    // --- Helper Function for Date Formatting ---
    const formatDateTime = (isoString: string | null | undefined): string => {
       if (!isoString) return "Date unavailable";
        try {
            return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(new Date(isoString));
        } catch (e) {
            console.error("Error formatting date:", isoString, e);
            return "Invalid Date";
        }
    }

    // --- Render Logic ---
    if (isAuthLoading) { return <p className="p-4 text-center">Loading authentication...</p>; }
    if (!token && !isAuthLoading) { return <p className='text-red-500 p-4 font-semibold text-center'>Authentication required for Admin access.</p>; }
    if (isLoadingRounds && token) { return <p className="p-4 text-center">Loading rounds data...</p>; }
    if (error && !isLoadingRounds) { return <p className='text-red-500 p-4 font-semibold text-center'>{error}</p>; }

    return (
        <div className="p-4 md:p-6">
            <h1 className="text-2xl font-bold mb-6">Admin - Manage Rounds</h1>

            {/* Create Round Form */}
            <div className="mb-8 p-6 border rounded shadow-md bg-white">
                <h2 className="text-xl font-semibold mb-4">Create New Round</h2>
                <form onSubmit={handleCreateRound}>
                    <div className="mb-4">
                        <label htmlFor="roundName" className="block mb-1 font-medium text-gray-700">Round Name:</label>
                        <input id="roundName" type="text" value={roundName} onChange={(e) => setRoundName(e.target.value)} className="border p-2 w-full rounded border-gray-300 focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50 disabled:bg-gray-100" required aria-required="true" disabled={isCreatingRound} />
                    </div>
                    <div className="mb-4">
                        <label htmlFor="roundDeadline" className="block mb-1 font-medium text-gray-700">Deadline:</label>
                        <input id="roundDeadline" type="datetime-local" value={roundDeadline} onChange={(e) => setRoundDeadline(e.target.value)} className="border p-2 w-full rounded border-gray-300 focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50 disabled:bg-gray-100" required aria-required="true" disabled={isCreatingRound} />
                    </div>
                    <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed" disabled={isCreatingRound}>
                        {isCreatingRound ? 'Creating...' : 'Create Round'}
                    </button>
                    {formError && <p className="text-red-600 mt-3 text-sm font-medium">{formError}</p>}
                    {formSuccess && <p className="text-green-600 mt-3 text-sm font-medium">{formSuccess}</p>}
                </form>
            </div>

             {/* Display Status Update/Scoring Errors */}
             {(statusUpdateError || scoringError) && (
                <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                    <strong>Error:</strong> {statusUpdateError || scoringError}
                </div>
            )}

            {/* List Rounds Table */}
            <h2 className="text-xl font-semibold mb-4">Existing Rounds</h2>
            <div className="overflow-x-auto shadow rounded border-b border-gray-200 bg-white">
                 <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                        <tr>
                            <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">ID</th>
                            <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Name</th>
                            <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Deadline</th>
                            <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Status</th>
                            <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {isLoadingRounds && rounds.length === 0 && (
                             <tr><td colSpan={5} className="text-center py-4 px-4 text-gray-500 italic">Loading rounds...</td></tr>
                        )}
                         {!isLoadingRounds && rounds.length === 0 ? (
                            <tr><td colSpan={5} className="text-center py-4 px-4 text-gray-500 italic">No rounds found. Create one above!</td></tr>
                        ) : (
                            rounds.map(round => {
                                // Check if this specific row is being updated or scored
                                const isUpdatingThisRow = updatingStatusId === round.roundId;
                                const isScoringThisRow = scoringRoundId === round.roundId;
                                // General check if *any* action is happening (to disable buttons)
                                const isAnyActionInProgress = updatingStatusId !== null || scoringRoundId !== null;

                                return (
                                     <tr key={round.roundId} className={`hover:bg-gray-50 transition-colors duration-150 ${isUpdatingThisRow || isScoringThisRow ? 'opacity-70' : ''}`}>
                                        <td className="py-3 px-4 whitespace-nowrap text-sm font-medium text-gray-900">{round.roundId}</td>
                                        <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-700">{round.name}</td>
                                        <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-700">{formatDateTime(round.deadline)}</td>
                                        <td className="py-3 px-4 whitespace-nowrap text-sm">
                                            <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                round.status === 'OPEN' ? 'bg-green-100 text-green-800' :
                                                round.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800' :
                                                round.status === 'CLOSED' ? 'bg-red-100 text-red-800' :
                                                'bg-gray-100 text-gray-800'
                                            }`}>
                                                {round.status}
                                            </span>
                                        </td>
                                        {/* Actions Cell */}
                                        <td className="py-3 px-4 whitespace-nowrap text-sm font-medium">
                                            {/* Show specific loading state for this row */}
                                            {isUpdatingThisRow && <span className="text-gray-500 italic text-xs mr-2">Updating Status...</span>}
                                            {isScoringThisRow && <span className="text-indigo-500 italic text-xs mr-2">Triggering Scoring...</span>}

                                            {/* Only render the div containing buttons if NO action is happening on THIS row */}
                                            {!isUpdatingThisRow && !isScoringThisRow && (
                                                <div className="flex items-center space-x-2 flex-wrap gap-1">
                                                    {/* Status Update Buttons - disable if any action is in progress */}
                                                    {round.status === 'SETUP' && (
                                                        <button onClick={() => handleUpdateStatus(round.roundId, 'OPEN')} disabled={isAnyActionInProgress} className="px-2 py-1 text-xs bg-green-500 hover:bg-green-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed">Open</button>
                                                    )}
                                                    {round.status === 'OPEN' && (
                                                        <button onClick={() => handleUpdateStatus(round.roundId, 'CLOSED')} disabled={isAnyActionInProgress} className="px-2 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed">Close</button>
                                                    )}
                                                    {(round.status === 'OPEN' || round.status === 'CLOSED') && (
                                                        <button onClick={() => handleUpdateStatus(round.roundId, 'SETUP')} disabled={isAnyActionInProgress} title="Reset status to Setup" className="px-2 py-1 text-xs bg-yellow-500 hover:bg-yellow-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed">Reset</button>
                                                    )}

                                                    {/* Manage Fixtures Link */}
                                                     {round.roundId && ( // Simplified: Show if round exists
                                                         <Link
                                                             href={`/admin/rounds/${round.roundId}/fixtures`}
                                                             className={`px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded ${isAnyActionInProgress ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
                                                             aria-disabled={isAnyActionInProgress}
                                                             onClick={(e) => { if (isAnyActionInProgress) e.preventDefault(); }}
                                                         >
                                                             Fixtures
                                                         </Link>
                                                     )}

                                                    {/* Trigger Scoring Button */}
                                                    {round.status === 'CLOSED' && (
                                                        <button
                                                            onClick={() => handleTriggerScoring(round.roundId)}
                                                            className="px-2 py-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                                            title="Calculate points and finalize round"
                                                            disabled={isAnyActionInProgress} // Disable if any action is happening
                                                        >
                                                            Trigger Scoring {/* Loading text handled by the span above */}
                                                        </button>
                                                    )}

                                                    {/* Completed Status */}
                                                    {(round.status === 'COMPLETED') && (
                                                        <span className="text-xs text-blue-700 font-semibold italic">Completed</span>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}