// frontend/src/app/(authenticated)/admin/prediction-status/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getActiveRound, getPredictionStatusAdmin, PlayerPredictionStatus, ActiveRoundResponse, ApiError } from '@/lib/api';

// Import UI Components
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import Spinner from '@/components/ui/Spinner';
import Avatar from '@/components/Avatar'; // Use your Avatar component
import { FaCheckCircle, FaTimesCircle, FaUsers } from 'react-icons/fa'; // Icons for status

export default function AdminPredictionStatusPage() {
    const { user, token, isLoading: isAuthLoading } = useAuth();

    // State for active round
    const [activeRound, setActiveRound] = useState<ActiveRoundResponse | null>(null);
    const [isLoadingRound, setIsLoadingRound] = useState(true);
    const [roundError, setRoundError] = useState<string | null>(null);

    // State for prediction status
    const [playerStatuses, setPlayerStatuses] = useState<PlayerPredictionStatus[]>([]);
    const [isLoadingStatus, setIsLoadingStatus] = useState(false); // Initially false, true only when fetching status
    const [statusError, setStatusError] = useState<string | null>(null);

    // Fetch Active Round (to know which round to query status for)
    const fetchActiveRoundForStatus = useCallback(async () => {
        if (!token) { setIsLoadingRound(false); return; }
        setIsLoadingRound(true); setRoundError(null); setActiveRound(null);
        setPlayerStatuses([]); setStatusError(null); // Reset status when fetching round
        try {
            // We only care about OPEN or maybe CLOSED rounds for this view
            const data = await getActiveRound(token);
            // Optional: Filter out SETUP rounds if you only want OPEN/CLOSED/COMPLETED
            // if (data && data.status !== 'SETUP') {
            //     setActiveRound(data);
            // } else {
            //     setActiveRound(null); // No relevant round found
            // }
            setActiveRound(data); // For now, show status for any active round type
        } catch (err) {
            const message = err instanceof ApiError ? err.message : (err instanceof Error ? err.message : "Failed to load round data.");
            setRoundError(message); console.error("Error fetching active round for status:", err);
        } finally { setIsLoadingRound(false); }
    }, [token]);

    // Fetch Prediction Status (triggered AFTER active round is fetched)
    const fetchStatuses = useCallback(async (roundId: number) => {
        if (!token) return;
        setIsLoadingStatus(true); setStatusError(null); setPlayerStatuses([]);
        try {
            const data = await getPredictionStatusAdmin(roundId, token);
            setPlayerStatuses(data);
        } catch (err) {
             const message = err instanceof ApiError ? err.message : (err instanceof Error ? err.message : "Could not load prediction status.");
            setStatusError(message); console.error(`Error fetching status for round ${roundId}:`, err);
        } finally {
            setIsLoadingStatus(false);
        }
    }, [token]);

    // Effect to fetch active round initially
    useEffect(() => {
        if (token && !isAuthLoading) {
            fetchActiveRoundForStatus();
        }
    }, [token, isAuthLoading, fetchActiveRoundForStatus]);

    // Effect to fetch statuses once active round is known
    useEffect(() => {
        if (activeRound?.roundId) {
            fetchStatuses(activeRound.roundId);
        }
    }, [activeRound, fetchStatuses]); // Dependency on activeRound object


    // --- Render Logic ---
    if (isAuthLoading) return <div className="p-6 text-center"><Spinner /> Loading...</div>;
    if (!user || user.role !== 'ADMIN') return <p className="p-4 text-red-400">Access Denied.</p>;

    // Determine counts for summary
    const submittedCount = playerStatuses.filter(p => p.hasPredicted).length;
    const pendingCount = playerStatuses.length - submittedCount;

    return (
        <div className="space-y-6 p-4 md:p-6">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-100 flex items-center">
                <FaUsers className="mr-3 text-gray-400" /> Prediction Status
            </h1>

            {/* Round Info / Loading */}
            <div className="mb-4 p-4 bg-gray-800 border border-gray-700 rounded-sm">
                {isLoadingRound ? (
                    <div className="flex items-center text-gray-400"><Spinner className="mr-2 h-4 w-4"/> Loading current round info...</div>
                ) : roundError ? (
                    <p className="text-red-400">{roundError}</p>
                ) : activeRound ? (
                    <div>
                        <p className="text-lg font-semibold text-gray-100">Current Round: {activeRound.name} <span className="text-sm font-normal text-gray-400">(ID: {activeRound.roundId}, Status: {activeRound.status})</span></p>
                        {/* Optionally add deadline info if useful */}
                    </div>
                ) : (
                    <p className="text-gray-400 italic">No active round found (or active round is in SETUP status).</p>
                )}
            </div>

            {/* Status Table Card - Show only if activeRound is loaded */}
            {activeRound && !roundError && (
                <Card className="dark:bg-gray-800 border border-gray-700">
                    <CardHeader>
                        <CardTitle>Player Submissions</CardTitle>
                        <CardDescription>
                            Status for round: {activeRound.name}. Submitted: {submittedCount}, Pending: {pendingCount}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoadingStatus ? (
                             <div className="text-center py-6"><Spinner /> Loading statuses...</div>
                        ) : statusError ? (
                            <p className="text-red-400 text-center py-6">{statusError}</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[60px]"></TableHead> {/* Avatar Col */}
                                            <TableHead>Player Name</TableHead>
                                            <TableHead className="text-center w-[120px]">Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {playerStatuses.length === 0 ? (
                                            <TableRow><TableCell colSpan={3} className="text-center py-6 text-gray-400 italic">No players found with PLAYER role.</TableCell></TableRow>
                                        ) : (
                                            playerStatuses.map(player => (
                                                <TableRow key={player.userId}>
                                                    <TableCell className="p-2">
                                                        <Avatar size="sm" name={player.name} fullAvatarUrl={player.avatarUrl} />
                                                    </TableCell>
                                                    <TableCell className="font-medium">{player.name}</TableCell>
                                                    <TableCell className="text-center">
                                                        {player.hasPredicted ? (
                                                            <span className="inline-flex items-center text-green-400">
                                                                <FaCheckCircle className="mr-1.5 h-4 w-4" /> Submitted
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center text-yellow-400">
                                                                <FaTimesCircle className="mr-1.5 h-4 w-4" /> Pending
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}