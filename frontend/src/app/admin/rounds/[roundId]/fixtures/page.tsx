// frontend/src/app/admin/rounds/[roundId]/fixtures/page.tsx
'use client';

import React, { useState, useEffect, useCallback, FormEvent } from 'react'; // Added FormEvent
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
    getRoundFixtures,
    addFixture,
    enterFixtureResult, // Assuming this exists from previous step
    ResultPayload,     // Assuming this exists
    Fixture,
    AddFixturePayload
} from '@/lib/api';

export default function AdminRoundFixturesPage() {
    // ... (Existing state: token, isAuthLoading, roundId, fixtures, isLoading, error, etc.) ...
    const { token, isLoading: isAuthLoading } = useAuth();
    const params = useParams();
    const roundIdParam = params?.roundId;
    const roundId = typeof roundIdParam === 'string' && !isNaN(parseInt(roundIdParam, 10))
        ? parseInt(roundIdParam, 10)
        : null;

    const [fixtures, setFixtures] = useState<Fixture[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [formSuccess, setFormSuccess] = useState<string | null>(null);
    const [isSubmittingAddFixture, setIsSubmittingAddFixture] = useState(false); // Renamed for clarity

    // --- State for Result Entry Modal ---
    const [isResultModalOpen, setIsResultModalOpen] = useState(false);
    const [selectedFixtureForResult, setSelectedFixtureForResult] = useState<Fixture | null>(null);
    const [modalHomeScore, setModalHomeScore] = useState<string>(''); // Store as string from input
    const [modalAwayScore, setModalAwayScore] = useState<string>(''); // Store as string from input
    const [isSubmittingResult, setIsSubmittingResult] = useState(false); // Loading state for result submit
    const [resultFormError, setResultFormError] = useState<string | null>(null); // Error state for result modal

    const [homeTeam, setHomeTeam] = useState('');
    const [awayTeam, setAwayTeam] = useState('');
    const [matchTime, setMatchTime] = useState('');

    // --- Fetch Fixtures --- (Keep existing implementation)
    const fetchFixtures = useCallback(async () => {
        // ... (your existing fetchFixtures function) ...
        if (!token) { setError("Authentication required to fetch fixtures."); setIsLoading(false); setFixtures([]); return; }
        if (roundId === null) { setError("Invalid Round ID specified."); setIsLoading(false); setFixtures([]); return; }
        setIsLoading(true); setError(null);
        try { const data = await getRoundFixtures(roundId, token); setFixtures(data || []); }
        catch (err: unknown) { console.error(`Fetch fixtures error for round ${roundId}:`, err); const message = (err instanceof Error) ? err.message : 'Failed to fetch fixtures.'; setError(message); setFixtures([]); }
        finally { setIsLoading(false); }
    }, [token, roundId]);

    // --- useEffect for Initial Fetch --- (Keep existing implementation)
    useEffect(() => {
        // Ensure useEffect content is NOT commented out
        if (!isAuthLoading && roundId !== null) { fetchFixtures(); }
        else if (!isAuthLoading && roundId === null) { setError("Invalid Round ID specified in URL."); setIsLoading(false); }
    }, [roundId, isAuthLoading, fetchFixtures]);

    // --- Add Fixture Handler --- (Renamed isSubmitting state)
    const handleAddFixture = async (e: React.FormEvent) => {
        // ... (your existing handleAddFixture function, but use setIsSubmittingAddFixture) ...
        e.preventDefault();
        if (roundId === null) { setFormError("Cannot add fixture: Round ID is missing."); return; }
        if (!token) { setFormError("Authentication error. Cannot add fixture."); return; }
        if (!homeTeam.trim() || !awayTeam.trim() || !matchTime) { setFormError("Please provide Home Team, Away Team, and Match Time."); return; }
        setFormError(null); setFormSuccess(null);
        setIsSubmittingAddFixture(true); // Use renamed state
        let isoMatchTime: string;
        try { isoMatchTime = new Date(matchTime).toISOString(); if (isNaN(new Date(isoMatchTime).getTime())) throw new Error("Invalid date"); }
        catch { setFormError("Invalid Match Time format."); setIsSubmittingAddFixture(false); return; }
        const fixtureData: AddFixturePayload = { homeTeam: homeTeam.trim(), awayTeam: awayTeam.trim(), matchTime: isoMatchTime };
        try { await addFixture(roundId, fixtureData, token); setFormSuccess(`Fixture "${fixtureData.homeTeam} vs ${fixtureData.awayTeam}" added successfully!`); setHomeTeam(''); setAwayTeam(''); setMatchTime(''); await fetchFixtures(); }
        catch (err: unknown) { console.error("Add fixture error:", err); const message = (err instanceof Error) ? err.message : 'Failed to add fixture.'; setFormError(message); }
        finally { setIsSubmittingAddFixture(false); } // Use renamed state
    };

    // --- Handlers for Result Modal ---
    const handleOpenResultModal = (fixture: Fixture) => {
        setSelectedFixtureForResult(fixture);
        // Reset score inputs when opening the modal
        setModalHomeScore('');
        setModalAwayScore('');
        setResultFormError(null); // Clear previous errors
        setIsResultModalOpen(true);
    };

    const handleCloseResultModal = () => {
        setIsResultModalOpen(false);
        setSelectedFixtureForResult(null);
        // Optionally clear scores on close too, though handleOpen resets them
        setModalHomeScore('');
        setModalAwayScore('');
        setResultFormError(null);
    };

     // --- Handler for Score Input Change ---
     const handleModalScoreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        // Allow only digits (or empty string)
        if (/^\d*$/.test(value)) {
            if (name === 'homeScore') {
                setModalHomeScore(value);
            } else if (name === 'awayScore') {
                setModalAwayScore(value);
            }
        }
    };

    // --- Handler for Submitting Result (with logging added) ---
    const handleResultSubmit = async (e: FormEvent) => {
        e.preventDefault(); // Prevent default form submission if called from a form element
        if (!selectedFixtureForResult || !token) {
            setResultFormError("Cannot submit result: Missing fixture data or authentication.");
            return;
        }

        // --- >>> ADDED LOGGING <<< ---
        console.log('--- handleResultSubmit ---');
        console.log('State before parse:', { modalHomeScore, modalAwayScore });
        // --- >>> END LOGGING <<< ---

        // Validate scores
        const homeScoreNum = parseInt(modalHomeScore, 10);
        const awayScoreNum = parseInt(modalAwayScore, 10);

        // --- >>> ADDED LOGGING <<< ---
        console.log('Parsed numbers:', { homeScoreNum, awayScoreNum });
        // --- >>> END LOGGING <<< ---

        // Check validation
        if (isNaN(homeScoreNum) || isNaN(awayScoreNum) || homeScoreNum < 0 || awayScoreNum < 0) {
            // --- >>> ADDED LOGGING <<< ---
            console.error('Validation Failed!', { homeScoreNum, awayScoreNum });
            // --- >>> END LOGGING <<< ---
            setResultFormError("Please enter valid non-negative numbers for both scores.");
            return;
        }

        // Validation passed, prepare payload
        const resultData: ResultPayload = {
            homeScore: homeScoreNum,
            awayScore: awayScoreNum
        };

        setResultFormError(null); // Clear error if validation passes now
        setIsSubmittingResult(true);

        try {
            console.log(`Submitting result for fixture ${selectedFixtureForResult.fixtureId}:`, resultData);
            // --- Make the API call ---
            await enterFixtureResult(selectedFixtureForResult.fixtureId, resultData, token);
            // -------------------------

            handleCloseResultModal(); // Close modal on success
            await fetchFixtures(); // Refresh the list to show the updated result

        } catch (err: unknown) {
            console.error("Submit result error:", err);
            const message = (err instanceof Error) ? err.message : 'Failed to submit result.';
            setResultFormError(message); // Show error within the modal
        } finally {
            setIsSubmittingResult(false);
        }
    };


    // --- Helper Function for Date Formatting --- (Keep existing implementation)
    const formatDateTime = // ... (your existing function) ...
        (isoString: string | null | undefined): string => {
            if (!isoString) return "Date unavailable";
            try { return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(new Date(isoString)); }
            catch (e) { console.error("Error formatting date:", isoString, e); return "Invalid Date"; }
        };

    // --- Render Logic --- (Keep existing implementation for loading/error)
    if (isAuthLoading) { return <p className="p-4 text-center">Loading authentication...</p>; }
    if (!token && !isAuthLoading) { return <p className='text-red-500 p-4 font-semibold text-center'>Authentication required.</p>; } // Simplified error
    if (isLoading) { return <p className="p-4 text-center">Loading fixtures for Round {roundIdParam || '...'}...</p>; }
    if (error) { return <p className='text-red-500 p-4 font-semibold text-center'>Error: {error}</p>; }
    if (roundId === null) { return <p className="text-red-600 p-4 font-semibold text-center">Error: Invalid or missing Round ID.</p>; }

    // --- Render Admin Fixtures Page ---
    return (
        <div className="p-4 md:p-6">
            {/* Page Header (Keep existing) */}
             <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center">
                 <h1 className="text-2xl font-bold mb-2 sm:mb-0">Admin - Manage Fixtures for Round {roundId}</h1>
                 <Link href="/admin" className="text-blue-600 hover:text-blue-800 hover:underline text-sm">
                     ← Back to Rounds List
                 </Link>
             </div>


            {/* Add Fixture Form (Use isSubmittingAddFixture) */}
            <div className="mb-8 p-6 border rounded shadow-md bg-white">
                 <h2 className="text-xl font-semibold mb-4">Add New Fixture</h2>
                 <form onSubmit={handleAddFixture}>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                         <div><label htmlFor="homeTeam" className="block mb-1 font-medium text-gray-700 text-sm">Home Team:</label><input id="homeTeam" type="text" value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)} className="border p-2 w-full rounded border-gray-300 focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50" required disabled={isSubmittingAddFixture} /></div>
                         <div><label htmlFor="awayTeam" className="block mb-1 font-medium text-gray-700 text-sm">Away Team:</label><input id="awayTeam" type="text" value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)} className="border p-2 w-full rounded border-gray-300 focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50" required disabled={isSubmittingAddFixture}/></div>
                         <div><label htmlFor="matchTime" className="block mb-1 font-medium text-gray-700 text-sm">Match Time:</label><input id="matchTime" type="datetime-local" value={matchTime} onChange={(e) => setMatchTime(e.target.value)} className="border p-2 w-full rounded border-gray-300 focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50" required disabled={isSubmittingAddFixture}/></div>
                     </div>
                     <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out disabled:opacity-50" disabled={isSubmittingAddFixture}>
                         {isSubmittingAddFixture ? 'Adding...' : 'Add Fixture'}
                     </button>
                     {formError && <p className="text-red-600 mt-3 text-sm font-medium">{formError}</p>}
                     {formSuccess && <p className="text-green-600 mt-3 text-sm font-medium">{formSuccess}</p>}
                 </form>
            </div>

            {/* List Fixtures Table (Keep existing structure) */}
            <h2 className="text-xl font-semibold mb-4">Existing Fixtures</h2>
            <div className="overflow-x-auto shadow rounded border-b border-gray-200 bg-white">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                        <tr>
                            <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">ID</th>
                            <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Home Team</th>
                            <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Away Team</th>
                            <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Match Time</th>
                            <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Result</th>
                            <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                     <tbody className="bg-white divide-y divide-gray-200">
                         {fixtures.length === 0 ? (
                            <tr><td colSpan={6} className="text-center py-4 px-4 text-gray-500 italic">No fixtures found for this round. Add one above!</td></tr>
                         ) : (
                             fixtures.map(fixture => {
                                 const resultExists = fixture.homeScore !== null && fixture.awayScore !== null;
                                 return (
                                     <tr key={fixture.fixtureId} className="hover:bg-gray-50 transition-colors duration-150">
                                         <td className="py-3 px-4 whitespace-nowrap text-sm font-medium text-gray-900">{fixture.fixtureId}</td>
                                         <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-700">{fixture.homeTeam}</td>
                                         <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-700">{fixture.awayTeam}</td>
                                         <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-700">{formatDateTime(fixture.matchTime)}</td>
                                         <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-700">
                                             {resultExists ? `${fixture.homeScore} - ${fixture.awayScore}` : <span className="text-gray-400 italic">Pending</span>}
                                         </td>
                                         <td className="py-3 px-4 whitespace-nowrap text-sm font-medium">
                                             <button
                                                 onClick={() => handleOpenResultModal(fixture)}
                                                 disabled={resultExists}
                                                 className="text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed text-xs"
                                             >
                                                 {resultExists ? 'Result Entered' : 'Enter Result'}
                                             </button>
                                         </td>
                                     </tr>
                                 );
                             })
                         )}
                     </tbody>
                </table>
            </div>


            {/* Result Entry Modal (Updated) */}
            {isResultModalOpen && selectedFixtureForResult && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center">
                    <div className="relative mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
                        {/* Wrap modal content in a form */}
                        <form onSubmit={handleResultSubmit}>
                            <div className="mt-3 text-center">
                                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                                    Enter Result for {selectedFixtureForResult.homeTeam} vs {selectedFixtureForResult.awayTeam}
                                </h3>
                                <div className="mt-2 px-7 py-3">
                                    {/* Score Inputs */}
                                    <div className="flex justify-around mb-4">
                                        <div>
                                            <label htmlFor="homeScore" className="block text-sm font-medium text-gray-700">{selectedFixtureForResult.homeTeam} Score</label>
                                            <input
                                                type="text" // Use text initially for better control with regex
                                                inputMode="numeric" // Hint for mobile keyboards
                                                pattern="[0-9]*" // HTML5 pattern validation
                                                id="homeScore"
                                                name="homeScore"
                                                value={modalHomeScore}
                                                onChange={handleModalScoreChange}
                                                className="mt-1 border p-2 w-24 rounded border-gray-300 text-center focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                                                required
                                                disabled={isSubmittingResult}
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="awayScore" className="block text-sm font-medium text-gray-700">{selectedFixtureForResult.awayTeam} Score</label>
                                            <input
                                                type="text" // Use text initially
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                id="awayScore"
                                                name="awayScore"
                                                value={modalAwayScore}
                                                onChange={handleModalScoreChange}
                                                className="mt-1 border p-2 w-24 rounded border-gray-300 text-center focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                                                required
                                                disabled={isSubmittingResult}
                                            />
                                        </div>
                                    </div>
                                     {/* Error Display */}
                                     {resultFormError && <p className="text-red-600 mt-3 text-sm font-medium">{resultFormError}</p>}
                                </div>
                                <div className="items-center px-4 py-3">
                                    {/* Submit Button */}
                                    <button
                                        type="submit" // Make this a submit button for the form
                                        className="px-4 py-2 bg-blue-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-50"
                                        disabled={isSubmittingResult}
                                    >
                                        {isSubmittingResult ? 'Submitting...' : 'Submit Result'}
                                    </button>
                                    {/* Cancel Button */}
                                    <button
                                        type="button" // Make cancel explicitly type="button"
                                        onClick={handleCloseResultModal}
                                        className="mt-2 px-4 py-2 bg-gray-200 text-gray-800 text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-300"
                                        disabled={isSubmittingResult} // Optionally disable cancel during submit
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}