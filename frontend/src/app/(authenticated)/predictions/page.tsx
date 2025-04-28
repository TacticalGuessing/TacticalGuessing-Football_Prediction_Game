// frontend/src/app/(authenticated)/predictions/page.tsx
'use client';

import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getActiveRound, savePredictions, generateRandomUserPredictions, ActiveRoundResponse, PredictionPayload, ApiError } from '@/lib/api'; // Import necessary functions and types
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { formatDateTime } from '@/utils/formatters';
import Image from 'next/image';
import { Button } from '@/components/Button';
import { FaClipboardList, FaSave } from 'react-icons/fa';
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

    // --- Consistent Input Styling ---
    const scoreInputClasses = "block w-full px-1 py-1 text-center border border-gray-600 rounded-md shadow-sm bg-gray-700 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-offset-0 focus:ring-accent focus:border-accent disabled:opacity-50 disabled:bg-gray-600 disabled:cursor-not-allowed sm:text-sm";
    //const jokerRadioClasses = "h-5 w-5 text-accent bg-gray-600 border-gray-500 focus:ring-accent focus:ring-offset-gray-800 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50";
    // --- End Input Styling ---

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


    // Loading and Error States
    const [isLoadingRound, setIsLoadingRound] = useState(true);
    const [roundError, setRoundError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    const currentJokerCount = Array.from(predictions.values()).filter(p => p.isJoker).length;


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

                data.fixtures.forEach(fixture => {
                    initialPredictions.set(fixture.fixtureId, {
                        fixtureId: fixture.fixtureId,
                        predictedHomeGoals: fixture.predictedHomeGoals,
                        predictedAwayGoals: fixture.predictedAwayGoals,
                        homeInput: fixture.predictedHomeGoals?.toString() ?? '', // Populate input string
                        awayInput: fixture.predictedAwayGoals?.toString() ?? '', // Populate input string
                        isJoker: fixture.isJoker || false,
                    });

                });
                setPredictions(initialPredictions);

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
        const currentPrediction = predictions.get(fixtureId);
        if (!currentPrediction || !activeRound) return; // Safety checks

        const isCurrentlyJoker = currentPrediction.isJoker;
        const limit = activeRound.jokerLimit;

        // Check limit ONLY if trying to ADD a new joker
        if (!isCurrentlyJoker && currentJokerCount >= limit) {
            toast.error(`Joker limit reached (${limit} allowed).`);
            return; // Prevent selection
        }

        setPredictions(prev => {
            const newPredictions = new Map(prev);
            const predictionToUpdate = newPredictions.get(fixtureId);
            if (predictionToUpdate) {
                // Toggle the joker status for the clicked fixture
                newPredictions.set(fixtureId, { ...predictionToUpdate, isJoker: !isCurrentlyJoker });
            }
            // Remove logic that clears the previous single jokerFixtureId
            return newPredictions;
        });
        // Remove setJokerFixtureId(fixtureId);
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
        return <div className="p-6 text-center text-gray-400">Authenticating...</div>;
    }
    if (isLoadingRound) {
        return <div className="p-6 text-center text-gray-400">Loading prediction round...</div>;
    }
    if (roundError) {
        return <div role="alert" className="p-4 md:p-6 text-center text-red-300 bg-red-900/30 border border-red-700/50 rounded">{roundError}</div>;
    }
    if (!activeRound) {
        return <div className="p-4 md:p-6 text-center text-gray-400">There is currently no active round open for predictions.</div>;
    }

    // Check if deadline has passed
    const isDeadlinePassed = new Date(activeRound.deadline) < new Date();

    // --- ADD THIS LINE ---
    // Determine combined disabled state for inputs/buttons
    const isSubmitDisabled = isSaving || isGenerating || isDeadlinePassed;
    const jokerLimitReached = currentJokerCount >= activeRound.jokerLimit;
    // --- END ADDED LINE ---

    return (
        <div className="container mx-auto p-4 md:p-4">
            <h1 className="text-xl md:text-2xl font-bold text-gray-100 mb-4 flex items-center"> {/* Added flex, reduced mb */}
                <FaClipboardList className="mr-3 text-blue-400" /> {/* Added Icon */}
                Predictions: <span className="text-accent ml-2">{activeRound.name}</span> {/* Added ml-2 */}
            </h1>
            {/* === MODIFIED Top Info Box === */}
            <div className={`mb-6 rounded-lg p-4 border ${isDeadlinePassed ? 'bg-red-900/20 border-red-700/50 text-red-300' : 'bg-gray-800/60 border-gray-700/80 text-gray-300'} flex flex-wrap items-center justify-between gap-4`}> {/* Added flex, justify-between, items-center, gap-4 */}
                {/* Left Side Info */}
                <div className="space-y-1"> {/* Group deadline and joker info */}
                    {/* Deadline Info */}
                    <div className="flex items-baseline flex-wrap gap-x-2">
                        <span className="text-sm font-medium">Prediction Deadline:</span>
                        <span className={`font-semibold text-sm ${isDeadlinePassed ? 'text-red-300' : 'text-accent'}`}>
                            {formatDateTime(activeRound.deadline)}
                        </span>
                    </div>
                    {/* Joker Limit Display */}
                    <div className="text-sm">
                        <span>Jokers Used: </span>
                        <span className={`font-semibold ${jokerLimitReached ? 'text-red-400' : 'text-gray-100'}`}>
                            {currentJokerCount} / {activeRound.jokerLimit}
                        </span>
                    </div>
                    {/* Deadline Passed Message (Optional: could be shown more prominently) */}
                    {isDeadlinePassed && (
                        <p className="mt-1 text-xs text-red-300 font-semibold italic">
                            Predictions are now closed.
                        </p>
                    )}
                </div>

                {/* Right Side Buttons */}
                <div className="flex items-center gap-2 flex-shrink-0"> {/* Add flex-shrink-0 */}
                    {/* Generate Random Button */}
                    <Button
                        type="button" // Still type="button" as it doesn't submit the form
                        variant="primary" // Changed variant to differentiate maybe?
                        size="sm"
                        onClick={handleGenerateRandom}
                        disabled={isSubmitDisabled || isGenerating}
                        isLoading={isGenerating}
                        className="p-2" // Keep icon-like padding
                        title="Generate Random Predictions (0-4 goals)"
                        aria-label="Generate Random Predictions"
                    >
                        <Image
                            src="/Random.png"
                            alt=""
                            width={20} height={20}
                            aria-hidden="true"
                        />
                        <span className="sr-only">Generate Random Predictions</span>
                    </Button>

                    {/* Save Button - Now needs type="button" and calls handleSave manually */}
                    <Button
                        type="button" // Changed from "submit"
                        variant="primary"
                        size="sm" // Match size?
                        onClick={() => handleSave()} // Call handler onClick
                        isLoading={isSaving}
                        disabled={isSubmitDisabled}
                        title="Save your predictions" // Add title
                    >
                        <FaSave className="mr-1.5 h-5 w-4" /> {/* Added Save Icon */}
                        {isSaving ? 'Saving...' : 'Save'} {/* Shorten text */}
                    </Button>
                </div>
            </div>
            {/* === END MODIFIED Top Info Box === */}

            <form> {/* Remove onSubmit */}
                <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 p-4 md:p-6 space-y-3">

                    {/* Fixture List */}
                    {activeRound.fixtures.map((fixture) => {
                        // Get current prediction state for this fixture
                        const currentPrediction = predictions.get(fixture.fixtureId);
                        // Determine if this fixture is the selected joker
                        const isJoker = currentPrediction?.isJoker ?? false; // New way: check map state

                        // Return the styled JSX for each fixture row
                        return (
                            <div
                                key={fixture.fixtureId}
                                // Default uses container bg (or bg-gray-900). Joker uses accent border + subtle accent bg.
                                className={`p-3 rounded-md border ${isJoker
                                    ? 'border-yellow-500 bg-yellow-900/10 shadow-md ring-1 ring-yellow-600' // Gold highlight style
                                    : 'border-gray-700/80'
                                    } grid grid-cols-12 gap-x-2 gap-y-1 items-center transition-all duration-150`}
                            >
                                {/* Column 1: Joker Radio */}
                                <div className="col-span-1 flex justify-center items-center">
                                    <button
                                        type="button"
                                        onClick={() => handleJokerChange(fixture.fixtureId)}
                                        // Disable if deadline passed OR if trying to add joker beyond limit
                                        disabled={isSubmitDisabled || (!isJoker && jokerLimitReached)}
                                        className={`p-1 rounded-full transition-all duration-150  ${
                                            // Add disabled state for limit reached
                                            (isSubmitDisabled || (!isJoker && jokerLimitReached))
                                                ? 'opacity-40 cursor-not-allowed'
                                                : 'hover:scale-110 hover:opacity-100'
                                            } ${isJoker ? 'opacity-100 scale-110' : 'opacity-60'}`} // Brighter/bigger if selected
                                        title={isJoker ? "Clear Joker" : (jokerLimitReached ? `Joker limit (${activeRound.jokerLimit}) reached` : "Set as Joker (double points)")}
                                        aria-label={isJoker ? `Clear Joker for ${fixture.homeTeam} vs ${fixture.awayTeam}` : `Set Joker for ${fixture.homeTeam} vs ${fixture.awayTeam}`}
                                    >
                                        <Image
                                            src="/Joker.png" // Path from /public
                                            alt="Joker Card Icon"
                                            width={40} // Adjust size as needed
                                            height={40} // Adjust size as needed
                                            className={`object-contain ${isJoker ? '' : 'grayscale'}`} // Grayscale if not selected
                                        />
                                    </button>
                                </div>

                                {/* Column 2: Home Team Name */}
                                <label htmlFor={`home-${fixture.fixtureId}`} className="col-span-4 sm:col-span-3 text-sm sm:text-base font-medium text-gray-200 text-left truncate pl-1 flex justify-start items-center gap-2">

                                    {/* --- Moved Home Crest Before Name --- */}
                                    {fixture.homeTeamCrestUrl && (
                                        <Image
                                            src={fixture.homeTeamCrestUrl}
                                            alt="" // Decorative, label provides context
                                            width={30} // <<< Increased size
                                            height={24} // <<< Increased size
                                            className="inline-block align-middle object-contain mr-1.5"
                                            unoptimized
                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                        />
                                    )}
                                    {/* --- End Home Crest --- */}
                                    <span>{fixture.homeTeam}</span>
                                </label>

                                {/* Column 3: Home Score Input */}
                                <div className="col-span-1">
                                    <input
                                        type="text" inputMode="numeric" pattern="[0-9]*"
                                        id={`home-${fixture.fixtureId}`}
                                        value={currentPrediction?.homeInput ?? ''}
                                        onChange={(e) => handleInputChange(fixture.fixtureId, 'home', e.target.value)}
                                        className={scoreInputClasses} // Apply themed input style
                                        maxLength={2}
                                        disabled={isSubmitDisabled}
                                        aria-label={`Predicted score for ${fixture.homeTeam}`}
                                    />
                                </div>

                                {/* Column 4: Score Separator */}
                                <div className="col-span-1 text-center font-semibold text-gray-400">-</div>

                                {/* Column 5: Away Score Input */}
                                <div className="col-span-1">
                                    <input
                                        type="text" inputMode="numeric" pattern="[0-9]*"
                                        id={`away-${fixture.fixtureId}`}
                                        value={currentPrediction?.awayInput ?? ''}
                                        onChange={(e) => handleInputChange(fixture.fixtureId, 'away', e.target.value)}
                                        className={scoreInputClasses} // Apply themed input style
                                        maxLength={2}
                                        disabled={isSubmitDisabled}
                                        aria-label={`Predicted score for ${fixture.awayTeam}`}
                                    />
                                </div>

                                {/* Column 6: Away Team Name */}
                                <label htmlFor={`away-${fixture.fixtureId}`} className="col-span-4 sm:col-span-3 text-sm sm:text-base font-medium text-gray-200 text-left truncate pr-1 flex justify-end items-center gap-2">
                                    <span>{fixture.awayTeam}</span>
                                    {/* --- Moved Away Crest After Name --- */}
                                    {fixture.awayTeamCrestUrl && (
                                        <Image
                                            src={fixture.awayTeamCrestUrl}
                                            alt="" // Decorative
                                            width={30} // <<< Increased size
                                            height={30} // <<< Increased size
                                            className="inline-block align-middle object-contain ml-1.5"
                                            unoptimized
                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                        />
                                    )}
                                    {/* --- End Away Crest --- */}
                                </label>

                                {/* Column 7: Match Time */}
                                <div className="col-span-12 sm:col-span-2 text-xs text-gray-400 text-center sm:text-right pt-1 sm:pt-0">
                                    {formatDateTime(fixture.matchTime)} {/* Use formatter */}
                                </div>
                            </div> // End Fixture Row Div
                        ); // End Return for map item
                    })}



                </div>
            </form>
        </div>
    );
}