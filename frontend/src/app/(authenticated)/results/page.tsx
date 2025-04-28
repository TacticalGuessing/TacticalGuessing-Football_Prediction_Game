// frontend/src/app/(authenticated)/results/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
// Ensure Fixture type includes crests, SimpleRound is correct
import { getCompletedRounds, getRoundFixtures, SimpleRound, Fixture, ApiError } from '@/lib/api';
import { formatDateTime } from '@/utils/formatters';
import Image from 'next/image'; // Import Image component

// --- UI Component Imports ---
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Label } from '@/components/ui/Label';
import Spinner from '@/components/ui/Spinner';
// Import icons
import { FaCalendarCheck, FaListAlt } from 'react-icons/fa';

export default function ResultsPage() {
    const { token, isLoading: isAuthLoading } = useAuth();
    const [completedRounds, setCompletedRounds] = useState<SimpleRound[]>([]);
    const [selectedRoundId, setSelectedRoundId] = useState<string>('');
    const [fixtures, setFixtures] = useState<Fixture[]>([]); // State holds Fixture[] which includes crests
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

        setIsLoadingFixtures(true); setError(null); setFixtures([]); // Clear previous fixtures
        const round = completedRounds.find(r => r.roundId === roundIdNum);
        const currentRoundName = round ? round.name : `Round ${roundIdNum}`;
        setSelectedRoundName(currentRoundName);

        try {
             const fixturesData = await getRoundFixtures(roundIdNum, token);
             console.log("[ResultsPage fetchFixtures] Fetched fixtures:", fixturesData); // Log fetched data
             setFixtures(fixturesData || []);
        } catch (err: unknown) {
             const message = err instanceof ApiError ? err.message : (err instanceof Error ? err.message : "Failed to load results.");
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
    const sectionContainerClasses = "bg-gray-800 rounded-lg shadow border border-gray-700 p-4 md:p-6"; // Changed rounding

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
                    <Label htmlFor="round-select-results" className="mb-1.5 text-gray-300">Select Round:</Label> {/* Adjusted label text color */}
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
                     {error && <p className="text-red-400 bg-red-900/30 p-3 rounded mt-4 text-sm">Error: {error}</p>} {/* Added text-sm */}

                     {!isLoadingFixtures && !error && fixtures.length > 0 && (
                         <div className="space-y-3">
                            {fixtures.map(fixture => (
                                // Apply 12-column grid layout
                                <div
                                    key={fixture.fixtureId}
                                    className="p-3 bg-gray-700/50 rounded-md border border-gray-600 grid grid-cols-12 gap-x-2 gap-y-1 items-center"
                                >
                                    {/* Column 1: Empty Placeholder (aligns with Joker column on predictions page) */}
                                    <div className="col-span-1"></div>

                                    {/* Column 2: Home Team Name & Crest */}
                                    <div className="col-span-4 sm:col-span-3 text-sm sm:text-base font-medium text-gray-100 text-left truncate pl-1 flex justify-start items-center gap-2">
                                        {/* Home Crest */}
                                        {fixture.homeTeamCrestUrl && (
                                            <Image
                                                src={fixture.homeTeamCrestUrl}
                                                alt="" // Decorative
                                                width={24} height={24}
                                                className="inline-block align-middle object-contain mr-1.5"
                                                unoptimized
                                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                            />
                                        )}
                                        {/* Home Team Name */}
                                        <span title={fixture.homeTeam}>{fixture.homeTeam}</span>
                                    </div>

                                    {/* Column 3: Home Score */}
                                    <div className="col-span-1 text-center text-lg font-semibold text-gray-100">
                                         {fixture.homeScore ?? '-'}
                                    </div>

                                    {/* Column 4: Score Separator */}
                                    <div className="col-span-1 text-center font-semibold text-gray-400">-</div>

                                    {/* Column 5: Away Score */}
                                     <div className="col-span-1 text-center text-lg font-semibold text-gray-100">
                                         {fixture.awayScore ?? '-'}
                                    </div>

                                    {/* Column 6: Away Team Name & Crest */}
                                    <div className="col-span-4 sm:col-span-3 text-sm sm:text-base font-medium text-gray-100 text-left truncate pr-1 flex justify-end items-center gap-2">
                                        {/* Away Team Name */}
                                        <span title={fixture.awayTeam}>{fixture.awayTeam}</span>
                                         {/* Away Crest */}
                                        {fixture.awayTeamCrestUrl && (
                                            <Image
                                                src={fixture.awayTeamCrestUrl}
                                                alt="" // Decorative
                                                width={24} height={24}
                                                className="inline-block align-middle object-contain ml-1.5"
                                                unoptimized
                                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                            />
                                        )}
                                    </div>

                                    {/* Column 7: Match Time */}
                                    <div className="col-span-12 sm:col-span-2 text-xs text-gray-400 text-center sm:text-right pt-1 sm:pt-0">
                                        {formatDateTime(fixture.matchTime)}
                                    </div>
                                </div> // End Fixture Row Div
                            ))}
                         </div> // End Fixtures Container div
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