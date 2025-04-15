// frontend/src/app/(authenticated)/admin/audit/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'react-hot-toast';

import {
    getAdminUserList,
    getCompletedRounds,
    getAdminUserRoundPredictions,
    AdminUserSelectItem,
    SimpleRound,
    AdminPredictionDetail,
    
} from '@/lib/api';
import { formatDateTime } from '@/utils/formatters';

// --- UI Component Imports ---
import { Button } from '@/components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { Label } from '@/components/ui/Label'; // Import Label
import Spinner from '@/components/ui/Spinner'; // Assuming Spinner exists

export default function AdminAuditPage() { // Renamed component
    const { token, isLoading: isAuthLoading } = useAuth() // Correctly only need token

    // --- State ---
    const [users, setUsers] = useState<AdminUserSelectItem[]>([]);
    const [completedRounds, setCompletedRounds] = useState<SimpleRound[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [selectedRoundId, setSelectedRoundId] = useState<string>('');
    const [predictionDetails, setPredictionDetails] = useState<AdminPredictionDetail[] | null>(null);
    const [auditTarget, setAuditTarget] = useState<{ userName: string; roundName: string } | null>(null);
    const [isLoadingUsers, setIsLoadingUsers] = useState(true); // Changed initial state
    const [isLoadingRounds, setIsLoadingRounds] = useState(true); // Changed initial state
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // --- Fetch Dropdown Data ---
    const fetchDropdownData = useCallback(async () => {
        if (!token) return;
        setError(null); setIsLoadingUsers(true); setIsLoadingRounds(true);
        // Don't clear existing data immediately, looks better
        // setUsers([]); setCompletedRounds([]);
        try {
            const [userData, roundData] = await Promise.all([
                getAdminUserList(token),
                getCompletedRounds(token)
            ]);
            setUsers(userData || []); // Handle potential null/undefined
            setCompletedRounds(roundData || []); // Handle potential null/undefined
        } catch (err: unknown) {
            console.error("Error fetching dropdown data:", err);
            const message = (err instanceof Error) ? err.message : "Failed to load initial data.";
            setError(message); toast.error(message);
        } finally {
            setIsLoadingUsers(false); setIsLoadingRounds(false);
        }
    }, [token]);

    useEffect(() => {
        if(token) { // Fetch only if token exists
             fetchDropdownData();
        } else if (!isAuthLoading && !token) {
            setError("Authentication required to load audit data.");
            setIsLoadingUsers(false); setIsLoadingRounds(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, isAuthLoading]); // fetchDropdownData dependency removed as token is enough


    // --- Fetch Prediction Details ---
    const handleFetchDetails = async () => {
        if (!token || !selectedUserId || !selectedRoundId) {
            const msg = "Please select both a user and a completed round.";
            setError(msg); toast.error(msg); return;
        }
        setError(null); setIsLoadingDetails(true); setPredictionDetails(null); setAuditTarget(null);
        try {
            const userIdNum = parseInt(selectedUserId, 10);
            const roundIdNum = parseInt(selectedRoundId, 10);

            // Add validation for parsed IDs
            if (isNaN(userIdNum) || isNaN(roundIdNum)) {
                throw new Error("Invalid user or round selection.");
            }

            const details = await getAdminUserRoundPredictions(userIdNum, roundIdNum, token);
            setPredictionDetails(details || []); // Ensure it's an array

            const selectedUser = users.find(u => u.userId === userIdNum);
            const selectedRound = completedRounds.find(r => r.roundId === roundIdNum);
            if (selectedUser && selectedRound) {
                 setAuditTarget({ userName: selectedUser.name, roundName: selectedRound.name });
            } else {
                 console.warn("Could not find user/round name for audit target display.");
                 setAuditTarget({ userName: `User ID ${userIdNum}`, roundName: `Round ID ${roundIdNum}`});
            }
        } catch (err: unknown) {
             console.error("Error fetching prediction details:", err);
             const message = (err instanceof Error) ? err.message : "Failed to load prediction details.";
             setError(message); toast.error(message);
             setPredictionDetails([]); // Keep as empty array to show "No predictions found" msg
        } finally {
            setIsLoadingDetails(false);
        }
    };

    // --- RENDER LOGIC ---
    const isLoadingInitialData = isLoadingUsers || isLoadingRounds;

    // Container style similar to other admin pages
    const sectionContainerClasses = "bg-gray-800 rounded-lg shadow border border-gray-700 p-6";

    return (
        <div className="space-y-6 p-4 md:p-6"> {/* Standard page padding */}
            <h1 className="text-2xl md:text-3xl font-bold text-gray-100">Admin Prediction Audit</h1>

             {/* Selection Area */}
             <div className={sectionContainerClasses}>
                <h2 className="text-lg font-semibold text-gray-200 mb-4">Select User and Round</h2>

                {/* Global Error */}
                {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

                {/* Loading state for dropdowns */}
                {isLoadingInitialData && <div className="flex items-center text-gray-400"><Spinner className="mr-2 h-4 w-4"/> Loading selection data...</div>}

                {/* Dropdown Grid - Render only when not loading initial data */}
                {!isLoadingInitialData && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        {/* User Select */}
                        <div className="space-y-1.5">
                            <Label htmlFor="user-select">User</Label>
                            <Select value={selectedUserId} onValueChange={setSelectedUserId} disabled={isLoadingDetails || users.length === 0}>
                                <SelectTrigger id="user-select" className="w-full" disabled={isLoadingDetails || users.length === 0}>
                                    <SelectValue placeholder="-- Select User --" />
                                </SelectTrigger>
                                <SelectContent>
                                    {users.map(userItem => (
                                        <SelectItem key={userItem.userId} value={userItem.userId.toString()}>
                                            {userItem.name} (ID: {userItem.userId})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                             {users.length === 0 && !isLoadingUsers && <p className="text-xs text-gray-500 mt-1">No users available.</p>}
                        </div>

                        {/* Round Select */}
                         <div className="space-y-1.5">
                            <Label htmlFor="round-select">Completed Round</Label>
                            <Select value={selectedRoundId} onValueChange={setSelectedRoundId} disabled={isLoadingDetails || completedRounds.length === 0}>
                                <SelectTrigger id="round-select" className="w-full" disabled={isLoadingDetails || completedRounds.length === 0}>
                                    <SelectValue placeholder="-- Select Round --" />
                                </SelectTrigger>
                                <SelectContent>
                                    {completedRounds.map(round => (
                                        <SelectItem key={round.roundId} value={round.roundId.toString()}>
                                            {round.name} (ID: {round.roundId})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {completedRounds.length === 0 && !isLoadingRounds && <p className="text-xs text-gray-500 mt-1">No completed rounds available.</p>}
                        </div>

                        {/* Fetch Button */}
                        <div> {/* Aligns button to bottom */}
                            <Button
                                type="button"
                                onClick={handleFetchDetails}
                                disabled={!selectedUserId || !selectedRoundId || isLoadingDetails}
                                isLoading={isLoadingDetails}
                                className="w-full md:w-auto" // Full width on small screens
                            >
                                View Predictions
                            </Button>
                        </div>
                    </div>
                )}
             </div>

            {/* Results Area */}
            {isLoadingDetails && ( <div className="text-center p-6 text-gray-400"><Spinner className="inline w-6 h-6 mr-2"/> Loading prediction details...</div> )}

            {/* Prediction Details Table */}
            {predictionDetails && predictionDetails.length > 0 && auditTarget && (
                 <div className={`${sectionContainerClasses} mt-6`}> {/* Use container style */}
                    <div className="px-6 py-4"> {/* Optional header padding */}
                        <h2 className="text-xl font-semibold text-gray-200">
                            Predictions for <span className="text-accent">{auditTarget.userName}</span>
                        </h2>
                        <p className="text-sm text-gray-400">Round: {auditTarget.roundName}</p>
                    </div>
                    <div className="border-t border-gray-700 overflow-x-auto"> {/* Table scroll container */}
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-center">Fixture</TableHead>
                                    <TableHead className="text-center">Prediction</TableHead>
                                    <TableHead className="text-center">Result</TableHead>
                                    <TableHead className="text-center">Joker</TableHead>
                                    <TableHead className="text-center">Points</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {predictionDetails.map((detail) => (
                                    <TableRow key={detail.fixtureId}>
                                        <TableCell className="text-sm"> {/* Fixture Details */}
                                            {detail.fixture.homeTeam} <span className="text-gray-500">vs</span> {detail.fixture.awayTeam}
                                            <span className="block text-xs text-gray-500">{formatDateTime(detail.fixture.matchTime)}</span>
                                        </TableCell>
                                        <TableCell className="text-center font-medium font-mono"> {/* Prediction */}
                                            {detail.predictedHomeGoals ?? '-'} - {detail.predictedAwayGoals ?? '-'}
                                        </TableCell>
                                        <TableCell className="text-center font-semibold text-blue-400 font-mono"> {/* Result */}
                                             {detail.fixture.homeScore ?? '?'} - {detail.fixture.awayScore ?? '?'}
                                        </TableCell>
                                        <TableCell className="text-center"> {/* Joker */}
                                             {detail.isJoker ? <span className="text-yellow-400 font-bold">★ Yes</span> : <span className="text-gray-500">No</span>}
                                        </TableCell>
                                        <TableCell className="text-center" > {/* Points */}
                                            {detail.pointsAwarded ?? <span className="text-gray-500">N/A</span>}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}

            {/* No predictions found message */}
             {predictionDetails && predictionDetails.length === 0 && auditTarget && (
                // Use themed warning message style
                <div className="bg-yellow-900/30 border border-yellow-700/50 text-yellow-300 px-4 py-3 rounded mt-6" role="alert">
                    <p className="font-medium">No predictions found for {auditTarget.userName} in round {auditTarget.roundName}.</p>
                </div>
             )}

        </div> // End page container
    );
};

// export default AdminAuditPage; // Removed duplicate export