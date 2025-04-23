// frontend/src/components/Leagues/PendingLeagueInvites.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext'; // Adjust path if needed
import { getPendingLeagueInvites, acceptLeagueInvite, rejectLeagueInvite, PendingLeagueInvite, ApiError } from '@/lib/api'; // Adjust path if needed
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/Card'; // Adjust path if needed
import { Button } from '@/components/ui/Button'; // Adjust path if needed
import { Loader2, Check, X, Mail } from 'lucide-react'; // Icons
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';

interface PendingLeagueInvitesProps {
    
    onInviteAction?: () => void; // Optional callback when an invite is accepted/rejected
}

export const PendingLeagueInvites: React.FC<PendingLeagueInvitesProps> = ({ onInviteAction }) => {
    const { user, token } = useAuth();
    const [invites, setInvites] = useState<PendingLeagueInvite[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState<number | null>(null); // Store ID of invite being processed

    const fetchInvites = useCallback(async () => {
        // Only fetch if logged in
        if (!token) {
            setIsLoading(false);
            setInvites([]); // Clear invites if not logged in
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const fetchedInvites = await getPendingLeagueInvites(token);
            setInvites(fetchedInvites);
        } catch (err) {
            console.error("Error fetching pending invites:", err);
            setError(err instanceof ApiError ? err.message : "Could not load pending invitations.");
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchInvites();
    }, [fetchInvites]); // Re-fetch if token changes (login/logout)

    const handleAccept = async (invite: PendingLeagueInvite) => {
        if (!token || isProcessing) return;
        setIsProcessing(invite.membershipId);
        try {
            const result = await acceptLeagueInvite(invite.membershipId, token);
            toast.success(result.message || `Successfully joined ${invite.league.name}!`);
            setInvites(prev => prev.filter(i => i.membershipId !== invite.membershipId)); // Update UI
            console.log("Calling onInviteAction from PendingLeagueInvites...");
            onInviteAction?.(); // Trigger callback
        } catch (err) {
            console.error("Error accepting invite:", err);
            toast.error(err instanceof ApiError ? err.message : "Failed to accept invitation.");
        } finally {
            setIsProcessing(null);
        }
    };

    const handleReject = async (invite: PendingLeagueInvite) => {
        if (!token || isProcessing) return;
        setIsProcessing(invite.membershipId);
        try {
            await rejectLeagueInvite(invite.membershipId, token);
            toast.success(`Invitation to ${invite.league.name} rejected.`);
            setInvites(prev => prev.filter(i => i.membershipId !== invite.membershipId)); // Update UI
            console.log("Calling onInviteAction from PendingLeagueInvites...");
            onInviteAction?.(); // Trigger callback
        } catch (err) {
            console.error("Error rejecting invite:", err);
            toast.error(err instanceof ApiError ? err.message : "Failed to reject invitation.");
        } finally {
            setIsProcessing(null);
        }
    };

    // Don't render if not logged in OR if loading complete with no invites/errors
    if (!user || (!isLoading && invites.length === 0 && !error)) {
        return null;
    }

    return (
        // Apply base dark theme styling to the Card
        <Card className="w-full dark:bg-gray-800 border border-gray-700 text-gray-200">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-100">
                    <Mail className="h-5 w-5" />
                    League Invitations
                </CardTitle>
                {invites.length > 0 && !isLoading && <CardDescription className="text-gray-400">You have pending league invites.</CardDescription>}
            </CardHeader>
            <CardContent>
                {isLoading && (
                    <div className="flex items-center justify-center p-4 text-gray-400">
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Loading invites...
                    </div>
                )}
                {!isLoading && error && (
                    <p className="text-red-400 text-center px-4 py-2">{error}</p>
                )}
                {!isLoading && !error && invites.length === 0 && (
                    <p className="text-gray-400 text-center px-4 py-2">No pending invitations.</p>
                )}
                {!isLoading && !error && invites.length > 0 && (
                    <div className="space-y-4">
                        {invites.map((invite, index) => (
                            <React.Fragment key={invite.membershipId}>
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 py-3">
                                    <div>
                                        <p className="text-gray-100">
                                            Invitation to join <span className="font-semibold text-blue-300">{invite.league.name}</span>
                                        </p>
                                        <p className="text-sm text-gray-400">
                                            From: {invite.league.creator?.name || 'Unknown'}
                                            {invite.invitedAt && ` • Sent: ${format(new Date(invite.invitedAt), 'PP')}`}
                                        </p>
                                    </div>
                                    <div className="flex gap-2 flex-shrink-0 self-end sm:self-center">
                                        <Button
                                            variant="outline" // Use your Button variants
                                            size="sm"
                                            onClick={() => handleReject(invite)}
                                            disabled={isProcessing === invite.membershipId}
                                            isLoading={isProcessing === invite.membershipId}
                                            aria-label={`Reject invitation to ${invite.league.name}`}
                                        >
                                            {isProcessing !== invite.membershipId && <X className="h-4 w-4" />}
                                            <span className="ml-1 hidden sm:inline">Reject</span>
                                        </Button>
                                        <Button
                                            variant="primary" // Use your Button variants
                                            size="sm"
                                            onClick={() => handleAccept(invite)}
                                            disabled={isProcessing === invite.membershipId}
                                            isLoading={isProcessing === invite.membershipId}
                                            aria-label={`Accept invitation to ${invite.league.name}`}
                                        >
                                            {isProcessing !== invite.membershipId && <Check className="h-4 w-4" />}
                                            <span className="ml-1 hidden sm:inline">Accept</span>
                                        </Button>
                                    </div>
                                </div>
                                {/* Use <hr> for separation */}
                                {index < invites.length - 1 && <hr className="border-gray-600" />}
                            </React.Fragment>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

// Default export is often preferred for page/feature components
export default PendingLeagueInvites;