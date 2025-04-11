// frontend/src/app/(authenticated)/admin/users/page.tsx
'use client';

import React, { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
// Assume you create these API functions in lib/api.ts
import { getAllUsersForAdmin, updateUserRoleAdmin, User, ApiError } from '@/lib/api';
import { toast } from 'react-hot-toast';
// Import a Spinner component if you have one
// import Spinner from '@/components/Spinner';



export default function AdminManageUsersPage() {
    const { user: adminUser, token, isLoading: isAuthLoading } = useAuth(); // Get current admin user
    const [users, setUsers] = useState<User[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [updatingRoleId, setUpdatingRoleId] = useState<number | null>(null); // Track which user's role is being updated

    const fetchUsers = useCallback(async () => {
        if (!token) return;
        console.log("Fetching users for admin...");
        setIsLoadingUsers(true);
        setError(null);
        try {
            const fetchedUsers = await getAllUsersForAdmin(token);
            // Filter out the current admin and any other admins from the list shown
            const displayUsers = fetchedUsers.filter(u => u.role !== 'ADMIN');
            setUsers(displayUsers);
        } catch (err) {
            console.error("Failed to fetch users:", err);
            setError(err instanceof ApiError ? err.message : "Could not load user list.");
        } finally {
            setIsLoadingUsers(false);
        }
    }, [token]);

    useEffect(() => {
        // Fetch users only if admin is loaded and token is available
        if (!isAuthLoading && token) {
            fetchUsers();
        }
    }, [isAuthLoading, token, fetchUsers]);

    const handleRoleChange = async (event: ChangeEvent<HTMLSelectElement>, targetUserId: number) => {
        const newRole = event.target.value as 'PLAYER' | 'VISITOR'; // Cast to expected roles
        const originalRole = users.find(u => u.userId === targetUserId)?.role;

        // Prevent unnecessary API call if role didn't change
        if (newRole === originalRole) return;

        if (!token) {
            toast.error("Authentication error.");
            return;
        }

        // Basic confirmation (optional but recommended)
        if (!confirm(`Change role for user ID ${targetUserId} to ${newRole}?`)) {
            event.target.value = originalRole || ''; // Revert dropdown visually
            return;
        }

        setUpdatingRoleId(targetUserId); // Set loading state for this specific row
        setError(null); // Clear previous errors

        try {
            console.log(`Admin ${adminUser?.userId} changing role for user ${targetUserId} to ${newRole}`);
            const updatedUser = await updateUserRoleAdmin(targetUserId, newRole, token);

            // Update local state immediately for better UX
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
            // Revert dropdown on error
             event.target.value = originalRole || '';
        } finally {
            setUpdatingRoleId(null); // Clear loading state for this row
        }
    };


    // --- Render Logic ---
    if (isAuthLoading || isLoadingUsers) {
        return <div className="p-6 text-center">Loading users...</div>;
    }

    if (error) {
         return <div className="p-6 text-center text-red-500 bg-red-100">Error loading users: {error}</div>;
    }

    return (
        <div className="container mx-auto p-4 md:p-6">
            <h1 className="text-2xl font-bold mb-6">Manage User Roles</h1>

            <div className="overflow-x-auto shadow rounded border-b border-gray-200 bg-white">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Role</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Set Role</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {users.length === 0 ? (
                            <tr><td colSpan={5} className="text-center py-4 text-gray-500 italic">No non-admin users found.</td></tr>
                        ) : (
                            users.map(user => (
                                <tr key={user.userId} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.userId}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{user.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.role}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <select
                                            value={user.role} // Controlled component showing current role
                                            onChange={(e) => handleRoleChange(e, user.userId)}
                                            disabled={updatingRoleId === user.userId} // Disable while updating this specific user
                                            className={`border rounded px-2 py-1 text-sm ${updatingRoleId === user.userId ? 'bg-gray-200 cursor-wait' : 'border-gray-300'}`}
                                        >
                                            <option value="PLAYER">PLAYER</option>
                                            <option value="VISITOR">VISITOR</option>
                                        </select>
                                        {updatingRoleId === user.userId && <span className="ml-2 text-xs italic">Updating...</span> /* Simple text indicator */}
                                        {/* Or use <Spinner /> component here */}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}