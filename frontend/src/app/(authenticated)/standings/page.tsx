// frontend/src/app/(authenticated)/standings/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
// Import updated functions and types from api.ts
import { getStandings, getCompletedRounds, SimpleRound, StandingEntry } from '@/lib/api'; // StandingEntry now expects name & points
import { useAuth } from '@/context/AuthContext';

export default function StandingsPage() {
    const { token, isLoading: isAuthLoading } = useAuth();

    // State for Rounds Dropdown
    const [rounds, setRounds] = useState<SimpleRound[]>([]);
    const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null); // null represents "Overall"
    const [isLoadingRounds, setIsLoadingRounds] = useState(true);
    const [roundsError, setRoundsError] = useState<string | null>(null);

    // State for Standings Table
    const [standings, setStandings] = useState<StandingEntry[]>([]);
    const [isLoadingStandings, setIsLoadingStandings] = useState(true); // Start true for initial overall fetch
    const [standingsError, setStandingsError] = useState<string | null>(null);
    const [tableTitle, setTableTitle] = useState('Overall Standings');

    // Fetch Completed Rounds for the dropdown
    const fetchCompletedRounds = useCallback(async () => {
        if (!token) return;
        setIsLoadingRounds(true);
        setRoundsError(null);
        try {
            const completedRoundsData = await getCompletedRounds(token);
            setRounds(completedRoundsData || []);
        } catch (err: unknown) {
            console.error("StandingsPage: Error fetching rounds:", err);
            const message = (err instanceof Error) ? err.message : 'Failed to load rounds.';
            setRoundsError(message);
            setRounds([]);
        } finally {
            setIsLoadingRounds(false);
        }
    }, [token]);

    // Fetch Standings - Modified to handle both overall (null) and specific round IDs
    const fetchStandings = useCallback(async (roundIdStr: string | null) => {
        if (!token) {
            setStandingsError("Authentication required.");
            setStandings([]);
            setIsLoadingStandings(false);
            return;
        }

        // --- Refined Parsing and Validation ---
        let roundIdNum: number | null = null;
        if (roundIdStr !== null) {
            const parsed = parseInt(roundIdStr, 10);
            if (isNaN(parsed)) {
                // Set error state for the UI
                setStandingsError("Invalid round selected (not a number).");
                setStandings([]);
                setIsLoadingStandings(false);
                // Use the error state to update the title
                setTableTitle('Invalid Round Selection');
                return; // Stop execution if parsing fails
            }
            roundIdNum = parsed; // Assign the parsed number
        }
        // If roundIdStr was null, roundIdNum remains null (Overall)
        // --- End Refined Parsing ---

        setIsLoadingStandings(true);
        setStandingsError(null);
        setStandings([]); // Clear previous standings

        try {
            // Call the API with roundIdNum (which is correctly number | null)
            // api.ts now returns StandingEntry[] where StandingEntry has { rank, userId, name, points }
            const data: StandingEntry[] = await getStandings(token, roundIdNum);
            console.log(`StandingsPage: Fetched standings for ${roundIdNum !== null ? `round ${roundIdNum}` : 'overall'}:`, data);
            setStandings(data || []);

            // Update title based on fetched data
            // This logic uses the 'rounds' state variable which is available via closure.
            // It does NOT need to be a dependency of this useCallback hook.
            if (roundIdNum !== null) {
                 const roundName = rounds.find(r => r.roundId === roundIdNum)?.name;
                 setTableTitle(roundName ? `Results for ${roundName}` : `Results for Round ${roundIdNum}`);
            } else {
                 setTableTitle('Overall Standings');
            }

        } catch (err: unknown) {
            console.error(`StandingsPage: Error fetching standings for ${roundIdNum !== null ? `round ${roundIdNum}` : 'overall'}:`, err);
            const message = (err instanceof Error) ? err.message : 'Failed to fetch standings.';
            setStandingsError(message);
            setStandings([]);
            // Update title on error
            setTableTitle(roundIdNum !== null ? `Error Loading Round ${roundIdNum} Standings` : 'Error Loading Overall Standings');
        } finally {
            setIsLoadingStandings(false);
        }
        // ***** THE FIX IS HERE: REMOVED 'rounds' from the dependency array *****
    }, [token]); // Only depends on token now

    // Initial Effects: Fetch rounds and overall standings
    useEffect(() => {
        if (!isAuthLoading && token) {
            fetchCompletedRounds();
            fetchStandings(null); // Fetch overall standings initially
        } else if (!isAuthLoading && !token) {
            setIsLoadingRounds(false);
            setIsLoadingStandings(false);
            setRoundsError("Authentication required to load data.");
            setStandingsError("Authentication required to load data.");
            setRounds([]);
            setStandings([]);
        }
        // The dependencies below are correct. The functions fetchCompletedRounds and fetchStandings
        // are memoized by useCallback and only change if their *own* dependencies change (which is just 'token' now).
    }, [token, isAuthLoading, fetchCompletedRounds, fetchStandings]);

    // Handle dropdown change
    const handleRoundChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newRoundIdValue = event.target.value;
        // If the value is an empty string '', set the state to null (for overall)
        // Otherwise, keep it as the string ID for fetchStandings to parse
        const newSelectedId = newRoundIdValue === '' ? null : newRoundIdValue;
        console.log("StandingsPage: handleRoundChange - Selected Value:", newRoundIdValue, "Mapped ID:", newSelectedId);
        setSelectedRoundId(newSelectedId); // Update state correctly (string | null)
        fetchStandings(newSelectedId); // Pass string | null
    };

    // --- Render Logic ---
    if (isAuthLoading) {
        return <p className="p-4 text-center">Authenticating...</p>;
    }
    if (!token && !isAuthLoading) {
         return (
            <div className="p-4 md:p-6">
                <h1 className="text-2xl font-bold mb-6">Standings</h1>
                <p className="text-red-600 font-semibold">Please log in to view standings.</p>
            </div>
        );
    }

    // Ensure rounds is an array before filtering
    const filteredRounds = Array.isArray(rounds) ? rounds.filter(round => round && typeof round.roundId === 'number') : [];
    // Dropdown should only be disabled while actively loading the list of rounds
    const isDropdownDisabled = isLoadingRounds;

    return (
        <div className="p-4 md:p-6">
            <h1 className="text-2xl font-bold mb-6">Standings</h1>

            {/* Round Selection Dropdown */}
            <div className="mb-6">
                 <label htmlFor="roundSelect" className="block text-sm font-medium text-gray-700 mb-1">View Standings:</label>
                 {/* Show loading text only if rounds are truly loading and haven't failed */}
                 {isLoadingRounds && !roundsError ? (<p>Loading rounds...</p>)
                 : roundsError ? (<p className="text-red-600">{roundsError}</p>)
                 : (
                     // Render the select element once rounds are loaded or if there was an error (allows selecting Overall)
                     <select
                         id="roundSelect"
                         // Use empty string '' for the value when selectedRoundId is null
                         value={selectedRoundId ?? ''}
                         onChange={handleRoundChange}
                         className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm"
                         // Use the correctly defined isDropdownDisabled. It's okay if it's enabled even with 0 rounds,
                         // because the "Overall Standings" option is always present.
                         disabled={isDropdownDisabled}
                         >
                         <option value="">-- Overall Standings --</option>
                         {filteredRounds.map((round) => (
                                 <option key={round.roundId} value={round.roundId.toString()}>
                                     {round.name}
                                 </option>
                             ))
                         }
                     </select>
                 )}
                  {/* Informative message if no specific rounds are available after loading finishes */}
                  {filteredRounds.length === 0 && !isLoadingRounds && !roundsError && (
                      <p className="text-sm text-gray-500 mt-2">No specific completed rounds found to select. Showing Overall.</p>
                  )}
             </div>

            {/* Standings Table */}
            <h2 className="text-xl font-semibold mb-4">{tableTitle}</h2>
            {/* Show loading text while standings are being fetched */}
            {isLoadingStandings ? (<p>Loading standings...</p>)
            : standingsError ? (<p className="text-red-600">{standingsError}</p>) // Show error if fetching standings failed
            : (
                // Render the table if loading is finished and there are no errors
                <div className="overflow-x-auto shadow rounded border-b border-gray-200 bg-white">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                            <tr>
                                <th scope="col" className="py-3 px-4 text-xs font-medium text-gray-600 uppercase tracking-wider w-16 text-center">Rank</th>
                                {/* UPDATED: Header from Username to Name */}
                                <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Name</th>
                                {/* UPDATED: Header from Total Score to Points */}
                                <th scope="col" className="py-3 px-4 text-xs font-medium text-gray-600 uppercase tracking-wider w-24 text-right">Points</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {/* Show message if standings array is empty */}
                            {standings.length === 0 ? (
                                <tr><td colSpan={3} className="text-center py-4 px-4 text-gray-500 italic">No standings data available{selectedRoundId !== null ? ' for this round' : ''}.</td></tr>
                            ) : (
                                // Map over the standings data if it's not empty
                                standings.map((item) => (
                                    <tr key={item.userId} className="hover:bg-gray-50 transition-colors duration-150">
                                        <td className="py-3 px-4 whitespace-nowrap text-sm font-medium text-center">{item.rank}</td>
                                        {/* UPDATED: Access item.name */}
                                        <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-700">{item.name}</td>
                                        {/* UPDATED: Access item.points */}
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