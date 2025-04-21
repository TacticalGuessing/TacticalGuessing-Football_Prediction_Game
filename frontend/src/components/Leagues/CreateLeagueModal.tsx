// frontend/src/components/Leagues/CreateLeagueModal.tsx
'use client';

import React, { useState, FormEvent, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { createLeague, ApiError } from '@/lib/api'; // Import createLeague
import { useAuth } from '@/context/AuthContext'; // To get token

// UI Components
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { FaPlus } from 'react-icons/fa';

interface CreateLeagueModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLeagueCreated: () => void; // Callback to refresh league list on dashboard
}

export default function CreateLeagueModal({ isOpen, onClose, onLeagueCreated }: CreateLeagueModalProps) {
    const { token } = useAuth();
    const [leagueName, setLeagueName] = useState('');
    const [description, setDescription] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!token || !leagueName.trim()) {
            toast.error("League Name is required.");
            return;
        }
        setIsLoading(true); setError(null);
        const toastId = toast.loading("Creating league...");

        try {
            await createLeague(leagueName.trim(), description.trim() || null, token);
            toast.success(`League "${leagueName.trim()}" created!`, { id: toastId });
            onLeagueCreated(); // Call callback to trigger refresh
            onClose(); // Close modal
            // Reset form fields for next time
            setLeagueName('');
            setDescription('');
        } catch (err) {
            console.error("Create league error:", err);
            const msg = err instanceof ApiError ? err.message : "Failed to create league.";
            setError(msg);
            toast.error(`Error: ${msg}`, { id: toastId });
        } finally {
            setIsLoading(false);
        }
    };

    // Reset form when modal is closed/opened
    useEffect(() => {
        if (!isOpen) {
            setLeagueName('');
            setDescription('');
            setError(null);
            setIsLoading(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <Card className="w-full max-w-md dark:bg-gray-800 border border-gray-700" onClick={(e) => e.stopPropagation()}>
                <CardHeader>
                    <CardTitle>Create New League</CardTitle>
                    <CardDescription>Give your league a name and optional description.</CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4">
                        {error && <p className="text-sm text-red-400">{error}</p>}
                        <div className="space-y-1.5">
                            <Label htmlFor="leagueName">League Name *</Label>
                            <Input
                                id="leagueName"
                                type="text"
                                value={leagueName}
                                onChange={(e) => setLeagueName(e.target.value)}
                                maxLength={100}
                                required
                                disabled={isLoading}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="leagueDescription">Description (Optional)</Label>
                            <Textarea
                                id="leagueDescription"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={3}
                                maxLength={500}
                                disabled={isLoading}
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-end space-x-3">
                        <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
                        <Button type="submit" disabled={isLoading || !leagueName.trim()} isLoading={isLoading}>
                            <FaPlus className="mr-2 h-4 w-4" /> Create League
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}