// frontend/src/components/Admin/EditRoundModal.tsx
'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import { Round } from '@/lib/api';
import { toast } from 'react-hot-toast'; // <--- Added toast import

// UI Component Imports
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';

interface EditRoundModalProps {
    isOpen: boolean;
    round: Round;
    onClose: () => void;
    onSave: (updatedData: { name: string; deadline: string }) => Promise<void> | void;
    error: string | null; // Error from parent to display
    isLoading: boolean; // Loading state from parent
}

const formatISOToDateTimeLocal = (isoString: string | null | undefined): string => {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        const timezoneOffset = date.getTimezoneOffset() * 60000;
        const localISOTime = new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
        return localISOTime;
    } catch (e) {
        console.error("Error formatting date:", e);
        return '';
    }
};

export default function EditRoundModal({
    isOpen,
    round,
    onClose,
    onSave,
    error, // This is the error passed FROM the parent
    isLoading
}: EditRoundModalProps) {
    // Internal state for form fields
    const [name, setName] = useState('');
    const [deadline, setDeadline] = useState('');
    // Removed internal error/loading state as they are passed via props

    // Effect to PREFILL form state when the modal opens or the round prop changes
    useEffect(() => {
        if (isOpen && round) {
            setName(round.name);
            setDeadline(formatISOToDateTimeLocal(round.deadline));
        }
        // No need to reset error here - parent controls error display
    }, [isOpen, round]); // Dependencies are correct


    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (isLoading) return;

        if (!name.trim() || !deadline) {
             toast.error("Round Name and Deadline cannot be empty.");
             return;
        }
        // Call the onSave prop passed from the parent, which handles API call & parent state
        await onSave({ name: name.trim(), deadline: deadline });
    };

    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <Card className="w-full max-w-md dark:bg-gray-800">
                <CardHeader>
                    <CardTitle>Edit Round Details</CardTitle>
                    <CardDescription>Update name or deadline for Round ID: {round.roundId}</CardDescription>
                </CardHeader>
                {/* Form inside CardContent */}
                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4">
                        {/* Error Display (shows error passed from parent) */}
                        {error && (
                            <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
                        )}

                        <div className="space-y-1.5">
                            <Label htmlFor="editRoundName">Round Name</Label>
                            <Input type="text" id="editRoundName" value={name} onChange={(e) => setName(e.target.value)} required disabled={isLoading} />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="editRoundDeadline">Prediction Deadline</Label>
                            <Input type="datetime-local" id="editRoundDeadline" value={deadline} onChange={(e) => setDeadline(e.target.value)} required disabled={isLoading} />
                            <p className="text-xs text-gray-400 dark:text-gray-400 mt-1">Note: Deadline is in your local timezone.</p>
                            {round.status !== 'SETUP' && (
                                  <p className="text-xs text-orange-500 dark:text-orange-400 mt-1">
                                      {/* Use ' for single quotes in JSX */}
                                      Warning: Modifying deadline for non-&apos;SETUP&apos; round.
                                  </p>
                             )}
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-end space-x-3">
                        <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}> Cancel </Button>
                        <Button type="submit" disabled={isLoading} isLoading={isLoading}> Save Changes </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}

// Removed the placeholder variables at the bottom