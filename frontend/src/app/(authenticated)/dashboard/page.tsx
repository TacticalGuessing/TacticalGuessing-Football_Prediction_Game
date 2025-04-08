// frontend/src/app/(authenticated)/dashboard/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'react-hot-toast';

// Import relevant API functions and types
import {
    getStandings,
    getLatestCompletedRound,
    getRoundSummary,
    StandingEntry,
    SimpleRound,
    RoundSummaryResponse
} from '@/lib/api';
// Assuming you have these components or render inline
// import StandingsTableSnippet from '@/components/Dashboard/StandingsTableSnippet';
// import LatestSummaryHighlights from '@/components/Dashboard/LatestSummaryHighlights';
// import MovementIndicator from '@/components/Standings/MovementIndicator';

export default function DashboardPage() {
    const { user, token, isLoading: isAuthLoading } = useAuth();

    // State for dashboard data
    const [overallStandings, setOverallStandings] = useState<StandingEntry[]>([]);
    const [latestSummary, setLatestSummary] = useState<RoundSummaryResponse | null>(null);
    const [latestRoundInfo, setLatestRoundInfo] = useState<SimpleRound | null>(null); // Store basic info too

    // Loading and Error State
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [pageError, setPageError] = useState<string | null>(null);

    // Fetch all necessary data for the dashboard
    const fetchDashboardData = useCallback(async () => {
        if (!token) {
             setIsLoadingData(false); // No token, stop loading
             setPageError("Authentication required to load dashboard.");
             return;
        };

        setIsLoadingData(true);
        setPageError(null);
        // Reset data on refetch? Maybe not for smoother updates.
        // setOverallStandings([]);
        // setLatestSummary(null);
        // setLatestRoundInfo(null);

        console.log(`%c[Dashboard] Fetching data...`, 'color: blue');

        try {
            // Use Promise.allSettled to fetch crucial data even if secondary fails
            const results = await Promise.allSettled([
                getStandings(token), // Fetch overall standings (index 0)
                getLatestCompletedRound(token) // Fetch latest completed round info (index 1)
            ]);

            let standingsError = null;
            let latestRoundError = null;
            let latestRound: SimpleRound | null = null;

            // Process Standings Result
            if (results[0].status === 'fulfilled') {
                 // Limit to top 5 for snippet display
                setOverallStandings(results[0].value.slice(0, 5));
                 console.log(`%c[Dashboard] Standings fetched.`, 'color: green;');
            } else {
                console.error("[Dashboard] Error fetching standings:", results[0].reason);
                standingsError = results[0].reason instanceof Error ? results[0].reason.message : "Could not load standings.";
            }

            // Process Latest Completed Round Result
            if (results[1].status === 'fulfilled') {
                latestRound = results[1].value; // This is { roundId, name } or null
                setLatestRoundInfo(latestRound);
                 console.log(`%c[Dashboard] Latest completed round fetched:`, 'color: green;', latestRound);
            } else {
                 console.error("[Dashboard] Error fetching latest completed round:", results[1].reason);
                 latestRoundError = results[1].reason instanceof Error ? results[1].reason.message : "Could not load latest round info.";
            }

            // If we found a latest completed round, fetch its summary
            let summaryError = null;
            if (latestRound?.roundId) {
                try {
                    console.log(`%c[Dashboard] Fetching summary for round ${latestRound.roundId}...`, 'color: teal;');
                    const summary = await getRoundSummary(latestRound.roundId, token);
                    setLatestSummary(summary);
                     console.log(`%c[Dashboard] Summary fetched.`, 'color: green;');
                } catch (summaryErr: unknown) {
                    console.error(`[Dashboard] Error fetching summary for round ${latestRound.roundId}:`, summaryErr);
                    summaryError = summaryErr instanceof Error ? summaryErr.message : "Could not load latest round summary.";
                    setLatestSummary(null); // Ensure summary is null on error
                }
            } else {
                 console.log(`%c[Dashboard] No latest completed round found, skipping summary fetch.`, 'color: orange;');
                 setLatestSummary(null); // No round means no summary
            }

            // Combine errors if necessary
            const combinedError = [standingsError, latestRoundError, summaryError].filter(Boolean).join('; ');
            if (combinedError) {
                 setPageError(combinedError);
                 toast.error("Some dashboard data failed to load.", { duration: 4000 });
            }


        } catch (generalError) {
             // Catch unexpected errors during Promise.allSettled itself (unlikely)
             console.error("[Dashboard] Unexpected error fetching data:", generalError);
             setPageError("An unexpected error occurred loading the dashboard.");
             toast.error("Failed to load dashboard data.");
        } finally {
            setIsLoadingData(false);
        }
    }, [token]); // Depends only on token

    // Effect to fetch data when authenticated
    useEffect(() => {
        if (!isAuthLoading && token) {
            fetchDashboardData();
        } else if (!isAuthLoading && !token) {
            // Handle case where user logs out - clear data? Or rely on redirect?
            setIsLoadingData(false);
            setPageError("Please log in."); // Show message if stuck on page
        }
    }, [isAuthLoading, token, fetchDashboardData]);


    // --- Render Logic ---

    if (isAuthLoading || isLoadingData) {
        return <div className="p-4 md:p-6 text-center">Loading Dashboard...</div>;
    }

     if (!user || !token) { // Check user as well
          // AuthProvider should redirect, this is a fallback message
          return ( <div className="p-4 md:p-6 text-center text-red-600">User not authenticated. Redirecting...</div> );
     }


    return (
        <div className="container mx-auto p-4 md:p-6 space-y-8">
            {/* Welcome Header */}
            <div>
                 <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
                     Welcome back, <span className="text-indigo-600">{user.name}!</span>
                 </h1>
                 {/* Optional: Add a brief intro or date */}
                 <p className="text-gray-600">Here&apos;s the latest from the Prediction Game.</p>
            </div>


             {/* Display combined errors if any */}
             {pageError && (
                 <div className="p-4 text-center text-red-600 bg-red-100 rounded border border-red-300">
                     <p>Could not load all dashboard data: {pageError}</p>
                 </div>
             )}


            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                                {/* Overall Standings Snippet (Left Column / Spans 2 on large screens) */}
                                <div className="lg:col-span-2 bg-white p-4 md:p-6 rounded-lg shadow border border-gray-200">
                     <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold text-gray-700">Overall Standings (Top 5)</h2>
                         <Link href="/standings" className="text-sm text-blue-600 hover:underline font-medium">View Full Standings →</Link>
                     </div>

                     {/* Standings Table Snippet */}
                     <div className="overflow-x-auto">
                        {overallStandings.length > 0 ? (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        {/* === MODIFIED: Added Headers === */}
                                        <th scope="col" className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-12">Pos</th>
                                        {/* +/- Column maybe omitted for snippet simplicity? Your choice. Let's omit for now. */}
                                        {/* <th scope="col" className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-10">+/-</th> */}
                                        <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                        <th scope="col" className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-12">Pld</th>
                                        <th scope="col" className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">Outcome</th>
                                        <th scope="col" className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">Exact</th>
                                        <th scope="col" className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">Acc %</th>
                                        <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-16">Points</th>
                                        {/* === END MODIFIED Headers === */}
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {overallStandings.map((entry) => (
                                        <tr key={entry.userId}>
                                            {/* === MODIFIED: Added Cells === */}
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-center">{entry.rank}</td>
                                            {/* Movement cell omitted */}
                                            <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{entry.name}</td>
                                            <td className="px-2 py-2 whitespace-nowrap text-sm text-center text-gray-500">{entry.totalPredictions}</td>
                                            <td className="px-2 py-2 whitespace-nowrap text-sm text-center text-gray-500">{entry.correctOutcomes}</td>
                                            <td className="px-2 py-2 whitespace-nowrap text-sm text-center text-gray-500">{entry.exactScores}</td>
                                            <td className="px-2 py-2 whitespace-nowrap text-sm text-center text-gray-500">{entry.accuracy === null ? '-' : `${entry.accuracy.toFixed(1)}%`}</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm font-bold text-indigo-600 text-right">{entry.points}</td>
                                            {/* === END MODIFIED Cells === */}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                         ) : (
                             <p className="text-sm text-gray-500 italic py-4 text-center">Standings data is currently unavailable.</p>
                         )}
                     </div>
                </div>

                {/* Latest Round Summary Snippet (Right Column / Spans 1) */}
                <div className="bg-white p-4 md:p-6 rounded-lg shadow border border-gray-200">
                     <h2 className="text-xl font-semibold text-gray-700 mb-4">Latest Round Summary</h2>

                     {latestSummary && latestRoundInfo ? (
                        <div className="space-y-3">
                             <h3 className="font-semibold text-indigo-700">{latestSummary.roundName}</h3>
                             <ul className="space-y-1 text-sm">
                                 <li>
                                    <span className="text-gray-600">Exact Scores:</span>
                                    <span className="ml-2 font-bold text-green-700">{latestSummary.roundStats.exactScoresCount}</span>
                                </li>
                                 <li>
                                    <span className="text-gray-600">Successful Jokers:</span>
                                    <span className="ml-2 font-bold text-yellow-700">{latestSummary.roundStats.successfulJokersCount} ★</span>
                                </li>
                                {latestSummary.topScorersThisRound.length > 0 && (
                                     <li>
                                        <span className="text-gray-600">Top Scorer:</span>
                                         <span className="ml-2 font-medium text-gray-800">{latestSummary.topScorersThisRound[0].name} ({latestSummary.topScorersThisRound[0].points} pts)</span>
                                     </li>
                                )}
                             </ul>
                             <div className="pt-2">
                                <Link href={`/rounds/${latestSummary.roundId}/summary`} className="text-sm text-blue-600 hover:underline font-medium">View Full Summary →</Link>
                             </div>
                        </div>
                     ) : latestRoundInfo === null && !isLoadingData ? ( // Explicitly check if fetch completed and found null
                        <p className="text-sm text-gray-500 italic">No rounds have been completed yet.</p>
                     ) : !isLoadingData && pageError?.includes("summary") ? ( // Show summary-specific error if relevant
                         <p className="text-sm text-red-500 italic">Could not load latest summary data.</p>
                     ) : (
                         !isLoadingData && <p className="text-sm text-gray-500 italic">Latest summary is unavailable.</p> // Generic fallback
                     )}
                 </div>

             </div> {/* End Grid */}


             {/* Bottom Links (Admin / Standings) */}
             <div className="mt-8 pt-6 border-t border-gray-200 space-y-4">
                  {/* Admin Area Link (Conditional) */}
                  {user.role === 'ADMIN' && (
                      <div className="p-4 border border-green-300 rounded bg-green-50">
                          <h3 className="font-bold text-green-800 mb-1">Admin Area</h3>
                          <Link href="/admin" className="text-blue-600 hover:text-blue-800 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded text-sm font-medium">
                              Go to Admin Panel →
                          </Link>
                      </div>
                  )}
                  {/* Navigation Links */}
                  {/* Example: Could add quick links here too if desired */}
                  {/* <div className="flex gap-4">
                        <Link href="/predictions" className="text-indigo-600 hover:underline">Make Predictions</Link>
                        <Link href="/standings" className="text-indigo-600 hover:underline">View Standings</Link>
                  </div> */}
            </div>

        </div> // End Container
    );
}