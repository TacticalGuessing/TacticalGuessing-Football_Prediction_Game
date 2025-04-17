// frontend/src/app/(authenticated)/admin/users/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getAllUsersForAdmin, updateUserRoleAdmin, deleteUserAdmin, User, ApiError } from '@/lib/api'; // Ensure these exist and are exported correctly
import { toast } from 'react-hot-toast';

// --- UI Component Imports ---
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select"; // Using Select component
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import Spinner from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { FaTrashAlt, FaKey } from 'react-icons/fa';
import ConfirmationModal from '@/components/Modal/ConfirmationModal';
// import { Button } from '@/components/ui/Button'; // Not used in this version, but keep if adding delete buttons etc.

export default function AdminManageUsersPage() {
    const { user: adminUser, token, isLoading: isAuthLoading } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [updatingRoleId, setUpdatingRoleId] = useState<number | null>(null);

    const [deletingUserId, setDeletingUserId] = useState<number | null>(null); // State for delete loading
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);

    const fetchUsers = useCallback(async () => {
        if (!token) return;
        console.log("Fetching users for admin...");
        setIsLoadingUsers(true); setError(null);
        try {
            const fetchedUsers = await getAllUsersForAdmin(token);
            const displayUsers = fetchedUsers.filter(u => u.role !== 'ADMIN'); // Filter out Admins
            setUsers(displayUsers);
        } catch (err) {
            console.error("Failed to fetch users:", err);
            setError(err instanceof ApiError ? err.message : "Could not load user list.");
        } finally {
            setIsLoadingUsers(false);
        }
    }, [token]);

    useEffect(() => {
        if (!isAuthLoading && token) {
            fetchUsers();
        }
    }, [isAuthLoading, token, fetchUsers]);

    const handleRoleChange = async (newRole: string | undefined, targetUserId: number) => {
        // Validate newRole
        if (newRole !== 'PLAYER' && newRole !== 'VISITOR') {
            console.warn("Invalid role selected:", newRole);
            return; // Exit if role is undefined or not valid
        }

        const originalUser = users.find(u => u.userId === targetUserId);
        const originalRole = originalUser?.role;

        if (newRole === originalRole) return; // No change needed

        if (!token) { toast.error("Authentication error."); return; }

        // Consider a Confirmation Modal here instead of window.confirm for consistency
        if (!window.confirm(`Change role for user ${originalUser?.name ?? targetUserId} to ${newRole}?`)) {
            return; // User cancelled
        }

        setUpdatingRoleId(targetUserId); setError(null);

        try {
            console.log(`Admin ${adminUser?.userId} changing role for user ${targetUserId} to ${newRole}`);
            const updatedUser = await updateUserRoleAdmin(targetUserId, newRole, token);

            setUsers(currentUsers =>
                currentUsers.map(u =>
                    u.userId === targetUserId ? { ...u, role: updatedUser.role } : u
                )
            );
            toast.success(`User ${updatedUser.name}'s role updated to ${updatedUser.role}`);

        } catch (err) {
            console.error(`Failed to update role for user ${targetUserId}:`, err);
            const message = err instanceof ApiError ? err.message : "Failed to update role.";
            toast.error(`Error: ${message}`);
            // No easy way to revert the Select component visually on error without more state
            // Refetching might be simplest if revert is needed: fetchUsers();
        } finally {
            setUpdatingRoleId(null);
        }
    };

    // --- NEW: Open Confirmation Modal Handler ---
const openDeleteConfirmation = (user: User) => {
    setUserToDelete(user);
    setIsConfirmModalOpen(true);
};

// --- NEW: User Deletion Handler ---
const handleDeleteUser = async () => {
    if (!userToDelete || !token) return;

    const targetUserId = userToDelete.userId;
    setDeletingUserId(targetUserId); // Set loading state for the specific user being deleted
    setIsConfirmModalOpen(false); // Close modal
    setError(null);
    const toastId = toast.loading(`Deleting user ${userToDelete.name}...`);

    try {
        await deleteUserAdmin(targetUserId, token);
        setUsers(currentUsers => currentUsers.filter(u => u.userId !== targetUserId));
        toast.success(`User ${userToDelete.name} deleted successfully.`, { id: toastId });
        setUserToDelete(null); // Clear selected user

    } catch (err) {
        console.error(`Failed to delete user ${targetUserId}:`, err);
        const message = err instanceof ApiError ? err.message : "Failed to delete user.";
        toast.error(`Error: ${message}`, { id: toastId });
    } finally {
        setDeletingUserId(null); // Clear loading state regardless of success/failure
    }
};

