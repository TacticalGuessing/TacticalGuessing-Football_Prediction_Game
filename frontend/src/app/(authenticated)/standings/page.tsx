// frontend/src/app/(authenticated)/standings/page.tsx <- THIS IS TYPESCRIPT/TSX
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react'; // Added useRef
import { getStandings, getCompletedRounds, SimpleRound, StandingEntry } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import MovementIndicator from '@/components/Standings/MovementIndicator';



export default function StandingsPage() {
    // --- Add a render counter ---
    const renderCount = useRef(0);
    useEffect(() => {
      renderCount.current += 1;
      console.log(`%cStandingsPage Render #${renderCount.current}`, 'color: blue; font-weight: bold;');
    });
    // ---

    const { token, isLoading: isAuthLoading } = useAuth();

    // State
    const [rounds, setRounds] = useState<SimpleRound[]>([]);
    const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
    const [isLoadingRounds, setIsLoadingRounds] = useState(true);
    const [roundsError, setRoundsError] = useState<string | null>(null);
    const [standings, setStandings] = useState<StandingEntry[]>([]);
    const [isLoadingStandings, setIsLoadingStandings] = useState(true);
    const [standingsError, setStandingsError] = useState<string | null>(null);
    const [tableTitle, setTableTitle] = useState('Overall Standings');

    // --- Logging ---
    console.log(`%cCALLBACK DEPS: Token defined: ${!!token}`, 'color: gray');

    // Fetch Completed Rounds
    const fetchCompletedRounds = useCallback(async () => {
        console.log('%cRunning fetchCompletedRounds...', 'color: green;');
        if (!token) {
            console.log('%cfetchCompletedRounds: No token, returning.', 'color: orange;');
            return;
        }
        setIsLoadingRounds(true);
        setRoundsError(null);
        try {
            const completedRoundsData = await getCompletedRounds(token);
            console.log('%cfetchCompletedRounds: SUCCESS', 'color: green;', completedRoundsData);
            setRounds(completedRoundsData || []);
        } catch (err: unknown) {
            console.error("fetchCompletedRounds: ERROR:", err);
            const message = (err instanceof Error) ? err.message : 'Failed to load rounds.';
            setRoundsError(message);
            setRounds([]);
        } finally {
            setIsLoadingRounds(false);
        }
    }, [token]);

    // Fetch Standings
    const fetchStandings = useCallback(async (roundIdStr: string | null) => {
        console.log(`%cRunning fetchStandings for roundIdStr: ${roundIdStr}...`, 'color: purple;');
        if (!token) {
            console.log('%cfetchStandings: No token, returning.', 'color: orange;');
            setStandingsError("Authentication required.");
            setStandings([]);
            setIsLoadingStandings(false);
            return;
        }

        let roundIdNum: number | null = null;
        if (roundIdStr !== null) {
            const parsed = parseInt(roundIdStr, 10);
            if (isNaN(parsed)) {
                console.log(`%cfetchStandings: Invalid roundIdStr ${roundIdStr}`, 'color: red;');
                setStandingsError("Invalid round selected (not a number).");
                setStandings([]);
                setIsLoadingStandings(false);
                return;
            }
            roundIdNum = parsed;
        }

        setIsLoadingStandings(true);
        setStandingsError(null);
        // Don't clear standings here, makes UI jumpy during re-fetch
        // setStandings([]);

        try {
            const data: StandingEntry[] = await getStandings(token, roundIdNum);
            console.log(`%cfetchStandings: SUCCESS for ${roundIdNum ?? 'overall'}`, 'color: purple;', data); // This is the log you saw repeating
            setStandings(data || []); // Update state with new data
        } catch (err: unknown) {
            console.error(`fetchStandings: ERROR for ${roundIdNum ?? 'overall'}:`, err);
            const message = (err instanceof Error) ? err.message : 'Failed to fetch standings.';
            setStandingsError(message);
            setStandings([]); // Clear standings on error
        } finally {
            setIsLoadingStandings(false);
        }
    }, [token]);

    // Initial Effects
    useEffect(() => {
        console.log('%cRunning Initial useEffect...', 'color: brown;', { isAuthLoading, hasToken: !!token });
        if (!isAuthLoading && token) {
            console.log('%cInitial useEffect: Conditions met, calling fetches.', 'color: brown;');
            fetchCompletedRounds();
            fetchStandings(null); // Fetch overall initially
        } else if (!isAuthLoading && !token) {
            console.log('%cInitial useEffect: No token after loading.', 'color: brown;');
            setIsLoadingRounds(false);
            setIsLoadingStandings(false);
            setRoundsError("Authentication required to load data.");
            setStandingsError("Authentication required to load data.");
            setRounds([]);
            setStandings([]);
        } else {
             console.log('%cInitial useEffect: Conditions not met (still loading auth?).', 'color: brown;');
        }
    }, [token, isAuthLoading, fetchCompletedRounds, fetchStandings]); // Dependencies should be stable


    // Effect for Setting Table Title (with anti-loop check)
    useEffect(() => {
        console.log('%cRunning Title useEffect...', 'color: teal;', { selectedRoundId, roundsCount: rounds?.length, isLoadingStandings, standingsError, currentTitle: tableTitle });
        let newTitle = tableTitle; // Start with current title

        if (isLoadingStandings) {
             console.log('%cTitle useEffect: Standings loading, skipping title update.', 'color: teal;');
             return; // Don't change title while loading
        } else if (standingsError) {
            const roundText = selectedRoundId !== null ? `Round ${selectedRoundId}` : 'Overall';
            newTitle = `Error Loading ${roundText} Standings`;
        } else {
            // Set title only after successful load
            if (selectedRoundId !== null) {
                const roundName = rounds.find(r => r.roundId.toString() === selectedRoundId)?.name;
                newTitle = (roundName ? `Results for ${roundName}` : `Results for Round ${selectedRoundId}`);
            } else {
                newTitle = ('Overall Standings');
            }
        }

        // Only update if the calculated title is different
        if (newTitle !== tableTitle) {
            console.log('%cTitle useEffect: Calculated title differs, setting title to:', newTitle, 'color: teal;');
            setTableTitle(newTitle);
        } else {
            console.log('%cTitle useEffect: Calculated title is same as current, skipping update.', 'color: teal;');
        }
    }, [selectedRoundId, rounds, isLoadingStandings, standingsError, tableTitle]); // Dependencies are correct


    // Handle dropdown change
    const handleRoundChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newRoundIdValue = event.target.value;
        const newSelectedId = newRoundIdValue === '' ? null : newRoundIdValue;
        console.log(`%chandleRoundChange: Selected Value: ${newRoundIdValue}, Mapped ID: ${newSelectedId}`, 'color: darkcyan;');
        setSelectedRoundId(newSelectedId);
        fetchStandings(newSelectedId); // Fetch new data on change
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

    const filteredRounds = Array.isArray(rounds) ? rounds.filter(round => round && typeof round.roundId === 'number') : [];
    const isDropdownDisabled = isLoadingRounds;
    const numColumns = 8;

    return (
        <div className="p-4 md:p-6">
            <h1 className="text-2xl font-bold mb-6">Standings</h1>

            {/* Round Selection Dropdown */}
            <div className="mb-6">
                 <label htmlFor="roundSelect" className="block text-sm font-medium text-gray-700 mb-1">View Standings:</label>
                 {isLoadingRounds && !roundsError ? (<p>Loading rounds...</p>)
                 : roundsError ? (<p className="text-red-600">{roundsError}</p>)
                 : (
                     <select
                         id="roundSelect"
                         value={selectedRoundId ?? ''}
                         onChange={handleRoundChange}
                         className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm"
                         disabled={isDropdownDisabled || isLoadingStandings} // Also disable while standings are loading
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
                  {filteredRounds.length === 0 && !isLoadingRounds && !roundsError && (
                      <p className="text-sm text-gray-500 mt-2">No specific completed rounds found to select. Showing Overall.</p>
                  )}
             </div>

            {/* Standings Table */}
            <h2 className="text-xl font-semibold mb-4">{tableTitle}</h2>
            {isLoadingStandings ? (<p>Loading standings...</p>) // Show loading indicator
            : standingsError ? (<p className="text-red-600">{standingsError}</p>) // Show error
            : ( // Render table only when not loading and no error
                <div className="overflow-x-auto shadow rounded border-b border-gray-200 bg-white">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                            <tr>
                                {/* Table Headers */}
                                <th scope="col" className="py-3 px-2 md:px-4 text-xs font-medium text-gray-600 uppercase tracking-wider w-12 md:w-16 text-center">Pos</th>
                                <th scope="col" className="py-3 px-1 md:px-2 text-xs font-medium text-gray-600 uppercase tracking-wider w-10 md:w-12 text-center">+/-</th>
                                <th scope="col" className="py-3 px-2 md:px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Name</th>
                                <th scope="col" className="py-3 px-2 md:px-4 text-xs font-medium text-gray-600 uppercase tracking-wider w-12 md:w-16 text-center">Pld</th>
                                <th scope="col" className="py-3 px-2 md:px-4 text-xs font-medium text-gray-600 uppercase tracking-wider w-16 md:w-20 text-center">Outcome</th>
                                <th scope="col" className="py-3 px-2 md:px-4 text-xs font-medium text-gray-600 uppercase tracking-wider w-16 md:w-20 text-center">Exact</th>
                                <th scope="col" className="py-3 px-2 md:px-4 text-xs font-medium text-gray-600 uppercase tracking-wider w-16 md:w-20 text-center">Acc %</th>
                                <th scope="col" className="py-3 px-2 md:px-4 text-xs font-medium text-gray-600 uppercase tracking-wider w-16 md:w-20 text-right">Points</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {standings.length === 0 ? ( // Show empty message only if loading is done, no error, and length is 0
                                <tr><td colSpan={numColumns} className="text-center py-4 px-4 text-gray-500 italic">No standings data available{selectedRoundId !== null ? ' for this round' : ''}.</td></tr>
                            ) : ( // Map data if available
                                standings.map((item) => (
                                    <tr key={item.userId} className="hover:bg-gray-50 transition-colors duration-150">
                                        {/* Table Data Cells */}
                                        <td className="py-3 px-2 md:px-4 whitespace-nowrap text-sm font-medium text-center">{item.rank}</td>
                                        <td className="py-3 px-1 md:px-2 whitespace-nowrap text-sm text-center"><MovementIndicator movement={item.movement} /></td>
                                        <td className="py-3 px-2 md:px-4 whitespace-nowrap text-sm text-gray-700">{item.name}</td>
                                        <td className="py-3 px-2 md:px-4 whitespace-nowrap text-sm text-gray-600 text-center">{item.totalPredictions}</td>
                                        <td className="py-3 px-2 md:px-4 whitespace-nowrap text-sm text-gray-600 text-center">{item.correctOutcomes}</td>
                                        <td className="py-3 px-2 md:px-4 whitespace-nowrap text-sm text-gray-600 text-center">{item.exactScores}</td>
                                        <td className="py-3 px-2 md:px-4 whitespace-nowrap text-sm text-gray-600 text-center">{item.accuracy !== null ? `${item.accuracy.toFixed(1)}%` : '-'}</td>
                                        <td className="py-3 px-2 md:px-4 whitespace-nowrap text-sm text-gray-900 font-semibold text-right">{item.points}</td>
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