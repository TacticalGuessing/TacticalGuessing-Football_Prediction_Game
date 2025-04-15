// frontend/src/app/(authenticated)/results/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getCompletedRounds, getRoundFixtures, SimpleRound, Fixture} from '@/lib/api';
import { formatDateTime } from '@/utils/formatters';

// --- UI Component Imports ---
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Label } from '@/components/ui/Label';
import Spinner from '@/components/ui/Spinner';
// Import icons
import { FaCalendarCheck, FaListAlt } from 'react-icons/fa';
// Import Image if you were using actual badge images now
// import Image from 'next/image';

export default function ResultsPage() {
    const { token, isLoading: isAuthLoading } = useAuth();
    const [completedRounds, setCompletedRounds] = useState<SimpleRound[]>([]);
    const [selectedRoundId, setSelectedRoundId] = useState<string>('');
    const [fixtures, setFixtures] = useState<Fixture[]>([]);
    const [isLoadingRounds, setIsLoadingRounds] = useState(true);
    const [isLoadingFixtures, setIsLoadingFixtures] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedRoundName, setSelectedRoundName] = useState<string | null>(null);

    // --- Fetch completed rounds ---
    const fetchRounds = useCallback(async () => {
        if (!token) { setError("Authentication required."); setIsLoadingRounds(false); return; }
        setIsLoadingRounds(true); setError(null);
        try {
            const roundsData = await getCompletedRounds(token);
            setCompletedRounds(roundsData || []);
        } catch (err) {
            setError("Failed to load completed rounds.");
            console.error("Error fetching completed rounds:", err);
        }
        finally { setIsLoadingRounds(false); }
    }, [token]);

    // --- Fetch fixtures for selected round ---
    const fetchFixtures = useCallback(async (roundIdStr: string) => {
        if (!token || !roundIdStr) { setFixtures([]); setSelectedRoundName(null); return; }
        const roundIdNum = parseInt(roundIdStr, 10);
        if (isNaN(roundIdNum)) { setFixtures([]); setSelectedRoundName(null); return; }

        setIsLoadingFixtures(true); setError(null); setFixtures([]);
        const round = completedRounds.find(r => r.roundId === roundIdNum);
        const currentRoundName = round ? round.name : `Round ${roundIdNum}`;
        setSelectedRoundName(currentRoundName);

        try {
             const fixturesData = await getRoundFixtures(roundIdNum, token);
             setFixtures(fixturesData || []);
        } catch (err: unknown) {
             const message = err instanceof Error ? err.message : "Failed to load results.";
             setError(`Failed to load results for ${currentRoundName}: ${message}`);
             console.error(`Error fetching fixtures for round ${roundIdNum}:`, err);
             setFixtures([]);
        } finally {
            setIsLoadingFixtures(false);
        }
    }, [token, completedRounds]);

    // --- Initial fetch for rounds ---
    useEffect(() => {
        if (!isAuthLoading && token) {
            fetchRounds();
        } else if (!isAuthLoading && !token) {
             setError("Authentication required.");
             setIsLoadingRounds(false);
        }
    }, [isAuthLoading, token, fetchRounds]);

    // --- Handler for dropdown change ---
    const handleRoundChange = (newRoundId: string | undefined) => {
        const roundIdToSet = newRoundId ?? '';
        setSelectedRoundId(roundIdToSet);
        if (roundIdToSet) {
            fetchFixtures(roundIdToSet);
        } else {
            setFixtures([]);
            setSelectedRoundName(null);
            setError(null);
        }
    };

    // Define container style
    const sectionContainerClasses = "bg-gray-800 rounded-lg shadow border border-gray-700 p-4 md:p-6";

    // --- Render Logic ---
    if (isAuthLoading) return <div className="p-6 text-center text-gray-400">Loading...</div>;

    return (
        <div className="space-y-6 p-4 md:p-6">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-100 flex items-center">
                <FaCalendarCheck className="mr-3 text-blue-400" /> Match Results
            </h1>

            {/* Round Selector Section */}
            <div className={sectionContainerClasses}>
                <div className="max-w-sm">
                    <Label htmlFor="round-select-results" className="mb-1.5">Select Round:</Label>
                    {isLoadingRounds ? <div className="flex items-center text-gray-400"><Spinner className="mr-2 h-4 w-4"/> Loading rounds...</div> : (
                        <Select
                            value={selectedRoundId}
                            onValueChange={handleRoundChange}
                            disabled={isLoadingRounds || isLoadingFixtures}
                        >
                            <SelectTrigger id="round-select-results" className="w-full" disabled={isLoadingRounds || isLoadingFixtures}>
                                <SelectValue placeholder="-- Select a Completed Round --" />
                            </SelectTrigger>
                            <SelectContent>
                                {completedRounds.map(round => (
                                    <SelectItem key={round.roundId} value={round.roundId.toString()}>
                                        {round.name} (ID: {round.roundId})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    {completedRounds.length === 0 && !isLoadingRounds && !error && (
                        <p className="text-sm text-gray-500 mt-2 italic">No completed rounds available.</p>
                    )}
                </div>
            </div>

            {/* Results Display Section */}
            {selectedRoundId && (
                 <div className={sectionContainerClasses}>
                     {selectedRoundName && !isLoadingFixtures && (
                         <h2 className="text-xl font-semibold text-gray-200 mb-4 flex items-center">
                              <FaListAlt className="mr-3 text-gray-400" /> {selectedRoundName} Results
                         </h2>
                     )}

                     {isLoadingFixtures && <div className="text-center p-4 text-gray-400"><Spinner className="inline w-5 h-5 mr-2"/> Loading results...</div>}
                     {error && <p className="text-red-400 bg-red-900/30 p-3 rounded mt-4">Error: {error}</p>}

                     {!isLoadingFixtures && !error && fixtures.length > 0 && (
                         <ul className="space-y-2"> {/* Reduced vertical space between items */}
                            {fixtures.map(fixture => (
                                // New layout for list items
                                <li key={fixture.fixtureId} className="p-3 bg-gray-700/50 rounded-md border border-gray-600">
                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4">
                                        {/* Home Team Section */}
                                        <div className="flex items-center justify-start w-full sm:w-auto sm:flex-1">
                                            {/* Placeholder for Home Badge */}
                                            <span className=" h-5 w-5 mr-2 bg-gray-600 rounded-full text-xs flex items-center justify-center text-gray-400">?</span>
                                            <span className="text-gray-100 font-medium text-sm truncate" title={fixture.homeTeam}>
                                                {fixture.homeTeam}
                                            </span>
                                        </div>

                                        {/* Score Section */}
                                        <div className="text-base font-bold text-gray-200 whitespace-nowrap font-mono px-2 order-first sm:order-none w-full text-center sm:w-auto">
                                            {fixture.homeScore !== null && fixture.awayScore !== null ? (
                                                `${fixture.homeScore} - ${fixture.awayScore}`
                                            ) : fixture.status === 'POSTPONED' || fixture.status === 'CANCELED' ? (
                                                <span className='text-xs italic text-red-400 font-normal uppercase'>{fixture.status}</span>
                                            ) : (
                                                <span className='text-xs italic text-gray-500 font-normal'>TBC</span>
                                            )}
                                        </div>

                                         {/* Away Team Section */}
                                        <div className="flex items-center justify-end w-full sm:w-auto sm:flex-1 text-right">
                                            <span className="text-gray-100 font-medium text-sm truncate" title={fixture.awayTeam}>
                                                {fixture.awayTeam}
                                            </span>
                                            {/* Placeholder for Away Badge */}
                                            <span className=" h-5 w-5 ml-2 bg-gray-600 rounded-full text-xs flex items-center justify-center text-gray-400">?</span>
                                        </div>

                                         {/* Date/Time Section */}
                                        <div className="text-xs text-gray-400 whitespace-nowrap w-full text-center border-t border-gray-600 pt-2 mt-2 sm:border-0 sm:w-auto sm:text-right sm:pt-0 sm:mt-0">
                                            {formatDateTime(fixture.matchTime)}
                                        </div>
                                    </div> {/* End Flex Container */}
                                </li>
                            ))}
                         </ul>
                     )}

                     {/* No fixtures found message */}
                     {!isLoadingFixtures && !error && fixtures.length === 0 && (
                         <p className="text-gray-500 italic text-center py-4">No fixtures found or results entered for this round yet.</p>
                     )}
                 </div> // End Results Display Section
            )}

         </div> // End Page Container
     );
 }