// --- NEW: Placeholder Password Reset Handler ---
const handlePasswordReset = (userId: number, userName: string) => {
    // Use default toast() instead of toast.info()
    toast(`Password reset feature for ${userName} (ID: ${userId}) is not yet implemented.`);
    // In the future, this might open a modal or trigger an email sending process
};


    // --- Render Logic ---
    // Using dark theme text/bg colors
    if (isAuthLoading) {
        return <div className="p-6 text-center text-gray-400">Loading authentication...</div>;
    }
    if (isLoadingUsers) {
         return <div className="p-6 text-center text-gray-400">Loading users...</div>;
    }
    // Auth check (should be handled by layout/middleware ideally)
    if (!adminUser || adminUser.role !== 'ADMIN') {
        return <p className="p-4 text-red-400">Access Denied.</p>;
    }

    return (
        <div className="space-y-6 p-4 md:p-6"> {/* Standard page padding */}
            <h1 className="text-2xl md:text-3xl font-bold text-gray-100">Manage User Roles</h1>

            {error && <p className="text-sm text-red-400 p-3 bg-red-900/30 border border-red-800 rounded">Error: {error}</p>}

            {/* Container for the table - Ensure consistent styling */}
            <div className="bg-gray-800 rounded-lg shadow border border-gray-700">
                 {/* Optional Header within the container */}
                 <div className="px-6 py-4 border-b border-gray-700">
                    <h2 className="text-xl font-semibold text-gray-200">User List</h2>
                     <p className="text-sm text-gray-400 mt-1">Assign PLAYER or VISITOR roles. Admins are not shown.</p>
                 </div>

                 {/* Table Container */}
                 <div className="overflow-x-auto"> {/* Removed border-t as header has border-b */}
                     {isLoadingUsers ? (
                          <div className="text-center p-6 text-gray-400"> <Spinner className="inline w-5 h-5 mr-2"/>Loading users...</div>
                     ) : (
                         <Table>
                             <TableHeader>
                                 <TableRow>
                                     {/* Add padding/text alignment to match Cell content */}
                                     <TableHead className="w-[80px] px-6 py-3">ID</TableHead>
                                     <TableHead className="px-6 py-3">Name</TableHead>
                                     <TableHead className="px-6 py-3">Email</TableHead>
                                     <TableHead className="w-[200px] px-6 py-3">Set Role</TableHead>
                                     <TableHead className="text-center px-6 py-3 w-[150px]">Actions</TableHead>
                                      {/* Example: Add Actions Header if needed */}
                                     {/* <TableHead className="text-center px-6 py-3 w-[100px]">Actions</TableHead> */}
                                 </TableRow>
                             </TableHeader>
                             <TableBody>
                                 {users.length === 0 ? (
                                     <TableRow><TableCell colSpan={5} className="text-center py-6 text-gray-400 italic px-6">No non-admin users found.</TableCell></TableRow>
                                 ) : (
                                     users.map(user => (
                                         <TableRow key={user.userId} className="hover:bg-gray-700/50">
                                             {/* Add consistent padding/vertical alignment */}
                                             <TableCell className="font-medium px-6 py-4 align-middle">{user.userId}</TableCell>
                                             <TableCell className="px-6 py-4 align-middle">{user.name}</TableCell>
                                             <TableCell className="text-sm text-gray-400 px-6 py-4 align-middle">{user.email}</TableCell>
                                             <TableCell className="px-6 py-4 align-middle"> {/* Apply padding */}
                                                 <div className="flex items-center space-x-2">
                                                     <Select
                                                         value={user.role}
                                                         onValueChange={(newRole) => handleRoleChange(newRole, user.userId)}
                                                         disabled={updatingRoleId === user.userId}
                                                     >
                                                         {/* Ensure SelectTrigger width doesn't cause overflow */}
                                                         <SelectTrigger className="w-full min-w-[120px] max-w-[150px]" disabled={updatingRoleId === user.userId}>
                                                             <SelectValue placeholder="Set role..." />
                                                         </SelectTrigger>
                                                         <SelectContent>
                                                             <SelectItem value="PLAYER">PLAYER</SelectItem>
                                                             <SelectItem value="VISITOR">VISITOR</SelectItem>
                                                         </SelectContent>
                                                     </Select>
                                                     {updatingRoleId === user.userId && <Spinner className="h-5 w-5 text-gray-400"/>}
                                                 </div>
                                             </TableCell>

                                             <TableCell className="px-6 py-4 align-middle">
                <div className="flex items-center justify-center space-x-2">
                    {/* Placeholder Password Reset Button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-900/30"
                        onClick={() => handlePasswordReset(user.userId, user.name)}
                        disabled={deletingUserId === user.userId} // Disable while deleting
                        title="Reset Password (Not Implemented)" // Tooltip
                    >
                        <FaKey className="h-4 w-4" />
                    </Button>

                    {/* Delete Button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/30"
                        onClick={() => openDeleteConfirmation(user)}
                        disabled={deletingUserId === user.userId} // Disable while deleting this user
                        isLoading={deletingUserId === user.userId} // Show spinner on this button if deleting
                        title="Delete User" // Tooltip
                    >
                        {/* Conditionally show icon or spinner */}
                        {deletingUserId !== user.userId && <FaTrashAlt className="h-4 w-4" />}
                    </Button>
                </div>
            </TableCell>
                                              {/* Example: Add Actions Cell if needed */}
                                             {/* <TableCell className="text-center px-6 py-4 align-middle"> <Button variant="ghost" size="sm" className="text-red-400..."> <FaTrashAlt/> </Button> </TableCell> */}
                                         </TableRow>
                                     ))
                                 )}
                             </TableBody>
                         </Table>
                     )}
                </div>

                    {/* --- ADDED Confirmation Modal --- */}
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
                    {/* Optional: Add warning about related data */}
                    {/* <br/><span className="text-yellow-400 text-xs">All associated predictions will also be deleted.</span> */}
                </span>
            }
            confirmText="Delete User"
            confirmButtonVariant="danger" // Use danger variant
            isConfirming={deletingUserId === userToDelete?.userId} // Pass loading state
        />

            </div>
        </div>
    );
}