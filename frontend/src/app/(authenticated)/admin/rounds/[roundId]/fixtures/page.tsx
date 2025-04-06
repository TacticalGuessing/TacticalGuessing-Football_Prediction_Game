// frontend/src/app/(authenticated)/admin/rounds/[roundId]/fixtures/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'react-hot-toast';
import {
    getRoundFixtures,
    addFixture,
    enterFixtureResult,
    importFixtures,
    deleteFixture,
    generateRandomResults,
    fetchExternalFixtures,
    importSelectedFixtures,
    Fixture,
    PotentialFixture,
    AddFixturePayload,
    ResultPayload,
    ImportFixturesPayload
} from '@/lib/api';
import ConfirmationModal from '@/components/Modal/ConfirmationModal';

// Interface for ResultModal Props (Corrected)
interface ResultModalProps {
  fixture: Fixture;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (fixtureId: number, result: ResultPayload) => Promise<void>;
}

// ResultModal Component (Implementation remains the same)
const ResultModal: React.FC<ResultModalProps> = ({ fixture, isOpen, onClose, onSubmit }) => {
    // ... (modal implementation as before) ...
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
            toast.success(`Result submitted for ${fixture.homeTeam} vs ${fixture.awayTeam}`);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to submit result.";
            setError(message);
            toast.error(`Result submission failed: ${message}`);
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
};


// --- Define Competitions ---
// --- MODIFIED: Added explicit type ---
interface Competition {
    code: string;
    name: string;
}
const COMPETITIONS: Competition[] = [
    { code: 'PL', name: 'Premier League (England)' },
    { code: 'BL1', name: 'Bundesliga (Germany)' },
    { code: 'SA', name: 'Serie A (Italy)' },
    { code: 'PD', name: 'La Liga (Spain)' },
    { code: 'FL1', name: 'Ligue 1 (France)' },
    { code: 'CL', name: 'Champions League' },
    { code: 'ELC', name: 'Championship (England)'},
];

// --- ADD THIS HELPER ---
const formatDateToYYYYMMDD = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Months are 0-indexed
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};
// --- END NEW HELPER ---

