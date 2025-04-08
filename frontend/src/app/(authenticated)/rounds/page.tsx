// frontend/src/app/(authenticated)/predictions/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation'; // Might need for redirects?
import { toast } from 'react-hot-toast';
import { formatDateTime } from '@/utils/formatters';
import { useAuth } from '@/context/AuthContext';
import {
    getActiveRound,
    savePredictions,
    generateRandomUserPredictions,
    ActiveRoundResponse,
    FixtureWithPrediction,
    PredictionPayload,
} from '@/lib/api';

// Local state type for prediction inputs
interface PredictionInputState {
    home: number | null;
    away: number | null;
}

export default function PredictionsPage() {
    const { user, token, isLoading: isAuthLoading } = useAuth();
    const router = useRouter(); // Initialize router if needed

    // State specific to this page
    const [activeRoundData, setActiveRoundData] = useState<ActiveRoundResponse | null>(null);
    const [isRoundLoading, setIsRoundLoading] = useState(true);
    const [roundError, setRoundError] = useState<string | null>(null);
    const [predictions, setPredictions] = useState<Record<number, PredictionInputState>>({});
    const [jokerFixtureId, setJokerFixtureId] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitSuccessMessage, setSubmitSuccessMessage] = useState<string | null>(null);
    const [isGeneratingRandom, setIsGeneratingRandom] = useState(false);
    const [isDeadlinePassed, setIsDeadlinePassed] = useState(false);
    const isActionRunning = isSubmitting || isGeneratingRandom;

    // --- Effects (Deadline Check, Fetching Data, Initializing State) ---

    // Fetch Active Round Data (Specific to this page now)
    const fetchRoundData = useCallback(async () => {
        if (!token) {
            setIsRoundLoading(false);
            setActiveRoundData(null);
            setRoundError("Authentication required.");
            setJokerFixtureId(null);
            return;
        }
        // Redirect if user is ADMIN (they shouldn't be submitting)
         if (user?.role === 'ADMIN') {
             toast.error("Admins cannot access the prediction submission page.");
             router.replace('/admin'); // Redirect to admin dashboard
             return;
         }

        setIsRoundLoading(true); setRoundError(null); setActiveRoundData(null);
        setSubmitError(null); setSubmitSuccessMessage(null); setJokerFixtureId(null);

        try {
            const data = await getActiveRound(token);
            setActiveRoundData(data);
        } catch (error: unknown) {
            console.error("Prediction Page: Failed to fetch active round:", error);
            const message = (error instanceof Error) ? error.message : "Could not load the active prediction round.";
            setRoundError(message); setActiveRoundData(null);
        } finally {
            setIsRoundLoading(false);
        }
    }, [token, user, router]); // Add user and router dependencies

    // Run fetchRoundData when token/auth state changes
    useEffect(() => {
        if (!isAuthLoading) {
             fetchRoundData();
        }
    }, [isAuthLoading, fetchRoundData]); // fetchRoundData includes token/user

    // Effect to initialize prediction state AND joker state from fetched data
    useEffect(() => {
        if (activeRoundData?.fixtures) {
            const initialPredictions: Record<number, PredictionInputState> = {};
            let initialJokerId: number | null = null;
            activeRoundData.fixtures.forEach((fixture: FixtureWithPrediction) => {
                initialPredictions[fixture.fixtureId] = { home: fixture.predictedHomeGoals ?? null, away: fixture.predictedAwayGoals ?? null };
                if (fixture.isJoker === true) initialJokerId = fixture.fixtureId;
            });
            setPredictions(initialPredictions); setJokerFixtureId(initialJokerId);
            setSubmitError(null); setSubmitSuccessMessage(null);
        } else {
            setPredictions({}); setJokerFixtureId(null);
        }
    }, [activeRoundData]);

    // Deadline Check Effect (Copied from dashboard)
    useEffect(() => {
        let timerId: NodeJS.Timeout | null = null;
        if (activeRoundData?.deadline) {
            const checkDeadline = () => {
                try {
                    const deadlineDate = new Date(activeRoundData.deadline);
                    const now = new Date();
                    const passed = now >= deadlineDate; setIsDeadlinePassed(passed); return passed;
                } catch (e) { console.error("Error parsing deadline:", e); setIsDeadlinePassed(false); return false; }
            };
            const passed = checkDeadline();
            if (!passed) { timerId = setInterval(() => { if (checkDeadline() && timerId) clearInterval(timerId); }, 30000); }
        } else { setIsDeadlinePassed(false); }
        return () => { if (timerId) clearInterval(timerId); };
    }, [activeRoundData?.deadline]);


    // --- Event Handlers (Copied/Adapted from dashboard) ---

    const handlePredictionChange = (fixtureId: number, scoreType: 'home' | 'away', value: string) => {
        const score = value === '' ? null : parseInt(value, 10);
        const finalScore = (score === null || isNaN(score) || score < 0) ? null : score;
        setSubmitError(null); setSubmitSuccessMessage(null);
        setPredictions(prev => ({ ...prev, [fixtureId]: { ...(prev[fixtureId] ?? { home: null, away: null }), [scoreType]: finalScore } }));
    };

    const handleSetJoker = (fixtureId: number) => {
        if (isDeadlinePassed || isActionRunning) return;
        setSubmitError(null); setSubmitSuccessMessage(null);
        setJokerFixtureId(prev => prev === fixtureId ? null : fixtureId);
    };

    const handleSubmitPredictions = async () => {
        if (!activeRoundData?.fixtures?.length || isDeadlinePassed || !token || isSubmitting) return;
        setIsSubmitting(true); setSubmitError(null); setSubmitSuccessMessage(null);
        const activeFixtureIds = new Set(activeRoundData.fixtures.map(f => f.fixtureId));
        type NonNullMappedPrediction = { fixtureId: number; predictedHomeGoals: number; predictedAwayGoals: number; isJoker: boolean; };
        const mappedOrNull: (NonNullMappedPrediction | null)[] = Object.entries(predictions)
            .map(([fixtureIdStr, scores]) => {
                const fixtureId = parseInt(fixtureIdStr, 10);
                if (activeFixtureIds.has(fixtureId) && typeof scores.home === 'number' && scores.home >= 0 && typeof scores.away === 'number' && scores.away >= 0) {
                    return { fixtureId, predictedHomeGoals: scores.home, predictedAwayGoals: scores.away, isJoker: fixtureId === jokerFixtureId };
                } return null;
            });
        const predictionsToSubmit: PredictionPayload[] = mappedOrNull.filter((p): p is NonNullMappedPrediction => p !== null);
        try {
            await savePredictions(predictionsToSubmit, token);
            setSubmitSuccessMessage("Predictions saved successfully!"); toast.success("Predictions saved!");
            // Optionally refetch to confirm, but message should suffice
            // await fetchRoundData();
        } catch (error: unknown) {
            console.error("Failed to submit predictions:", error);
            const errorMessage = (error instanceof Error) ? error.message : "An error occurred while saving predictions.";
            setSubmitError(errorMessage); toast.error(`Save failed: ${errorMessage}`);
        } finally { setIsSubmitting(false); }
    };

    const handleGenerateRandom = async () => {
        if (!activeRoundData?.fixtures?.length || isDeadlinePassed || !token || isActionRunning) return;
        const confirmRandom = window.confirm("Overwrite current predictions with random scores (0-4) and clear Joker?");
        if (!confirmRandom) return;
        setIsGeneratingRandom(true); setSubmitError(null); setSubmitSuccessMessage(null); setJokerFixtureId(null);
        try {
            const result = await generateRandomUserPredictions(token);
            toast.success(result.message || `Generated predictions for ${result.count} fixtures.`);
            await fetchRoundData(); // Refresh data to show random scores & clear joker visually
        } catch (error: unknown) {
             console.error("Failed to generate random predictions:", error);
             const errorMessage = (error instanceof Error) ? error.message : "An error occurred generating predictions.";
             toast.error(`Failed to generate: ${errorMessage}`);
             await fetchRoundData(); // Refetch even on error
        } finally { setIsGeneratingRandom(false); }
    };


    // --- Render Logic ---

    if (isAuthLoading || isRoundLoading) { // Show loading while auth or round data loads
        return <div className="p-4 md:p-6 text-center">Loading Predictions...</div>;
    }

     // If not loading, but user is somehow still null/no token (shouldn't happen if protect works)
     if (!user || !token) {
          return <div className="p-4 md:p-6 text-center text-red-600">Authentication error. Please log in again.</div>;
     }

     // If user is Admin (should have been redirected, but show message if somehow here)
     if (user.role === 'ADMIN') {
         return <div className="p-4 md:p-6 text-center text-orange-600">Admins cannot submit predictions. Please use the Admin panel.</div>;
     }

    // Handle round fetching errors
    if (roundError) {
        return <div className="p-4 md:p-6 text-center text-red-600 bg-red-100 rounded">Error: {roundError}</div>;
    }

    // Handle no active round found
    if (!activeRoundData) {
        return <div className="p-4 md:p-6 text-center text-gray-600 bg-yellow-100 rounded">No active prediction round found. Check back later!</div>;
    }

    // Main Page Content (Prediction Form)
    return (
        <div className="container mx-auto p-4 md:p-6">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">Submit Predictions</h1>

            {/* Display round details and fixtures */}
            <div className="border border-gray-200 rounded-lg shadow-sm p-4 md:p-6 bg-gradient-to-r from-blue-50 to-indigo-50">
                {/* Round Title and Deadline */}
                <div className="mb-5">
                    <h3 className="text-xl lg:text-2xl font-bold text-indigo-800 mb-1">{activeRoundData.name}</h3>
                    <p className={`text-sm ${isDeadlinePassed ? 'text-red-700 font-semibold' : 'text-gray-600'}`}>
                        Prediction Deadline: <strong className={isDeadlinePassed ? '' : 'text-red-600'}>{formatDateTime(activeRoundData.deadline)}</strong>
                        {isDeadlinePassed ? <span className="italic text-xs block sm:inline sm:ml-2">(Deadline Passed - Predictions Locked)</span> : <span className="italic text-xs block sm:inline sm:ml-2">(Predictions lock at this time)</span>}
                    </p>
                </div>

                {/* Fixtures List and Form */}
                <h4 className="text-lg font-semibold text-gray-700 mb-3 border-t pt-4">Enter Your Predictions:</h4>
                {activeRoundData.fixtures.length > 0 ? (
                    <ul className="space-y-4">
                        {/* Fixture Row Mapping */}
                        {activeRoundData.fixtures.map((fixture) => {
                            const currentPrediction = predictions[fixture.fixtureId] ?? { home: null, away: null };
                            const isCurrentJoker = fixture.fixtureId === jokerFixtureId;
                            return (
                                <li key={fixture.fixtureId} className={`p-3 bg-white rounded-md border ${isCurrentJoker ? 'border-yellow-400 ring-2 ring-yellow-300' : 'border-gray-200'} shadow-sm grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 md:gap-4 items-center`}>
                                    {/* Info */}
                                    <div className="flex-grow text-sm md:text-base">
                                        <span className="font-semibold text-gray-800">{fixture.homeTeam}</span> <span className="mx-2 text-gray-400">vs</span> <span className="font-semibold text-gray-800">{fixture.awayTeam}</span>
                                        <span className="block md:inline text-xs text-gray-500 md:ml-3">({formatDateTime(fixture.matchTime)})</span>
                                    </div>
                                    {/* Inputs */}
                                    <div className="flex items-center gap-2 w-full md:w-auto justify-start md:justify-end">
                                        <input type="number" min="0" placeholder="H" aria-label={`Home score prediction for ${fixture.homeTeam}`} className={`w-12 px-2 py-1 border border-gray-300 rounded text-center focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 ${isDeadlinePassed ? 'bg-gray-200 cursor-not-allowed' : ''}`} disabled={isDeadlinePassed || isActionRunning} value={currentPrediction.home ?? ''} onChange={(e) => handlePredictionChange(fixture.fixtureId, 'home', e.target.value)} />
                                        <span className="text-gray-400">-</span>
                                        <input type="number" min="0" placeholder="A" aria-label={`Away score prediction for ${fixture.awayTeam}`} className={`w-12 px-2 py-1 border border-gray-300 rounded text-center focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 ${isDeadlinePassed ? 'bg-gray-200 cursor-not-allowed' : ''}`} disabled={isDeadlinePassed || isActionRunning} value={currentPrediction.away ?? ''} onChange={(e) => handlePredictionChange(fixture.fixtureId, 'away', e.target.value)} />
                                    </div>
                                    {/* Joker */}
                                    <div className="w-full md:w-auto flex justify-end">
                                        <button type="button" onClick={() => handleSetJoker(fixture.fixtureId)} disabled={isDeadlinePassed || isActionRunning} title={isCurrentJoker ? "Clear Joker for this match" : "Set this match as Joker (double points if correct)"} className={`px-3 py-1 rounded text-xs font-medium transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-opacity-50 ${ isCurrentJoker ? 'bg-yellow-400 hover:bg-yellow-500 text-yellow-900 focus:ring-yellow-400' : 'bg-gray-200 hover:bg-gray-300 text-gray-700 focus:ring-gray-400' } ${isDeadlinePassed || isActionRunning ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                            {isCurrentJoker ? '★ Joker Active' : 'Set Joker'}
                                        </button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                ) : (<p className="text-gray-500 italic px-3">No fixtures have been added to this round yet.</p>)}

                {/* Submission button area (only shown if fixtures exist) */}
                {activeRoundData.fixtures.length > 0 && (
                    <div className="mt-6 border-t pt-4 space-y-3">
                        {/* Messages */}
                        {submitSuccessMessage && (<div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative" role="alert"><span className="block sm:inline">{submitSuccessMessage}</span></div>)}
                        {submitError && (<div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert"><strong className="font-bold">Error! </strong><span className="block sm:inline">{submitError}</span></div>)}
                        {/* Buttons */}
                        <div className="flex flex-col sm:flex-row justify-end items-center gap-3">
                            <button type="button" onClick={handleGenerateRandom} className={`bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-opacity-50 transition duration-150 ease-in-out text-sm ${isActionRunning || isDeadlinePassed ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={isActionRunning || isDeadlinePassed} title="Fill all predictions with random scores (0-4)">
                                {isGeneratingRandom ? 'Generating...' : 'Generate Random'}
                            </button>
                            <button type="button" onClick={handleSubmitPredictions} className={`bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 transition duration-150 ease-in-out ${isActionRunning || isDeadlinePassed ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={isActionRunning || isDeadlinePassed}>
                                {isSubmitting ? 'Saving...' : (isDeadlinePassed ? 'Deadline Passed' : 'Save Predictions')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div> // End Container
    );
}