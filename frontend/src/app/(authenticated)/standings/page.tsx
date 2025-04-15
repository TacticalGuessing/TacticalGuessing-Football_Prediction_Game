// frontend/src/app/(authenticated)/standings/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getStandings, getCompletedRounds, SimpleRound, StandingEntry, ApiError } from '@/lib/api'; // Add ApiError
import { useAuth } from '@/context/AuthContext';
import MovementIndicator from '@/components/Standings/MovementIndicator';
import Avatar from '@/components/Avatar';
import { FaTrophy } from 'react-icons/fa';

export default function StandingsPage() {
    // Removed renderCount ref for cleaner code, uncomment if needed for debugging
    // const renderCount = useRef(0);
    // useEffect(() => {
    //   renderCount.current += 1;
    // });

    const { token, isLoading: isAuthLoading } = useAuth(); // Include user for potential future checks

    // State
    const [rounds, setRounds] = useState<SimpleRound[]>([]);
    const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null); // null for Overall
    const [isLoadingRounds, setIsLoadingRounds] = useState(true);
    const [roundsError, setRoundsError] = useState<string | null>(null);
    const [standings, setStandings] = useState<StandingEntry[]>([]);
    const [isLoadingStandings, setIsLoadingStandings] = useState(true);
    const [standingsError, setStandingsError] = useState<string | null>(null);
    const [tableTitle, setTableTitle] = useState('Overall Standings');

    // Define consistent input/select classes for dark theme
    const selectClasses = "block w-full pl-3 pr-10 py-2 border border-gray-600 rounded-md shadow-sm bg-gray-700 text-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-forest focus:border-forest disabled:opacity-50 disabled:bg-gray-600 disabled:cursor-not-allowed sm:text-sm";
    const cardClasses = "bg-gray-800 rounded-lg shadow-lg border border-gray-700 p-4 mb-6"; // Card style for filter section

    // Fetch Completed Rounds
    const fetchCompletedRounds = useCallback(async () => {
        if (!token) return;
        setIsLoadingRounds(true); setRoundsError(null);
        try {
            const completedRoundsData = await getCompletedRounds(token);
            setRounds(completedRoundsData || []);
        } catch (err: unknown) {
            console.error("fetchCompletedRounds: ERROR:", err);
            const message = err instanceof ApiError ? err.message : (err instanceof Error ? err.message : 'Failed to load rounds.');
            setRoundsError(message); setRounds([]);
        } finally { setIsLoadingRounds(false); }
    }, [token]);

    // Fetch Standings (Updated to fix 'prefer-const')
    const fetchStandings = useCallback(async (roundIdStr: string | null) => {
        if (!token) {
            setStandingsError("Authentication required.");
            setStandings([]);
            setIsLoadingStandings(false);
            return;
        }

        let parsedRoundId: number | undefined = undefined; // Use 'let' initially for parsing logic

        // --- Parameter Parsing and Validation ---
        if (roundIdStr !== null) {
            const parsed = parseInt(roundIdStr, 10);
            if (isNaN(parsed)) {
                // Handle invalid round ID string
                setStandingsError("Invalid round selected (NaN).");
                setStandings([]);
                setIsLoadingStandings(false);
                return; // Stop execution if parsing fails
            }
            parsedRoundId = parsed; // Assign the valid number
        }
        // At this point, parsedRoundId is either a valid number or undefined (for Overall)
        // --- End Parameter Parsing ---

        // Now declare the value we pass to the API using const
        const finalRoundIdForAPI: number | undefined = parsedRoundId;

        // Set loading state and clear previous error
        setIsLoadingStandings(true);
        setStandingsError(null);

        try {
            // Call API with the final const value
            const data: StandingEntry[] = await getStandings(token, finalRoundIdForAPI);
            setStandings(data || []); // Set state with fetched data or empty array
        } catch (err: unknown) {
            // Handle API errors
            console.error(`fetchStandings: ERROR for ${finalRoundIdForAPI ?? 'overall'}:`, err);
            const message = err instanceof ApiError ? err.message : (err instanceof Error ? err.message : 'Failed to fetch standings.');
            setStandingsError(message);
            setStandings([]); // Clear standings on error
        } finally {
            // Always stop loading indicator
            setIsLoadingStandings(false);
        }
    }, [token]); // Dependency array for useCallback

    // Initial Effects
    useEffect(() => {
        if (!isAuthLoading && token) {
            fetchCompletedRounds();
            fetchStandings(null);
        } else if (!isAuthLoading && !token) { /* ... handle not logged in ... */ }
    }, [token, isAuthLoading, fetchCompletedRounds, fetchStandings]);

    // Effect for Setting Table Title
    useEffect(() => {
        // ... (logic remains the same) ...
        let newTitle = 'Standings'; // Default
        if (isLoadingStandings) { return; }
        if (standingsError) { newTitle = `Error Loading Standings`; }
        else {
            if (selectedRoundId !== null) {
                const roundName = rounds.find(r => r.roundId.toString() === selectedRoundId)?.name;
                newTitle = (roundName ? `${roundName} Standings` : `Round ${selectedRoundId} Standings`);
            } else { newTitle = ('Overall Standings'); }
        }
        if (newTitle !== tableTitle) setTableTitle(newTitle);
    }, [selectedRoundId, rounds, isLoadingStandings, standingsError, tableTitle]);


    // Handle dropdown change
    const handleRoundChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newRoundIdValue = event.target.value;
        const newSelectedId = newRoundIdValue === '' ? null : newRoundIdValue;
        setSelectedRoundId(newSelectedId);
        fetchStandings(newSelectedId);
    };

    // --- Render Logic ---
     if (isAuthLoading) { return <p className="p-6 text-center text-gray-400">Authenticating...</p>; }
     // Assuming layout handles non-authenticated users

    const filteredRounds = Array.isArray(rounds) ? rounds.filter(round => round && typeof round.roundId === 'number') : [];
    const isDropdownDisabled = isLoadingRounds || isLoadingStandings; // Disable during both loads
    const numColumns = 8;

    return (
        // Apply consistent page padding if not handled by layout
        // <div className="p-4 md:p-6">
        <> {/* Use Fragment if layout handles padding */}
            {/* Page Title */}
            <h1 className="text-2xl md:text-3xl font-bold mb-6 text-gray-100 flex items-center"> {/* Added flex */}
               <FaTrophy className="mr-3 text-amber-400" /> {/* Added icon */}
                Standings
            </h1>

            {/* Round Selection Card */}
            <div className={`${cardClasses} flex flex-col sm:flex-row gap-4 items-center justify-between`}>
                {/* Dropdown Section */}
                <div className="flex-grow w-full sm:w-auto">
                   <label htmlFor="roundSelect" className="block text-sm font-medium text-gray-300 mb-1">
                        View Standings For:
                    </label>
                    {isLoadingRounds && !roundsError ? (<p className="text-sm text-gray-400 italic">Loading rounds...</p>)
                    : roundsError ? (<p className="text-sm text-red-400">{roundsError}</p>)
                    : (
                        <select
                            id="roundSelect"
                            value={selectedRoundId ?? ''}
                            onChange={handleRoundChange}
                            className={selectClasses} // Apply themed select classes
                            disabled={isDropdownDisabled}
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
                        <p className="text-sm text-gray-400 mt-2 italic">No completed rounds available.</p>
                    )}
                </div>
                {/* Conditional Link to Round Summary */}
                <div className="w-full sm:w-auto sm:pl-4 flex justify-end sm:self-center pt-2 sm:pt-0">
                    {selectedRoundId && !isLoadingRounds && !roundsError && (
                        <Link href={`/rounds/${selectedRoundId}/summary`} className="text-sm text-accent hover:text-amber-300 hover:underline font-medium px-3 py-2 rounded hover:bg-gray-700 transition-colors whitespace-nowrap">
                            View Round Summary →
                        </Link> // Styled link
                    )}
                </div>
            </div> {/* End Selection Card */}


            {/* Standings Table Section */}
            <h2 className="text-xl font-semibold mb-4 text-gray-200">{tableTitle}</h2>

            {/* Loading/Error State for Table */}
            {isLoadingStandings ? (<div className="text-center p-6 text-gray-400 italic">Loading standings...</div>)
            : standingsError ? (<div role="alert" className="text-center p-4 text-red-300 bg-red-900/30 border border-red-700/50 rounded">Error: {standingsError}</div>)
            : (
                // Table Container
                <div className="overflow-x-auto shadow-lg rounded-lg border border-gray-700">
                    <table className="min-w-full divide-y divide-gray-600">
                        {/* Table Head */}
                        <thead className="bg-gray-700">
                            <tr>
                                <th scope="col" className="py-3 px-2 md:px-3 text-xs font-medium text-gray-300 uppercase tracking-wider w-12 text-center">Pos</th>
                                <th scope="col" className="py-3 px-1 md:px-2 text-xs font-medium text-gray-300 uppercase tracking-wider w-10 text-center">+/-</th>
                                <th scope="col" className="py-3 px-2 md:px-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-1/3 sm:w-auto">Name</th>
                                <th scope="col" className="py-3 px-2 md:px-3 text-xs font-medium text-gray-300 uppercase tracking-wider w-12 text-center">Pld</th>
                                <th scope="col" className="py-3 px-2 md:px-3 text-xs font-medium text-gray-300 uppercase tracking-wider w-16 text-center">Outcome</th>
                                <th scope="col" className="py-3 px-2 md:px-3 text-xs font-medium text-gray-300 uppercase tracking-wider w-16 text-center">Exact</th>
                                <th scope="col" className="py-3 px-2 md:px-3 text-xs font-medium text-gray-300 uppercase tracking-wider w-16 text-center">Acc %</th>
                                <th scope="col" className="py-3 px-2 md:px-4 text-xs font-medium text-gray-300 uppercase tracking-wider w-16 text-right">Points</th>
                            </tr>
                        </thead>
                        {/* Table Body */}
                        <tbody className="bg-gray-800 divide-y divide-gray-600">
                            {standings.length === 0 ? (
                                <tr><td colSpan={numColumns} className="text-center py-6 px-4 text-gray-400 italic">No standings data available{selectedRoundId !== null ? ' for this round' : ''}.</td></tr>
                            ) : (
                                standings.map((item) => {
                                    // Avatar URL logic remains the same
                                    let itemAvatarSrc: string | null = null;
                                    if (item.avatarUrl) { /* ... logic to set itemAvatarSrc from absolute URL ... */
                                        if (item.avatarUrl.startsWith('http')) { itemAvatarSrc = item.avatarUrl; }
                                        else { console.warn(`Standings unexpected relative avatarUrl: ${item.avatarUrl}`);}
                                    }

                                    // Row styling with hover effect
                                    return (
                                        <tr key={item.userId} className="hover:bg-gray-700/50 transition-colors duration-150">
                                            {/* Pos */}
                                            <td className="py-3 px-2 md:px-3 whitespace-nowrap text-sm font-medium text-gray-200 text-center">{item.rank}</td>
                                            {/* +/- */}
                                            <td className="py-3 px-1 md:px-2 whitespace-nowrap text-sm text-center"><MovementIndicator movement={item.movement} /></td>
                                            {/* Name Cell with Avatar */}
                                            <td className="py-2 px-2 md:px-4 whitespace-nowrap text-sm text-gray-100">
                                                <div className="flex items-center space-x-3"> {/* Increased space */}
                                                    <Avatar
                                                        fullAvatarUrl={itemAvatarSrc}
                                                        name={item.name}
                                                        size="sm"
                                                        // Removed border from Avatar itself, rely on container if needed
                                                    />
                                                    {/* Display Team Name or Name */}
                                                    <span className="font-medium truncate" title={item.teamName || item.name}>
                                                        {item.teamName || item.name}
                                                    </span>
                                                </div>
                                            </td>
                                            {/* Pld */}
                                            <td className="py-3 px-2 md:px-3 whitespace-nowrap text-sm text-gray-300 text-center">{item.totalPredictions}</td>
                                            {/* Outcome */}
                                            <td className="py-3 px-2 md:px-3 whitespace-nowrap text-sm text-gray-300 text-center">{item.correctOutcomes}</td>
                                            {/* Exact */}
                                            <td className="py-3 px-2 md:px-3 whitespace-nowrap text-sm text-gray-300 text-center">{item.exactScores}</td>
                                            {/* Acc % */}
                                            <td className="py-3 px-2 md:px-3 whitespace-nowrap text-sm text-gray-300 text-center">{item.accuracy !== null ? `${item.accuracy.toFixed(1)}%` : '-'}</td>
                                            {/* Points */}
                                            <td className="py-3 px-2 md:px-4 whitespace-nowrap text-sm text-gray-100 font-semibold text-right">{item.points}</td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div> // End Table Container
            )}
        </> // End Fragment
        // </div> // End main container div
    );
}