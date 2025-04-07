// frontend/src/app/(authenticated)/rounds/[roundId]/summary/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation'; // Import useParams to get route parameters
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'react-hot-toast';

// Import API function and types
import {
    getRoundSummary,        // Should be available now
    RoundSummaryResponse,   // Should be available now
    RoundTopScorer,         // Import for type annotation
    OverallLeader,          // Import for type annotation
    TopJokerPlayer          // Import for type annotation
} from '@/lib/api';


const RoundSummaryPage = () => {
    const { token } = useAuth();
    const params = useParams();
    const router = useRouter();

    const [summaryData, setSummaryData] = useState<RoundSummaryResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const roundIdParam = params.roundId;
    const roundId = typeof roundIdParam === 'string' ? parseInt(roundIdParam, 10) : null;

    // Fetch summary data
    const fetchSummary = useCallback(async () => {
        if (!token) { setError("Authentication token not found."); setIsLoading(false); return; };
        if (roundId === null || isNaN(roundId) || roundId <= 0) { setError("Invalid Round ID in URL."); setIsLoading(false); return; }
        setIsLoading(true); setError(null); setSummaryData(null);
        try {
            console.log(`Fetching summary for Round ID: ${roundId}`);
            const data = await getRoundSummary(roundId, token);
            setSummaryData(data);
        } catch (err: unknown) {
            console.error("Error fetching round summary:", err);
            const message = err instanceof Error ? err.message : "Failed to load round summary.";
            setError(message); toast.error(message);
        } finally {
            setIsLoading(false);
        }
    }, [token, roundId]);

    // Effect to fetch data
    useEffect(() => {
        fetchSummary();
    }, [fetchSummary]);

    // --- Render Logic ---

    if (isLoading) { return <div className="p-4 md:p-6 text-center">Loading Round Summary...</div>; }
    if (error) { return <div className="p-4 md:p-6 text-center text-red-600 bg-red-100 rounded">Error: {error}</div>; }
    if (!summaryData) { return <div className="p-4 md:p-6 text-center text-gray-500">Round summary data is unavailable.</div>; }

    // Main content rendering
    return (
        <div className="container mx-auto p-4 md:p-6">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
                Round Summary: <span className="text-indigo-600">{summaryData.roundName}</span>
            </h1>
             <p className="text-sm text-gray-500 mb-6">(Round ID: {summaryData.roundId})</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                {/* Round Statistics Card */}
                <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-700 mb-3">Round Statistics</h2>
                    <ul className="space-y-2 text-sm">
                         <li>
                            <span className="font-medium text-gray-600">Total Predictions Made:</span>
                            <span className="ml-2 text-gray-800">{summaryData.roundStats.totalPredictions}</span>
                        </li>
                        <li>
                            <span className="font-medium text-gray-600">Exact Scores Predicted:</span>
                            <span className="ml-2 font-bold text-green-700">{summaryData.roundStats.exactScoresCount}</span>
                        </li>
                        <li>
                            <span className="font-medium text-gray-600">Successful Jokers Played:</span>
                            <span className="ml-2 font-bold text-yellow-700">{summaryData.roundStats.successfulJokersCount} ★</span>
                        </li>
                    </ul>
                </div>

                 {/* Top Scorers (This Round) Card */}
                 <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
                     <h2 className="text-lg font-semibold text-gray-700 mb-3">Top Scorers (This Round)</h2>
                     {summaryData.topScorersThisRound.length > 0 ? (
                        <ol className="list-decimal list-inside space-y-1">
                            {/* *** ADDED TYPE ANNOTATION *** */}
                            {summaryData.topScorersThisRound.map((scorer: RoundTopScorer) => (
                                <li key={scorer.userId ?? `scorer-${Math.random()}`} className="text-sm">
                                    <span className="font-medium text-gray-800">{scorer.name}</span>
                                    <span className="text-gray-600"> - {scorer.points} pts</span>
                                </li>
                            ))}
                        </ol>
                     ) : (
                        <p className="text-sm text-gray-500 italic">No points scored this round.</p>
                     )}
                 </div>

                 {/* Overall League Leaders Card */}
                 <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
                     <h2 className="text-lg font-semibold text-gray-700 mb-3">Overall League Leaders</h2>
                     {summaryData.overallLeaders.length > 0 ? (
                        <ol className="list-decimal list-inside space-y-1">
                             {/* *** ADDED TYPE ANNOTATION *** */}
                            {summaryData.overallLeaders.map((leader: OverallLeader) => (
                                <li key={leader.userId ?? `leader-${Math.random()}`} className="text-sm">
                                    <span className="font-medium text-gray-800">{leader.name}</span>
                                    <span className="text-gray-600"> - {leader.totalPoints} total pts</span>
                                </li>
                            ))}
                        </ol>
                      ) : (
                        <p className="text-sm text-gray-500 italic">No overall leaders found.</p>
                     )}
                     <Link href="/standings" className="text-xs text-blue-600 hover:underline mt-2 block">View Full Standings →</Link>
                 </div>

                 {/* Top Joker Players Card */}
                <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-700 mb-3">Most Successful Jokers (Overall)</h2>
                     {summaryData.topJokerPlayers.length > 0 ? (
                        <ol className="list-decimal list-inside space-y-1">
                             {/* *** ADDED TYPE ANNOTATION *** */}
                            {summaryData.topJokerPlayers.map((jokerPlayer: TopJokerPlayer) => (
                                <li key={jokerPlayer.userId ?? `joker-${Math.random()}`} className="text-sm">
                                    <span className="font-medium text-gray-800">{jokerPlayer.name}</span>
                                    <span className="text-gray-600"> - {jokerPlayer.successfulJokers} successful play(s)</span>
                                </li>
                            ))}
                        </ol>
                      ) : (
                        <p className="text-sm text-gray-500 italic">No successful Jokers played yet.</p>
                     )}
                </div>

            </div> {/* End Grid */}

             {/* Navigation Back */}
             <div className="mt-8">
                 <button
                     onClick={() => router.back()}
                     className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline"
                 >
                    ← Back
                 </button>
                 <span className="mx-2 text-gray-300">|</span>
                 <Link href="/standings" className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline">
                    View Full Standings
                 </Link>
            </div>

        </div> // End Container
    );
};

export default RoundSummaryPage;