export default function AdminRoundFixturesPage() {
    const { token, user, isLoading: isAuthLoading } = useAuth();
    const params = useParams();
    const router = useRouter();
    const rawRoundIdParam = params?.roundId;
    const roundId = Number(rawRoundIdParam);

    // --- Component State ---
    const [fixtures, setFixtures] = useState<Fixture[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null); // General page/fetch error
    const [homeTeam, setHomeTeam] = useState('');
    const [awayTeam, setAwayTeam] = useState('');
    const [matchTime, setMatchTime] = useState('');
    const [isAddingFixture, setIsAddingFixture] = useState(false);
    const [addFixtureError, setAddFixtureError] = useState<string | null>(null); // Inline error for add form
    const [selectedFixture, setSelectedFixture] = useState<Fixture | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    // --- REMOVED unused state: submitResultError ---
    // const [submitResultError, setSubmitResultError] = useState<string | null>(null);
    const [competitionCode, setCompetitionCode] = useState('');
    const [matchday, setMatchday] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);
    const [importSuccess, setImportSuccess] = useState<string | null>(null);
    const [isConfirmDeleteFixtureOpen, setIsConfirmDeleteFixtureOpen] = useState(false);
    const [fixtureToDelete, setFixtureToDelete] = useState<Fixture | null>(null);
    const [isDeletingFixture, setIsDeletingFixture] = useState(false);
    // --- REMOVED unused state: generateResultsError ---
    // const [generateResultsError, setGenerateResultsError] = useState<string | null>(null);
    const [isConfirmGenerateOpen, setIsConfirmGenerateOpen] = useState(false);
    const [isGeneratingResults, setIsGeneratingResults] = useState(false);

    // --- ADD NEW STATE for Date Range Import ---
    const [importDateCompCode, setImportDateCompCode] = useState(''); // Separate state for this section's dropdown
    const [startDate, setStartDate] = useState<string>(() => formatDateToYYYYMMDD(new Date())); // Default to today
    const [endDate, setEndDate] = useState<string>(() => {
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        return formatDateToYYYYMMDD(nextWeek);
    }); // Default to 7 days from today
    const [isFetchingExternal, setIsFetchingExternal] = useState(false); // Loading for fetch button
    const [potentialFixtures, setPotentialFixtures] = useState<PotentialFixture[]>([]); // Results from fetch
    const [fetchError, setFetchError] = useState<string | null>(null); // Error specific to fetch
    const [selectedExternalIds, setSelectedExternalIds] = useState<Set<number>>(new Set()); // Tracks selected fixture external IDs
    const [isImportingSelected, setIsImportingSelected] = useState(false); // Loading for final import button
    // --- END NEW STATE ---

    // --- Fetch Fixtures Function ---
    const fetchRoundAndFixtures = useCallback(async (id: number) => {
        if (!token) { setError("Authentication required."); setIsLoading(false); return; }
        setIsLoading(true);
        setError(null);
        // Removed clearing of unused states
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
        if (!isAuthLoading && (!user || user.role !== 'ADMIN')) { router.push('/dashboard'); return; }
        if (isNaN(roundId)) { if (!isAuthLoading) { setError("Invalid Round ID provided in URL."); setIsLoading(false); setFixtures([]); } return; }
        if (!isAuthLoading) { if (token) { setError(null); fetchRoundAndFixtures(roundId); } else { setError("Authentication required for Admin access."); setIsLoading(false); setFixtures([]); } }
    }, [roundId, token, user, isAuthLoading, fetchRoundAndFixtures, rawRoundIdParam, router]);


    // --- Handlers ---
    const handleAddFixture = async (e: React.FormEvent) => {
        e.preventDefault();
        if (user?.role !== 'ADMIN') return;
        if (isNaN(roundId)) { setAddFixtureError("Invalid Round ID."); return; }
        if (!token) { setAddFixtureError("Authentication error."); return; }
        if (!homeTeam.trim() || !awayTeam.trim() || !matchTime) { toast.error("Please provide home team, away team, and match time."); return; }
        let matchTimeISO: string;
        try { matchTimeISO = new Date(matchTime).toISOString(); if (isNaN(new Date(matchTimeISO).getTime())) throw new Error(); } catch { toast.error("Invalid match time format."); return; }
        if (isAddingFixture || isImporting || isDeletingFixture || isGeneratingResults) return;

        setIsAddingFixture(true);
        setAddFixtureError(null);
        setError(null);
        const payload: AddFixturePayload = { homeTeam: homeTeam.trim(), awayTeam: awayTeam.trim(), matchTime: matchTimeISO };
        try {
            await addFixture(roundId, payload, token);
            toast.success("Fixture added successfully!");
            setHomeTeam(''); setAwayTeam(''); setMatchTime('');
            await fetchRoundAndFixtures(roundId);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to add fixture.';
            setAddFixtureError(message);
            toast.error(`Add fixture failed: ${message}`);
         }
        finally { setIsAddingFixture(false); }
    };

    const openResultModal = (fixture: Fixture) => {
        if (user?.role !== 'ADMIN') return;
        // Removed setting unused submitResultError
        setSelectedFixture(fixture);
        setIsModalOpen(true);
    };

    const handleResultSubmit = async (fixtureId: number, result: ResultPayload): Promise<void> => {
        if (user?.role !== 'ADMIN') throw new Error("Permission Denied.");
        if (isNaN(roundId)) throw new Error("Invalid Round ID.");
        if (!token) throw new Error("Authentication error.");
        // Removed clearing unused states
        try {
            await enterFixtureResult(fixtureId, result, token);
            await fetchRoundAndFixtures(roundId);
        } catch (err) {
             console.error("Error caught in handleResultSubmit (parent):", err);
             throw err;
        }
    };

    const handleImportFixtures = async () => {
        if (user?.role !== 'ADMIN') return;
        if (isNaN(roundId)) { toast.error("Invalid Round ID."); return; }
        if (!token) { toast.error("Authentication error."); return; }
        if (!competitionCode || !matchday) { toast.error("Please select a Competition and provide a Matchday."); return; }
        if (isAddingFixture || isImporting || isDeletingFixture || isGeneratingResults) return;

        setIsImporting(true);
        setImportError(null); setImportSuccess(null); setError(null);
        // Removed clearing unused states
        const payload: ImportFixturesPayload = { roundId: roundId, competitionCode: competitionCode, matchday: matchday };
        try {
            const result = await importFixtures(payload, token);
            setImportSuccess(result.message || `Successfully imported ${result.count} fixtures.`);
            toast.success(result.message || `Successfully imported ${result.count} fixtures.`);
            await fetchRoundAndFixtures(roundId);
        } catch (err: unknown) {
             const message = err instanceof Error ? err.message : 'Failed to import fixtures.';
             setImportError(message);
             toast.error(`Import failed: ${message}`);
         }
        finally { setIsImporting(false); }
    };

    const openDeleteFixtureModal = (fixture: Fixture) => {
        if (user?.role !== 'ADMIN') return;
        setFixtureToDelete(fixture);
        setIsConfirmDeleteFixtureOpen(true);
    };

    const closeDeleteFixtureModal = () => {
        setIsConfirmDeleteFixtureOpen(false);
        setFixtureToDelete(null);
        setIsDeletingFixture(false);
    };

    const handleConfirmDeleteFixture = async () => {
        if (user?.role !== 'ADMIN' || !fixtureToDelete || !token) return;
        const fixtureIdToDelete = fixtureToDelete.fixtureId;
        const fixtureNameToDelete = `${fixtureToDelete.homeTeam} vs ${fixtureToDelete.awayTeam}`;
        setIsDeletingFixture(true);
        setError(null);
        // Removed clearing unused states
        try {
            await deleteFixture(fixtureIdToDelete, token);
            toast.success(`Fixture "${fixtureNameToDelete}" deleted successfully!`);
            await fetchRoundAndFixtures(roundId);
            closeDeleteFixtureModal();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to delete fixture.';
            toast.error(`Delete failed for "${fixtureNameToDelete}": ${message}`);
            closeDeleteFixtureModal();
        } finally {
            setIsDeletingFixture(false);
        }
    };

    const openGenerateRandomModal = () => {
         if (user?.role !== 'ADMIN') return;
         setIsConfirmGenerateOpen(true);
    };

    const closeGenerateRandomModal = () => {
         setIsConfirmGenerateOpen(false);
         setIsGeneratingResults(false);
    };

    const handleConfirmGenerateRandom = async () => {
        if (user?.role !== 'ADMIN' || !token || isNaN(roundId)) return;
        if (isAddingFixture || isImporting || isDeletingFixture || isGeneratingResults) return;

        setIsGeneratingResults(true);
        // Removed clearing unused generateResultsError
        setError(null);
        // Removed clearing other unused states
        try {
            const result = await generateRandomResults(roundId, token);
            toast.success(result.message || `Successfully generated random results for ${result.count} fixtures.`);
            await fetchRoundAndFixtures(roundId);
            closeGenerateRandomModal();
        } catch (err: unknown) {
            console.error(`Error generating random results for round ${roundId}:`, err);
            const message = err instanceof Error ? err.message : 'Failed to generate random results.';
            toast.error(`Generate random failed: ${message}`);
            closeGenerateRandomModal();
        } finally {
             setIsGeneratingResults(false);
        }
    };

    const formatDateTime = (isoString: string | null | undefined): string => {
        if (!isoString) return "N/A";
        try { return new Intl.DateTimeFormat('en-GB', { dateStyle: 'short', timeStyle: 'short', hour12: false }).format(new Date(isoString)); } catch (e) { console.error("Error formatting date:", isoString, e); return "Invalid Date"; }
    };

    // === ADD NEW Handler for Fetching External Fixtures by Date ===
    const handleFetchExternal = async () => {
        if (user?.role !== 'ADMIN' || !token) {
            toast.error("Admin authentication required.");
            return;
        }
        if (!importDateCompCode || !startDate || !endDate) {
            toast.error("Please select a competition and both start/end dates.");
            return;
        }
        if (new Date(endDate) < new Date(startDate)) {
             toast.error("End date cannot be before start date.");
             return;
        }
        // Prevent concurrent actions (check against ALL relevant loading states)
        if (isAddingFixture || isImporting || isDeletingFixture || isGeneratingResults || isFetchingExternal || isImportingSelected) return;

        setIsFetchingExternal(true);
        setFetchError(null);
        setPotentialFixtures([]); // Clear previous results
        setSelectedExternalIds(new Set()); // Clear selection

        try {
            const fetchedData = await fetchExternalFixtures(token, importDateCompCode, startDate, endDate);
            setPotentialFixtures(fetchedData);
            if (fetchedData.length === 0) {
                toast.success("No fixtures found matching the criteria in the external source.");
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to fetch external fixtures.';
            setFetchError(message); // Display error near the fetch UI
            toast.error(`Fetch failed: ${message}`);
        } finally {
            setIsFetchingExternal(false);
        }
    };
    // === END NEW HANDLER ===

    // === ADD NEW Handler for Importing Selected Fixtures ===
const handleImportSelected = async () => {
    if (user?.role !== 'ADMIN' || !token || isNaN(roundId)) {
        toast.error("Admin authentication required or invalid round.");
        return;
    }
    if (selectedExternalIds.size === 0) {
        toast.error("No fixtures selected to import.");
        return;
    }
    // Prevent concurrent actions
    if (isAddingFixture || isImporting || isDeletingFixture || isGeneratingResults || isFetchingExternal || isImportingSelected) return;

    setIsImportingSelected(true);
    setError(null); // Clear general errors
    setFetchError(null); // Clear fetch error specifically

    // Filter the potential fixtures based on the selected IDs
    const fixturesToSubmit = potentialFixtures
        .filter(fixture => selectedExternalIds.has(fixture.externalId))
        .map(({ homeTeam, awayTeam, matchTime }) => ({ // Only send needed fields
            homeTeam,
            awayTeam,
            matchTime
        }));

     console.log(`[handleImportSelected] Submitting ${fixturesToSubmit.length} fixtures for import into round ${roundId}`);

    try {
        const result = await importSelectedFixtures(token, roundId, fixturesToSubmit);
        toast.success(result.message || `Imported ${result.count} fixtures successfully.`);
        // Clear the selection and potential list after successful import
        setPotentialFixtures([]);
        setSelectedExternalIds(new Set());
        setFetchError(null);
        // Refresh the main list of fixtures for this round
        await fetchRoundAndFixtures(roundId);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to import selected fixtures.';
        toast.error(`Import failed: ${message}`);
        // Optionally set the general error state as well
        // setError(message);
    } finally {
        setIsImportingSelected(false);
    }
};
// === END NEW HANDLER ===

    // === ADD NEW Handlers for Checkbox Selection ===
    const handlePotentialFixtureCheckChange = (externalId: number, checked: boolean) => {
        setSelectedExternalIds(prev => {
            const newSet = new Set(prev);
            if (checked) {
                newSet.add(externalId);
            } else {
                newSet.delete(externalId);
            }
            return newSet;
        });
    };

    const handleSelectAllPotentialFixtures = (checked: boolean) => {
        if (checked) {
            // Select all currently displayed potential fixtures
            setSelectedExternalIds(new Set(potentialFixtures.map(f => f.externalId)));
        } else {
            // Deselect all
            setSelectedExternalIds(new Set());
        }
    };


    // --- Render Logic ---
    if (isNaN(roundId) && !isAuthLoading) { /* ... */ }
    if (isAuthLoading) { /* ... */ }
    if (!user || user.role !== 'ADMIN') { return <p className="p-4 text-red-600">Access Denied: You do not have permission to view this admin area.</p>; }
    if (!token) { /* ... */ }

    const isAnyActionRunning = isAddingFixture || isImporting || isDeletingFixture || isGeneratingResults || isFetchingExternal || isImportingSelected;

    //console.log('LOADING STATES:', {
        //isAddingFixture,
        //isImporting, // Matchday import
        //isDeletingFixture,
        //isGeneratingResults, // Admin random generate
        //isFetchingExternal, // Fetch potential by date
        //isImportingSelected, // Import selected by date
        //isAnyActionRunning // Combined result
    //});

    return (
        <div className="p-4 md:p-6">
            {/* Header Section */}
            <div className="flex justify-between items-center mb-6"> <h1 className="text-2xl font-bold">Admin - Fixtures for Round {roundId}</h1> <Link href="/admin" className="text-blue-600 hover:text-blue-800 hover:underline"> ← Back to Rounds List </Link> </div>

            {/* Global Action Messages */}
            {error && <p className="mb-4 text-sm text-red-600 p-3 bg-red-100 border border-red-300 rounded">{error}</p>}
            {addFixtureError && <p className="mb-4 text-sm text-red-600 p-3 bg-red-100 border border-red-300 rounded">{addFixtureError}</p>}
            {importSuccess && <p className="mb-4 text-sm text-green-600 p-3 bg-green-100 border border-green-300 rounded">{importSuccess}</p>}
            {importError && <p className="mb-4 text-sm text-red-600 p-3 bg-red-100 border border-red-300 rounded">{importError}</p>}
            {/* Removed JSX display for submitResultError and generateResultsError */}

            {/* Admin Sections (Conditionally Rendered) */}
            {user?.role === 'ADMIN' && (
                <>

                    {/* === ADD THIS NEW SECTION === */}
                <div className="mb-8 p-6 border rounded shadow-md bg-white border-blue-200">
                <h2 className="text-xl font-semibold mb-4 text-blue-800">Import Fixtures by Date Range</h2>
                <p className="text-sm text-gray-600 mb-4">
                    Fetch fixtures directly from football-data.org for a specific competition within a date range.
                    You can then select which ones to add to this round (Round {roundId}).
                </p>

                {/* Inputs for Date Range Import */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                     {/* Competition Dropdown */}
                     <div className="md:col-span-2">
                         <label htmlFor="importDateCompCode" className="block mb-1 font-medium text-gray-700 text-sm">Competition:</label>
                         <select
                              id="importDateCompCode"
                              value={importDateCompCode}
                              onChange={(e) => setImportDateCompCode(e.target.value)}
                              className="border p-2 w-full rounded border-gray-300 focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50 disabled:bg-gray-100 bg-white"
                              disabled={isAnyActionRunning}
                              required
                         >
                             <option value="">-- Select Competition --</option>
                             {COMPETITIONS.map(comp => (<option key={comp.code} value={comp.code}>{comp.name} ({comp.code})</option>))}
                         </select>
                     </div>
                     {/* Start Date */}
                     <div>
                         <label htmlFor="startDate" className="block mb-1 font-medium text-gray-700 text-sm">Start Date:</label>
                         <input
                             id="startDate"
                             type="date"
                             value={startDate}
                             onChange={(e) => setStartDate(e.target.value)}
                             className="border p-2 w-full rounded border-gray-300 focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50 disabled:bg-gray-100"
                             disabled={isAnyActionRunning}
                             required
                         />
                     </div>
                      {/* End Date */}
                     <div>
                         <label htmlFor="endDate" className="block mb-1 font-medium text-gray-700 text-sm">End Date:</label>
                         <input
                             id="endDate"
                             type="date"
                             value={endDate}
                             onChange={(e) => setEndDate(e.target.value)}
                             className="border p-2 w-full rounded border-gray-300 focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50 disabled:bg-gray-100"
                             disabled={isAnyActionRunning}
                             required
                         />
                     </div>
                 </div>

                 {/* Fetch Button and Error Display */}
                 <div className="flex items-center justify-between mt-4">
                     <button
                         onClick={handleFetchExternal}
                         className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                         disabled={isAnyActionRunning || !importDateCompCode || !startDate || !endDate}
                     >
                         {isFetchingExternal ? 'Fetching...' : 'Fetch Available Fixtures'}
                     </button>
                      {fetchError && <p className="text-sm text-red-600 ml-4">{fetchError}</p>}
                 </div>

                 {/* --- Display Potential Fixtures List --- */}
                 {potentialFixtures.length > 0 && (
                    <div className="mt-6 border-t border-gray-300 pt-4">
                        <h3 className="text-lg font-semibold mb-3 text-gray-800">Potential Fixtures Found ({potentialFixtures.length}):</h3>
                        <div className="mb-4 border rounded-md overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                                            <input
                                                type="checkbox"
                                                className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-offset-0 focus:ring-indigo-200 focus:ring-opacity-50"
                                                checked={selectedExternalIds.size > 0 && selectedExternalIds.size === potentialFixtures.length}
                                                ref={input => { // Handle indeterminate state
                                                    if (input) {
                                                        input.indeterminate = selectedExternalIds.size > 0 && selectedExternalIds.size < potentialFixtures.length;
                                                    }
                                                }}
                                                onChange={(e) => handleSelectAllPotentialFixtures(e.target.checked)}
                                                title="Select/Deselect All"
                                            />
                                        </th>
                                        <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Home Team</th>
                                        <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Away Team</th>
                                        <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time (UTC)</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {potentialFixtures.map((fixture) => (
                                        <tr key={fixture.externalId}>
                                            <td className="px-4 py-2 whitespace-nowrap">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-offset-0 focus:ring-indigo-200 focus:ring-opacity-50"
                                                    checked={selectedExternalIds.has(fixture.externalId)}
                                                    onChange={(e) => handlePotentialFixtureCheckChange(fixture.externalId, e.target.checked)}
                                                />
                                            </td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{fixture.homeTeam}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{fixture.awayTeam}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{formatDateTime(fixture.matchTime)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {/* Import Selected Button */}
                        <div className="text-right">
                            <button
                                onClick={handleImportSelected} // <<< Add this handler in the next step
                                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={isAnyActionRunning || selectedExternalIds.size === 0}
                                title={`Import ${selectedExternalIds.size} selected fixture(s) into Round ${roundId}`}
                            >
                                {isImportingSelected ? 'Importing...' : `Import Selected (${selectedExternalIds.size})`}
                            </button>
                        </div>
                    </div>
                 )}
                 {/* --- End Potential Fixtures List --- */}

            </div>
            {/* === END NEW SECTION === */}

                    {/* Import Fixtures Section */}
                    <div className="mb-8 p-6 border rounded shadow-md bg-white">
                        {/* ... content as before ... */}
                         <h2 className="text-xl font-semibold mb-4">Import Fixtures from football-data.org</h2>
                         <p className="text-sm text-gray-600 mb-4"> Select the Competition and enter the Matchday number. <br /> Check <a href="https://www.football-data.org/documentation/v4/index.html#competitions" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">football-data.org V4 Docs</a> for codes used. <br /> <strong className="text-orange-700">Note:</strong> This adds fixtures to the current list. </p>
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                             <div>
                                 <label htmlFor="competitionCode" className="block mb-1 font-medium text-gray-700 text-sm">Competition:</label>
                                 <select id="competitionCode" value={competitionCode} onChange={(e) => setCompetitionCode(e.target.value)} className="border p-2 w-full rounded border-gray-300 focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50 disabled:bg-gray-100 bg-white" disabled={isAnyActionRunning} required >
                                     <option value="">-- Select Competition --</option>
                                     {COMPETITIONS.map(comp => (<option key={comp.code} value={comp.code}>{comp.name} ({comp.code})</option>))}
                                 </select>
                             </div>
                             <div>
                                 <label htmlFor="matchday" className="block mb-1 font-medium text-gray-700 text-sm">Matchday:</label>
                                 <input id="matchday" type="number" value={matchday} onChange={(e) => setMatchday(e.target.value)} placeholder="e.g., 1" min="1" className="border p-2 w-full rounded border-gray-300 focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50 disabled:bg-gray-100" disabled={isAnyActionRunning} required />
                             </div>
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
                        {addFixtureError && <p className="text-sm text-red-600 mb-3">{addFixtureError}</p>}
                         <form onSubmit={handleAddFixture}>
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                                <div> <label htmlFor="homeTeam" className="block mb-1 font-medium text-gray-700 text-sm">Home Team:</label> <input id="homeTeam" type="text" value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)} className="border p-2 w-full rounded border-gray-300 disabled:bg-gray-100" required disabled={isAnyActionRunning} /> </div>
                                <div> <label htmlFor="awayTeam" className="block mb-1 font-medium text-gray-700 text-sm">Away Team:</label> <input id="awayTeam" type="text" value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)} className="border p-2 w-full rounded border-gray-300 disabled:bg-gray-100" required disabled={isAnyActionRunning} /> </div>
                                <div> <label htmlFor="matchTime" className="block mb-1 font-medium text-gray-700 text-sm">Match Time:</label> <input id="matchTime" type="datetime-local" value={matchTime} onChange={(e) => setMatchTime(e.target.value)} className="border p-2 w-full rounded border-gray-300 disabled:bg-gray-100" required disabled={isAnyActionRunning} /> </div>
                                <div className="md:self-end"> <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full md:w-auto transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed" disabled={isAnyActionRunning}> {isAddingFixture ? 'Adding...' : 'Add Fixture'} </button> </div>
                            </div>
                         </form>
                     </div>

                     {/* Generate Random Results Button Section */}
                     <div className="mb-6 text-right">
                         <button
                             onClick={openGenerateRandomModal}
                             className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                             disabled={isAnyActionRunning || isLoading}
                             title="Overwrite results with random scores (0-4) and set status to FINISHED"
                         >
                             {isGeneratingResults ? 'Generating...' : 'Generate Random Results'}
                         </button>
                     </div>
                </>
            )}

            {/* Fixture List Table */}
            <h2 className="text-xl font-semibold mb-4">Existing Fixtures</h2>
            {isLoading && <p className="text-center text-gray-500">Loading fixtures...</p>}
            {!isLoading && fixtures.length === 0 && <p className="text-center text-gray-500 italic">No fixtures found for this round. {user?.role === 'ADMIN' ? 'Add one above or import.' : ''}</p>}
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
                                {user?.role === 'ADMIN' && (
                                    <th scope="col" className="py-3 px-4 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                                )}
                           </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {fixtures.map(fixture => {
                                // --- REMOVED unused variable: fixtureDesc ---
                                const isDeletingThis = isDeletingFixture && fixtureToDelete?.fixtureId === fixture.fixtureId;
                                return (
                                 <tr key={fixture.fixtureId} className={`hover:bg-gray-50 transition-colors duration-150 ${isDeletingThis ? 'opacity-50' : ''}`}>
                                      <td className="py-3 px-4 whitespace-nowrap text-sm font-medium text-gray-900">{fixture.fixtureId}</td>
                                      <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-700">{fixture.homeTeam}</td>
                                      <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-700">{fixture.awayTeam}</td>
                                      <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-700">{formatDateTime(fixture.matchTime)}</td>
                                      <td className="py-3 px-4 whitespace-nowrap text-sm text-center text-gray-700"> {fixture.homeScore !== null && fixture.awayScore !== null ? `${fixture.homeScore} - ${fixture.awayScore}` : <span className="text-gray-400 italic">Pending</span>} </td>
                                      <td className="py-3 px-4 whitespace-nowrap text-sm"> <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${ fixture.status === 'FINISHED' ? 'bg-blue-100 text-blue-800' : fixture.status === 'IN_PLAY' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800' }`}> {fixture.status || 'SCHEDULED'} </span> </td>
                                      {user?.role === 'ADMIN' && (
                                         <td className="py-3 px-4 whitespace-nowrap text-sm font-medium text-center space-x-2">
                                             <button onClick={() => openResultModal(fixture)} className="text-indigo-600 hover:text-indigo-900 hover:underline disabled:text-gray-400 disabled:no-underline" disabled={isAnyActionRunning || isDeletingThis} title={fixture.homeScore !== null ? "Edit Result" : "Enter Result"} > {fixture.homeScore !== null ? 'Edit' : 'Result'} </button>
                                             <button onClick={() => openDeleteFixtureModal(fixture)} className="text-red-600 hover:text-red-900 hover:underline disabled:text-gray-400 disabled:no-underline" disabled={isAnyActionRunning || isDeletingThis} title="Delete Fixture"> {isDeletingThis ? 'Deleting...' : 'Delete'} </button>
                                         </td>
                                       )}
                                 </tr>
                                );
                            })}
                        </tbody>
                    </table>
                 </div>
            )}

            {/* Result Modal (Conditionally Rendered) */}
            {user?.role === 'ADMIN' && selectedFixture && ( <ResultModal fixture={selectedFixture} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmit={handleResultSubmit} /> )}

            {/* Delete Fixture Confirmation Modal */}
            {user?.role === 'ADMIN' && fixtureToDelete && (
            <ConfirmationModal
                isOpen={isConfirmDeleteFixtureOpen}
                onClose={closeDeleteFixtureModal}
                onConfirm={handleConfirmDeleteFixture}
                title={`Delete Fixture?`}
                message={
                    <>
                        {/* --- MODIFIED: Use HTML entities for quotes --- */}
                        <p>Are you sure you want to delete fixture “{fixtureToDelete.homeTeam} vs {fixtureToDelete.awayTeam}” (ID: {fixtureToDelete.fixtureId})?</p>
                        <p className="font-semibold text-red-700 mt-2">This will also delete ALL associated predictions.</p>
                        <p className="font-semibold text-red-700">This action cannot be undone.</p>
                    </>
                }
                confirmText="Delete Fixture"
                isConfirming={isDeletingFixture}
            />
            )}

            {/* Generate Random Confirmation Modal */}
            {user?.role === 'ADMIN' && (
                <ConfirmationModal
                    isOpen={isConfirmGenerateOpen}
                    onClose={closeGenerateRandomModal}
                    onConfirm={handleConfirmGenerateRandom}
                    title="Generate Random Results?"
                    message={
                        <>
                            <p>Are you sure you want to generate random scores (0-4) for <span className="font-semibold">ALL</span> fixtures in Round {roundId}?</p>
                            <p className="font-semibold text-orange-700 mt-2">This will overwrite any existing results and mark fixtures as FINISHED.</p>
                        </>
                    }
                    confirmText="Generate Results"
                    isConfirming={isGeneratingResults}
                />
            )}

        </div> // End page container
    );
}