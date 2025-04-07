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

const AdminAuditPage = () => {
    // *** FIX 1: Remove unused 'user' from destructuring ***
    const { token } = useAuth(); // Only need token here

    // State for dropdowns
    const [users, setUsers] = useState<AdminUserSelectItem[]>([]);
    const [completedRounds, setCompletedRounds] = useState<SimpleRound[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [selectedRoundId, setSelectedRoundId] = useState<string>('');

    // State for results table
    const [predictionDetails, setPredictionDetails] = useState<AdminPredictionDetail[] | null>(null);
    const [auditTarget, setAuditTarget] = useState<{ userName: string; roundName: string } | null>(null);

    // State for loading and errors
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [isLoadingRounds, setIsLoadingRounds] = useState(false);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch initial data for dropdowns
    const fetchDropdownData = useCallback(async () => {
        if (!token) return;
        setError(null); setIsLoadingUsers(true); setIsLoadingRounds(true); setUsers([]); setCompletedRounds([]);
        try {
            const [userData, roundData] = await Promise.all([
                getAdminUserList(token),
                getCompletedRounds(token)
            ]);
            setUsers(userData);
            setCompletedRounds(roundData);
        } catch (err: unknown) { // *** FIX 2: Type error as unknown ***
            console.error("Error fetching dropdown data:", err);
            // Check if it's an Error object to safely access message
            const message = (err instanceof Error) ? err.message : "Failed to load initial data for audit.";
            setError(message);
            toast.error(message);
        } finally {
            setIsLoadingUsers(false);
            setIsLoadingRounds(false);
        }
    }, [token]);

    // Fetch dropdown data on component mount or when token changes
    useEffect(() => {
        fetchDropdownData();
    }, [fetchDropdownData]);


    // Handler to fetch prediction details
    const handleFetchDetails = async () => {
        if (!token || !selectedUserId || !selectedRoundId) {
            const msg = "Please select both a user and a completed round.";
            setError(msg); toast.error(msg); return;
        }
        setError(null); setIsLoadingDetails(true); setPredictionDetails(null); setAuditTarget(null);
        try {
            const userIdNum = parseInt(selectedUserId, 10);
            const roundIdNum = parseInt(selectedRoundId, 10);
            const details = await getAdminUserRoundPredictions(userIdNum, roundIdNum, token);
            setPredictionDetails(details);
            const selectedUser = users.find(u => u.userId === userIdNum);
            const selectedRound = completedRounds.find(r => r.roundId === roundIdNum);
            if (selectedUser && selectedRound) {
                 setAuditTarget({ userName: selectedUser.name, roundName: selectedRound.name });
            }
        } catch (err: unknown) { // *** FIX 3: Type error as unknown ***
             console.error("Error fetching prediction details:", err);
             // Check if it's an Error object to safely access message
             const message = (err instanceof Error) ? err.message : "Failed to load prediction details.";
             setError(message);
             toast.error(message);
             setPredictionDetails([]); // Set empty array on error to hide "no predictions" message
        } finally {
            setIsLoadingDetails(false);
        }
    };

    // --- RENDER LOGIC ---
    const isLoadingInitialData = isLoadingUsers || isLoadingRounds;

    return (
        <div className="container mx-auto p-4 md:p-6">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">Admin Prediction Audit</h1>

             {/* Selection Area */}
             <div className="bg-white p-4 md:p-6 rounded-lg shadow mb-6 border border-gray-200">
                <h2 className="text-lg font-semibold text-gray-700 mb-4">Select User and Round</h2>
                {isLoadingInitialData && <p className="text-gray-600">Loading users and rounds...</p>}
                {error && !isLoadingInitialData && <p className="text-red-600 bg-red-100 p-3 rounded">Error: {error}</p>}

                {!isLoadingInitialData && !error && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        {/* User Select */}
                        <div>
                            <label htmlFor="user-select" className="block text-sm font-medium text-gray-700 mb-1">User</label>
                            <select id="user-select" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm disabled:bg-gray-100 disabled:cursor-not-allowed" disabled={isLoadingDetails}>
                                <option value="" disabled>-- Select User --</option>
                                {users.map(userItem => ( // Renamed inner 'user' to 'userItem' to avoid potential shadowing
                                    <option key={userItem.userId} value={userItem.userId}>
                                        {userItem.name} (ID: {userItem.userId})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Round Select */}
                        <div>
                            <label htmlFor="round-select" className="block text-sm font-medium text-gray-700 mb-1">Completed Round</label>
                            <select id="round-select" value={selectedRoundId} onChange={(e) => setSelectedRoundId(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm disabled:bg-gray-100 disabled:cursor-not-allowed" disabled={isLoadingDetails}>
                                <option value="" disabled>-- Select Round --</option>
                                {completedRounds.map(round => (
                                    <option key={round.roundId} value={round.roundId}>
                                        {round.name} (ID: {round.roundId})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Fetch Button */}
                        <div className="md:pt-5">
                            <button type="button" onClick={handleFetchDetails} disabled={!selectedUserId || !selectedRoundId || isLoadingDetails} className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed">
                                {isLoadingDetails ? 'Loading...' : 'View Predictions'}
                            </button>
                        </div>
                    </div>
                )}
             </div>

            {/* Results Area */}
            {isLoadingDetails && ( <div className="text-center p-4"><p className="text-lg font-semibold text-gray-600">Loading prediction details...</p></div> )}

            {/* Conditionally render table */}
            {predictionDetails && predictionDetails.length > 0 && auditTarget && (
                 <div className="bg-white p-4 md:p-6 rounded-lg shadow border border-gray-200 mt-6">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">
                        Predictions for <span className="text-indigo-600">{auditTarget.userName}</span> - Round: <span className="text-indigo-600">{auditTarget.roundName}</span>
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fixture</th>
                                    <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Prediction</th>
                                    <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Result</th>
                                    <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Joker</th>
                                    <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Points</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {predictionDetails.map((detail) => (
                                    <tr key={detail.fixtureId}>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                                            {detail.fixture.homeTeam} vs {detail.fixture.awayTeam}
                                            <span className="block text-xs text-gray-500">{formatDateTime(detail.fixture.matchTime)}</span>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-center font-medium text-gray-900">
                                            {detail.predictedHomeGoals ?? '-'} - {detail.predictedAwayGoals ?? '-'}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-center font-semibold text-blue-700">
                                             {detail.fixture.homeScore ?? '?'} - {detail.fixture.awayScore ?? '?'}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
                                             {detail.isJoker ? <span className="text-yellow-600 font-bold">★ Yes</span> : 'No'}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-center font-bold text-green-700">
                                            {detail.pointsAwarded ?? 'N/A'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Display message if details loaded but are empty */}
             {predictionDetails && predictionDetails.length === 0 && auditTarget && (
                <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded mt-6" role="alert">
                    <p className="font-medium">No predictions found for {auditTarget.userName} in round {auditTarget.roundName}.</p>
                </div>
             )}

        </div>
    );
};

export default AdminAuditPage;