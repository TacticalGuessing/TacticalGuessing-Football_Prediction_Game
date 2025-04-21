// frontend/src/components/Leagues/JoinLeagueModal.tsx
'use client';

import React, { useState, FormEvent, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { joinLeagueByInviteCode, ApiError } from '@/lib/api'; // Import joinLeague
import { useAuth } from '@/context/AuthContext';

// UI Components
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { FaSignInAlt } from 'react-icons/fa';

interface JoinLeagueModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLeagueJoined: () => void; // Callback to refresh league list
}

export default function JoinLeagueModal({ isOpen, onClose, onLeagueJoined }: JoinLeagueModalProps) {
    const { token } = useAuth();
    const [inviteCode, setInviteCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!token || !inviteCode.trim()) {
            toast.error("Invite Code is required.");
            return;
        }
        setIsLoading(true); setError(null);
        const toastId = toast.loading("Joining league...");

        try {
            // Convert to upper maybe if codes are stored case-insensitively
            const response = await joinLeagueByInviteCode(inviteCode.trim().toUpperCase(), token);
            toast.success(response.message || `Joined league successfully!`, { id: toastId });
            onLeagueJoined(); // Trigger refresh
            onClose(); // Close modal
            setInviteCode(''); // Reset form
        } catch (err) {
            console.error("Join league error:", err);
            const msg = err instanceof ApiError ? err.message : "Failed to join league.";
            setError(msg);
            toast.error(`Error: ${msg}`, { id: toastId });
        } finally {
            setIsLoading(false);
        }
    };

     // Reset form when modal is closed/opened
     useEffect(() => {
        if (!isOpen) {
            setInviteCode('');
            setError(null);
            setIsLoading(false);
        }
    }, [isOpen]);


    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <Card className="w-full max-w-md dark:bg-gray-800 border border-gray-700" onClick={(e) => e.stopPropagation()}>
                <CardHeader>
                    <CardTitle>Join League</CardTitle>
                    <CardDescription>Enter the invite code provided by the league admin.</CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4">
                        {error && <p className="text-sm text-red-400">{error}</p>}
                        <div className="space-y-1.5">
                            <Label htmlFor="inviteCode">Invite Code *</Label>
                            <Input
                                id="inviteCode"
                                type="text"
                                value={inviteCode}
                                onChange={(e) => setInviteCode(e.target.value)}
                                placeholder="ABC123XYZ" // Example format
                                required
                                disabled={isLoading}
                                // Optional: Convert to uppercase visually? style={{ textTransform: 'uppercase' }}
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-end space-x-3">
                         <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
                         <Button type="submit" disabled={isLoading || !inviteCode.trim()} isLoading={isLoading}>
                            <FaSignInAlt className="mr-2 h-4 w-4" /> Join League
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}