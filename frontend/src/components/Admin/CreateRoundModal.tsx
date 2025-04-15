// frontend/src/components/Admin/CreateRoundModal.tsx
'use client';

import React, { useState,useEffect, FormEvent } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext'; // Need token for API call
import { createRound } from '@/lib/api'; // API function

// UI Components
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { FaPlus } from 'react-icons/fa';

interface CreateRoundModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRoundCreated: () => void; // Callback to refresh the list on the main page
}

export default function CreateRoundModal({ isOpen, onClose, onRoundCreated }: CreateRoundModalProps) {
    const { token } = useAuth();

    // State moved from admin/page.tsx
    const [newRoundName, setNewRoundName] = useState('');
    const [newRoundDeadline, setNewRoundDeadline] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    // Handler moved from admin/page.tsx
    const handleCreateRoundSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!token) { toast.error("Authentication error."); return; }
        if (!newRoundName.trim() || !newRoundDeadline) {
             toast.error("Round Name and Prediction Deadline are required."); return;
         }

        setIsCreating(true); setCreateError(null);

        try {
            // Convert local datetime string to ISO string for backend
            const deadlineISO = new Date(newRoundDeadline).toISOString();
            await createRound({ name: newRoundName.trim(), deadline: deadlineISO }, token);

            toast.success(`Round "${newRoundName.trim()}" created successfully!`);
            setNewRoundName(''); // Reset form inside modal
            setNewRoundDeadline('');
            onRoundCreated(); // Call parent callback to refresh list
            onClose(); // Close modal on success

        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to create round';
            setCreateError(errorMsg); // Show error within the modal
            toast.error(`Creation failed: ${errorMsg}`);
        } finally {
            setIsCreating(false);
        }
    };

    // Reset form when modal opens/closes
    useEffect(() => {
        if (!isOpen) {
            setNewRoundName('');
            setNewRoundDeadline('');
            setCreateError(null);
            setIsCreating(false); // Ensure loading state is reset
        }
    }, [isOpen]);


    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <Card className="w-full max-w-md dark:bg-gray-800">
                <CardHeader>
                    <CardTitle>Create New Round</CardTitle>
                    <CardDescription>Enter the details for the new prediction round.</CardDescription>
                </CardHeader>
                <form onSubmit={handleCreateRoundSubmit}>
                    <CardContent className="space-y-4">
                         {createError && <p className="text-sm text-red-400 dark:text-red-400">{createError}</p>}
                        <div className="space-y-1.5">
                            <Label htmlFor="createRoundName">Round Name</Label>
                            <Input
                                id="createRoundName" // Unique ID
                                type="text"
                                value={newRoundName}
                                onChange={(e) => setNewRoundName(e.target.value)}
                                placeholder="e.g., Gameweek 6, Semi-Finals"
                                required
                                disabled={isCreating}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="createRoundDeadline">Prediction Deadline</Label>
                            <Input
                                id="createRoundDeadline" // Unique ID
                                type="datetime-local"
                                value={newRoundDeadline}
                                onChange={(e) => setNewRoundDeadline(e.target.value)}
                                required
                                disabled={isCreating}
                            />
                             <p className="text-xs text-gray-400 dark:text-gray-400 mt-1">Predictions lock after this time (local timezone).</p>
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={onClose} disabled={isCreating}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isCreating} isLoading={isCreating}>
                            <FaPlus className="mr-2 h-4 w-4" /> Create Round
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}