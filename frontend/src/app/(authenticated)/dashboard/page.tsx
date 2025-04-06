// frontend/src/app/(mainApp)/dashboard/page.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'react-hot-toast'; // <<< Import toast

// Import AuthContext hook
import { useAuth } from '@/context/AuthContext';

// Import updated API functions and types from api.ts
import {
    getActiveRound,
    savePredictions,
    generateRandomUserPredictions, // <<< Import new function
    ActiveRoundResponse,
    FixtureWithPrediction
} from '@/lib/api';

// Local type for prediction input state
interface PredictionInputState {
    home: number | null;
    away: number | null;
    // is_joker?: boolean; // Add later if needed
}

export default function DashboardPage() {
    const router = useRouter();
    // Use AuthContext for user info, token, loading state, and logout
    const { user, token, isLoading: isAuthLoading, logout } = useAuth();

    // State for Active Round - Use imported type
    const [activeRoundData, setActiveRoundData] = useState<ActiveRoundResponse | null>(null);
    const [isRoundLoading, setIsRoundLoading] = useState(true);
    const [roundError, setRoundError] = useState<string | null>(null);

    // State for User Predictions Input - keyed by fixtureId
    const [predictions, setPredictions] = useState<Record<number, PredictionInputState>>({});

    // State for Submission Process
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitSuccessMessage, setSubmitSuccessMessage] = useState<string | null>(null);

    // --- NEW: State for Generate Random Process ---
    const [isGeneratingRandom, setIsGeneratingRandom] = useState(false);

    // State for Deadline Check
    const [isDeadlinePassed, setIsDeadlinePassed] = useState(false);

    // Effect for Deadline Check
    useEffect(() => {
        let timerId: NodeJS.Timeout | null = null;
        if (activeRoundData?.deadline) {
            const checkDeadline = () => {
                try {
                    const deadlineDate = new Date(activeRoundData.deadline);
                    const now = new Date();
                    const passed = now >= deadlineDate; // Use >= for inclusivity
                    setIsDeadlinePassed(passed);
                    return passed;
                } catch (e) {
                    console.error("Error parsing deadline date:", activeRoundData.deadline, e);
                    setIsDeadlinePassed(false); // Assume not passed if date is invalid
                    return false;
                }
            };

            const passed = checkDeadline(); // Initial check

            if (!passed) {
                timerId = setInterval(() => {
                    const stillPassed = checkDeadline();
                    if (stillPassed && timerId) {
                        clearInterval(timerId);
                    }
                }, 30000); // Check every 30 seconds
            }
        } else {
            setIsDeadlinePassed(false); // No deadline, so not passed
        }
        // Cleanup timer
        return () => {
            if (timerId) {
                clearInterval(timerId);
            }
        };
    }, [activeRoundData?.deadline]);

    // Effect for Fetching Active Round Data
    const fetchRoundData = useCallback(async () => {
        if (!token) {
            setIsRoundLoading(false);
            setActiveRoundData(null);
            setRoundError(null);
            return;
        }

        setIsRoundLoading(true);
        setRoundError(null);
        setActiveRoundData(null);
        setSubmitError(null);
        setSubmitSuccessMessage(null);

        try {
            const data = await getActiveRound(token);
            setActiveRoundData(data);
        } catch (error: unknown) {
            console.error("Round Fetch Effect: Failed to fetch active round:", error);
            const message = (error instanceof Error) ? error.message : "Could not load the active prediction round.";
            setRoundError(message);
            setActiveRoundData(null);
        } finally {
            setIsRoundLoading(false);
        }
    }, [token]);

    // Run fetchRoundData when token becomes available or changes
    useEffect(() => {
        if (!isAuthLoading) {
             fetchRoundData();
        }
    }, [isAuthLoading, fetchRoundData]);


    // Effect: Initialize prediction input state AFTER round data is loaded/updated
    useEffect(() => {
        if (activeRoundData?.fixtures) {
            const initialPredictions: Record<number, PredictionInputState> = {};
            activeRoundData.fixtures.forEach((fixture: FixtureWithPrediction) => {
                initialPredictions[fixture.fixtureId] = {
                    home: fixture.predictedHomeGoals ?? null,
                    away: fixture.predictedAwayGoals ?? null,
                };
            });
            setPredictions(initialPredictions);
             // Clear messages on data load/refresh
            setSubmitError(null);
            setSubmitSuccessMessage(null);
        } else {
            setPredictions({});
        }
    }, [activeRoundData]);

    // Handler for the logout button
    const handleLogout = () => {
        console.log("Logging out user...");
        logout();
        router.push('/login');
    };

    // Handler for Prediction Input Changes
    const handlePredictionChange = (fixtureId: number, scoreType: 'home' | 'away', value: string) => {
        const score = value === '' ? null : parseInt(value, 10);
        const finalScore = (score === null || isNaN(score) || score < 0) ? null : score;
        setSubmitError(null);
        setSubmitSuccessMessage(null);
        setPredictions(prevPredictions => {
            const currentPrediction = prevPredictions[fixtureId] ?? { home: null, away: null };
            return { ...prevPredictions, [fixtureId]: { ...currentPrediction, [scoreType]: finalScore } };
        });
    };

    // Handler for Submitting Predictions
    const handleSubmitPredictions = async () => {
        if (!activeRoundData?.fixtures?.length) { setSubmitError("No active round or fixtures to submit."); return; }
        if (isDeadlinePassed) { setSubmitError("The deadline for this round has passed. Predictions are locked."); return; }
        if (!token) { setSubmitError("Authentication token not found. Please log in again."); return; }

        setIsSubmitting(true); setSubmitError(null); setSubmitSuccessMessage(null);

        const activeFixtureIds = new Set(activeRoundData.fixtures.map(f => f.fixtureId));

        const predictionsToSubmit = Object.entries(predictions)
            .map(([fixtureIdStr, scores]) => {
                const fixtureId = parseInt(fixtureIdStr, 10);
                if (activeFixtureIds.has(fixtureId) &&
                    typeof scores.home === 'number' && scores.home >= 0 &&
                    typeof scores.away === 'number' && scores.away >= 0)
                {
                    return {
                        fixtureId: fixtureId,
                        predictedHomeGoals: scores.home,
                        predictedAwayGoals: scores.away,
                    };
                }
                return null;
            })
            .filter((p): p is { fixtureId: number; predictedHomeGoals: number; predictedAwayGoals: number; } => p !== null); // Type guard filter

        if (predictionsToSubmit.length === 0) { // Check length after filter
            setSubmitError("Please enter valid scores (0 or greater) for at least one fixture.");
            setIsSubmitting(false);
            return;
        }

        try {
            await savePredictions(predictionsToSubmit, token);
            setSubmitSuccessMessage("Predictions saved successfully!");
            // No automatic refetch here, success message is shown
        } catch (error: unknown) {
            console.error("Failed to submit predictions:", error);
            const errorMessage = (error instanceof Error) ? error.message : "An error occurred while saving predictions.";
            setSubmitError(errorMessage);
            toast.error(`Save failed: ${errorMessage}`); // Add toast for save error
        } finally {
            setIsSubmitting(false);
        }
    };


    // --- NEW: Handler for Generating Random Predictions ---
    const handleGenerateRandom = async () => {
        if (!activeRoundData?.fixtures?.length) { toast.error("No active round or fixtures found."); return; }
        if (isDeadlinePassed) { toast.error("The deadline has passed, cannot generate predictions."); return; }
        if (!token) { toast.error("Authentication token not found."); return; }
        // Prevent concurrent actions
        if (isGeneratingRandom || isSubmitting) return;

        setIsGeneratingRandom(true);
        setSubmitError(null); // Clear other messages
        setSubmitSuccessMessage(null);

        try {
            const result = await generateRandomUserPredictions(token);
            toast.success(result.message || `Generated random predictions for ${result.count} fixtures.`);
            // Refresh the round data to show the new predictions in the input fields
            await fetchRoundData();
        } catch (error: unknown) {
             console.error("Failed to generate random predictions:", error);
             const errorMessage = (error instanceof Error) ? error.message : "An error occurred while generating predictions.";
             toast.error(`Failed to generate random predictions: ${errorMessage}`);
        } finally {
            setIsGeneratingRandom(false);
        }
    };
    // --- End New Handler ---


    // Helper Function for Date Formatting
    const formatDateTime = (isoString: string | null | undefined): string => {
        if (!isoString) return "Date unavailable";
        try {
            return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(new Date(isoString));
        } catch (e) {
            console.error("Error formatting date:", isoString, e);
            return "Invalid Date";
        }
    };

    // --- Conditional Rendering: Loading States ---
    if (isAuthLoading) {
        return ( <div className="flex justify-center items-center min-h-screen bg-gray-100"><p className="text-lg font-semibold text-gray-600">Authenticating...</p></div> );
    }
    if (!user || !token) {
         console.warn("Dashboard rendering without user/token after auth check.");
         // Assuming AuthProvider handles actual redirect, show message if somehow stuck here
         return ( <div className="flex justify-center items-center min-h-screen bg-gray-100"><p className="text-red-600">User not authenticated. Redirecting...</p></div> );
    }

    // Determine if any action is running
    const isActionRunning = isSubmitting || isGeneratingRandom;

    // --- Main Dashboard Render ---
    return (
        <div className="min-h-screen bg-gray-100 p-4 md:p-8">
            <div className="max-w-5xl mx-auto bg-white p-4 sm:p-6 rounded-lg shadow-lg">

                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 pb-4 border-b border-gray-200">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2 sm:mb-0">
                        Welcome, {user.name}!
                    </h1>
                    <button type="button" onClick={handleLogout} className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 transition duration-150 ease-in-out w-full sm:w-auto">
                        Logout
                    </button>
                </div>

                {/* Active Prediction Round Area */}
                <div className="mt-6">
                    <h2 className="text-xl md:text-2xl font-semibold text-gray-700 mb-4">Active Prediction Round</h2>
                    {isRoundLoading && <div className="text-center p-4"><p className="text-lg font-semibold text-gray-600">Loading active round...</p></div>}
                    {roundError && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert"><strong className="font-bold">Error! </strong><span className="block sm:inline">{roundError}</span></div>}
                    {!isRoundLoading && !roundError && !activeRoundData && <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded mb-4" role="alert"><p className="font-medium">No active prediction round found.</p></div>}

                    {/* Display round details and fixtures if loaded */}
                    {!isRoundLoading && !roundError && activeRoundData && (
                        <div className="border border-gray-200 rounded-lg shadow-sm p-4 md:p-6 bg-gradient-to-r from-blue-50 to-indigo-50">
                            <div className="mb-5">
                                <h3 className="text-xl lg:text-2xl font-bold text-indigo-800 mb-1">{activeRoundData.name}</h3>
                                <p className={`text-sm ${isDeadlinePassed ? 'text-red-700 font-semibold' : 'text-gray-600'}`}>
                                    Prediction Deadline: <strong className={isDeadlinePassed ? '' : 'text-red-600'}>{formatDateTime(activeRoundData.deadline)}</strong>
                                    {isDeadlinePassed ? <span className="italic text-xs block sm:inline sm:ml-2">(Deadline Passed - Predictions Locked)</span> : <span className="italic text-xs block sm:inline sm:ml-2">(Predictions lock at this time)</span>}
                                </p>
                            </div>
                            <h4 className="text-lg font-semibold text-gray-700 mb-3 border-t pt-4">Fixtures:</h4>
                            {activeRoundData.fixtures.length > 0 ? (
                                <ul className="space-y-4">
                                    {activeRoundData.fixtures.map((fixture) => {
                                        const currentPrediction = predictions[fixture.fixtureId] ?? { home: null, away: null };
                                        return (
                                            <li key={fixture.fixtureId} className="p-3 bg-white rounded-md border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-4">
                                                <div className="flex-grow mb-2 md:mb-0 text-sm md:text-base">
                                                    <span className="font-semibold text-gray-800">{fixture.homeTeam}</span> <span className="mx-2 text-gray-400">vs</span> <span className="font-semibold text-gray-800">{fixture.awayTeam}</span>
                                                    <span className="block md:inline text-xs text-gray-500 md:ml-3">({formatDateTime(fixture.matchTime)})</span>
                                                </div>
                                                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                                                    <input type="number" min="0" placeholder="H" aria-label={`Home score prediction for ${fixture.homeTeam}`} className={`w-12 px-2 py-1 border border-gray-300 rounded text-center focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 ${isDeadlinePassed ? 'bg-gray-200 cursor-not-allowed' : ''}`} disabled={isDeadlinePassed || isActionRunning} value={currentPrediction.home ?? ''} onChange={(e) => handlePredictionChange(fixture.fixtureId, 'home', e.target.value)} />
                                                    <span className="text-gray-400">-</span>
                                                    <input type="number" min="0" placeholder="A" aria-label={`Away score prediction for ${fixture.awayTeam}`} className={`w-12 px-2 py-1 border border-gray-300 rounded text-center focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 ${isDeadlinePassed ? 'bg-gray-200 cursor-not-allowed' : ''}`} disabled={isDeadlinePassed || isActionRunning} value={currentPrediction.away ?? ''} onChange={(e) => handlePredictionChange(fixture.fixtureId, 'away', e.target.value)} />
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : (<p className="text-gray-500 italic px-3">No fixtures have been added to this round yet.</p>)}

                            {/* Submission button area */}
                            {activeRoundData.fixtures.length > 0 && (
                                <div className="mt-6 border-t pt-4 space-y-3">
                                    {submitSuccessMessage && (<div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative" role="alert"><span className="block sm:inline">{submitSuccessMessage}</span></div>)}
                                    {submitError && (<div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert"><strong className="font-bold">Error! </strong><span className="block sm:inline">{submitError}</span></div>)}
                                    <div className="flex flex-col sm:flex-row justify-end items-center gap-3">
                                         {/* Generate Random Button */}
                                         <button
                                             type="button"
                                             onClick={handleGenerateRandom}
                                             className={`bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-opacity-50 transition duration-150 ease-in-out text-sm ${isActionRunning || isDeadlinePassed ? 'opacity-50 cursor-not-allowed' : ''}`}
                                             disabled={isActionRunning || isDeadlinePassed}
                                             title="Fill all predictions with random scores (0-4)"
                                         >
                                             {isGeneratingRandom ? 'Generating...' : 'Generate Random'}
                                         </button>

                                         {/* Save Predictions Button */}
                                         <button
                                             type="button"
                                             onClick={handleSubmitPredictions}
                                             className={`bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 transition duration-150 ease-in-out ${isActionRunning || isDeadlinePassed ? 'opacity-50 cursor-not-allowed' : ''}`}
                                             disabled={isActionRunning || isDeadlinePassed}
                                          >
                                             {isSubmitting ? 'Saving...' : (isDeadlinePassed ? 'Deadline Passed' : 'Save Predictions')}
                                         </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div> {/* End Active Prediction Round Area */}

                {/* Admin Area (Conditional Link) */}
                {user.role === 'ADMIN' && (
                    <div className="mt-8 p-4 border border-green-300 rounded bg-green-50">
                        <h3 className="font-bold text-green-800 mb-1">Admin Area</h3>
                        <Link
                             href="/admin"
                             className="text-blue-600 hover:text-blue-800 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded text-sm font-medium"
                         >
                            Go to Admin Panel →
                        </Link>
                    </div>
                )}

                {/* League Standings Link */}
                <div className="mt-4 p-4 border border-gray-200 rounded bg-gray-50">
                    <h3 className="font-semibold text-gray-800 mb-1">League Standings</h3>
                    <Link href="/standings" className="text-blue-600 hover:text-blue-800 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded text-sm">
                        View Completed Round Standings →
                    </Link>
                </div>

            </div> {/* End max-w container */}
        </div> // End main div
    );
}