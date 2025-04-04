// frontend/src/app/(authenticated)/admin/rounds/[roundId]/fixtures/page.tsx
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
    deleteFixture,
    generateRandomResults, // <<< ADD THIS IMPORT
    Fixture,
    AddFixturePayload,
    ResultPayload,
    ImportFixturesPayload
    // ImportFixturesResponse // Removed as requested previously
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
    // --- Start of Modal Code ---
    const [homeScore, setHomeScore] = useState('');
    const [awayScore, setAwayScore] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
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
            onClose();
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
                            <input type="number" id="homeScore" value={homeScore} onChange={(e) => setHomeScore(e.target.value)} min="0" className="mt-1 p-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" required disabled={isSubmitting} />
                        </div>
                        <div className='flex-1'>
                            <label htmlFor="awayScore" className="block text-sm font-medium text-gray-700">{fixture.awayTeam} Score</label>
                            <input type="number" id="awayScore" value={awayScore} onChange={(e) => setAwayScore(e.target.value)} min="0" className="mt-1 p-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" required disabled={isSubmitting} />
                        </div>
                    </div>
                     {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
                    <div className="flex justify-end gap-3">
                        <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 disabled:opacity-50">Cancel</button>
                        <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{isSubmitting ? 'Submitting...' : 'Submit Result'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
    // --- End of Modal Code ---
};


// --- Define Competitions ---
const COMPETITIONS = [
    { code: 'PL', name: 'Premier League (England)' },
    { code: 'BL1', name: 'Bundesliga (Germany)' },
    { code: 'SA', name: 'Serie A (Italy)' },
    { code: 'PD', name: 'La Liga (Spain)' },
    { code: 'FL1', name: 'Ligue 1 (France)' },
    { code: 'CL', name: 'Champions League' },
    { code: 'ELC', name: 'Championship (England)'},
];


export default function AdminRoundFixturesPage() {
    const { token, isLoading: isAuthLoading } = useAuth();
    const params = useParams();
    const rawRoundIdParam = params?.roundId;
    const roundId = Number(rawRoundIdParam);

    // Diagnostic Logs
    // console.log("[Fixtures Page] Mount/Render");
    // console.log("[Fixtures Page] useParams() result:", params);
    // console.log("[Fixtures Page] Raw roundId from params:", rawRoundIdParam, typeof rawRoundIdParam);
    // console.log("[Fixtures Page] Calculated roundId:", roundId, "Is NaN:", isNaN(roundId));

    // --- Component State ---
    const [fixtures, setFixtures] = useState<Fixture[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [homeTeam, setHomeTeam] = useState('');
    const [awayTeam, setAwayTeam] = useState('');
    const [matchTime, setMatchTime] = useState('');
    const [isAddingFixture, setIsAddingFixture] = useState(false);
    const [addFixtureError, setAddFixtureError] = useState<string | null>(null);
    const [addFixtureSuccess, setAddFixtureSuccess] = useState<string | null>(null);
    const [selectedFixture, setSelectedFixture] = useState<Fixture | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [submitResultError, setSubmitResultError] = useState<string | null>(null);
    const [competitionCode, setCompetitionCode] = useState('');
    const [matchday, setMatchday] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);
    const [importSuccess, setImportSuccess] = useState<string | null>(null);
    const [deletingFixtureId, setDeletingFixtureId] = useState<number | null>(null);
    const [deleteFixtureError, setDeleteFixtureError] = useState<string | null>(null);
    // --- Add State for Random Results Generation ---
    const [isGeneratingResults, setIsGeneratingResults] = useState(false);
    const [generateResultsError, setGenerateResultsError] = useState<string | null>(null);
    const [generateResultsSuccess, setGenerateResultsSuccess] = useState<string | null>(null);
    // --- End Random Results State ---


    // --- Fetch Fixtures Function ---
    const fetchRoundAndFixtures = useCallback(async (id: number) => {
        if (!token) { setError("Authentication required."); setIsLoading(false); return; }
        setIsLoading(true);
        setError(null); setAddFixtureError(null); setAddFixtureSuccess(null);
        setSubmitResultError(null); setImportError(null); setImportSuccess(null);
        setDeleteFixtureError(null); setGenerateResultsError(null); setGenerateResultsSuccess(null); // <<< Added clear for generate results messages
        try {
            const fixturesData = await getRoundFixtures(id, token);
            setFixtures(fixturesData || []);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to load fixture data.';
            setError(message); setFixtures([]);
        } finally { setIsLoading(false); }
    }, [token]);


    // --- Initial Load/ID Change Effect ---
    useEffect(() => {
        if (isNaN(roundId)) {
            if (!isAuthLoading) { setError("Invalid Round ID provided in URL."); setIsLoading(false); setFixtures([]); }
            return;
        }
        if (!isAuthLoading) {
            if (token) { setError(null); fetchRoundAndFixtures(roundId); }
            else { setError("Authentication required for Admin access."); setIsLoading(false); setFixtures([]); }
        }
    }, [roundId, token, isAuthLoading, fetchRoundAndFixtures, rawRoundIdParam]);


    // --- Handlers ---
    const handleAddFixture = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isNaN(roundId)) { setAddFixtureError("Invalid Round ID."); return; }
        if (!token) { setAddFixtureError("Authentication error."); return; }
        if (!homeTeam.trim() || !awayTeam.trim() || !matchTime) { setAddFixtureError("Please provide home team, away team, and match time."); return; }
        let matchTimeISO: string;
        try { matchTimeISO = new Date(matchTime).toISOString(); if (isNaN(new Date(matchTimeISO).getTime())) throw new Error(); } catch { setAddFixtureError("Invalid match time format."); return; }
        if (isAddingFixture || isImporting || deletingFixtureId || isGeneratingResults) return; // Prevent concurrent

        setIsAddingFixture(true);
        // Clear all action messages
        setAddFixtureError(null); setAddFixtureSuccess(null); setImportError(null); setImportSuccess(null);
        setSubmitResultError(null); setDeleteFixtureError(null); setGenerateResultsError(null); setGenerateResultsSuccess(null);
        const payload: AddFixturePayload = { homeTeam: homeTeam.trim(), awayTeam: awayTeam.trim(), matchTime: matchTimeISO };
        try {
            await addFixture(roundId, payload, token);
            setAddFixtureSuccess("Fixture added successfully!"); setHomeTeam(''); setAwayTeam(''); setMatchTime('');
            await fetchRoundAndFixtures(roundId);
        } catch (err: unknown) { const message = err instanceof Error ? err.message : 'Failed to add fixture.'; setAddFixtureError(message); }
        finally { setIsAddingFixture(false); }
    };

    const openResultModal = (fixture: Fixture) => {
        setSubmitResultError(null); setSelectedFixture(fixture); setIsModalOpen(true);
    };

    const handleResultSubmit = async (fixtureId: number, result: ResultPayload): Promise<void> => {
        if (isNaN(roundId)) throw new Error("Invalid Round ID.");
        if (!token) { setSubmitResultError("Authentication error."); throw new Error("Authentication error."); }
        // Clear relevant messages
        setSubmitResultError(null); setDeleteFixtureError(null); setGenerateResultsError(null); setGenerateResultsSuccess(null);
        try {
            await enterFixtureResult(fixtureId, result, token);
            await fetchRoundAndFixtures(roundId);
        } catch (err: unknown) { const message = err instanceof Error ? err.message : 'Failed to submit result.'; setSubmitResultError(`Fixture ${fixtureId}: ${message}`); throw err; }
    };

    const handleImportFixtures = async () => {
        if (isNaN(roundId)) { setImportError("Invalid Round ID."); return; }
        if (!token) { setImportError("Authentication error."); return; }
        if (!competitionCode || !matchday) { setImportError("Please select a Competition and provide a Matchday."); return; }
        if (isAddingFixture || isImporting || deletingFixtureId || isGeneratingResults) return; // Prevent concurrent

        setIsImporting(true);
        // Clear all action messages
        setImportError(null); setImportSuccess(null); setAddFixtureError(null); setAddFixtureSuccess(null);
        setSubmitResultError(null); setDeleteFixtureError(null); setGenerateResultsError(null); setGenerateResultsSuccess(null);
        const payload: ImportFixturesPayload = { roundId: roundId, competitionCode: competitionCode, matchday: matchday };
        try {
            const result = await importFixtures(payload, token);
            setImportSuccess(result.message || `Successfully imported ${result.count} fixtures.`);
            await fetchRoundAndFixtures(roundId);
        } catch (err: unknown) { const message = err instanceof Error ? err.message : 'Failed to import fixtures.'; setImportError(message); }
        finally { setIsImporting(false); }
    };

    const handleDeleteFixture = async (fixtureIdToDelete: number, fixtureName: string) => {
        if (isNaN(roundId)) { setDeleteFixtureError("Invalid Round ID."); return; }
        if (!token) { setDeleteFixtureError("Authentication error."); return; }
        if (deletingFixtureId || isAddingFixture || isImporting || isGeneratingResults) return; // Prevent concurrent

        if (!window.confirm(`Are you sure you want to delete "${fixtureName}" (ID: ${fixtureIdToDelete})? This also deletes predictions.`)) return;

        setDeletingFixtureId(fixtureIdToDelete);
        // Clear all action messages
        setDeleteFixtureError(null); setAddFixtureError(null); setAddFixtureSuccess(null); setSubmitResultError(null); setImportError(null); setImportSuccess(null); setGenerateResultsError(null); setGenerateResultsSuccess(null);
        try {
            await deleteFixture(fixtureIdToDelete, token);
            await fetchRoundAndFixtures(roundId);
        } catch (err: unknown) { const message = err instanceof Error ? err.message : 'Failed to delete fixture.'; setDeleteFixtureError(`Error deleting fixture ${fixtureIdToDelete}: ${message}`); }
        finally { setDeletingFixtureId(null); }
    };

    // --- Handle Generate Random Results ---
    const handleGenerateRandomResults = async () => {
        if (isNaN(roundId)) { setGenerateResultsError("Invalid Round ID."); return; }
        if (!token) { setGenerateResultsError("Authentication error."); return; }
        if (isAddingFixture || isImporting || deletingFixtureId !== null || isGeneratingResults) return; // Prevent concurrent

        if (!window.confirm(`Are you sure you want to generate random results for ALL fixtures in Round ${roundId}? This will overwrite any existing results and mark fixtures as FINISHED.`)) return;

        setIsGeneratingResults(true);
        // Clear all action messages
        setGenerateResultsError(null); setGenerateResultsSuccess(null);
        setDeleteFixtureError(null); setAddFixtureError(null); setAddFixtureSuccess(null);
        setSubmitResultError(null); setImportError(null); setImportSuccess(null);
        setError(null); // Clear general error too

        try {
            const result = await generateRandomResults(roundId, token);
            setGenerateResultsSuccess(result.message || `Successfully generated random results for ${result.count} fixtures.`);
            await fetchRoundAndFixtures(roundId); // Refresh list
        } catch (err: unknown) {
            console.error(`Error generating random results for round ${roundId}:`, err);
            const message = err instanceof Error ? err.message : 'Failed to generate random results.';
            setGenerateResultsError(message);
        } finally {
            setIsGeneratingResults(false);
        }
    };
    // --- End Handler ---


    // --- Helper Function for Date Formatting ---
    const formatDateTime = (isoString: string | null | undefined): string => {
        if (!isoString) return "N/A";
        try { return new Intl.DateTimeFormat('en-GB', { dateStyle: 'short', timeStyle: 'short', hour12: false }).format(new Date(isoString)); } catch (e) { console.error("Error formatting date:", isoString, e); return "Invalid Date"; }
    };


    // --- Render Logic ---
    if (isNaN(roundId) && !isAuthLoading) { return ( <div className="p-4 md:p-6"> <h1 className="text-2xl font-bold text-red-600">Error</h1> <p className='text-red-500 p-4 font-semibold text-center'>Invalid Round ID provided in URL.</p> <Link href="/admin" className="text-blue-600 hover:text-blue-800 hover:underline"> ← Back to Rounds List </Link> </div> ); }
    if (isAuthLoading) { return <div className="p-4 md:p-6"><p className="p-4 text-center">Loading authentication...</p></div>; }
    if (!token) { return <div className="p-4 md:p-6"><p className='text-red-500 p-4 font-semibold text-center'>Authentication required for Admin access.</p></div>; }

    // --- Update isAnyActionRunning check ---
    const isAnyActionRunning = isAddingFixture || isImporting || (deletingFixtureId !== null) || isGeneratingResults;

    return (
        <div className="p-4 md:p-6">
            {/* Header Section */}
            <div className="flex justify-between items-center mb-6"> <h1 className="text-2xl font-bold">Admin - Fixtures for Round {roundId}</h1> <Link href="/admin" className="text-blue-600 hover:text-blue-800 hover:underline"> ← Back to Rounds List </Link> </div>

            {/* Global Action Messages */}
            {addFixtureError && <p className="mb-4 text-sm text-red-600 p-3 bg-red-100 border border-red-300 rounded">{addFixtureError}</p>}
            {addFixtureSuccess && <p className="mb-4 text-sm text-green-600 p-3 bg-green-100 border border-green-300 rounded">{addFixtureSuccess}</p>}
            {submitResultError && <p className="mb-4 text-sm text-red-600 p-3 bg-red-100 border border-red-300 rounded">{submitResultError}</p>}
            {importError && <p className="mb-4 text-sm text-red-600 p-3 bg-red-100 border border-red-300 rounded">{importError}</p>}
            {importSuccess && <p className="mb-4 text-sm text-green-600 p-3 bg-green-100 border border-green-300 rounded">{importSuccess}</p>}
            {deleteFixtureError && <p className="mb-4 text-sm text-red-600 p-3 bg-red-100 border border-red-300 rounded">{deleteFixtureError}</p>}
            {/* Add Generate Results Messages */}
            {generateResultsError && <p className="mb-4 text-sm text-red-600 p-3 bg-red-100 border border-red-300 rounded">{generateResultsError}</p>}
            {generateResultsSuccess && <p className="mb-4 text-sm text-green-600 p-3 bg-green-100 border border-green-300 rounded">{generateResultsSuccess}</p>}
            {error && <p className="mb-4 text-sm text-red-600 p-3 bg-red-100 border border-red-300 rounded">{error}</p>} {/* General fetch error */}


            {/* Import Fixtures Section */}
            <div className="mb-8 p-6 border rounded shadow-md bg-white">
                 <h2 className="text-xl font-semibold mb-4">Import Fixtures from football-data.org</h2>
                  <p className="text-sm text-gray-600 mb-4"> Select the Competition and enter the Matchday number. <br /> Check <a href="https://www.football-data.org/documentation/v4/index.html#competitions" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">football-data.org V4 Docs</a> for codes used. <br /> <strong className="text-orange-700">Note:</strong> This adds fixtures to the current list. </p>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                     {/* Competition Dropdown */}
                     <div>
                         <label htmlFor="competitionCode" className="block mb-1 font-medium text-gray-700 text-sm">Competition:</label>
                         <select id="competitionCode" value={competitionCode} onChange={(e) => setCompetitionCode(e.target.value)} className="border p-2 w-full rounded border-gray-300 focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50 disabled:bg-gray-100 bg-white" disabled={isAnyActionRunning} required >
                             <option value="">-- Select Competition --</option>
                             {COMPETITIONS.map(comp => (<option key={comp.code} value={comp.code}>{comp.name} ({comp.code})</option>))}
                         </select>
                     </div>
                     {/* Matchday Input */}
                     <div>
                         <label htmlFor="matchday" className="block mb-1 font-medium text-gray-700 text-sm">Matchday:</label>
                         <input id="matchday" type="number" value={matchday} onChange={(e) => setMatchday(e.target.value)} placeholder="e.g., 1" min="1" className="border p-2 w-full rounded border-gray-300 focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50 disabled:bg-gray-100" disabled={isAnyActionRunning} required />
                     </div>
                     {/* Import Button */}
                      <div className="md:self-end">
                           <button onClick={handleImportFixtures} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded w-full md:w-auto transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed" disabled={isAnyActionRunning || !competitionCode || !matchday} >
                                {isImporting ? 'Importing...' : 'Import Fixtures'}
                            </button>
                      </div>
                 </div>
            </div>

            {/* Add Fixture Manually Form */}
             <div className="mb-8 p-6 border rounded shadow-md bg-white">
                <h2 className="text-xl font-semibold mb-4">Add Fixture Manually</h2>
                 <form onSubmit={handleAddFixture}>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                        <div> <label htmlFor="homeTeam" className="block mb-1 font-medium text-gray-700 text-sm">Home Team:</label> <input id="homeTeam" type="text" value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)} className="border p-2 w-full rounded border-gray-300 disabled:bg-gray-100" required disabled={isAnyActionRunning} /> </div>
                        <div> <label htmlFor="awayTeam" className="block mb-1 font-medium text-gray-700 text-sm">Away Team:</label> <input id="awayTeam" type="text" value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)} className="border p-2 w-full rounded border-gray-300 disabled:bg-gray-100" required disabled={isAnyActionRunning} /> </div>
                        <div> <label htmlFor="matchTime" className="block mb-1 font-medium text-gray-700 text-sm">Match Time:</label> <input id="matchTime" type="datetime-local" value={matchTime} onChange={(e) => setMatchTime(e.target.value)} className="border p-2 w-full rounded border-gray-300 disabled:bg-gray-100" required disabled={isAnyActionRunning} /> </div>
                        <div className="md:self-end"> <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full md:w-auto transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed" disabled={isAnyActionRunning}> {isAddingFixture ? 'Adding...' : 'Add Fixture'} </button> </div>
                    </div>
                 </form>
             </div>

             {/* --- Add Generate Random Results Button Section --- */}
             <div className="mb-6 text-right">
                 <button
                     onClick={handleGenerateRandomResults}
                     className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                     disabled={isAnyActionRunning || isLoading} // Also disable if main fixture list is loading
                     title="Overwrite results with random scores (0-4) and set status to FINISHED"
                 >
                     {isGeneratingResults ? 'Generating...' : 'Generate Random Results'}
                 </button>
             </div>
             {/* --- End Generate Random Results Button Section --- */}


            {/* Fixture List Table */}
              <h2 className="text-xl font-semibold mb-4">Existing Fixtures</h2>
            {/* Show loading indicator specifically for fixtures */}
            {isLoading && <p className="text-center text-gray-500">Loading fixtures...</p>}
            {/* Show message only if NOT loading and fixtures array is empty */}
            {!isLoading && fixtures.length === 0 && <p className="text-center text-gray-500 italic">No fixtures found for this round. Add one above or import.</p>}
            {/* Show table only if NOT loading and fixtures array has items */}
            {!isLoading && fixtures.length > 0 && (
                 <div className="overflow-x-auto shadow rounded border-b border-gray-200 bg-white">
                      <table className="min-w-full divide-y divide-gray-200">
                        {/* Table Head */}
                        <thead className="bg-gray-100"> <tr> <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">ID</th> <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Home Team</th> <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Away Team</th> <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Time (Local)</th> <th scope="col" className="py-3 px-4 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">Result</th> <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Status</th> <th scope="col" className="py-3 px-4 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th> </tr> </thead>
                        {/* Table Body */}
                         <tbody className="bg-white divide-y divide-gray-200">
                            {fixtures.map(fixture => {
                                const isDeletingThis = deletingFixtureId === fixture.fixtureId;
                                const fixtureDesc = `${fixture.homeTeam} vs ${fixture.awayTeam}`;
                                return (
                                 <tr key={fixture.fixtureId} className={`hover:bg-gray-50 transition-colors duration-150 ${isDeletingThis ? 'opacity-50' : ''}`}> {/* Add fade effect */}
                                      <td className="py-3 px-4 whitespace-nowrap text-sm font-medium text-gray-900">{fixture.fixtureId}</td>
                                      <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-700">{fixture.homeTeam}</td>
                                      <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-700">{fixture.awayTeam}</td>
                                      <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-700">{formatDateTime(fixture.matchTime)}</td>
                                      <td className="py-3 px-4 whitespace-nowrap text-sm text-center text-gray-700"> {fixture.homeScore !== null && fixture.awayScore !== null ? `${fixture.homeScore} - ${fixture.awayScore}` : <span className="text-gray-400 italic">Pending</span>} </td>
                                      <td className="py-3 px-4 whitespace-nowrap text-sm"> <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${ fixture.status === 'FINISHED' ? 'bg-blue-100 text-blue-800' : fixture.status === 'IN_PLAY' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800' }`}> {fixture.status || 'SCHEDULED'} </span> </td>
                                      {/* Actions Cell - Modified */}
                                      <td className="py-3 px-4 whitespace-nowrap text-sm font-medium text-center space-x-2">
                                           {/* Enter/Edit Result Button */}
                                           <button onClick={() => openResultModal(fixture)} className="text-indigo-600 hover:text-indigo-900 hover:underline disabled:text-gray-400 disabled:no-underline" disabled={isAnyActionRunning} title={fixture.homeScore !== null ? "Edit Result" : "Enter Result"} > {fixture.homeScore !== null ? 'Edit' : 'Result'} </button>
                                           {/* Delete Button Added */}
                                           <button onClick={() => handleDeleteFixture(fixture.fixtureId, fixtureDesc)} className="text-red-600 hover:text-red-900 hover:underline disabled:text-gray-400 disabled:no-underline" disabled={isAnyActionRunning} title="Delete Fixture"> {isDeletingThis ? 'Deleting...' : 'Delete'} </button>
                                       </td>
                                      {/* End Actions Cell */}
                                 </tr>
                                );
                            })}
                        </tbody>
                    </table>
                 </div>
            )}

            {/* Result Modal */}
            {selectedFixture && ( <ResultModal fixture={selectedFixture} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmit={handleResultSubmit} /> )}
        </div>
    );
}