// frontend/src/app/(authenticated)/results/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getCompletedRounds, getRoundFixtures, SimpleRound, Fixture } from '@/lib/api'; // Need API functions
import { formatDateTime } from '@/utils/formatters'; // Keep formatter

export default function ResultsPage() {
    const { token } = useAuth();
    const [completedRounds, setCompletedRounds] = useState<SimpleRound[]>([]);
    const [selectedRoundId, setSelectedRoundId] = useState<string>('');
    const [fixtures, setFixtures] = useState<Fixture[]>([]);
    const [isLoadingRounds, setIsLoadingRounds] = useState(true);
    const [isLoadingFixtures, setIsLoadingFixtures] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedRoundName, setSelectedRoundName] = useState<string | null>(null);

    // Fetch completed rounds for dropdown
    const fetchRounds = useCallback(async () => {
        if (!token) return;
        setIsLoadingRounds(true); setError(null);
        try {
            const roundsData = await getCompletedRounds(token);
            setCompletedRounds(roundsData);
            // Decide later if we want to auto-select the latest
        } catch (err) {
            setError("Failed to load completed rounds.");
            console.error("Error fetching completed rounds:", err);
        }
        finally { setIsLoadingRounds(false); }
    }, [token]);

    // Fetch fixtures for selected round
    const fetchFixtures = useCallback(async (roundIdStr: string) => {
        if (!token || !roundIdStr) { setFixtures([]); return; }
        const roundIdNum = parseInt(roundIdStr, 10);
        if (isNaN(roundIdNum)) { setFixtures([]); return; }

        setIsLoadingFixtures(true); setError(null); setFixtures([]);
        // Find and set name optimistically
        const round = completedRounds.find(r => r.roundId === roundIdNum);
        const currentRoundName = round ? round.name : `Round ${roundIdNum}`;
        setSelectedRoundName(currentRoundName);

        try {
             console.log(`Fetching fixtures for round ${roundIdNum}`);
             // *** Ensure getRoundFixtures is called ***
             const fixturesData = await getRoundFixtures(roundIdNum, token);
             setFixtures(fixturesData);
        } catch (err: unknown) { // Use unknown for catch
             // Safely access error message
             const message = err instanceof Error ? err.message : "Failed to load results for this round.";
             setError(`Failed to load results for ${currentRoundName}: ${message}`);
             console.error(`Error fetching fixtures for round ${roundIdNum}:`, err);
             setFixtures([]); // Clear fixtures on error
        } finally {
            setIsLoadingFixtures(false);
        }
    }, [token, completedRounds]); // Remove selectedRoundName dependency, calculate inside

    // Initial fetch for rounds
    useEffect(() => {
        fetchRounds();
    }, [fetchRounds]);

    // Handler for dropdown change
    const handleRoundChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newRoundId = event.target.value;
        setSelectedRoundId(newRoundId);
        if (newRoundId) {
            fetchFixtures(newRoundId); // Fetch fixtures when selection changes
        } else {
            // Clear results if "-- Select --" is chosen
            setFixtures([]);
            setSelectedRoundName(null);
            setError(null);
        }
    };

    return (
        <div className="container mx-auto p-4 md:p-6">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">Match Results</h1>

            {/* Round Selector */}
            <div className="mb-6 max-w-sm">
                 <label htmlFor="round-select-results" className="block text-sm font-medium text-gray-700 mb-1">
                     Select Round:
                 </label>
                 {isLoadingRounds ? <p className="text-sm text-gray-500">Loading rounds...</p> : (
                    <select
                         id="round-select-results"
                         value={selectedRoundId}
                         onChange={handleRoundChange}
                         className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm"
                         disabled={isLoadingRounds || isLoadingFixtures}
                    >
                        <option value="">-- Select a Completed Round --</option>
                         {completedRounds.map(round => (
                             <option key={round.roundId} value={round.roundId}>
                                 {round.name} (ID: {round.roundId})
                             </option>
                         ))}
                    </select>
                 )}
                  {completedRounds.length === 0 && !isLoadingRounds && !error && (
                     <p className="text-sm text-gray-500 mt-2 italic">No completed rounds available.</p>
                  )}
            </div>

            {/* Results Display */}
            {/* Show round name title only when a round is selected */}
            {selectedRoundId && selectedRoundName && !isLoadingFixtures && (
                 <h2 className="text-xl font-semibold text-gray-700 mb-4">{selectedRoundName} Results</h2>
             )}

             {isLoadingFixtures && <p className="text-center p-4">Loading results...</p>}
             {error && <p className="text-red-600 bg-red-100 p-3 rounded mt-4">Error: {error}</p>}

             {/* Show fixture list only if not loading, no error, and a round is selected */}
             {!isLoadingFixtures && !error && selectedRoundId && (
                 fixtures.length > 0 ? (
                     <ul className="space-y-3">
                        {fixtures.map(fixture => (
                            <li key={fixture.fixtureId} className="p-3 bg-white rounded-md border border-gray-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                <div className="text-sm flex-grow">
                                    <span className="text-gray-800 font-medium">{fixture.homeTeam}</span>
                                    <span className="mx-2 text-gray-400">vs</span>
                                    <span className="text-gray-800 font-medium">{fixture.awayTeam}</span>
                                    <span className="block text-xs text-gray-500 mt-1">{formatDateTime(fixture.matchTime)}</span>
                                </div>
                                <div className="text-base font-bold text-indigo-700 whitespace-nowrap pt-1 sm:pt-0">
                                     {fixture.homeScore !== null && fixture.awayScore !== null ? (
                                        `${fixture.homeScore} - ${fixture.awayScore}`
                                     ) : fixture.status === 'POSTPONED' || fixture.status === 'CANCELED' ? (
                                         <span className='text-xs italic text-red-600 font-normal'>{fixture.status}</span>
                                     ) : (
                                         <span className='text-xs italic text-gray-500 font-normal'>Result TBC</span>
                                     )}
                                </div>
                            </li>
                        ))}
                     </ul>
                 ) : (
                     // Show this only if fixtures loaded but were empty for the selected round
                     !isLoadingRounds && <p className="text-gray-500 italic mt-4">No fixtures found or results entered for this round yet.</p>
                 )
             )}
         </div>
     );
 }