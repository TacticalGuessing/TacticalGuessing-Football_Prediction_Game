// frontend/src/app/(authenticated)/admin/page.tsx
'use client';

// Import necessary React hooks and types
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link'; // <<< Import Link
import { useAuth } from '@/context/AuthContext';
import { toast } from 'react-hot-toast';

// Import API functions and types
import {
    getRounds,
    //createRound,
    updateRoundStatus,
    triggerScoring,
    deleteRound,
    Round,
    updateRoundDetails,

} from '@/lib/api';

// Import necessary components
import EditRoundModal from '@/components/Admin/EditRoundModal';
import ConfirmationModal from '@/components/Modal/ConfirmationModal';
import CreateRoundModal from '@/components/Admin/CreateRoundModal';

// --- Add UI Component Imports ---
import { Button } from '@/components/ui/Button';
//import { Input } from '@/components/ui/Input';
//import { Label } from '@/components/ui/Label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { FaEdit, FaTrashAlt, FaList, FaToggleOff, FaToggleOn, FaCalculator, FaExclamationTriangle, FaUserCog, FaPlus } from 'react-icons/fa'; // Added FaCalculator
import { formatDateTime } from '@/utils/formatters'; // Ensure this path is correct

// Define RoundStatus locally if not exported from API
type RoundStatus = 'SETUP' | 'OPEN' | 'CLOSED';

// Define the payload type for updating round details
interface UpdateRoundPayload {
    name?: string;
    deadline?: string;
    jokerLimit?: number; // Keep if you might edit jokers later via EditRoundModal
}

