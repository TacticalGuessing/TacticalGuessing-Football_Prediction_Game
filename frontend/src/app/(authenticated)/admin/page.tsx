// frontend/src/app/admin/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
// Import relevant API functions for this page
import {
    getRounds,
    createRound,
    updateRoundStatus,
    triggerScoring,
    deleteRound, // <<< ADD THIS IMPORT
    Round
} from '@/lib/api';

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
    const [scoringRoundId, setScoringRoundId] = useState<number | null>(null);
    const [scoringError, setScoringError] = useState<string | null>(null);

    // --- Add Delete Round State ---
    const [deletingRoundId, setDeletingRoundId] = useState<number | null>(null);
    const [deleteRoundError, setDeleteRoundError] = useState<string | null>(null);
    // --- End Delete Round State ---

    // --- Fetch Rounds ---
    const fetchRounds = useCallback(async () => {
        if (!token) { setError("Authentication token not found."); setIsLoadingRounds(false); return; }
        setIsLoadingRounds(true);
        // Clear errors before fetch
        setError(null); setStatusUpdateError(null); setScoringError(null); setDeleteRoundError(null); // Added clear for delete error
        try {
            console.log("[Admin Rounds Page] Fetching rounds..."); // Add log
            const data = await getRounds(token); // Uses admin getRounds
            setRounds(data || []);
            console.log("[Admin Rounds Page] Rounds fetched:", data?.length || 0); // Add log
        } catch (err: unknown) {
            console.error("Fetch rounds error:", err);
            const message = err instanceof Error ? err.message : 'Failed to fetch rounds.';
            setError(message);
            setRounds([]);
        } finally {
            setIsLoadingRounds(false);
        }
    }, [token]);

    // --- useEffect for Initial Fetch ---
    useEffect(() => {
        console.log("[Admin Rounds Page] useEffect triggered. Auth Loading:", isAuthLoading);
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
        // Clear all action errors/success
        setFormError(null); setFormSuccess(null); setStatusUpdateError(null); setScoringError(null); setDeleteRoundError(null);
        if (!token) { setFormError("Authentication error. Cannot create round."); return; }
        if (!roundName.trim() || !roundDeadline) { setFormError("Please provide both a name and a deadline."); return; }
        let deadlineISO: string;
        try { deadlineISO = new Date(roundDeadline).toISOString(); if (isNaN(new Date(deadlineISO).getTime())) { throw new Error("Invalid date"); } } catch { setFormError("Invalid deadline date/time format."); return; }
        setIsCreatingRound(true);
        try {
            const newRound = await createRound({ name: roundName.trim(), deadline: deadlineISO }, token);
            setFormSuccess(`Round "${newRound.name}" created successfully!`);
            setRoundName(''); setRoundDeadline('');
            await fetchRounds(); // Refresh list
        } catch (err: unknown) {
            console.error("Create round error:", err);
            const message = err instanceof Error ? err.message : 'Failed to create round.';
            setFormError(message);
        } finally {
            setIsCreatingRound(false);
        }
    };

    // --- Update Round Status Handler ---
    const handleUpdateStatus = async (roundIdToUpdate: number, newStatus: SettableRoundStatus) => {
        if (!token) { setStatusUpdateError(`Round ${roundIdToUpdate}: Authentication error.`); return; }
        // Prevent concurrent actions
        if (scoringRoundId !== null || updatingStatusId !== null || deletingRoundId !== null) return;

        setUpdatingStatusId(roundIdToUpdate);
        // Clear all action errors/success
        setStatusUpdateError(null); setFormError(null); setFormSuccess(null); setScoringError(null); setDeleteRoundError(null);
        try {
            await updateRoundStatus(roundIdToUpdate, { status: newStatus }, token);
            setRounds(prevRounds => prevRounds.map(r => r.roundId === roundIdToUpdate ? { ...r, status: newStatus } : r));
        } catch (err: unknown) {
            console.error(`Error updating status for round ${roundIdToUpdate} to ${newStatus}:`, err);
            const message = err instanceof Error ? err.message : `Failed to update status to ${newStatus}.`;
            setStatusUpdateError(`Round ${roundIdToUpdate}: ${message}`);
            await fetchRounds(); // Revert on error
        } finally {
            setUpdatingStatusId(null);
        }
    };

     // --- Handler for Trigger Scoring ---
    const handleTriggerScoring = async (roundIdToScore: number) => {
        if (!token) { setScoringError(`Round ${roundIdToScore}: Authentication error.`); return; }
        // Prevent concurrent actions
        if (scoringRoundId !== null || updatingStatusId !== null || deletingRoundId !== null) return;

        setScoringRoundId(roundIdToScore);
        // Clear all action errors/success
        setScoringError(null); setStatusUpdateError(null); setFormError(null); setFormSuccess(null); setDeleteRoundError(null);
        try {
            console.log(`Triggering scoring for round ${roundIdToScore}...`);
            await triggerScoring(roundIdToScore, token);
            console.log(`Scoring triggered successfully for round ${roundIdToScore}. Refetching rounds...`);
            await fetchRounds();
        } catch (err: unknown) {
            console.error(`Error triggering scoring for round ${roundIdToScore}:`, err);
            const message = (err instanceof Error) ? err.message : 'Failed to trigger scoring.';
            setScoringError(`Round ${roundIdToScore}: ${message}`);
        } finally {
            setScoringRoundId(null);
        }
    };

    // --- Handler for Delete Round ---
    const handleDeleteRound = async (roundIdToDelete: number, roundName: string) => {
        if (!token) { setDeleteRoundError("Authentication error."); return; }
        // Prevent concurrent actions
        if (deletingRoundId || updatingStatusId || scoringRoundId) return;

        if (!window.confirm(`Are you sure you want to delete round "${roundName}" (ID: ${roundIdToDelete})? This will also delete ALL associated fixtures and predictions.`)) {
            return;
        }

        setDeletingRoundId(roundIdToDelete);
        // Clear all action errors/success
        setDeleteRoundError(null); setStatusUpdateError(null); setScoringError(null);
        setFormError(null); setFormSuccess(null);

        try {
            await deleteRound(roundIdToDelete, token);
            await fetchRounds(); // Re-fetch rounds list
        } catch (err: unknown) {
            console.error(`Error deleting round ${roundIdToDelete}:`, err);
            const message = err instanceof Error ? err.message : 'Failed to delete round.';
            setDeleteRoundError(`Error deleting round ${roundIdToDelete}: ${message}`);
        } finally {
            setDeletingRoundId(null);
        }
    };
    // --- End Delete Round Handler ---


    // --- Helper Function for Date Formatting ---
    const formatDateTime = (isoString: string | null | undefined): string => {
       if (!isoString) return "Date unavailable";
        try { return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(new Date(isoString)); } catch (e) { console.error("Error formatting date:", isoString, e); return "Invalid Date"; }
    }

    // --- Render Logic ---
    if (isAuthLoading) { return <p className="p-4 text-center">Loading authentication...</p>; }
    if (!token && !isAuthLoading) { return <p className='text-red-500 p-4 font-semibold text-center'>Authentication required for Admin access.</p>; }
    if (error && !isLoadingRounds) { return <p className='text-red-500 p-4 font-semibold text-center'>{error}</p>; }

    return (
        <div className="p-4 md:p-6">
            <h1 className="text-2xl font-bold mb-6">Admin - Manage Rounds</h1>

            {/* Create Round Form */}
            <div className="mb-8 p-6 border rounded shadow-md bg-white">
                 <h2 className="text-xl font-semibold mb-4">Create New Round</h2>
                <form onSubmit={handleCreateRound}>
                    <div className="mb-4"> <label htmlFor="roundName" className="block mb-1 font-medium text-gray-700">Round Name:</label> <input id="roundName" type="text" value={roundName} onChange={(e) => setRoundName(e.target.value)} className="border p-2 w-full rounded border-gray-300 focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50 disabled:bg-gray-100" required aria-required="true" disabled={isCreatingRound} /> </div>
                    <div className="mb-4"> <label htmlFor="roundDeadline" className="block mb-1 font-medium text-gray-700">Deadline:</label> <input id="roundDeadline" type="datetime-local" value={roundDeadline} onChange={(e) => setRoundDeadline(e.target.value)} className="border p-2 w-full rounded border-gray-300 focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50 disabled:bg-gray-100" required aria-required="true" disabled={isCreatingRound} /> </div>
                    <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed" disabled={isCreatingRound}> {isCreatingRound ? 'Creating...' : 'Create Round'} </button>
                    {formError && <p className="text-red-600 mt-3 text-sm font-medium">{formError}</p>}
                    {formSuccess && <p className="text-green-600 mt-3 text-sm font-medium">{formSuccess}</p>}
                </form>
            </div>

             {/* Display Status/Scoring/Delete Errors */}
             {(statusUpdateError || scoringError || deleteRoundError) && ( // Added deleteRoundError
                <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                    <strong>Error:</strong> {statusUpdateError || scoringError || deleteRoundError} {/* Added deleteRoundError */}
                </div>
            )}

            {/* List Rounds Table */}
            <h2 className="text-xl font-semibold mb-4">Existing Rounds</h2>
            <div className="overflow-x-auto shadow rounded border-b border-gray-200 bg-white">
                 <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100"> <tr> <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">ID</th> <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Name</th> <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Deadline</th> <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Status</th> <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th> </tr> </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {isLoadingRounds && rounds.length === 0 && (
                             <tr><td colSpan={5} className="text-center py-4 px-4 text-gray-500 italic">Loading rounds...</td></tr>
                        )}
                         {!isLoadingRounds && rounds.length === 0 ? (
                            <tr><td colSpan={5} className="text-center py-4 px-4 text-gray-500 italic">No rounds found. Create one above!</td></tr>
                        ) : (
                            rounds.map(round => {
                                const isUpdatingThisRow = updatingStatusId === round.roundId;
                                const isScoringThisRow = scoringRoundId === round.roundId;
                                const isDeletingThisRow = deletingRoundId === round.roundId; // <<< ADDED THIS
                                const isAnyActionInProgress = updatingStatusId !== null || scoringRoundId !== null || deletingRoundId !== null; // <<< UPDATED THIS

                                return (
                                     <tr key={round.roundId} className={`hover:bg-gray-50 transition-colors duration-150 ${isUpdatingThisRow || isScoringThisRow || isDeletingThisRow ? 'opacity-70' : ''}`}> {/* <<< UPDATED THIS */}
                                         <td className="py-3 px-4 whitespace-nowrap text-sm font-medium text-gray-900">{round.roundId}</td>
                                        <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-700">{round.name}</td>
                                        <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-700">{formatDateTime(round.deadline)}</td>
                                        <td className="py-3 px-4 whitespace-nowrap text-sm"> <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${ round.status === 'OPEN' ? 'bg-green-100 text-green-800' : round.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800' : round.status === 'CLOSED' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800' }`}> {round.status} </span> </td>
                                        {/* Actions Cell */}
                                        <td className="py-3 px-4 whitespace-nowrap text-sm font-medium">
                                            {/* Loading indicators */}
                                            {isUpdatingThisRow && <span className="text-gray-500 italic text-xs mr-2">Updating Status...</span>}
                                            {isScoringThisRow && <span className="text-indigo-500 italic text-xs mr-2">Triggering Scoring...</span>}
                                            {isDeletingThisRow && <span className="text-red-500 italic text-xs mr-2">Deleting...</span>} {/* Added delete indicator */}

                                            {/* Show buttons only if no action on this row */}
                                            {!isUpdatingThisRow && !isScoringThisRow && !isDeletingThisRow && (
                                                <div className="flex items-center space-x-2 flex-wrap gap-1">
                                                    {/* Status Buttons */}
                                                     {round.status === 'SETUP' && ( <button onClick={() => handleUpdateStatus(round.roundId, 'OPEN')} disabled={isAnyActionInProgress} className="px-2 py-1 text-xs bg-green-500 hover:bg-green-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed">Open</button> )}
                                                     {round.status === 'OPEN' && ( <button onClick={() => handleUpdateStatus(round.roundId, 'CLOSED')} disabled={isAnyActionInProgress} className="px-2 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed">Close</button> )}
                                                     {(round.status === 'OPEN' || round.status === 'CLOSED') && ( <button onClick={() => handleUpdateStatus(round.roundId, 'SETUP')} disabled={isAnyActionInProgress} title="Reset status to Setup" className="px-2 py-1 text-xs bg-yellow-500 hover:bg-yellow-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed">Reset</button> )}
                                                    {/* Fixtures Link */}
                                                     {round.roundId && ( <Link href={`/admin/rounds/${round.roundId}/fixtures`} className={`px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded ${isAnyActionInProgress ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`} aria-disabled={isAnyActionInProgress} onClick={(e) => { if (isAnyActionInProgress) e.preventDefault(); }} > Fixtures </Link> )}
                                                    {/* Trigger Scoring Button */}
                                                     {round.status === 'CLOSED' && ( <button onClick={() => handleTriggerScoring(round.roundId)} className="px-2 py-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed" title="Calculate points and finalize round" disabled={isAnyActionInProgress} > Trigger Scoring </button> )}
                                                    {/* Completed Status */}
                                                     {(round.status === 'COMPLETED') && ( <span className="text-xs text-blue-700 font-semibold italic">Completed</span> )}

                                                    {/* --- Add Delete Round Button --- */}
                                                    {/* Allow deleting SETUP or COMPLETED rounds, prevent deleting OPEN/CLOSED */}
                                                    {(round.status === 'SETUP' || round.status === 'COMPLETED') && (
                                                         <button
                                                             onClick={() => handleDeleteRound(round.roundId, round.name)}
                                                             className="px-2 py-1 text-xs bg-red-700 hover:bg-red-800 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                                             title="Delete Round (Permanent!)"
                                                             disabled={isAnyActionInProgress} // Disable if any action is running
                                                         >
                                                             Delete
                                                         </button>
                                                    )}
                                                    {/* --- End Delete Round Button --- */}

                                                </div>
                                            )}
                                        </td>
                                        {/* End Actions Cell */}
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