// frontend/src/app/(authenticated)/standings/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
// Ensure StandingEntry interface includes avatarUrl and teamName (optional)
import { getStandings, getCompletedRounds, SimpleRound, StandingEntry } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import MovementIndicator from '@/components/Standings/MovementIndicator';
import Avatar from '@/components/Avatar'; // <<< Ensure this import is present

export default function StandingsPage() {
    const renderCount = useRef(0);
    useEffect(() => {
      renderCount.current += 1;
      // console.log(`%cStandingsPage Render #${renderCount.current}`, 'color: blue; font-weight: bold;'); // Keep for debugging if needed
    });

    const { token, isLoading: isAuthLoading } = useAuth();

    // State
    const [rounds, setRounds] = useState<SimpleRound[]>([]);
    const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null); // null for Overall
    const [isLoadingRounds, setIsLoadingRounds] = useState(true);
    const [roundsError, setRoundsError] = useState<string | null>(null);
    const [standings, setStandings] = useState<StandingEntry[]>([]); // Type should include avatarUrl/teamName
    const [isLoadingStandings, setIsLoadingStandings] = useState(true);
    const [standingsError, setStandingsError] = useState<string | null>(null);
    const [tableTitle, setTableTitle] = useState('Overall Standings');

    // Fetch Completed Rounds (Keep as is)
    const fetchCompletedRounds = useCallback(async () => {
        if (!token) return;
        setIsLoadingRounds(true); setRoundsError(null);
        try {
            const completedRoundsData = await getCompletedRounds(token);
            setRounds(completedRoundsData || []);
        } catch (err: unknown) {
            console.error("fetchCompletedRounds: ERROR:", err);
            const message = (err instanceof Error) ? err.message : 'Failed to load rounds.';
            setRoundsError(message); setRounds([]);
        } finally { setIsLoadingRounds(false); }
    }, [token]);

    // Fetch Standings (Keep as is - assuming backend now returns required fields)
    const fetchStandings = useCallback(async (roundIdStr: string | null) => {
        if (!token) { setStandingsError("Authentication required."); setStandings([]); setIsLoadingStandings(false); return; }
        let roundIdNum: number | undefined = undefined;
        if (roundIdStr !== null) {
            const parsed = parseInt(roundIdStr, 10);
            if (isNaN(parsed)) { setStandingsError("Invalid round selected."); setStandings([]); setIsLoadingStandings(false); return; }
            roundIdNum = parsed;
        }
        setIsLoadingStandings(true); setStandingsError(null);
        try {
            const data: StandingEntry[] = await getStandings(token, roundIdNum);
            setStandings(data || []);
        } catch (err: unknown) {
            console.error(`fetchStandings: ERROR for ${roundIdNum ?? 'overall'}:`, err);
            const message = (err instanceof Error) ? err.message : 'Failed to fetch standings.';
            setStandingsError(message); setStandings([]);
        } finally { setIsLoadingStandings(false); }
    }, [token]);

    // Initial Effects (Keep as is)
    useEffect(() => {
        if (!isAuthLoading && token) {
            fetchCompletedRounds();
            fetchStandings(null);
        } else if (!isAuthLoading && !token) {
            setIsLoadingRounds(false); setIsLoadingStandings(false);
            setRoundsError("Authentication required to load data."); setStandingsError("Authentication required to load data.");
            setRounds([]); setStandings([]);
        }
    }, [token, isAuthLoading, fetchCompletedRounds, fetchStandings]);

    // Effect for Setting Table Title (Keep as is)
    useEffect(() => {
        let newTitle = tableTitle;
        if (isLoadingStandings) { return; }
        else if (standingsError) { newTitle = `Error Loading Standings`; }
        else {
            if (selectedRoundId !== null) {
                const roundName = rounds.find(r => r.roundId.toString() === selectedRoundId)?.name;
                newTitle = (roundName ? `${roundName} Standings` : `Round ${selectedRoundId} Standings`);
            } else { newTitle = ('Overall Standings'); }
        }
        if (newTitle !== tableTitle) {
            setTableTitle(newTitle);
        }
    }, [selectedRoundId, rounds, isLoadingStandings, standingsError, tableTitle]);

    // Handle dropdown change (Keep as is)
    const handleRoundChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newRoundIdValue = event.target.value;
        const newSelectedId = newRoundIdValue === '' ? null : newRoundIdValue;
        setSelectedRoundId(newSelectedId);
        fetchStandings(newSelectedId);
    };

    // --- Base URL logic (defined once, outside map) ---
    const apiBaseUrlForImages = process.env.NEXT_PUBLIC_API_BASE_URL_FOR_IMAGES || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'; // Ensure port matches backend
    const baseUrlForImages = apiBaseUrlForImages.replace(/\/api\/?$/, '').replace(/\/$/, '');
    // ----------------------------------------------------

    // --- Render Logic ---
     if (isAuthLoading) { return <p className="p-4 text-center">Authenticating...</p>; }
     if (!token && !isAuthLoading) { return ( <div className="p-4 md:p-6"><h1 className="text-2xl font-bold mb-6">Standings</h1><p className="text-red-600 font-semibold">Please log in to view standings.</p></div> ); }

    const filteredRounds = Array.isArray(rounds) ? rounds.filter(round => round && typeof round.roundId === 'number') : [];
    const isDropdownDisabled = isLoadingRounds;
    const numColumns = 8; // Adjusted number of columns if changed

    return (
        <div className="p-4 md:p-6">
            <h1 className="text-2xl font-bold mb-6">Standings</h1>

            {/* Round Selection and Summary Link Container (Keep as is) */}
            <div className="mb-6 bg-white p-4 rounded shadow border border-gray-200 flex flex-col sm:flex-row gap-4 items-center justify-between">
                {/* Dropdown Section */}
                <div className="flex-grow w-full sm:w-auto">
                   <label htmlFor="roundSelect" className="block text-sm font-medium text-gray-700 mb-1">
                        View Standings:
                    </label>
                    {isLoadingRounds && !roundsError ? (<p className="text-sm text-gray-500">Loading rounds...</p>)
                    : roundsError ? (<p className="text-sm text-red-600">{roundsError}</p>)
                    : (
                        <select
                            id="roundSelect"
                            value={selectedRoundId ?? ''}
                            onChange={handleRoundChange}
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm"
                            disabled={isDropdownDisabled || isLoadingStandings}
                            >
                            <option value="">-- Overall Standings --</option>
                            {filteredRounds.map((round) => (
                                <option key={round.roundId} value={round.roundId.toString()}>
                                    {round.name}
                                </option>
                            ))}
                        </select>
                    )}
                    {filteredRounds.length === 0 && !isLoadingRounds && !roundsError && (
                        <p className="text-sm text-gray-500 mt-2 italic">No completed rounds found.</p>
                    )}
                </div>
                {/* Conditional Link to Round Summary */}
                <div className="w-full sm:w-auto sm:pl-4 flex justify-end sm:self-center pt-2 sm:pt-0">
                    {selectedRoundId && !isLoadingRounds && !roundsError && (
                        <Link href={`/rounds/${selectedRoundId}/summary`} className="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium px-3 py-2 rounded hover:bg-blue-50 transition-colors whitespace-nowrap">
                            View Round Summary →
                        </Link>
                    )}
                </div>
            </div> {/* End Selection Container */}


            {/* Standings Table Section */}
            <h2 className="text-xl font-semibold mb-4">{tableTitle}</h2>
            {isLoadingStandings ? (<p className="text-center p-4">Loading standings...</p>)
            : standingsError ? (<p className="text-center p-4 text-red-600 bg-red-100 rounded">Error: {standingsError}</p>)
            : (
                <div className="overflow-x-auto shadow rounded border-b border-gray-200 bg-white">
                    <table className="min-w-full divide-y divide-gray-200 table-fixed sm:table-auto">
                        <thead className="bg-gray-100">
                            <tr>
                                {/* Column Headers */}
                                <th scope="col" className="py-3 px-2 md:px-3 text-xs font-medium text-gray-600 uppercase tracking-wider w-12 text-center">Pos</th>
                                <th scope="col" className="py-3 px-1 md:px-2 text-xs font-medium text-gray-600 uppercase tracking-wider w-10 text-center">+/-</th>
                                <th scope="col" className="py-3 px-2 md:px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-1/3 sm:w-auto">Name</th>
                                <th scope="col" className="py-3 px-2 md:px-3 text-xs font-medium text-gray-600 uppercase tracking-wider w-12 text-center">Pld</th>
                                <th scope="col" className="py-3 px-2 md:px-3 text-xs font-medium text-gray-600 uppercase tracking-wider w-16 text-center">Outcome</th>
                                <th scope="col" className="py-3 px-2 md:px-3 text-xs font-medium text-gray-600 uppercase tracking-wider w-16 text-center">Exact</th>
                                <th scope="col" className="py-3 px-2 md:px-3 text-xs font-medium text-gray-600 uppercase tracking-wider w-16 text-center">Acc %</th>
                                <th scope="col" className="py-3 px-2 md:px-4 text-xs font-medium text-gray-600 uppercase tracking-wider w-16 text-right">Points</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {standings.length === 0 ? (
                                <tr><td colSpan={numColumns} className="text-center py-6 px-4 text-gray-500 italic">No standings data available{selectedRoundId !== null ? ' for this round' : ''}.</td></tr>
                            ) : (
                                // Start mapping over standings array
                                standings.map((item) => { // <<< Start of .map() callback function scope

                                    // --- DEFINE itemAvatarSrc HERE ---
                                    // Construct the full URL for *this specific item* inside the loop
                                    const itemAvatarSrc = item.avatarUrl ? `${baseUrlForImages}${item.avatarUrl}` : null;
                                    // ----------------------------------

                                    // Return the JSX for the table row
                                    return (
                                        <tr key={item.userId} className="hover:bg-gray-50 transition-colors duration-150">
                                            {/* Pos */}
                                            <td className="py-3 px-2 md:px-3 whitespace-nowrap text-sm font-medium text-center">{item.rank}</td>
                                            {/* +/- */}
                                            <td className="py-3 px-1 md:px-2 whitespace-nowrap text-sm text-center"><MovementIndicator movement={item.movement} /></td>

                                            {/* Name Cell with Avatar */}
                                            <td className="py-2 px-2 md:px-4 whitespace-nowrap text-sm text-gray-700">
                                                <div className="flex items-center space-x-2">
                                                    <Avatar
                                                        fullAvatarUrl={itemAvatarSrc} // <<< Use the variable defined above
                                                        name={item.name}       // Assumes item.name is the user's real name
                                                        size="sm"              // w-8 h-8
                                                    />
                                                    {/* Display Team Name if available, otherwise fallback to actual name */}
                                                    <span className="font-medium truncate" title={item.teamName || item.name}>
                                                        {item.teamName || item.name}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Pld */}
                                            <td className="py-3 px-2 md:px-3 whitespace-nowrap text-sm text-gray-600 text-center">{item.totalPredictions}</td>
                                            {/* Outcome */}
                                            <td className="py-3 px-2 md:px-3 whitespace-nowrap text-sm text-gray-600 text-center">{item.correctOutcomes}</td>
                                            {/* Exact */}
                                            <td className="py-3 px-2 md:px-3 whitespace-nowrap text-sm text-gray-600 text-center">{item.exactScores}</td>
                                            {/* Acc % */}
                                            <td className="py-3 px-2 md:px-3 whitespace-nowrap text-sm text-gray-600 text-center">{item.accuracy !== null ? `${item.accuracy.toFixed(1)}%` : '-'}</td>
                                            {/* Points */}
                                            <td className="py-3 px-2 md:px-4 whitespace-nowrap text-sm text-gray-900 font-semibold text-right">{item.points}</td>
                                        </tr>
                                    ); // <<< End of return statement for .map()
                                }) // <<< End of .map() callback function scope
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div> // End main container div
    );
}