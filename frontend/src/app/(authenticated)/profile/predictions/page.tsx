// frontend/src/app/(authenticated)/profile/predictions/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
    getUserPredictionsForRound,
    UserPredictionResponse,
    getRounds, // <--- FIX: Use getRounds instead of getAllRounds
    Round,
    ApiError
} from '@/lib/api';
import { formatDateTime } from '@/utils/formatters';

// Import UI Components
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import Spinner from '@/components/ui/Spinner';
import { FaStar } from 'react-icons/fa'; // <-- FIX: Removed FaRegFutbol



// --- Type Definitions ---
// Keep LeaderInfo, ScorerInfo, NewsItem interfaces if used elsewhere or move NewsItem here if not imported


export default function ProfilePredictionsPage() {
    const { token, isLoading: isAuthLoading } = useAuth(); // Removed unused 'user'

    // State
    const [allRounds, setAllRounds] = useState<Round[]>([]);
    const [isLoadingRounds, setIsLoadingRounds] = useState(true);
    const [selectedRoundId, setSelectedRoundId] = useState<string>('current'); // Default to 'current' as string
    const [predictionData, setPredictionData] = useState<UserPredictionResponse | null>(null);
    const [isLoadingPredictions, setIsLoadingPredictions] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch All Rounds for Dropdown
    const fetchRounds = useCallback(async () => {
        if (!token) return;
        setIsLoadingRounds(true);
        try {
            // FIX: Call getRounds without the status array filter
            const fetchedRounds = await getRounds(token);
            // FIX: Add type to sort parameters
            fetchedRounds.sort((a: Round, b: Round) => b.roundId - a.roundId);
            setAllRounds(fetchedRounds);
             // Automatically select the first available round (newest completed/closed/open)
             // OR default to 'current' if no rounds exist yet? Let's default to 'current'.
             // setSelectedRoundId(fetchedRounds[0]?.roundId ? String(fetchedRounds[0].roundId) : 'current');
        } catch (err) {
            console.error("Failed to fetch rounds for dropdown:", err);
            setError("Could not load rounds list.");
        } finally {
            setIsLoadingRounds(false);
        }
    }, [token]);

    // Fetch Predictions for Selected Round
    const fetchPredictions = useCallback(async () => {
        if (!token || !selectedRoundId) return;

        setIsLoadingPredictions(true);
        setError(null);
        setPredictionData(null);

        try {
             // FIX: Prepare roundIdToSend ensuring type safety
            const roundIdToSend: number | 'current' = selectedRoundId === 'current' ? 'current' : parseInt(selectedRoundId, 10);

             // Handle potential NaN from parseInt if selectedRoundId is unexpectedly not 'current' or a number string
             if (selectedRoundId !== 'current' && isNaN(roundIdToSend as number)) {
                 throw new Error("Invalid round selection.");
             }

            console.log(`Fetching predictions for round: ${roundIdToSend}`);
            const data = await getUserPredictionsForRound(roundIdToSend, token); // Pass correctly typed ID
            setPredictionData(data);

            if (selectedRoundId === 'current' && !data.roundInfo) {
                console.log("No active/open round found.");
            } else if (!data.roundInfo && selectedRoundId !== 'current') {
                 setError(`Round with ID ${selectedRoundId} not found or access denied.`);
            }
             console.log(`Prediction data for ${selectedRoundId}:`, data);
        } catch (err) {
             const message = err instanceof ApiError ? err.message : (err instanceof Error ? err.message : "Could not load predictions.");
            setError(message);
            console.error(`Error fetching predictions for round ${selectedRoundId}:`, err);
        } finally {
            setIsLoadingPredictions(false);
        }
    }, [token, selectedRoundId]);

    // Initial fetch effect
    useEffect(() => {
        if (token && !isAuthLoading) {
            fetchRounds();
        }
    }, [token, isAuthLoading, fetchRounds]);

    // Effect to fetch predictions
     useEffect(() => {
        // Only fetch if rounds are loaded and a selection is made
        if (!isLoadingRounds && selectedRoundId) {
             fetchPredictions();
        }
    }, [selectedRoundId, isLoadingRounds, fetchPredictions]); // Trigger when selection changes

    // --- Render Logic ---
    if (isAuthLoading) {
        return <div className="p-6 text-center"><Spinner /> Loading...</div>;
    }
    // No need for !user check if page is protected by layout/auth context redirects

    const handleRoundChange = (value: string) => {
        setSelectedRoundId(value);
    };

    return (
        <div className="space-y-6 p-4 md:p-6">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-100">My Predictions</h1>

            {/* Round Selector */}
            <div className="max-w-xs">
                <Select
                    value={selectedRoundId} // Keep as string
                    onValueChange={handleRoundChange}
                    disabled={isLoadingRounds || isLoadingPredictions}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Select Round..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="current">Current/Active Round</SelectItem>
                        {isLoadingRounds ? (
                             <div className="p-2 text-center text-gray-400 italic">Loading rounds...</div>
                        ) : (
                            allRounds.map(round => (
                                <SelectItem key={round.roundId} value={String(round.roundId)}>
                                    {round.name} ({round.status})
                                </SelectItem>
                            ))
                        )}
                    </SelectContent>
                </Select>
            </div>

            {/* Predictions Display Card */}
            <Card className="dark:bg-gray-800 border border-gray-700">
                 <CardHeader>
                    {isLoadingPredictions ? (
                         <CardTitle>Loading Predictions...</CardTitle>
                    ) : predictionData?.roundInfo ? (
                        <>
                             <CardTitle>Predictions for: {predictionData.roundInfo.roundName}</CardTitle>
                             <CardDescription>Status: {predictionData.roundInfo.status}</CardDescription>
                        </>
                    ) : selectedRoundId === 'current' && !isLoadingRounds ? ( // Show only after rounds check
                         <CardTitle>No Active Round Found</CardTitle>
                    ) : !isLoadingRounds && allRounds.length === 0 ? ( // Handle no rounds at all
                         <CardTitle>No Rounds Available</CardTitle>
                    ): (
                         <CardTitle>Select a round</CardTitle>
                    )}
                 </CardHeader>
                 <CardContent>
                    {isLoadingPredictions ? (
                        <div className="text-center py-6"><Spinner /> Loading predictions...</div>
                    ) : error ? (
                         <p className="text-red-400 text-center py-6">{error}</p>
                    ) : !predictionData?.roundInfo && selectedRoundId === 'current' ? (
                         <p className="text-gray-400 italic text-center py-6">There is currently no active round open for predictions.</p>
                    // FIX: Use ' for apostrophe
                    ) : !predictionData || predictionData.predictions.length === 0 ? (
                         <p className="text-gray-400 italic text-center py-6">You haven&apos;t made any predictions for this round yet.</p>
                    ) : (
                         <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Fixture</TableHead>
                                        <TableHead className="text-center">Your Pick</TableHead>
                                        <TableHead className="text-center">Result</TableHead>
                                        <TableHead className="text-center w-[40px]">Joker</TableHead>
                                        <TableHead className="text-right w-[60px]">Points</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {predictionData.predictions.map(p => (
                                        <TableRow key={p.predictionId}>
                                            <TableCell>
                                                 <div className="font-medium">{p.fixture.homeTeam} vs {p.fixture.awayTeam}</div>
                                                 <div className="text-xs text-gray-400">{formatDateTime(p.fixture.matchTime)}</div>
                                            </TableCell>
                                             <TableCell className="text-center font-mono text-lg">
                                                {p.predictedHomeGoals} - {p.predictedAwayGoals}
                                            </TableCell>
                                            <TableCell className="text-center font-mono text-lg">
                                                {(p.fixture.homeScore !== null && p.fixture.awayScore !== null)
                                                    ? `${p.fixture.homeScore} - ${p.fixture.awayScore}`
                                                    : <span className="text-xs text-gray-500 italic">Pending</span>
                                                }
                                            </TableCell>
                                            <TableCell className="text-center">
                                                 {p.isJoker && <FaStar className="h-4 w-4 text-yellow-400 mx-auto" title="Joker Played"/>}
                                            </TableCell>
                                             <TableCell className="text-right font-semibold">
                                                 {p.pointsAwarded !== null
                                                    ? p.pointsAwarded
                                                    : '-'
                                                 }
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

        </div>
    );
}