// frontend/src/app/(authenticated)/predictions/page.tsx
'use client';

import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getActiveRound, savePredictions, generateRandomUserPredictions, ActiveRoundResponse, PredictionPayload, ApiError } from '@/lib/api'; // Import necessary functions and types
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
//import CountdownTimer from '@/components/CountdownTimer'; // Assuming you have this component
// Import other necessary components like Spinner, etc.

interface PredictionInput extends PredictionPayload {
    // Helper state to track input values directly, allowing nulls initially
    homeInput: string;
    awayInput: string;
}

export default function PredictionsPage() {
    // --- Authentication and Router Hooks ---
    const { user, token, isLoading: isAuthLoading } = useAuth(); // Get user object including role
    const router = useRouter(); // Get router instance

    // --- Role Check and Redirect Effect ---
    useEffect(() => {
        // Redirect if loading is finished and user is a VISITOR
        if (!isAuthLoading && user && user.role === 'VISITOR') {
            console.log('[PredictionsPage] Visitor detected, redirecting to dashboard.');
            toast.error("Visitors cannot access the predictions page."); // Optional feedback
            router.replace('/dashboard'); // Redirect away
        }
    }, [user, isAuthLoading, router]);

    // State for active round data
    const [activeRound, setActiveRound] = useState<ActiveRoundResponse | null>(null);
    const [predictions, setPredictions] = useState<Map<number, PredictionInput>>(new Map()); // Map fixtureId -> PredictionInput
    const [jokerFixtureId, setJokerFixtureId] = useState<number | null>(null);

    // Loading and Error States
    const [isLoadingRound, setIsLoadingRound] = useState(true);
    const [roundError, setRoundError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    // Fetch Active Round Data
    const fetchRoundData = useCallback(async () => {
        if (!token) return;
        console.log('%c[PredictionsPage] Fetching active round...', 'color: blue');
        setIsLoadingRound(true);
        setRoundError(null);
        try {
            const data = await getActiveRound(token);
            setActiveRound(data);
            if (data) {
                // Initialize predictions state based on fetched data
                const initialPredictions = new Map<number, PredictionInput>();
                let initialJoker: number | null = null;
                data.fixtures.forEach(fixture => {
                    initialPredictions.set(fixture.fixtureId, {
                        fixtureId: fixture.fixtureId,
                        predictedHomeGoals: fixture.predictedHomeGoals,
                        predictedAwayGoals: fixture.predictedAwayGoals,
                        homeInput: fixture.predictedHomeGoals?.toString() ?? '', // Populate input string
                        awayInput: fixture.predictedAwayGoals?.toString() ?? '', // Populate input string
                        isJoker: fixture.isJoker || false,
                    });
                    if (fixture.isJoker) {
                        initialJoker = fixture.fixtureId;
                    }
                });
                setPredictions(initialPredictions);
                setJokerFixtureId(initialJoker);
                 console.log('%c[PredictionsPage] Active round fetched and state initialized.', 'color: green');
            } else {
                 console.log('%c[PredictionsPage] No active round found.', 'color: orange;');
            }
        } catch (err) {
            console.error("[PredictionsPage] Error fetching active round:", err);
            setRoundError(err instanceof Error ? err.message : "Failed to load prediction data.");
            setActiveRound(null);
            setPredictions(new Map());
        } finally {
            setIsLoadingRound(false);
        }
    }, [token]);

    // Fetch data on mount/token change
    useEffect(() => {
        if (token && !isAuthLoading) {
            fetchRoundData();
        } else if (!token && !isAuthLoading) {
            setIsLoadingRound(false);
            setRoundError("Please log in to make predictions.");
        }
    }, [token, isAuthLoading, fetchRoundData]);


    // Handle input changes
    const handleInputChange = (fixtureId: number, team: 'home' | 'away', value: string) => {
        // Allow only non-negative integers or empty string
        const sanitizedValue = value.replace(/[^0-9]/g, '');

        setPredictions(prev => {
            const current = prev.get(fixtureId);
            if (!current) return prev; // Should not happen

            const updatedInput = { ...current };
            let parsedValue: number | null = null;
            if (sanitizedValue !== '') {
                parsedValue = parseInt(sanitizedValue, 10);
                // Optional: Prevent excessively large numbers if desired
                 // if (parsedValue > 99) parsedValue = 99;
            }

            if (team === 'home') {
                updatedInput.homeInput = sanitizedValue;
                updatedInput.predictedHomeGoals = parsedValue;
            } else {
                updatedInput.awayInput = sanitizedValue;
                updatedInput.predictedAwayGoals = parsedValue;
            }
            return new Map(prev).set(fixtureId, updatedInput);
        });
    };

    // Handle Joker selection
    const handleJokerChange = (fixtureId: number) => {
        setPredictions(prev => {
            const newPredictions = new Map(prev);
            // Clear previous joker
            if (jokerFixtureId !== null) {
                const oldJoker = newPredictions.get(jokerFixtureId);
                if (oldJoker) newPredictions.set(jokerFixtureId, { ...oldJoker, isJoker: false });
            }
            // Set new joker
            const newJoker = newPredictions.get(fixtureId);
            if (newJoker) newPredictions.set(fixtureId, { ...newJoker, isJoker: true });

            return newPredictions;
        });
        setJokerFixtureId(fixtureId);
    };

    // Handle Save Predictions
    const handleSave = async (e?: FormEvent) => {
        if (e) e.preventDefault();
        if (!token || isSaving || !activeRound) return;

        setIsSaving(true);
        const toastId = toast.loading("Saving predictions...");

        // Prepare payload - ensure goals are numbers or null
        const payload: PredictionPayload[] = Array.from(predictions.values()).map(p => ({
            fixtureId: p.fixtureId,
            // Ensure null is sent if input is empty, otherwise send the number
            predictedHomeGoals: p.homeInput === '' ? null : p.predictedHomeGoals,
            predictedAwayGoals: p.awayInput === '' ? null : p.predictedAwayGoals,
            isJoker: p.isJoker,
        }));

        console.log("[PredictionsPage] Saving payload:", payload);

        try {
            await savePredictions(payload, token);
            toast.success("Predictions saved successfully!", { id: toastId });
            // Optional: Refetch data to confirm, or assume success
            // fetchRoundData();
        } catch (err) {
            console.error("[PredictionsPage] Error saving predictions:", err);
            const message = err instanceof ApiError ? err.message : (err instanceof Error ? err.message : "Failed to save predictions.");
            toast.error(`Save failed: ${message}`, { id: toastId });
        } finally {
            setIsSaving(false);
        }
    };

     // Handle Generate Random Predictions
     const handleGenerateRandom = async () => {
         if (!token || isGenerating || !activeRound) return;

         setIsGenerating(true);
         const toastId = toast.loading("Generating random predictions...");

         try {
             const result = await generateRandomUserPredictions(token);
             toast.success(`${result.message} (${result.count} predictions generated). Refreshing...`, { id: toastId, duration: 3000 });
             // Refetch data to show the generated predictions
             setTimeout(fetchRoundData, 1000); // Slight delay for user to read toast

         } catch (err) {
             console.error("[PredictionsPage] Error generating random predictions:", err);
             const message = err instanceof ApiError ? err.message : (err instanceof Error ? err.message : "Failed to generate predictions.");
             toast.error(`Generation failed: ${message}`, { id: toastId });
         } finally {
             setIsGenerating(false);
         }
     };


    // --- Render Logic ---
    if (isAuthLoading) {
        return <div className="p-4 md:p-6 text-center">Authenticating...</div>;
    }
     if (isLoadingRound) {
        return <div className="p-4 md:p-6 text-center">Loading prediction round...</div>;
    }
    if (roundError) {
        return <div className="p-4 md:p-6 text-center text-red-600 bg-red-50 rounded border border-red-200">{roundError}</div>;
    }
    if (!activeRound) {
        return <div className="p-4 md:p-6 text-center text-gray-600">There is currently no active round open for predictions.</div>;
    }

    // Check if deadline has passed
    const isDeadlinePassed = new Date(activeRound.deadline) < new Date();

    return (
        <div className="container mx-auto p-4 md:p-6">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
                Make Predictions: <span className="text-indigo-600">{activeRound.name}</span>
            </h1>
            <div className="mb-6 text-sm text-gray-600 flex items-center justify-between flex-wrap gap-2">
                <span>Deadline:</span>
                {/* Assume CountdownTimer component handles formatting and countdown */}
                <span className="font-medium text-red-600">
    {new Date(activeRound.deadline).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
</span>
            </div>

            {isDeadlinePassed && (
                <div className="mb-6 p-3 text-center bg-red-100 border border-red-300 text-red-700 rounded font-medium">
                    The deadline for this round has passed. Predictions are closed.
                </div>
            )}

            <form onSubmit={handleSave}>
                <div className="bg-white p-4 md:p-6 rounded-lg shadow border border-gray-200 space-y-4">

                     {/* Fixture List */}
                     {activeRound.fixtures.map((fixture) => {
                         const currentPrediction = predictions.get(fixture.fixtureId);
                         const isJoker = jokerFixtureId === fixture.fixtureId;

                         return (
                             <div key={fixture.fixtureId} className={`p-3 rounded border ${isJoker ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200'} grid grid-cols-12 gap-2 items-center`}>
                                {/* Joker Radio */}
                                 <div className="col-span-1 flex justify-center">
                                    <input
                                        type="radio"
                                        name="joker"
                                        value={fixture.fixtureId}
                                        checked={isJoker}
                                        onChange={() => handleJokerChange(fixture.fixtureId)}
                                        disabled={isSaving || isGenerating || isDeadlinePassed}
                                        className="form-radio h-5 w-5 text-yellow-500 focus:ring-yellow-400 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                        aria-label={`Set Joker for ${fixture.homeTeam} vs ${fixture.awayTeam}`}
                                     />
                                 </div>
                                {/* Home Team */}
                                <label htmlFor={`home-${fixture.fixtureId}`} className="col-span-4 sm:col-span-3 text-sm sm:text-base font-medium text-right truncate pr-1">{fixture.homeTeam}</label>
                                {/* Home Score */}
                                <div className="col-span-1">
                                    <input
                                        type="text" // Use text to allow empty string, handle parsing
                                        inputMode="numeric" // Hint for mobile keyboards
                                        pattern="[0-9]*" // Pattern for validation (optional)
                                        id={`home-${fixture.fixtureId}`}
                                        value={currentPrediction?.homeInput ?? ''}
                                        onChange={(e) => handleInputChange(fixture.fixtureId, 'home', e.target.value)}
                                        className="w-full px-1 py-1 text-center border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
                                        maxLength={2}
                                        disabled={isSaving || isGenerating || isDeadlinePassed}
                                        aria-label={`Predicted score for ${fixture.homeTeam}`}
                                    />
                                </div>
                                {/* Separator */}
                                <div className="col-span-1 text-center font-semibold">-</div>
                                {/* Away Score */}
                                <div className="col-span-1">
                                     <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        id={`away-${fixture.fixtureId}`}
                                        value={currentPrediction?.awayInput ?? ''}
                                        onChange={(e) => handleInputChange(fixture.fixtureId, 'away', e.target.value)}
                                        className="w-full px-1 py-1 text-center border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
                                        maxLength={2}
                                        disabled={isSaving || isGenerating || isDeadlinePassed}
                                        aria-label={`Predicted score for ${fixture.awayTeam}`}
                                    />
                                </div>
                                {/* Away Team */}
                                <label htmlFor={`away-${fixture.fixtureId}`} className="col-span-4 sm:col-span-3 text-sm sm:text-base font-medium text-left truncate pl-1">{fixture.awayTeam}</label>
                                 {/* Match Time (optional display) */}
                                 <div className="col-span-12 sm:col-span-2 text-xs text-gray-500 text-center sm:text-right pt-1 sm:pt-0">
                                     {new Date(fixture.matchTime).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                                 </div>
                            </div>
                         );
                     })}

                     {/* Actions Area */}
                     <div className="pt-4 flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-gray-200">
                         {/* Generate Random Button */}
                         <button
                            type="button"
                            onClick={handleGenerateRandom}
                            disabled={isSaving || isGenerating || isDeadlinePassed}
                            className="px-4 py-2 border border-gray-400 text-gray-700 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition duration-150 ease-in-out text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                             {isGenerating ? 'Generating...' : 'Generate Random'}
                         </button>

                        {/* Save Button */}
                         <button
                             type="submit"
                             disabled={isSaving || isGenerating || isDeadlinePassed}
                             className="px-6 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                             {isSaving ? 'Saving...' : 'Save Predictions'}
                         </button>
                     </div>

                </div>
            </form>
        </div>
    );
}