// Default export for the Admin Rounds Page component
export default function AdminRoundsPage() {
    const { token, user, isLoading: isAuthLoading } = useAuth();
    const router = useRouter();

    // State
    const [rounds, setRounds] = useState<Round[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    //const [newRoundName, setNewRoundName] = useState('');
    //const [newRoundDeadline, setNewRoundDeadline] = useState('');
    //const [isCreating, setIsCreating] = useState(false);
    //const [createError, setCreateError] = useState<string | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingRound, setEditingRound] = useState<Round | null>(null);
    const [editError, setEditError] = useState<string | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
    const [roundToDelete, setRoundToDelete] = useState<Round | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // === NEW: Create Modal State ===
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // Function to fetch rounds (this will now be the callback)
    const fetchRounds = useCallback(async () => {
        // console.log("fetchRounds called"); // Debug log
        if (!token) return;
        setError(null); // Clear previous errors on fetch
        // Don't set loading true here if it's just a refresh, only on initial load
        // setIsLoading(true);
        try {
            const fetchedRounds = await getRounds(token);
            //console.log("[AdminPage fetchRounds] Fetched rounds data:", fetchedRounds);
            setRounds(fetchedRounds.sort((a, b) => b.roundId - a.roundId));
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to fetch rounds');
            setRounds([]); // Clear rounds on error
        } finally {
            // Only set initial loading to false
            if (isLoading) setIsLoading(false);
        }
    }, [token, isLoading]); // Dependency on isLoading ensures initial fetch works

    // Effect to handle initial load & auth check
    // Effect to handle initial load & auth check
    useEffect(() => {
        //console.log(`[AdminPage Effect] Running. isAuthLoading: ${isAuthLoading}, user: ${user ? user.email : 'null'}, isLoading: ${isLoading}`);

        // --- Primary Action: Only run logic AFTER initial auth loading is complete ---
        if (!isAuthLoading) {

            // Case 1: User is logged out (or never logged in)
            if (!user) {
                //console.log("[AdminPage Effect] Condition: No user. Should NOT redirect from here. Clearing rounds.");
                setRounds([]); // Clear data if user logged out while on page
                // No redirect should happen here; let AuthContext logout handle it.
                return; // Explicitly stop processing this effect run
            }

            // Case 2: User is logged in, but NOT an ADMIN
            if (user && user.role !== 'ADMIN') {
                console.warn("[AdminPage Effect] Condition: User exists but NOT Admin. Redirecting to /dashboard.");
                router.replace('/dashboard');
                return; // Stop processing
            }

            // Case 3: User IS an ADMIN
            if (user && user.role === 'ADMIN') {
                // Fetch data only if it's the initial page load (indicated by `isLoading` state)
                if (isLoading) {
                    //console.log("[AdminPage Effect] Condition: Admin user detected, initial fetch needed.");
                    fetchRounds();
                } else {
                    //console.log("[AdminPage Effect] Condition: Admin user detected, but not initial fetch (isLoading is false). No fetch needed here.");
                }
                return; // Stop processing
            }

            // Fallback case (shouldn't be reached with above logic)
            console.warn("[AdminPage Effect] Reached unexpected state.");

        } else {
            //console.log("[AdminPage Effect] Skipping checks, initial auth loading is still true.");
        }
        // Original dependencies are likely correct, ensuring it re-runs on relevant state changes
    }, [user, isAuthLoading, router, fetchRounds, isLoading]);

    // Helper to set loading state


    // --- Handlers ---

    const handleStatusChange = async (roundId: number, newStatus: RoundStatus) => {
        if (!token) return;

        try {
            await updateRoundStatus(roundId, { status: newStatus }, token);
            await fetchRounds(); toast.success(`Round ${roundId} status updated to ${newStatus}.`);
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : `Failed to update status for round ${roundId}`;
            setError(errorMsg); toast.error(`Status update failed: ${errorMsg}`);
        }
    };

    const handleTriggerScoring = async (roundId: number) => {
        if (!token) return;

        try {
            await triggerScoring(roundId, token);
            toast.success(`Scoring triggered for round ${roundId}. Status will update.`);
            setTimeout(fetchRounds, 1500); // Refresh after a delay
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : `Failed to trigger scoring for round ${roundId}`;
            setError(errorMsg); toast.error(`Scoring trigger failed: ${errorMsg}`);
        }
    };

    const openDeleteModal = (round: Round) => {
        setRoundToDelete(round); setIsConfirmDeleteOpen(true);
    };

    const closeDeleteConfirmModal = () => {
        setIsConfirmDeleteOpen(false); setRoundToDelete(null); setIsDeleting(false);
    };

    const handleConfirmDelete = async () => {
        if (!token || !roundToDelete) return;
        const roundIdToDelete = roundToDelete.roundId;
        setIsDeleting(true); setError(null);
        try {
            await deleteRound(roundIdToDelete, token);
            await fetchRounds(); toast.success(`Round "${roundToDelete.name}" deleted successfully!`);
            closeDeleteConfirmModal();
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : `Failed to delete round ${roundToDelete.name}`;
            setError(errorMsg); toast.error(`Deletion failed: ${errorMsg}`);
            closeDeleteConfirmModal(); // Close even on error
        } finally {
            setIsDeleting(false);
        }
    };

    const handleOpenEditModal = (round: Round) => {
        setEditingRound(round); setIsEditModalOpen(true); setEditError(null);
    };

    const handleCloseEditModal = () => {
        setIsEditModalOpen(false); setEditingRound(null); setEditError(null);
    };

    const handleUpdateRound = async (updatedData: UpdateRoundPayload) => {
        if (!token || !editingRound || isUpdating) return; // Prevent double submit using isUpdating

        const roundIdToUpdate = editingRound.roundId;

        // --- Set Loading State ---
        setIsUpdating(true); // <--- USE setIsUpdating here
        // setRoundActionLoading(roundIdToUpdate, true); // Remove if actionLoading is redundant

        setEditError(null); setError(null); // Clear errors

        try {
            // Convert deadline if needed by API (assuming API expects ISO)
            const payloadToSubmit = { ...updatedData };
            if (updatedData.deadline) {
                try {
                    payloadToSubmit.deadline = new Date(updatedData.deadline).toISOString();
                } catch (dateError) {
                    console.error("Invalid deadline format during update:", updatedData.deadline, dateError); // Added dateError here
                    throw new Error("Invalid deadline date format.");
                }
            }

            await updateRoundDetails(roundIdToUpdate, payloadToSubmit, token); // Use the correct API function
            await fetchRounds(); // Refresh list
            handleCloseEditModal(); // Close modal on success
            toast.success(`Round "${updatedData.name || editingRound.name}" updated successfully!`);

        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to update round details.';
            console.error("Error updating round:", err);
            setEditError(errorMsg); // Show error in modal
            toast.error(`Update failed: ${errorMsg}`);
            // Keep modal open on error

        } finally {
            // --- Reset Loading State ---
            setIsUpdating(false); // <--- USE setIsUpdating here
            // setRoundActionLoading(roundIdToUpdate, false); // Remove if actionLoading is redundant
        }
    };

    // === NEW: Create Modal Handlers ===
    const handleOpenCreateModal = () => setIsCreateModalOpen(true);
    const handleCloseCreateModal = () => setIsCreateModalOpen(false);
    // The 'handleRoundCreated' action is simply calling fetchRounds directly now via the prop
    // =================================

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
        // Main page container - Apply padding here
        <div className="p-4 md:p-6 space-y-6"> {/* Added space-y-6 for spacing between elements */}

            {/* Page Title - Moved up, standard margin bottom */}
            <h1 className="text-2xl md:text-3xl font-bold text-gray-100 mb-6 flex items-center"> {/* Added flex */}
                <FaUserCog className="mr-3 text-gray-400" /> {/* Added icon */}
                Admin Dashboard Penis
            </h1>

            {/* Global Error Display (if any) */}
            {error && <p className="text-sm text-red-400 p-3 bg-red-900/30 border border-red-800 rounded">{error}</p>}

            {/* === Section for Creating Rounds === */}
            <div className="mb-4"> {/* Add margin below button */}
                <Button onClick={handleOpenCreateModal}>
                    <FaPlus className="mr-2 h-4 w-4" /> Create New Round
                </Button>
            </div>
            {/* ================================= */}

            {/* Rounds List Table Section - Now directly follows the title */}
            <div className="bg-gray-800 rounded-lg shadow border border-gray-700"> {/* Container for the table section */}
                {/* Header inside the container - REMOVED duplicate H2 */}
                <div className="px-6 py-4 border-b border-gray-700"> {/* Optional: Header padding & border if needed */}
                    <h2 className="text-xl font-semibold text-gray-200">Manage Existing Rounds</h2>
                </div>

                {/* Loading/Empty States */}
                {isLoading && <p className="text-center text-gray-400 py-6">Loading rounds...</p>}
                {!isLoading && rounds.length === 0 && !error && <p className="text-center text-gray-400 italic py-6">No rounds found.</p>}

                {/* Table Container */}
                {!isLoading && rounds.length > 0 && (
                    <div className="overflow-x-auto"> {/* Removed extra border/rounding */}
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]">ID</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Deadline</TableHead>
                                    <TableHead># Jokers</TableHead>
                                    <TableHead className="text-center">Status</TableHead>
                                    
                                    {/* Adjusted width for Actions column */}
                                    <TableHead className="text-center w-[250px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rounds.map((round) => {
                                    const isDeletingThis = isDeleting && roundToDelete?.roundId === round.roundId;
                                    const statusClass =
                                        round.status === 'OPEN' ? 'bg-green-200 text-green-900 dark:bg-green-900/50 dark:text-green-300' :
                                            round.status === 'CLOSED' ? 'bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-300' :
                                                round.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' :
                                                    'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'; // SETUP

                                    return (
                                        <TableRow key={round.roundId} data-state={isDeletingThis ? 'disabled' : undefined} className={isDeletingThis ? 'opacity-50 pointer-events-none' : ''}>
                                            <TableCell className="font-medium">{round.roundId}</TableCell>
                                            <TableCell>{round.name}</TableCell>
                                            <TableCell className="text-xs text-gray-400">{formatDateTime(round.deadline)}</TableCell>
                                            <TableCell className="text-center text-sm">{round.jokerLimit ?? 1}</TableCell> {/* Display Joker Limit */}
                                            {/* Status Cell - Just the badge */}
                                            <TableCell className="text-center">
                                                <span className={`px-2 py-0.5 inline-flex items-center justify-center text-xs leading-5 font-semibold rounded-full ${statusClass}`}>
                                                    {round.status}
                                                </span>
                                                {/* Removed the div with status change buttons from here */}
                                            </TableCell>
                                            {/* Actions Cell - Always Show Icons */}
                                            <TableCell className="text-center space-x-1 flex items-center justify-center">
                                                {/* Manage Fixtures */}
                                                <Link href={`/admin/rounds/${round.roundId}/fixtures`} passHref legacyBehavior>
                                                    <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white" title="Manage Fixtures" disabled={isDeleting || isUpdating}>
                                                        <FaList className="h-3.5 w-3.5" /> <span className="sr-only">Fixtures</span>
                                                    </Button>
                                                </Link>

                                                {/* Edit Round Details */}
                                                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white" onClick={() => handleOpenEditModal(round)} disabled={isDeleting || isUpdating} title="Edit Round Details">
                                                    <FaEdit className="h-3.5 w-3.5" /> <span className="sr-only">Edit</span>
                                                </Button>

                                                {/* Trigger Scoring - Show icon always, disable if not CLOSED */}
                                                <Button
                                                    variant="ghost" size="sm"
                                                    className={round.status === 'CLOSED' ? "text-purple-400 hover:text-purple-300 hover:bg-purple-900/50" : "text-gray-600 cursor-not-allowed"} // Dim if disabled
                                                    onClick={() => round.status === 'CLOSED' ? handleTriggerScoring(round.roundId) : undefined}
                                                    disabled={isDeleting || isUpdating || round.status !== 'CLOSED'}
                                                    title={round.status === 'CLOSED' ? "Trigger Scoring" : "Scoring only available when round is CLOSED"}
                                                >
                                                    <FaCalculator className="h-4 w-4" /> <span className="sr-only">Trigger Scoring</span>
                                                </Button>

                                                {/* --- Status Toggles --- */}
                                                {/* Show "Open" toggle if status is SETUP */}
                                                {round.status === 'SETUP' && (
                                                    <Button variant="ghost" size="sm" className="text-green-400 hover:text-green-300 hover:bg-green-900/50" onClick={() => handleStatusChange(round.roundId, 'OPEN')} disabled={isDeleting || isUpdating} title="Open Round">
                                                        <FaToggleOff className="h-4 w-4" /> <span className="sr-only">Open Round</span>
                                                    </Button>
                                                )}
                                                {/* Show "Close" toggle if status is OPEN */}
                                                {round.status === 'OPEN' && (
                                                    <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 hover:bg-red-900/50" onClick={() => handleStatusChange(round.roundId, 'CLOSED')} disabled={isDeleting || isUpdating} title="Close Round">
                                                        <FaToggleOn className="h-4 w-4" /> <span className="sr-only">Close Round</span>
                                                    </Button>
                                                )}
                                                {/* Optionally show a disabled/warning icon if status is CLOSED or COMPLETED */}
                                                {(round.status === 'CLOSED' || round.status === 'COMPLETED') && (
                                                    <Button variant="ghost" size="sm" className="text-gray-600 cursor-not-allowed" disabled={true} title={round.status === 'CLOSED' ? "Round is Closed (trigger scoring)" : "Round is Completed"}>
                                                        {/* You could use FaToggleOn here dimmed, or a different icon */}
                                                        <FaExclamationTriangle className="h-4 w-4 text-gray-600" />
                                                        <span className="sr-only">Cannot change status</span>
                                                    </Button>
                                                )}
                                                {/* --- End Status Toggles --- */}


                                                {/* Delete Button - Show icon always, disable if not SETUP */}
                                                <Button
                                                    variant="ghost" size="sm"
                                                    className={round.status === 'SETUP' ? "text-gray-400 hover:text-red-400 hover:bg-red-900/30" : "text-gray-600 cursor-not-allowed"} // Subtle default/disabled, red hover only if enabled
                                                    onClick={() => round.status === 'SETUP' ? openDeleteModal(round) : undefined}
                                                    disabled={isDeleting || isUpdating || round.status !== 'SETUP'}
                                                    isLoading={isDeletingThis} // Show loading spinner specifically when deleting this row
                                                    title={round.status !== 'SETUP' ? "Can only delete rounds in SETUP status" : "Delete Round"}
                                                >
                                                    {/* Show warning or trash icon based on disabled status */}
                                                    {round.status !== 'SETUP' ?
                                                        <FaExclamationTriangle className="h-4 w-4" /> :
                                                        <FaTrashAlt className="h-3.5 w-3.5" />
                                                    }
                                                    <span className="sr-only">Delete</span>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>

            {/* Edit Round Modal */}
            {editingRound && (
                <EditRoundModal
                    isOpen={isEditModalOpen}
                    round={editingRound}
                    onClose={handleCloseEditModal}
                    onSave={handleUpdateRound}
                    error={editError}
                    isLoading={isUpdating}
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
                    confirmButtonVariant="danger"
                />
            )}

            {/* === NEW: Create Round Modal Render === */}
            <CreateRoundModal
                isOpen={isCreateModalOpen}
                onClose={handleCloseCreateModal}
                onRoundCreated={fetchRounds} // <<< Pass the fetchRounds function directly
            />
                       {/* ====================================== */}

        </div> // End main container div
    );
}