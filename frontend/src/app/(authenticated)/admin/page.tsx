// frontend/src/app/(authenticated)/admin/page.tsx
'use client';

// Import necessary React hooks and types
import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link'; // <<< Import Link
import { useAuth } from '@/context/AuthContext';
import { toast } from 'react-hot-toast';

// Import API functions and types
import {
    getRounds,
    createRound,
    updateRoundStatus,
    triggerScoring,
    deleteRound,
    Round,
    updateRoundDetails,
} from '@/lib/api';

// Import necessary components
import EditRoundModal from '@/components/Admin/EditRoundModal';
import ConfirmationModal from '@/components/Modal/ConfirmationModal';

// Define the payload type for updating round details
interface UpdateRoundPayload {
    name?: string;
    deadline?: string;
}

// Default export for the Admin Rounds Page component
export default function AdminRoundsPage() {
    const { token, user, isLoading: isAuthLoading } = useAuth();
    const router = useRouter();

    // State
    const [rounds, setRounds] = useState<Round[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});
    const [newRoundName, setNewRoundName] = useState('');
    const [newRoundDeadline, setNewRoundDeadline] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingRound, setEditingRound] = useState<Round | null>(null);
    const [editError, setEditError] = useState<string | null>(null);
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
    const [roundToDelete, setRoundToDelete] = useState<Round | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Function to fetch rounds
    const fetchRounds = useCallback(async () => {
        if (!token) return;
        setError(null);
        try {
            const fetchedRounds = await getRounds(token);
            setRounds(fetchedRounds.sort((a, b) => b.roundId - a.roundId));
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to fetch rounds');
            setRounds([]);
        } finally {
            if (isLoading) setIsLoading(false);
        }
    }, [token, isLoading]);

    // Effect to handle initial load & auth check
    useEffect(() => {
        // Redirect if not admin (after auth check is done)
        if (!isAuthLoading && (!user || user.role !== 'ADMIN')) {
             router.replace('/dashboard'); // Use replace to avoid back navigation to admin
             return;
        }
        // Fetch rounds if authenticated and still loading state
        if (token && isLoading) {
            fetchRounds();
        } else if (!isAuthLoading && !token){
            // If auth check done but no token, set error (though redirect should handle)
            setError("Authentication required.");
            setIsLoading(false);
        }
    }, [token, user, isAuthLoading, router, fetchRounds, isLoading]);

    // Helper to set loading state
    const setRoundActionLoading = (roundId: number, isLoading: boolean) => {
        setActionLoading(prev => ({ ...prev, [roundId]: isLoading }));
    };

    // --- Handlers ---

    const handleCreateRoundSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!token) return;
        if (!newRoundName.trim() || !newRoundDeadline) {
             toast.error("Round Name and Prediction Deadline are required."); return;
         }
        setIsCreating(true); setCreateError(null); setError(null);
        try {
            await createRound({ name: newRoundName, deadline: newRoundDeadline }, token);
            setNewRoundName(''); setNewRoundDeadline('');
            await fetchRounds(); toast.success('Round created successfully!');
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to create round';
            setCreateError(errorMsg); toast.error(`Creation failed: ${errorMsg}`);
        } finally { setIsCreating(false); }
    };

    const handleStatusChange = async (roundId: number, newStatus: 'SETUP' | 'OPEN' | 'CLOSED') => {
         if (!token) return;
         setRoundActionLoading(roundId, true); setError(null);
         try {
             await updateRoundStatus(roundId, { status: newStatus }, token);
             await fetchRounds(); toast.success(`Round ${roundId} status updated to ${newStatus}.`);
         } catch (err: unknown) {
              const errorMsg = err instanceof Error ? err.message : `Failed to update status for round ${roundId}`;
              setError(errorMsg); toast.error(`Status update failed: ${errorMsg}`);
         } finally { setRoundActionLoading(roundId, false); }
     };

    const handleTriggerScoring = async (roundId: number) => {
          if (!token) return;
          setRoundActionLoading(roundId, true); setError(null);
          try {
              await triggerScoring(roundId, token);
              toast.success(`Scoring triggered for round ${roundId}. Status will update.`);
              setTimeout(fetchRounds, 1500); // Refresh after a delay
          } catch (err: unknown) {
              const errorMsg = err instanceof Error ? err.message : `Failed to trigger scoring for round ${roundId}`;
              setError(errorMsg); toast.error(`Scoring trigger failed: ${errorMsg}`);
          } finally { setRoundActionLoading(roundId, false); }
      };

    const openDeleteConfirmModal = (round: Round) => {
        setRoundToDelete(round); setIsConfirmDeleteOpen(true);
    };

    const closeDeleteConfirmModal = () => {
        setIsConfirmDeleteOpen(false); setRoundToDelete(null); setIsDeleting(false);
    };

    const handleConfirmDelete = async () => {
        if (!token || !roundToDelete) return;
        const roundIdToDelete = roundToDelete.roundId;
        setIsDeleting(true); setRoundActionLoading(roundIdToDelete, true); setError(null);
        try {
            await deleteRound(roundIdToDelete, token);
            await fetchRounds(); toast.success(`Round "${roundToDelete.name}" deleted successfully!`);
            closeDeleteConfirmModal();
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : `Failed to delete round ${roundToDelete.name}`;
            setError(errorMsg); toast.error(`Deletion failed: ${errorMsg}`);
            closeDeleteConfirmModal(); // Close even on error
        } finally {
            setIsDeleting(false); setRoundActionLoading(roundIdToDelete, false);
        }
    };

    const handleOpenEditModal = (round: Round) => {
        setEditingRound(round); setIsEditModalOpen(true); setEditError(null);
    };

    const handleCloseEditModal = () => {
        setIsEditModalOpen(false); setEditingRound(null); setEditError(null);
    };

    const handleUpdateRound = async (updatedData: UpdateRoundPayload) => {
        if (!token || !editingRound) return;
        // Optional: Check if data actually changed before API call
        // if (updatedData.name === editingRound.name && updatedData.deadline === editingRound.deadline) {
        //     handleCloseEditModal(); return;
        // }
        const roundIdToUpdate = editingRound.roundId;
        setRoundActionLoading(roundIdToUpdate, true); setEditError(null); setError(null);
        try {
            await updateRoundDetails(roundIdToUpdate, updatedData, token);
            await fetchRounds(); handleCloseEditModal();
            toast.success(`Round "${updatedData.name || editingRound.name}" updated successfully!`);
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to update round details.';
            console.error("Error updating round:", err); setEditError(errorMsg);
            toast.error(`Update failed: ${errorMsg}`);
        } finally { setRoundActionLoading(roundIdToUpdate, false); }
    };

    // --- Render Logic ---

    // Show loading state until auth is checked and initial round fetch attempt is done
    if (isAuthLoading || isLoading) {
        return <div className="p-4 text-center">Loading Admin Data...</div>;
    }
    // This should ideally be handled by layout/middleware, but double-check here
    if (!user || user.role !== 'ADMIN') {
        // Redirect should have happened in useEffect, show message if somehow still here
        return <p className="p-4 text-red-600">Access Denied.</p>;
    }

    // Main component rendering
    return (
        <div className="p-4 md:p-6">
            <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

            {error && <p className="text-red-500 bg-red-100 p-3 rounded mb-4">Error: {error}</p>}

            {/* Grid for Admin Sections */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">

                {/* Create Round Form */}
                 <div className="bg-white p-4 rounded shadow border border-gray-200">
                    <h2 className="text-lg font-semibold mb-3">Create New Round</h2>
                    {createError && <p className="text-red-500 text-sm mb-3">Error: {createError}</p>}
                    <form onSubmit={handleCreateRoundSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="newRoundName" className="block text-sm font-medium text-gray-700 mb-1"> Round Name: </label>
                            <input type="text" id="newRoundName" value={newRoundName} onChange={(e) => setNewRoundName(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" required disabled={isCreating}/>
                        </div>
                        <div>
                             <label htmlFor="newRoundDeadline" className="block text-sm font-medium text-gray-700 mb-1"> Prediction Deadline: </label>
                             <input type="datetime-local" id="newRoundDeadline" value={newRoundDeadline} onChange={(e) => setNewRoundDeadline(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" required disabled={isCreating}/>
                             <p className="text-xs text-gray-500 mt-1">Select date and time in your local timezone.</p>
                        </div>
                        <div className="text-right"> <button type="submit" disabled={isCreating} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"> {isCreating ? 'Creating...' : 'Create Round'} </button> </div>
                    </form>
                 </div>

                 {/* === NEW: Audit Link Section === */}
                 <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
                    <h2 className="text-xl font-semibold mb-3 text-gray-700">Audit & Verification</h2>
                    <Link href="/admin/audit" className="text-blue-600 hover:underline block font-medium">
                        Prediction Audit Tool →
                    </Link>
                     <p className="text-sm text-gray-500 mt-1">View user predictions vs results for completed rounds.</p>
                 </div>
                 {/* === END NEW SECTION === */}

            </div> {/* End Grid */}


            {/* Rounds List Table */}
            <h2 className="text-xl font-semibold mt-8 mb-4">Manage Existing Rounds</h2>
            <div className="overflow-x-auto shadow rounded border-b border-gray-200 bg-white">
                 <table className="min-w-full divide-y divide-gray-200">
                     <thead className="bg-gray-100">
                        <tr>
                            <th className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">ID</th>
                            <th className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Name</th>
                            <th className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Deadline</th>
                            <th className="py-3 px-4 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">Status</th>
                            <th className="py-3 px-4 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                        </tr>
                     </thead>
                     <tbody className="bg-white divide-y divide-gray-200">
                          {/* Loading/Empty Row */}
                          {!isLoading && rounds.length === 0 && !error ? (
                                <tr><td colSpan={5} className="text-center py-4 px-4 text-gray-500 italic">No rounds found. Create one above!</td></tr>
                          ) : (
                                rounds.map((round) => (
                                     <tr key={round.roundId} className="hover:bg-gray-50 transition-colors duration-150">
                                          {/* Data Cells */}
                                          <td className="py-3 px-4 whitespace-nowrap text-sm">{round.roundId}</td>
                                          <td className="py-3 px-4 whitespace-nowrap text-sm">{round.name}</td>
                                          <td className="py-3 px-4 whitespace-nowrap text-sm">
                                              {new Date(round.deadline).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short', hour12: false })}
                                          </td>
                                          <td className="py-3 px-4 whitespace-nowrap text-sm text-center font-medium">
                                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                 round.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                                 round.status === 'OPEN' ? 'bg-blue-100 text-blue-800' :
                                                 round.status === 'CLOSED' ? 'bg-red-100 text-red-800' :
                                                 'bg-gray-100 text-gray-800'
                                              }`}>
                                                  {round.status}
                                              </span>
                                          </td>
                                          {/* Action Buttons Cell */}
                                          <td className="py-3 px-4 whitespace-nowrap text-sm text-center space-x-1">
                                                {actionLoading[round.roundId] && !isDeleting ? <span className="text-xs italic">Working...</span> : (
                                                     <>
                                                          <button onClick={() => handleOpenEditModal(round)} className="text-indigo-600 hover:text-indigo-900" title="Edit Round Details" disabled={isDeleting}> Edit </button>
                                                          <button onClick={() => router.push(`/admin/rounds/${round.roundId}/fixtures`)} className="text-blue-600 hover:text-blue-900" title="Manage Fixtures" disabled={isDeleting}> Fixtures </button>
                                                          {round.status === 'SETUP' && ( <button onClick={() => handleStatusChange(round.roundId, 'OPEN')} className="text-green-600 hover:text-green-900" title="Open Round" disabled={isDeleting}>Open</button> )}
                                                          {round.status === 'OPEN' && ( <button onClick={() => handleStatusChange(round.roundId, 'CLOSED')} className="text-red-600 hover:text-red-900" title="Close Round" disabled={isDeleting}>Close</button> )}
                                                          {round.status === 'CLOSED' && ( <button onClick={() => handleTriggerScoring(round.roundId)} className="text-purple-600 hover:text-purple-900" title="Trigger Scoring" disabled={isDeleting}>Score</button> )}
                                                          <button onClick={() => openDeleteConfirmModal(round)} className="text-red-600 hover:text-red-900 ml-2" title="Delete Round" disabled={isDeleting || actionLoading[round.roundId]}>
                                                            {isDeleting && roundToDelete?.roundId === round.roundId ? 'Deleting...' : 'Delete'}
                                                          </button>
                                                     </>
                                                )}
                                            </td>
                                     </tr>
                                ))
                          )}
                     </tbody>
                 </table>
            </div>

            {/* Edit Round Modal */}
            {editingRound && (
                 <EditRoundModal
                     isOpen={isEditModalOpen}
                     round={editingRound}
                     onClose={handleCloseEditModal}
                     onSave={handleUpdateRound}
                     error={editError}
                     isLoading={actionLoading[editingRound.roundId] || false}
                 />
             )}

             {/* Delete Confirmation Modal */}
             {roundToDelete && (
                <ConfirmationModal
                    isOpen={isConfirmDeleteOpen}
                    onClose={closeDeleteConfirmModal}
                    onConfirm={handleConfirmDelete}
                    title={`Delete Round: ${roundToDelete.name}?`}
                    message={
                        <>
                            <p>Are you sure you want to delete round &ldquot;{roundToDelete.name}&ldquot; (ID: {roundToDelete.roundId})?</p>
                            <p className="font-semibold text-red-700 mt-2">This will also delete ALL associated fixtures and predictions.</p>
                            <p className="font-semibold text-red-700">This action cannot be undone.</p>
                        </>
                    }
                    confirmText="Delete Round"
                    isConfirming={isDeleting}
                />
             )}

        </div> // End main container div
    );
}