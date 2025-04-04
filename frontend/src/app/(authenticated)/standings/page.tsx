// frontend/src/app/(mainApp)/standings/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
// Import base types and functions from api.ts
import { getStandingsForRound, getCompletedRounds, SimpleRound, StandingEntry } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

// Define a new interface for standings data *after* rank is added
interface RankedStandingEntry extends StandingEntry {
    rank: number;
}

export default function StandingsPage() {
    const { token, isLoading: isAuthLoading } = useAuth();

    // State for Rounds Dropdown - Use imported SimpleRound type
    const [rounds, setRounds] = useState<SimpleRound[]>([]);
    const [selectedRoundId, setSelectedRoundId] = useState<string>('');
    const [isLoadingRounds, setIsLoadingRounds] = useState(true);
    const [roundsError, setRoundsError] = useState<string | null>(null);

    // State for Standings Table - Use the new RankedStandingEntry type
    const [standings, setStandings] = useState<RankedStandingEntry[]>([]);
    const [isLoadingStandings, setIsLoadingStandings] = useState(false);
    const [standingsError, setStandingsError] = useState<string | null>(null);

    // Fetch Completed Rounds
    const fetchCompletedRounds = useCallback(async () => {
        if (!token) return;
        setIsLoadingRounds(true);
        setRoundsError(null);
        try {
            console.log("StandingsPage: Calling getCompletedRounds..."); // Log before API call
            const completedRoundsData = await getCompletedRounds(token);
            console.log("StandingsPage: Received rounds data from API:", completedRoundsData); // Log raw API response
            setRounds(completedRoundsData || []);
        } catch (err: unknown) {
            console.error("StandingsPage: Error fetching rounds:", err);
            const message = (err instanceof Error) ? err.message : 'Failed to load rounds.';
            setRoundsError(message);
            setRounds([]); // Ensure rounds is an empty array on error
        } finally {
            setIsLoadingRounds(false);
        }
    }, [token]);

    // Fetch Standings for Selected Round
    const fetchStandings = useCallback(async (roundIdStr: string) => {
        if (!roundIdStr || !token) {
            setStandings([]);
            return;
        }
        const roundIdNum = parseInt(roundIdStr, 10);
        if (isNaN(roundIdNum)) {
             setStandingsError("Invalid round selected.");
             setStandings([]);
             return;
        }

        setIsLoadingStandings(true);
        setStandingsError(null);
        setStandings([]);
        try {
            const data: StandingEntry[] = await getStandingsForRound(roundIdNum, token);
            console.log('StandingsPage: Fetched standings:', data);

            // Calculate rank after fetching and sorting
            let currentRank = 0;
            let lastPoints = -Infinity;
            let itemsWithSameRank = 1;

            const rankedData: RankedStandingEntry[] = data
                .sort((a, b) => b.points - a.points)
                .map((item) => {
                    if (item.points === lastPoints) {
                        itemsWithSameRank++;
                    } else {
                        currentRank = currentRank + itemsWithSameRank;
                        lastPoints = item.points;
                        itemsWithSameRank = 1;
                    }
                    return {
                        ...item,
                        rank: currentRank
                    };
                });

            setStandings(rankedData || []);
        } catch (err: unknown) {
            console.error(`StandingsPage: Error fetching standings for round ${roundIdStr}:`, err);
            const message = (err instanceof Error) ? err.message : 'Failed to fetch standings.';
            setStandingsError(message);
            setStandings([]);
        } finally {
            setIsLoadingStandings(false);
        }
    }, [token]);

    // Initial fetch for rounds
    useEffect(() => {
        if (!isAuthLoading && token) { // Ensure auth loading is false AND token exists
            fetchCompletedRounds();
        } else if (!isAuthLoading && !token) {
            // No token after auth check, set loading rounds to false
             setIsLoadingRounds(false);
             setRoundsError("Authentication required to load rounds."); // Optional: set an error
             setRounds([]); // Ensure rounds is empty
        }
        // If isAuthLoading is true, do nothing yet
    }, [token, isAuthLoading, fetchCompletedRounds]); // Dependencies


    // Handle dropdown change
    const handleRoundChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newRoundId = event.target.value;
        console.log("StandingsPage: handleRoundChange - Selected Round ID:", newRoundId); // Log selection change
        setSelectedRoundId(newRoundId);
        fetchStandings(newRoundId); // Trigger fetch for the new ID
    };

    // --- Render Logic ---
    if (isAuthLoading) {
        return <p className="p-4 text-center">Authenticating...</p>;
    }

    // No explicit token check needed here anymore IF protected route logic works
    // But keep as fallback UI in case context/routing fails
    if (!token && !isAuthLoading) {
         return (
            <div className="p-4 md:p-6">
                <h1 className="text-2xl font-bold mb-6">Standings</h1>
                <p className="text-red-600 font-semibold">Please log in to view standings.</p>
            </div>
        );
    }


    // --- Calculate filtered rounds and disabled state before return ---
    const filteredRounds = Array.isArray(rounds)
        ? rounds.filter(round => round && typeof round.roundId === 'number')
        : []; // Ensure rounds is an array before filtering
    const isDropdownDisabled = isLoadingRounds || filteredRounds.length === 0; // Disable while loading OR if no valid rounds

    // --- Add console logs right before return ---
    console.log("StandingsPage Render - isLoadingRounds:", isLoadingRounds);
    console.log("StandingsPage Render - roundsError:", roundsError);
    console.log("StandingsPage Render - Rounds State (before filter):", JSON.stringify(rounds)); // Stringify for better object inspection
    console.log("StandingsPage Render - Filtered Rounds:", JSON.stringify(filteredRounds));
    console.log("StandingsPage Render - Is Dropdown Disabled:", isDropdownDisabled);
    // --- End added logs ---


    return (
        <div className="p-4 md:p-6">
            <h1 className="text-2xl font-bold mb-6">Standings</h1>

            {/* Round Selection Dropdown */}
            <div className="mb-6">
                 <label htmlFor="roundSelect" className="block text-sm font-medium text-gray-700 mb-1">Select Round:</label>
                 {isLoadingRounds ? (<p>Loading rounds...</p>)
                 : roundsError ? (<p className="text-red-600">{roundsError}</p>)
                 : (<select id="roundSelect" value={selectedRoundId} onChange={handleRoundChange}
                         className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm"
                         disabled={isDropdownDisabled} // Use the calculated variable
                         >
                         <option value="">-- Select a Completed Round --</option>
                         {/* Map over the pre-filtered array */}
                         {filteredRounds.map((round) => (
                                 <option key={round.roundId} value={round.roundId.toString()}>
                                     {round.name}
                                 </option>
                             ))
                         }
                     </select>
                 )}
                  {/* Use filteredRounds count for the "No completed rounds" message */}
                  {filteredRounds.length === 0 && !isLoadingRounds && !roundsError && (<p className="text-sm text-gray-500 mt-2">No completed rounds found.</p>)}
             </div>

            {/* Standings Table */}
            <h2 className="text-xl font-semibold mb-4">Results for Round {selectedRoundId || '...'}</h2>
            {isLoadingStandings ? (<p>Loading standings...</p>)
            : standingsError ? (<p className="text-red-600">{standingsError}</p>)
            : !selectedRoundId ? (<p className="text-gray-500">Please select a round above to view results.</p>)
            : (<div className="overflow-x-auto shadow rounded border-b border-gray-200 bg-white">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                            <tr>
                                <th scope="col" className="py-3 px-4 text-xs font-medium text-gray-600 uppercase tracking-wider w-16 text-center">Rank</th>
                                <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Name</th>
                                <th scope="col" className="py-3 px-4 text-xs font-medium text-gray-600 uppercase tracking-wider w-24 text-right">Points</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {standings.length === 0 ? (
                                <tr><td colSpan={3} className="text-center py-4 px-4 text-gray-500 italic">No standings data available for this round.</td></tr>
                            ) : (
                                standings.map((item) => (
                                    <tr key={item.userId} className="hover:bg-gray-50 transition-colors duration-150">
                                        <td className="py-3 px-4 whitespace-nowrap text-sm font-medium text-center">{item.rank}</td>
                                        <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-700">{item.name}</td>
                                        <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-900 font-semibold text-right">{item.points}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}