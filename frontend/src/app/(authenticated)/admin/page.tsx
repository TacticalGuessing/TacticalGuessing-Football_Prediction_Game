// frontend/src/app/(authenticated)/admin/page.tsx
'use client';

// Import necessary React hooks and types
import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { useRouter } from 'next/navigation'; // Use for navigation if needed
import { useAuth } from '@/context/AuthContext'; // Import authentication context

// Import API functions and types
import {
    getRounds,
    createRound,
    updateRoundStatus,
    triggerScoring,
    deleteRound,
    Round, // Type for a round object
    updateRoundDetails, // Function to update round details via API
} from '@/lib/api';

// Import necessary components (EditRoundModal should exist)
// ConfirmationModal import is REMOVED
import EditRoundModal from '@/components/Admin/EditRoundModal'; // Modal for editing rounds

// Define the payload type for updating round details
interface UpdateRoundPayload {
    name?: string;
    deadline?: string;
}

// Default export for the Admin Rounds Page component
export default function AdminRoundsPage() {
    // Get authentication status and user details
    const { token, user, isLoading: isAuthLoading } = useAuth();
    const router = useRouter(); // Router for navigation

    // State for the list of rounds
    const [rounds, setRounds] = useState<Round[]>([]);
    // State for main page loading status
    const [isLoading, setIsLoading] = useState(true);
    // State for general page errors
    const [error, setError] = useState<string | null>(null);
    // State to track loading status for specific actions per round ID
    const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});

    // --- State for the Inline Create Round Form ---
    const [newRoundName, setNewRoundName] = useState('');
    const [newRoundDeadline, setNewRoundDeadline] = useState('');
    const [isCreating, setIsCreating] = useState(false); // Loading state specifically for creation
    const [createError, setCreateError] = useState<string | null>(null); // Error state specifically for creation

    // --- State for Delete Confirmation Modal REMOVED ---
    // const [showConfirmModal, setShowConfirmModal] = useState(false);
    // const [roundToDelete, setRoundToDelete] = useState<number | null>(null);
    // const [confirmMessage, setConfirmMessage] = useState('');

    // State for the edit round modal
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingRound, setEditingRound] = useState<Round | null>(null); // Stores the round being edited
    const [editError, setEditError] = useState<string | null>(null); // Error state specifically for the edit modal

    // Function to fetch rounds from the API
    const fetchRounds = useCallback(async () => {
        if (!token) return; // Need token to fetch
        setError(null); // Clear previous general errors
        try {
            const fetchedRounds = await getRounds(token); // Fetch all rounds
            // Sort rounds by ID descending (newest first)
            setRounds(fetchedRounds.sort((a, b) => b.roundId - a.roundId));
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to fetch rounds');
            setRounds([]); // Clear rounds on error
        } finally {
            // Only set global loading false after the *initial* fetch completes
            if (isLoading) setIsLoading(false);
        }
    }, [token, isLoading]); // Depend on token and initial loading state

    // Effect to handle initial load, authentication checks, and redirection
    useEffect(() => {
        // Redirect non-admins or logged-out users
        if (!isAuthLoading && (!user || user.role !== 'ADMIN')) {
             router.push('/dashboard'); // Redirect to dashboard
             return;
        }
        // Fetch rounds only on initial load when authenticated
        if (token && isLoading) {
            fetchRounds();
        } else if (!isAuthLoading && !token){
             // Handle case where user is definitively logged out after auth check
            setError("Authentication required.");
            setIsLoading(false);
        }
    }, [token, user, isAuthLoading, router, fetchRounds, isLoading]); // Dependencies

    // Helper to set loading state for a specific round action
    const setRoundActionLoading = (roundId: number, isLoading: boolean) => {
        setActionLoading(prev => ({ ...prev, [roundId]: isLoading }));
    };

    // Handler for submitting the INLINE create round form
    const handleCreateRoundSubmit = async (e: FormEvent) => {
        e.preventDefault(); // Prevent default form submission
        if (!token) return; // Need token
        // Basic validation
        if (!newRoundName.trim() || !newRoundDeadline) {
             alert("Round Name and Prediction Deadline are required.");
             return;
         }
        setIsCreating(true); // Set specific creation loading state
        setCreateError(null); // Clear previous creation errors
        setError(null); // Clear general page errors
        try {
            // Call API to create round
            await createRound({ name: newRoundName, deadline: newRoundDeadline }, token);
            setNewRoundName(''); // Clear form fields on success
            setNewRoundDeadline('');
            await fetchRounds(); // Refresh the rounds list
            alert('Round created successfully!'); // Provide user feedback
        } catch (err: unknown) {
            // Handle creation errors
            const errorMsg = err instanceof Error ? err.message : 'Failed to create round';
            setCreateError(errorMsg); // Set specific error state for the form
        } finally {
             setIsCreating(false); // Turn off creation loading state regardless of outcome
        }
    };

    // Handler for changing a round's status
     const handleStatusChange = async (roundId: number, newStatus: 'SETUP' | 'OPEN' | 'CLOSED') => {
         if (!token) return;
         setRoundActionLoading(roundId, true); // Set loading for this specific round
         setError(null);
         try {
             await updateRoundStatus(roundId, { status: newStatus }, token); // Call API
             await fetchRounds(); // Refresh list
         } catch (err: unknown) {
              const errorMsg = err instanceof Error ? err.message : `Failed to update status for round ${roundId}`;
              setError(errorMsg); // Set general error
              alert(`Error: ${errorMsg}`); // Alert user
         } finally {
              setRoundActionLoading(roundId, false); // Clear loading for this round
         }
     };

    // Handler for triggering the scoring process for a round
     const handleTriggerScoring = async (roundId: number) => {
          if (!token) return;
          setRoundActionLoading(roundId, true);
          setError(null);
          try {
              await triggerScoring(roundId, token); // Call API
              alert(`Scoring triggered for round ${roundId}. Status will update shortly.`);
              // Add a small delay before refreshing to allow backend process
              setTimeout(fetchRounds, 1500);
          } catch (err: unknown) {
              const errorMsg = err instanceof Error ? err.message : `Failed to trigger scoring for round ${roundId}`;
              setError(errorMsg);
              alert(`Error: ${errorMsg}`);
          } finally {
              setRoundActionLoading(roundId, false);
          }
      };

     // --- MODIFIED: Handler to prompt for deletion using window.confirm ---
      const promptDeleteRound = (roundId: number, roundName: string) => {
           const confirmationMessage = `Are you sure you want to delete round "${roundName}"? This will also delete ALL associated fixtures and predictions. This action cannot be undone.`;
           if (window.confirm(confirmationMessage)) {
                // If user clicks OK, directly call the delete handler
                handleDeleteRound(roundId); // Pass the ID directly
           }
           // If user clicks Cancel, do nothing
       };

      // --- MODIFIED: Handler for actually deleting the round (now accepts ID as argument) ---
       const handleDeleteRound = async (roundIdToDelete: number | null) => { // Accept ID as arg
            if (!token || roundIdToDelete === null) return; // Safety check

            setRoundActionLoading(roundIdToDelete, true); // Use the passed ID
            setError(null);
            try {
                await deleteRound(roundIdToDelete, token); // Call API with the ID
                await fetchRounds(); // Refresh list
                alert('Round deleted successfully!');
            } catch (err: unknown) {
                const errorMsg = err instanceof Error ? err.message : `Failed to delete round ${roundIdToDelete}`;
                setError(errorMsg);
                alert(`Error: ${errorMsg}`);
            } finally {
                setRoundActionLoading(roundIdToDelete, false); // Clear loading for the ID
                // No need to reset roundToDelete state anymore
            }
        };

    // Handler to open the Edit Round modal
    const handleOpenEditModal = (round: Round) => {
        setEditingRound(round); // Store the round data to edit
        setIsEditModalOpen(true); // Open the modal
        setEditError(null); // Clear any previous edit errors
    };

    // Handler to close the Edit Round modal
    const handleCloseEditModal = () => {
        setIsEditModalOpen(false); // Close the modal
        setEditingRound(null); // Clear the editing state
        setEditError(null); // Clear edit errors
    };

    // Handler for saving changes from the Edit Round modal
    const handleUpdateRound = async (updatedData: UpdateRoundPayload) => {
        if (!token || !editingRound) return; // Safety checks

        // Optional: Prevent API call if no actual changes were made
        if (updatedData.name === editingRound.name && updatedData.deadline === editingRound.deadline) {
            handleCloseEditModal(); // Just close if nothing changed
            return;
        }

        const roundIdToUpdate = editingRound.roundId; // Capture ID
        setRoundActionLoading(roundIdToUpdate, true); // Set loading for this round
        setEditError(null); // Clear previous modal errors

        try {
            // Call the API function to update details
            await updateRoundDetails(roundIdToUpdate, updatedData, token);
            await fetchRounds(); // Refresh the rounds list
            handleCloseEditModal(); // Close modal on success
            alert('Round updated successfully!');
        } catch (err: unknown) {
            // Handle errors during update
            const errorMsg = err instanceof Error ? err.message : 'Failed to update round details.';
            console.error("Error updating round:", err);
            setEditError(errorMsg); // Set error state to display *in the modal*
        } finally {
             setRoundActionLoading(roundIdToUpdate, false); // Clear loading state
        }
    };


    // --- Render Logic ---

    // Show main loading indicator only on initial load
    if (isAuthLoading || (isLoading && rounds.length === 0)) {
        return <div className="p-4 text-center">Loading Admin Data...</div>;
    }

    // Should not render if user is not an admin (redirect handled in useEffect)
    if (!user || user.role !== 'ADMIN') {
        return null;
    }

    // Main component rendering
    return (
        <div className="p-4 md:p-6">
            <h1 className="text-2xl font-bold mb-6">Admin - Manage Rounds</h1>

            {/* Display general page errors */}
            {error && <p className="text-red-500 bg-red-100 p-3 rounded mb-4">Error: {error}</p>}

            {/* --- Inlined Round Creation Form --- */}
            <div className="bg-white p-4 rounded shadow border border-gray-200 mb-6">
                <h2 className="text-lg font-semibold mb-3">Create New Round</h2>
                {/* Display creation-specific errors */}
                {createError && <p className="text-red-500 text-sm mb-3">Error: {createError}</p>}
                {/* Form for creating a new round */}
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
            {/* --- End Inlined Form --- */}


            {/* Rounds List Table */}
            <h2 className="text-xl font-semibold mt-8 mb-4">Existing Rounds</h2>
            <div className="overflow-x-auto shadow rounded border-b border-gray-200 bg-white">
                 {/* Table structure */}
                 <table className="min-w-full divide-y divide-gray-200">
                     <thead className="bg-gray-100">
                          {/* Table Headers */}
                          <tr>
                                <th className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">ID</th>
                                <th className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Name</th>
                                <th className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Deadline</th>
                                <th className="py-3 px-4 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">Status</th>
                                <th className="py-3 px-4 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                          </tr>
                     </thead>
                     <tbody className="bg-white divide-y divide-gray-200">
                          {/* Table Body: Loading/Empty/Data Rows */}
                          {isLoading && rounds.length === 0 ? (
                                <tr><td colSpan={5} className="text-center py-4 px-4 text-gray-500 italic">Loading rounds...</td></tr>
                          ) : rounds.length === 0 ? (
                                <tr><td colSpan={5} className="text-center py-4 px-4 text-gray-500 italic">No rounds found.</td></tr>
                          ) : (
                                rounds.map((round) => (
                                     <tr key={round.roundId} className="hover:bg-gray-50 transition-colors duration-150">
                                          {/* Round Data Cells */}
                                          <td className="py-3 px-4 whitespace-nowrap text-sm">{round.roundId}</td>
                                          <td className="py-3 px-4 whitespace-nowrap text-sm">{round.name}</td>
                                          <td className="py-3 px-4 whitespace-nowrap text-sm">
                                              {/* Format deadline for display */}
                                              {new Date(round.deadline).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                                          </td>
                                          <td className="py-3 px-4 whitespace-nowrap text-sm text-center font-medium">
                                              {/* Status Badge */}
                                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                 round.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                                 round.status === 'OPEN' ? 'bg-blue-100 text-blue-800' :
                                                 round.status === 'CLOSED' ? 'bg-red-100 text-red-800' :
                                                 'bg-gray-100 text-gray-800' // SETUP
                                              }`}>
                                                  {round.status}
                                              </span>
                                          </td>
                                          {/* Action Buttons Cell */}
                                          <td className="py-3 px-4 whitespace-nowrap text-sm text-center space-x-1">
                                              {/* Show loading indicator or action buttons */}
                                              {actionLoading[round.roundId] ? <span className="text-xs italic">Working...</span> : (
                                                   <>
                                                        {/* Edit Button */}
                                                        <button onClick={() => handleOpenEditModal(round)} className="text-indigo-600 hover:text-indigo-900" title="Edit Round Details"> Edit </button>
                                                        {/* Manage Fixtures Button */}
                                                        <button onClick={() => router.push(`/admin/rounds/${round.roundId}/fixtures`)} className="text-blue-600 hover:text-blue-900" title="Manage Fixtures"> Fixtures </button>
                                                        {/* Conditional Status Change Buttons */}
                                                        {round.status === 'SETUP' && ( <button onClick={() => handleStatusChange(round.roundId, 'OPEN')} className="text-green-600 hover:text-green-900" title="Open Round">Open</button> )}
                                                        {round.status === 'OPEN' && ( <button onClick={() => handleStatusChange(round.roundId, 'CLOSED')} className="text-red-600 hover:text-red-900" title="Close Round">Close</button> )}
                                                        {/* Trigger Scoring Button */}
                                                        {round.status === 'CLOSED' && ( <button onClick={() => handleTriggerScoring(round.roundId)} className="text-purple-600 hover:text-purple-900" title="Trigger Scoring">Score</button> )}
                                                        {/* Delete Button - Calls promptDeleteRound */}
                                                        <button onClick={() => promptDeleteRound(round.roundId, round.name)} className="text-red-600 hover:text-red-900 ml-2" title="Delete Round"> Delete </button>
                                                   </>
                                              )}
                                          </td>
                                     </tr>
                                ))
                          )}
                     </tbody>
                 </table>
            </div>

            {/* Modal Components */}
             {/* Confirmation Modal JSX REMOVED */}

             {/* Edit Round Modal (renders only when editingRound is set) */}
             {editingRound && (
                 <EditRoundModal
                     isOpen={isEditModalOpen}
                     round={editingRound}
                     onClose={handleCloseEditModal}
                     onSave={handleUpdateRound}
                     error={editError} // Pass error message to modal
                     isLoading={actionLoading[editingRound.roundId] || false} // Pass loading state
                 />
             )}
        </div>
    );
}