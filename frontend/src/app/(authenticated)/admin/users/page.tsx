// frontend/src/app/(authenticated)/admin/users/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
// Ensure all necessary API functions and types are imported
import {
    getAllUsersForAdmin,
    updateUserRoleAdmin,
    deleteUserAdmin,
    updateUserVerificationAdmin, // Import the new verification update function
    User,
    ApiError
} from '@/lib/api';
import { toast } from 'react-hot-toast';

// --- UI Component Imports ---
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import Spinner from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
// Import necessary icons
import { FaTrashAlt, FaKey, FaUserCheck, FaUserTimes } from 'react-icons/fa';
import ConfirmationModal from '@/components/Modal/ConfirmationModal';

export default function AdminManageUsersPage() {
    // --- State ---
    const { user: adminUser, token, isLoading: isAuthLoading } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // State for specific row actions
    const [updatingRoleId, setUpdatingRoleId] = useState<number | null>(null);
    const [updatingVerificationId, setUpdatingVerificationId] = useState<number | null>(null); // State for verification update
    const [deletingUserId, setDeletingUserId] = useState<number | null>(null); // State for delete loading
    // Modal states
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);

    // --- Data Fetching ---
    const fetchUsers = useCallback(async () => {
        if (!token) return;
        console.log("Fetching users for admin...");
        setIsLoadingUsers(true);
        setError(null); // Clear previous errors
        try {
            // Ensure getAllUsersForAdmin fetches emailVerified
            const fetchedUsers = await getAllUsersForAdmin(token);
            // Filter out Admins from the display list
            const displayUsers = fetchedUsers.filter(u => u.role !== 'ADMIN');
            setUsers(displayUsers);
        } catch (err) {
            console.error("Failed to fetch users:", err);
            setError(err instanceof ApiError ? err.message : "Could not load user list.");
            setUsers([]); // Clear users on error
        } finally {
            setIsLoadingUsers(false);
        }
    }, [token]);

    // Initial data fetch effect
    useEffect(() => {
        if (!isAuthLoading && token) {
            fetchUsers();
        } else if (!isAuthLoading && !token) {
            setIsLoadingUsers(false); // Stop loading if no token
        }
        // Added fetchUsers to dependency array as per ESLint rule suggestion
    }, [isAuthLoading, token, fetchUsers]);

    // --- Handlers ---

    // Handler for changing user role
    const handleRoleChange = async (newRole: string | undefined, targetUserId: number) => {
        if (newRole !== 'PLAYER' && newRole !== 'VISITOR') return;
        const originalUser = users.find(u => u.userId === targetUserId);
        if (newRole === originalUser?.role) return; // No change
        if (!token) { toast.error("Authentication error."); return; }
        if (!window.confirm(`Change role for user ${originalUser?.name ?? targetUserId} to ${newRole}?`)) return;

        setUpdatingRoleId(targetUserId); setError(null);
        try {
            console.log(`Admin ${adminUser?.userId} changing role for user ${targetUserId} to ${newRole}`);
            const updatedUser = await updateUserRoleAdmin(targetUserId, newRole, token);
            setUsers(currentUsers => currentUsers.map(u => u.userId === targetUserId ? { ...u, role: updatedUser.role } : u));
            toast.success(`User ${updatedUser.name}'s role updated to ${updatedUser.role}`);
        } catch (err) {
            console.error(`Failed to update role for user ${targetUserId}:`, err);
            const message = err instanceof ApiError ? err.message : "Failed to update role.";
            toast.error(`Error: ${message}`);
            setError(message); // Show error on page
        } finally {
            setUpdatingRoleId(null);
        }
    };

    // Handler for changing verification status
    const handleVerificationChange = async (targetUser: User) => {
        if (!token) { toast.error("Authentication error."); return; }
        const targetUserId = targetUser.userId;
        const newStatus = !targetUser.emailVerified; // Toggle current status

        // Confirmation
        if (!window.confirm(`Set verification status for ${targetUser.name} to ${newStatus ? 'VERIFIED' : 'NOT VERIFIED'}?`)) {
            return; // User cancelled
        }

        setUpdatingVerificationId(targetUserId); // Set loading state for this specific action
        setError(null); // Clear previous errors

        try {
            console.log(`Admin ${adminUser?.userId} changing verification for user ${targetUserId} to ${newStatus}`);
            const updatedUser = await updateUserVerificationAdmin(targetUserId, newStatus, token);

            // Update the user list in the state
            setUsers(currentUsers =>
                currentUsers.map(u =>
                    u.userId === targetUserId ? { ...u, emailVerified: updatedUser.emailVerified } : u
                )
            );
            toast.success(`User ${updatedUser.name} verification status set to ${updatedUser.emailVerified ? 'VERIFIED' : 'NOT VERIFIED'}`);

        } catch (err) {
            console.error(`Failed to update verification for user ${targetUserId}:`, err);
            const message = err instanceof ApiError ? err.message : "Failed to update verification status.";
            toast.error(`Error: ${message}`);
            setError(message); // Show error on page
        } finally {
            setUpdatingVerificationId(null); // Clear loading state
        }
    };


    // Open delete confirmation modal
    const openDeleteConfirmation = (user: User) => {
        setUserToDelete(user);
        setIsConfirmModalOpen(true);
    };

    // Handle confirmed user deletion
    const handleDeleteUser = async () => {
        if (!userToDelete || !token) return;
        const targetUserId = userToDelete.userId;
        const targetUserName = userToDelete.name; // Store name for messages

        setDeletingUserId(targetUserId); // Set loading state
        setIsConfirmModalOpen(false); // Close modal
        setError(null);
        const toastId = toast.loading(`Deleting user ${targetUserName}...`);

        try {
            await deleteUserAdmin(targetUserId, token);
            setUsers(currentUsers => currentUsers.filter(u => u.userId !== targetUserId)); // Remove user from list
            toast.success(`User ${targetUserName} deleted successfully.`, { id: toastId });
            setUserToDelete(null); // Clear selected user
        } catch (err) {
            console.error(`Failed to delete user ${targetUserId}:`, err);
            const message = err instanceof ApiError ? err.message : "Failed to delete user.";
            toast.error(`Error: ${message}`, { id: toastId });
            setError(message); // Show error on page
        } finally {
            setDeletingUserId(null); // Clear loading state
        }
    };

    // Placeholder for password reset action
    const handlePasswordReset = (userId: number, userName: string) => {
        toast(`Password reset feature for ${userName} (ID: ${userId}) is not yet implemented.`);
    };

    // --- Render Logic ---
    if (isAuthLoading) { return <div className="p-6 text-center text-gray-400">Loading authentication...</div>; }
    if (isLoadingUsers) { return <div className="p-6 text-center text-gray-400">Loading users...</div>; }
    if (!adminUser || adminUser.role !== 'ADMIN') { return <p className="p-4 text-red-400">Access Denied.</p>; }

    return (
        <div className="space-y-6 p-4 md:p-6">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-100">Manage Users</h1>

            {error && <p className="text-sm text-red-400 p-3 bg-red-900/30 border border-red-800 rounded">Error: {error}</p>}

            <div className="bg-gray-800 rounded-lg shadow border border-gray-700">
                 <div className="px-6 py-4 border-b border-gray-700">
                    <h2 className="text-xl font-semibold text-gray-200">User List</h2>
                    <p className="text-sm text-gray-400 mt-1">Manage roles and verification status. Admins are not shown.</p>
                 </div>

                 <div className="overflow-x-auto">
                     <Table>
                         <TableHeader>
                             <TableRow>
                                 <TableHead className="w-[80px] px-6 py-3">ID</TableHead>
                                 <TableHead className="px-6 py-3">Name</TableHead>
                                 <TableHead className="px-6 py-3">Email</TableHead>
                                 <TableHead className="text-center w-[120px] px-4 py-3">Verified</TableHead>
                                 <TableHead className="w-[180px] px-6 py-3">Set Role</TableHead>
                                 <TableHead className="text-center px-6 py-3 w-[150px]">Actions</TableHead>
                             </TableRow>
                         </TableHeader>
                         <TableBody>
                             {users.length === 0 ? (
                                 <TableRow><TableCell colSpan={6} className="text-center py-6 text-gray-400 italic px-6">No non-admin users found.</TableCell></TableRow>
                             ) : (
                                 users.map(user => {
                                      // Determine if any action is currently running for this specific user
                                      const isUpdatingThisUser = updatingRoleId === user.userId || updatingVerificationId === user.userId || deletingUserId === user.userId;
                                      return (
                                         <TableRow key={user.userId} className={`hover:bg-gray-700/50 ${isUpdatingThisUser ? 'opacity-60' : ''}`}>
                                             <TableCell className="font-medium px-6 py-4 align-middle">{user.userId}</TableCell>
                                             <TableCell className="px-6 py-4 align-middle">{user.name}</TableCell>
                                             <TableCell className="text-sm text-gray-400 px-6 py-4 align-middle">{user.email}</TableCell>
                                             {/* Verification Status Cell */}
                                             <TableCell className="px-4 py-4 align-middle text-center">
                                                 <Button
                                                     variant="ghost"
                                                     size="sm"
                                                     onClick={() => handleVerificationChange(user)}
                                                     disabled={isUpdatingThisUser} // Disable if any action is running for this user
                                                     isLoading={updatingVerificationId === user.userId} // Show spinner only for verification loading
                                                     title={user.emailVerified ? "Mark as NOT Verified" : "Mark as VERIFIED"}
                                                     className={`rounded-full px-2 py-1 ${user.emailVerified ? 'text-green-400 hover:bg-green-900/30' : 'text-red-400 hover:bg-red-900/30'} disabled:opacity-50 disabled:cursor-not-allowed`} // Add disabled style
                                                 >
                                                     {/* Show icon only when not loading for verification */}
                                                     {updatingVerificationId !== user.userId && (
                                                          user.emailVerified
                                                             ? <FaUserCheck className="h-4 w-4" />
                                                             : <FaUserTimes className="h-4 w-4" />
                                                     )}
                                                     {/* Keep screen reader text */}
                                                     <span className="sr-only">{user.emailVerified ? 'Verified' : 'Not Verified'}</span>
                                                 </Button>
                                             </TableCell>
                                             {/* Role Select Cell */}
                                             <TableCell className="px-6 py-4 align-middle">
                                                 <div className="flex items-center space-x-2">
                                                     <Select
                                                         value={user.role}
                                                         onValueChange={(newRole) => handleRoleChange(newRole, user.userId)}
                                                         disabled={isUpdatingThisUser} // Disable if any action is running for this user
                                                     >
                                                         <SelectTrigger className="w-full min-w-[120px] max-w-[150px]" disabled={updatingRoleId === user.userId}> {/* Still disable trigger specifically on role update */}
                                                             <SelectValue placeholder="Set role..." />
                                                         </SelectTrigger>
                                                         <SelectContent>
                                                             <SelectItem value="PLAYER">PLAYER</SelectItem>
                                                             <SelectItem value="VISITOR">VISITOR</SelectItem>
                                                         </SelectContent>
                                                     </Select>
                                                     {updatingRoleId === user.userId && <Spinner className="h-5 w-5 text-gray-400"/>} {/* Show spinner only for role update */}
                                                 </div>
                                             </TableCell>
                                             {/* Actions Cell */}
                                             <TableCell className="px-6 py-4 align-middle">
                                                 <div className="flex items-center justify-center space-x-2">
                                                     {/* Password Reset Button */}
                                                     <Button variant="ghost" size="icon" className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-900/30 disabled:opacity-50 disabled:cursor-not-allowed" onClick={() => handlePasswordReset(user.userId, user.name)} disabled={isUpdatingThisUser} title="Reset Password (Not Implemented)" > <FaKey className="h-4 w-4" /> </Button>
                                                     {/* Delete Button */}
                                                     <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300 hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed" onClick={() => openDeleteConfirmation(user)} disabled={isUpdatingThisUser} isLoading={deletingUserId === user.userId} title="Delete User" > {deletingUserId !== user.userId && <FaTrashAlt className="h-4 w-4" />} </Button>
                                                 </div>
                                             </TableCell>
                                         </TableRow>
                                      );
                                 })
                                 )}
                             </TableBody>
                         </Table>
                     
                 </div>

                 {/* Delete Confirmation Modal */}
                 <ConfirmationModal
                    isOpen={isConfirmModalOpen}
                    onClose={() => setIsConfirmModalOpen(false)}
                    onConfirm={handleDeleteUser}
                    title="Confirm Deletion"
                    message={
                        <span>
                            Are you sure you want to delete the user{' '}
                            <strong className="text-red-300">{userToDelete?.name}</strong> (ID: {userToDelete?.userId})?
                            <br />
                            <strong className="text-red-300">This action cannot be undone.</strong>
                            <br/><span className="text-yellow-400 text-xs italic">(Note: Deletion may fail if user has related data like predictions. Consider disabling instead if needed later).</span>
                        </span>
                    }
                    confirmText="Delete User"
                    confirmButtonVariant="danger"
                    isConfirming={deletingUserId === userToDelete?.userId}
                />
            </div>
        </div>
    );
}