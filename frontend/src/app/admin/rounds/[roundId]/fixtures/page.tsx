// frontend/src/app/admin/rounds/[roundId]/fixtures/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation'; // Use useParams for client components
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import {
    getRoundFixtures,
    addFixture,
    enterFixtureResult,
    importFixtures,
    // Round, // Round type no longer needed here unless used elsewhere
    Fixture,
    AddFixturePayload,
    ResultPayload,
    ImportFixturesPayload,
    ImportFixturesResponse
} from '@/lib/api';

// Modal Component (Assuming it exists and accepts these props)
interface ResultModalProps {
    fixture: Fixture;
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (fixtureId: number, result: ResultPayload) => Promise<void>;
}

// Basic Modal Placeholder (Replace with your actual modal implementation)
const ResultModal: React.FC<ResultModalProps> = ({ fixture, isOpen, onClose, onSubmit }) => {
    const [homeScore, setHomeScore] = useState('');
    const [awayScore, setAwayScore] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            // Reset form when modal opens
            setHomeScore(fixture.homeScore?.toString() ?? '');
            setAwayScore(fixture.awayScore?.toString() ?? '');
            setError(null);
            setIsSubmitting(false);
        }
    }, [isOpen, fixture]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        const hs = parseInt(homeScore, 10);
        const as = parseInt(awayScore, 10);

        if (isNaN(hs) || isNaN(as) || hs < 0 || as < 0) {
            setError("Scores must be non-negative numbers.");
            return;
        }
        setIsSubmitting(true);
        try {
            await onSubmit(fixture.fixtureId, { homeScore: hs, awayScore: as });
            onClose(); // Close modal on successful submit
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to submit result.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center">
            <div className="relative mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
                <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Enter Result for:</h3>
                <p className="text-sm text-gray-700 mb-1">{fixture.homeTeam} vs {fixture.awayTeam}</p>
                <p className="text-xs text-gray-500 mb-4">Fixture ID: {fixture.fixtureId}</p>
                <form onSubmit={handleSubmit}>
                    <div className="flex gap-4 mb-4">
                        <div className='flex-1'>
                            <label htmlFor="homeScore" className="block text-sm font-medium text-gray-700">{fixture.homeTeam} Score</label>
                            <input
                                type="number"
                                id="homeScore"
                                value={homeScore}
                                onChange={(e) => setHomeScore(e.target.value)}
                                min="0"
                                className="mt-1 p-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                required
                                disabled={isSubmitting}
                            />
                        </div>
                        <div className='flex-1'>
                            <label htmlFor="awayScore" className="block text-sm font-medium text-gray-700">{fixture.awayTeam} Score</label>
                            <input
                                type="number"
                                id="awayScore"
                                value={awayScore}
                                onChange={(e) => setAwayScore(e.target.value)}
                                min="0"
                                className="mt-1 p-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                required
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>
                     {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                            {isSubmitting ? 'Submitting...' : 'Submit Result'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


export default function AdminRoundFixturesPage() {
    const { token, isLoading: isAuthLoading } = useAuth();
    const params = useParams();
    const roundId = parseInt(params.roundId as string, 10);

    const [fixtures, setFixtures] = useState<Fixture[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // Removed unused roundInfo state:
    // const [roundInfo, setRoundInfo] = useState<Round | null>(null);

    // State for adding fixtures manually
    const [homeTeam, setHomeTeam] = useState('');
    const [awayTeam, setAwayTeam] = useState('');
    const [matchTime, setMatchTime] = useState('');
    const [isAddingFixture, setIsAddingFixture] = useState(false);
    const [addFixtureError, setAddFixtureError] = useState<string | null>(null);
    const [addFixtureSuccess, setAddFixtureSuccess] = useState<string | null>(null);

    // State for managing the result modal
    const [selectedFixture, setSelectedFixture] = useState<Fixture | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [submitResultError, setSubmitResultError] = useState<string | null>(null); // Specific error for result submission

    // --- State for Importing Fixtures ---
    const [competitionCode, setCompetitionCode] = useState(''); // e.g., PL, BL1, SA, PD, CL
    const [matchday, setMatchday] = useState('');             // e.g., 1, 2, ...
    const [isImporting, setIsImporting] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);
    const [importSuccess, setImportSuccess] = useState<string | null>(null);
    // --- End Import State ---


    // --- Fetch Fixtures --- (Removed round info fetching part)
    const fetchRoundAndFixtures = useCallback(async () => {
        if (!token || isNaN(roundId)) {
            setIsLoading(false);
            setError(isNaN(roundId) ? "Invalid Round ID." : "Authentication required.");
            return;
        }
        setIsLoading(true);
        // Clear errors before fetch
        setError(null); setAddFixtureError(null); setAddFixtureSuccess(null); setSubmitResultError(null); setImportError(null); setImportSuccess(null);
        try {
            const fixturesData = await getRoundFixtures(roundId, token);
            setFixtures(fixturesData || []);
            // Removed round info fetching:
            // // Example placeholder: setRoundInfo(await getRoundDetails(roundId, token));
        } catch (err: unknown) {
            console.error("Error fetching fixtures:", err);
            const message = err instanceof Error ? err.message : 'Failed to load fixture data.';
            setError(message);
            setFixtures([]);
        } finally {
            setIsLoading(false);
        }
    }, [roundId, token]);

    // --- useEffect for Initial Fetch ---
    useEffect(() => {
        if (!isAuthLoading && roundId) {
            fetchRoundAndFixtures();
        }
         if (!isAuthLoading && !token) {
             setError("Authentication required for Admin access.");
             setIsLoading(false);
         }
         if (isNaN(roundId)) {
             setError("Invalid Round ID provided in URL.");
             setIsLoading(false);
         }
    }, [roundId, token, isAuthLoading, fetchRoundAndFixtures]);

    // --- Handle Add Fixture Manually ---
    const handleAddFixture = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token || isNaN(roundId)) { setAddFixtureError("Cannot add fixture: Invalid round or not authenticated."); return; }
        if (!homeTeam.trim() || !awayTeam.trim() || !matchTime) { setAddFixtureError("Please provide home team, away team, and match time."); return; }

        let matchTimeISO: string;
        try {
            matchTimeISO = new Date(matchTime).toISOString();
            if (isNaN(new Date(matchTimeISO).getTime())) { throw new Error("Invalid date"); }
        } catch {
            setAddFixtureError("Invalid match time format."); return;
        }

        setIsAddingFixture(true);
        // Clear previous messages
        setAddFixtureError(null); setAddFixtureSuccess(null); setImportError(null); setImportSuccess(null); setSubmitResultError(null);

        const payload: AddFixturePayload = {
            homeTeam: homeTeam.trim(),
            awayTeam: awayTeam.trim(),
            matchTime: matchTimeISO
        };

        try {
            await addFixture(roundId, payload, token);
            setAddFixtureSuccess("Fixture added successfully!");
            // Clear form
            setHomeTeam(''); setAwayTeam(''); setMatchTime('');
            // Refresh fixture list
            await fetchRoundAndFixtures();
        } catch (err: unknown) {
            console.error("Error adding fixture:", err);
            const message = err instanceof Error ? err.message : 'Failed to add fixture.';
            setAddFixtureError(message);
        } finally {
            setIsAddingFixture(false);
        }
    };

    // --- Handle Open Result Modal ---
    const openResultModal = (fixture: Fixture) => {
        // Clear previous submission errors when opening modal
        setSubmitResultError(null);
        setSelectedFixture(fixture);
        setIsModalOpen(true);
    };

    // --- Handle Submit Result ---
    const handleResultSubmit = async (fixtureId: number, result: ResultPayload): Promise<void> => {
        if (!token) {
            setSubmitResultError("Authentication error."); // Set specific error state
             throw new Error("Authentication error."); // Throw to signal failure to modal
        }
        // Clear previous submission errors before trying
        setSubmitResultError(null); setImportError(null); setImportSuccess(null); setAddFixtureError(null); setAddFixtureSuccess(null);

        try {
            console.log(`Submitting result for fixture ${fixtureId}:`, result);
            await enterFixtureResult(fixtureId, result, token);
            console.log(`Result submitted successfully for ${fixtureId}. Refreshing...`);
            // Refresh list to show updated scores/status
            await fetchRoundAndFixtures();
             // Don't close modal here, let modal handle it on success
        } catch (err: unknown) {
            console.error(`Error submitting result for fixture ${fixtureId}:`, err);
            const message = err instanceof Error ? err.message : 'Failed to submit result.';
            setSubmitResultError(`Fixture ${fixtureId}: ${message}`); // Set specific error state
            throw err; // Re-throw error so modal knows submission failed
        }
    };

    // --- Handle Import Fixtures ---
    const handleImportFixtures = async () => {
        if (!token || isNaN(roundId)) { setImportError("Cannot import: Invalid round or not authenticated."); return; }
        if (!competitionCode.trim() || !matchday) { setImportError("Please provide both Competition Code and Matchday."); return; }
        // Prevent concurrent actions
        if (isAddingFixture || isImporting) return;

        setIsImporting(true);
        // Clear previous messages
        setImportError(null); setImportSuccess(null); setAddFixtureError(null); setAddFixtureSuccess(null); setSubmitResultError(null);

        const payload: ImportFixturesPayload = {
            roundId: roundId,
            competitionCode: competitionCode.trim().toUpperCase(), // Standardize code
            matchday: matchday // Keep as string or number as entered
        };

        try {
            const result: ImportFixturesResponse = await importFixtures(payload, token);
            setImportSuccess(result.message || `Successfully imported ${result.count} fixtures.`);
            // Clear form? Optional
            // setCompetitionCode(''); setMatchday('');
            // Refresh fixture list to show imported fixtures
            await fetchRoundAndFixtures();
        } catch (err: unknown) {
            console.error("Error importing fixtures:", err);
            const message = err instanceof Error ? err.message : 'Failed to import fixtures.';
            setImportError(message);
        } finally {
            setIsImporting(false);
        }
    };
    // --- End Import Logic ---


    // --- Helper Function for Date Formatting ---
    const formatDateTime = (isoString: string | null | undefined): string => {
        if (!isoString) return "N/A";
        try {
             return new Intl.DateTimeFormat('en-GB', { dateStyle: 'short', timeStyle: 'short', hour12: false }).format(new Date(isoString));
        } catch (e) {
            console.error("Error formatting date:", isoString, e);
            return "Invalid Date";
        }
    };

    // --- Render Logic ---
    if (isAuthLoading) { return <p className="p-4 text-center">Loading authentication...</p>; }
    if (!token && !isAuthLoading) { return <p className='text-red-500 p-4 font-semibold text-center'>Authentication required for Admin access.</p>; }
    if (error && !isLoading) { return <p className='text-red-500 p-4 font-semibold text-center'>{error}</p>; }
    if (isNaN(roundId)) { return <p className='text-red-500 p-4 font-semibold text-center'>Invalid Round ID in URL.</p>; }


    return (
        <div className="p-4 md:p-6">
            <div className="flex justify-between items-center mb-6">
                 {/* Title now just uses the roundId */}
                 <h1 className="text-2xl font-bold">Admin - Fixtures for Round {roundId}</h1>
                 <Link href="/admin" className="text-blue-600 hover:text-blue-800 hover:underline">
                     ← Back to Rounds List
                 </Link>
            </div>

             {/* Display Global Errors/Success for Actions */}
             {addFixtureError && <p className="mb-4 text-sm text-red-600 p-3 bg-red-100 border border-red-300 rounded">{addFixtureError}</p>}
             {addFixtureSuccess && <p className="mb-4 text-sm text-green-600 p-3 bg-green-100 border border-green-300 rounded">{addFixtureSuccess}</p>}
             {submitResultError && <p className="mb-4 text-sm text-red-600 p-3 bg-red-100 border border-red-300 rounded">{submitResultError}</p>}
             {importError && <p className="mb-4 text-sm text-red-600 p-3 bg-red-100 border border-red-300 rounded">{importError}</p>}
             {importSuccess && <p className="mb-4 text-sm text-green-600 p-3 bg-green-100 border border-green-300 rounded">{importSuccess}</p>}


            {/* --- Import Fixtures Section --- */}
            <div className="mb-8 p-6 border rounded shadow-md bg-white">
                 <h2 className="text-xl font-semibold mb-4">Import Fixtures from football-data.org</h2>
                 <p className="text-sm text-gray-600 mb-4">
                     Enter the Competition Code (e.g., PL, BL1, SA, PD, CL) and the Matchday number.
                     <br /> Check <a href="https://www.football-data.org/documentation/v4/index.html#competitions" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">football-data.org V4 Docs</a> for available competitions.
                     <br /> <strong className="text-orange-700">Note:</strong> This will add fixtures to the current list. Ensure the round is empty or duplicates are acceptable/handled.
                 </p>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                     <div>
                         <label htmlFor="competitionCode" className="block mb-1 font-medium text-gray-700 text-sm">Competition Code:</label>
                         <input
                             id="competitionCode"
                             type="text"
                             value={competitionCode}
                             onChange={(e) => setCompetitionCode(e.target.value)}
                             placeholder="e.g., PL"
                             className="border p-2 w-full rounded border-gray-300 focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50 disabled:bg-gray-100"
                             disabled={isImporting || isAddingFixture} // Disable if any action is happening
                         />
                     </div>
                     <div>
                         <label htmlFor="matchday" className="block mb-1 font-medium text-gray-700 text-sm">Matchday:</label>
                         <input
                             id="matchday"
                             type="number" // Use number for easier input, API takes string/number
                             value={matchday}
                             onChange={(e) => setMatchday(e.target.value)}
                             placeholder="e.g., 1"
                             min="1"
                             className="border p-2 w-full rounded border-gray-300 focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50 disabled:bg-gray-100"
                             disabled={isImporting || isAddingFixture}
                         />
                     </div>
                      <div className="md:self-end"> {/* Align button vertically */}
                           <button
                                onClick={handleImportFixtures}
                                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded w-full md:w-auto transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={isImporting || isAddingFixture || !competitionCode || !matchday} // Also disable if fields are empty
                            >
                                {isImporting ? 'Importing...' : 'Import Fixtures'}
                            </button>
                      </div>
                 </div>
             </div>
             {/* --- End Import Section --- */}


            {/* Add Fixture Manually Form */}
             <div className="mb-8 p-6 border rounded shadow-md bg-white">
                <h2 className="text-xl font-semibold mb-4">Add Fixture Manually</h2>
                 <form onSubmit={handleAddFixture}>
                     <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                        <div>
                             <label htmlFor="homeTeam" className="block mb-1 font-medium text-gray-700 text-sm">Home Team:</label>
                             <input id="homeTeam" type="text" value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)} className="border p-2 w-full rounded border-gray-300 disabled:bg-gray-100" required disabled={isAddingFixture || isImporting} />
                        </div>
                         <div>
                            <label htmlFor="awayTeam" className="block mb-1 font-medium text-gray-700 text-sm">Away Team:</label>
                            <input id="awayTeam" type="text" value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)} className="border p-2 w-full rounded border-gray-300 disabled:bg-gray-100" required disabled={isAddingFixture || isImporting} />
                        </div>
                        <div>
                            <label htmlFor="matchTime" className="block mb-1 font-medium text-gray-700 text-sm">Match Time:</label>
                            <input id="matchTime" type="datetime-local" value={matchTime} onChange={(e) => setMatchTime(e.target.value)} className="border p-2 w-full rounded border-gray-300 disabled:bg-gray-100" required disabled={isAddingFixture || isImporting} />
                         </div>
                         <div className="md:self-end"> {/* Align button vertically */}
                            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full md:w-auto transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed" disabled={isAddingFixture || isImporting}>
                                {isAddingFixture ? 'Adding...' : 'Add Fixture'}
                             </button>
                         </div>
                    </div>
                 </form>
             </div>


            {/* Fixture List Table */}
            <h2 className="text-xl font-semibold mb-4">Existing Fixtures</h2>
            {isLoading && <p className="text-center text-gray-500">Loading fixtures...</p>}
            {!isLoading && fixtures.length === 0 && <p className="text-center text-gray-500 italic">No fixtures found for this round. Add one above or import.</p>}
            {!isLoading && fixtures.length > 0 && (
                 <div className="overflow-x-auto shadow rounded border-b border-gray-200 bg-white">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                             <tr>
                                <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">ID</th>
                                <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Home Team</th>
                                <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Away Team</th>
                                <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Time (Local)</th>
                                <th scope="col" className="py-3 px-4 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">Result</th>
                                <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Status</th>
                                <th scope="col" className="py-3 px-4 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                         <tbody className="bg-white divide-y divide-gray-200">
                            {fixtures.map(fixture => (
                                 <tr key={fixture.fixtureId} className="hover:bg-gray-50 transition-colors duration-150">
                                    <td className="py-3 px-4 whitespace-nowrap text-sm font-medium text-gray-900">{fixture.fixtureId}</td>
                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-700">{fixture.homeTeam}</td>
                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-700">{fixture.awayTeam}</td>
                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-700">{formatDateTime(fixture.matchTime)}</td>
                                     <td className="py-3 px-4 whitespace-nowrap text-sm text-center text-gray-700">
                                        {fixture.homeScore !== null && fixture.awayScore !== null
                                            ? `${fixture.homeScore} - ${fixture.awayScore}`
                                             : <span className="text-gray-400 italic">Pending</span>}
                                     </td>
                                     <td className="py-3 px-4 whitespace-nowrap text-sm">
                                          <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                              fixture.status === 'FINISHED' ? 'bg-blue-100 text-blue-800' :
                                              fixture.status === 'IN_PLAY' ? 'bg-yellow-100 text-yellow-800' : // Example
                                              'bg-gray-100 text-gray-800' // Default/Scheduled
                                          }`}>
                                             {fixture.status || 'SCHEDULED'} {/* Display status, default if null */}
                                          </span>
                                     </td>
                                    <td className="py-3 px-4 whitespace-nowrap text-sm font-medium text-center">
                                         <button
                                            onClick={() => openResultModal(fixture)}
                                            className="text-indigo-600 hover:text-indigo-900 hover:underline disabled:text-gray-400 disabled:no-underline"
                                             // Disable if another action is running
                                             disabled={isAddingFixture || isImporting}
                                            title={fixture.homeScore !== null ? "Edit Result" : "Enter Result"}
                                         >
                                             {fixture.homeScore !== null ? 'Edit Result' : 'Enter Result'}
                                         </button>
                                     </td>
                                 </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>
            )}

            {/* Modal for Entering Results */}
             {selectedFixture && (
                <ResultModal
                    fixture={selectedFixture}
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSubmit={handleResultSubmit}
                />
            )}
        </div>
    );
}