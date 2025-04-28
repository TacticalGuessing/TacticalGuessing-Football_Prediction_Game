// frontend/src/app/(authenticated)/admin/rounds/[roundId]/fixtures/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
//import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'react-hot-toast';
import {
    getRoundFixtures,
    addFixture,
    enterFixtureResult,
    //importFixtures,
    deleteFixture,
    generateRandomResults,
    fetchExternalFixtures,
    importSelectedFixtures,
    Fixture,
    PotentialFixture,
    AddFixturePayload,
    ResultPayload,
    fetchRoundResultsAdmin,
    ApiError,
    //ImportFixturesPayload
} from '@/lib/api';
import ConfirmationModal from '@/components/Modal/ConfirmationModal'; // Keep using this for now

// --- UI Component Imports ---
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'; // Removed CardFooter as it wasn't used
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { FaEdit, FaTrashAlt, FaFileUpload, FaPlus, FaExternalLinkAlt, FaSyncAlt } from 'react-icons/fa';
import Spinner from '@/components/ui/Spinner';

// --- ResultModal using UI components ---
interface ResultModalProps {
  fixture: Fixture;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (fixtureId: number, result: ResultPayload) => Promise<void>;
}

const ResultModal: React.FC<ResultModalProps> = ({ fixture, isOpen, onClose, onSubmit }) => {
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
             <Card className="w-full max-w-md dark:bg-gray-800">
                <CardHeader>
                    <CardTitle>Enter Result</CardTitle>
                    <CardDescription>{fixture.homeTeam} vs {fixture.awayTeam} (ID: {fixture.fixtureId})</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit}>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className='space-y-1.5'>
                                <Label htmlFor="homeScore">{fixture.homeTeam} Score</Label>
                                <Input type="number" id="homeScore" value={homeScore} onChange={(e) => setHomeScore(e.target.value)} min="0" required disabled={isSubmitting} />
                            </div>
                            <div className='space-y-1.5'>
                                <Label htmlFor="awayScore">{fixture.awayTeam} Score</Label>
                                <Input type="number" id="awayScore" value={awayScore} onChange={(e) => setAwayScore(e.target.value)} min="0" required disabled={isSubmitting} />
                            </div>
                        </div>
                         {error && <p className="text-red-600 dark:text-red-400 text-sm mb-3">{error}</p>}
                        <div className="flex justify-end gap-3 mt-4">
                            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
                            <Button type="submit" disabled={isSubmitting} isLoading={isSubmitting}>Submit Result</Button>
                        </div>
                    </form>
                </CardContent>
             </Card>
        </div>
    );
};
// --- END ResultModal ---


// --- Define Competitions ---
interface Competition { code: string; name: string; }
const COMPETITIONS: Competition[] = [
    { code: 'PL', name: 'Premier League (England)' },
    { code: 'BL1', name: 'Bundesliga (Germany)' },
    { code: 'SA', name: 'Serie A (Italy)' },
    { code: 'PD', name: 'La Liga (Spain)' },
    { code: 'FL1', name: 'Ligue 1 (France)' },
    { code: 'CL', name: 'Champions League' },
    { code: 'ELC', name: 'Championship (England)'},
];

// --- Date Helper ---
const formatDateToYYYYMMDD = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// --- Date Time Formatting Helper ---
const formatDateTime = (isoString: string | null | undefined): string => {
    if (!isoString) return "N/A";
    try {
        return new Intl.DateTimeFormat('en-GB', { dateStyle: 'short', timeStyle: 'short', hour12: false }).format(new Date(isoString));
    } catch (e) {
        console.error("Error formatting date:", isoString, e);
        return "Invalid Date";
    }
};


export default function AdminRoundFixturesPage() {
    const { token, user, isLoading: isAuthLoading } = useAuth();
    const params = useParams();
    const router = useRouter();
    const rawRoundIdParam = params?.roundId;
    const roundId = Number(rawRoundIdParam);

    // --- Component State (Identical to original) ---
    const [fixtures, setFixtures] = useState<Fixture[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [homeTeam, setHomeTeam] = useState('');
    const [awayTeam, setAwayTeam] = useState('');
    const [matchTime, setMatchTime] = useState('');
    const [isAddingFixture, setIsAddingFixture] = useState(false);
    const [addFixtureError, setAddFixtureError] = useState<string | null>(null);
    const [selectedFixture, setSelectedFixture] = useState<Fixture | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    //const [competitionCode, setCompetitionCode] = useState('');
    //const [matchday, setMatchday] = useState('');
    //const [isImporting, setIsImporting] = useState(false); // For matchday import
    //const [importError, setImportError] = useState<string | null>(null); // For matchday import
    const [importSuccess, setImportSuccess] = useState<string | null>(null); // For any import success
    const [isConfirmDeleteFixtureOpen, setIsConfirmDeleteFixtureOpen] = useState(false);
    const [fixtureToDelete, setFixtureToDelete] = useState<Fixture | null>(null);
    const [isDeletingFixture, setIsDeletingFixture] = useState(false);
    const [isConfirmGenerateOpen, setIsConfirmGenerateOpen] = useState(false);
    const [isGeneratingResults, setIsGeneratingResults] = useState(false);
    const [importDateCompCode, setImportDateCompCode] = useState('');
    const [startDate, setStartDate] = useState<string>(() => formatDateToYYYYMMDD(new Date()));
    const [endDate, setEndDate] = useState<string>(() => { const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7); return formatDateToYYYYMMDD(nextWeek); });
    const [isFetchingExternal, setIsFetchingExternal] = useState(false);
    const [potentialFixtures, setPotentialFixtures] = useState<PotentialFixture[]>([]);
    const [fetchError, setFetchError] = useState<string | null>(null); // For date range fetch
    const [selectedExternalIds, setSelectedExternalIds] = useState<Set<number>>(new Set());
    const [isImportingSelected, setIsImportingSelected] = useState(false); // For date range import
    // --- ADD State for Fetching Results ---
    const [isFetchingResults, setIsFetchingResults] = useState(false);

    // --- Fetch Fixtures Function (Identical to original) ---
    const fetchRoundAndFixtures = useCallback(async (id: number) => {
        if (!token) { setError("Authentication required."); setIsLoading(false); return; }
        setIsLoading(true); setError(null);
        try {
            const fixturesData = await getRoundFixtures(id, token);
            setFixtures(fixturesData || []);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to load fixture data.';
            setError(message); setFixtures([]);
        } finally { setIsLoading(false); }
    }, [token]);

    // --- Initial Load/ID Change Effect (Identical to original) ---
    useEffect(() => {
        if (!isAuthLoading && (!user || user.role !== 'ADMIN')) { router.push('/dashboard'); return; }
        if (isNaN(roundId)) { if (!isAuthLoading) { setError("Invalid Round ID provided in URL."); setIsLoading(false); setFixtures([]); } return; }
        if (!isAuthLoading) { if (token) { setError(null); fetchRoundAndFixtures(roundId); } else { setError("Authentication required for Admin access."); setIsLoading(false); setFixtures([]); } }
    }, [roundId, token, user, isAuthLoading, fetchRoundAndFixtures, rawRoundIdParam, router]);

    // --- Handlers (Identical to original) ---
    const handleAddFixture = async (e: React.FormEvent) => {
        e.preventDefault();
        if (user?.role !== 'ADMIN') return;
        if (isNaN(roundId)) { setAddFixtureError("Invalid Round ID."); return; }
        if (!token) { setAddFixtureError("Authentication error."); return; }
        if (!homeTeam.trim() || !awayTeam.trim() || !matchTime) { toast.error("Please provide home team, away team, and match time."); return; }
        let matchTimeISO: string;
        try { matchTimeISO = new Date(matchTime).toISOString(); if (isNaN(new Date(matchTimeISO).getTime())) throw new Error(); } catch { toast.error("Invalid match time format."); return; }
        // Updated check to include all relevant states
        if (isAddingFixture || isDeletingFixture || isGeneratingResults || isFetchingExternal || isImportingSelected) return;

        setIsAddingFixture(true);
        setAddFixtureError(null); setError(null);
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
        setSelectedFixture(fixture);
        setIsModalOpen(true);
    };

    const handleResultSubmit = async (fixtureId: number, result: ResultPayload): Promise<void> => {
        if (user?.role !== 'ADMIN') throw new Error("Permission Denied.");
        if (isNaN(roundId)) throw new Error("Invalid Round ID.");
        if (!token) throw new Error("Authentication error.");
        try {
            await enterFixtureResult(fixtureId, result, token);
            await fetchRoundAndFixtures(roundId);
        } catch (err) {
             console.error("Error caught in handleResultSubmit (parent):", err);
             throw err;
        }
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
        setIsDeletingFixture(true); setError(null);
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
             // setIsDeletingFixture is reset in closeDeleteFixtureModal
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
        // Updated check
        if (isAddingFixture || isDeletingFixture || isGeneratingResults || isFetchingExternal || isImportingSelected) return;

        setIsGeneratingResults(true); setError(null);
        try {
            const result = await generateRandomResults(roundId, token);
            const successMsg = result.message || `Successfully generated random results for ${result.count} fixtures.`;
            toast.success(successMsg);
            await fetchRoundAndFixtures(roundId);
            closeGenerateRandomModal();
        } catch (err: unknown) {
            console.error(`Error generating random results for round ${roundId}:`, err);
            const message = err instanceof Error ? err.message : 'Failed to generate random results.';
            toast.error(`Generate random failed: ${message}`);
            closeGenerateRandomModal();
        } finally {
            // setIsGeneratingResults is reset in closeGenerateRandomModal
        }
    };

    // Handler for Fetching External Fixtures by Date (Identical to original)
    const handleFetchExternal = async () => {
        if (user?.role !== 'ADMIN' || !token) { toast.error("Admin authentication required."); return; }
        if (!importDateCompCode || !startDate || !endDate) { toast.error("Please select a competition and both start/end dates."); return; }
        if (new Date(endDate) < new Date(startDate)) { toast.error("End date cannot be before start date."); return; }
        if (isAddingFixture || isDeletingFixture || isGeneratingResults || isFetchingExternal || isImportingSelected) return;

        setIsFetchingExternal(true);
        setFetchError(null); setPotentialFixtures([]); setSelectedExternalIds(new Set());
        try {
            const fetchedData = await fetchExternalFixtures(token, importDateCompCode, startDate, endDate);
            console.log("[handleFetchExternal] Data received from API:", fetchedData);
            setPotentialFixtures(fetchedData);
            if (fetchedData.length === 0) { toast.success("No fixtures found matching the criteria."); }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to fetch external fixtures.';
            setFetchError(message); toast.error(`Fetch failed: ${message}`);
        } finally { setIsFetchingExternal(false); }
    };

    // Handler for Importing Selected Fixtures (Identical to original)
    const handleImportSelected = async () => {
        if (user?.role !== 'ADMIN' || !token || isNaN(roundId)) { toast.error("Admin authentication required or invalid round."); return; }
        if (selectedExternalIds.size === 0) { toast.error("No fixtures selected to import."); return; }
        if (isAddingFixture || isDeletingFixture || isGeneratingResults || isFetchingExternal || isImportingSelected) return;

        setIsImportingSelected(true); setError(null); setFetchError(null);
        const fixturesToSubmit = potentialFixtures
            .filter(fixture => selectedExternalIds.has(fixture.externalId))
            .map(({ externalId, homeTeam, awayTeam, matchTime, homeTeamCrestUrl, awayTeamCrestUrl }) => ({ // <<< Destructure crests
                               externalId,
                               homeTeam,
                               awayTeam,
                               matchTime,
                               homeTeamCrestUrl, // <<< Include crest
                               awayTeamCrestUrl  // <<< Include crest
                           }));
                
                       console.log("[handleImportSelected] Payload being sent to backend:", fixturesToSubmit);
        try {
            const result = await importSelectedFixtures(token, roundId, fixturesToSubmit);
            const successMsg = result.message || `Imported ${result.count} fixtures successfully.`;
            setImportSuccess(successMsg); toast.success(successMsg);
            setPotentialFixtures([]); setSelectedExternalIds(new Set()); setFetchError(null);
            setImportDateCompCode(''); // Reset date range form on success
            await fetchRoundAndFixtures(roundId);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to import selected fixtures.';
            toast.error(`Import failed: ${message}`);
        } finally { setIsImportingSelected(false); }
    };

    // Checkbox Handlers (Identical to original)
    const handlePotentialFixtureCheckChange = (externalId: number, checked: boolean) => {
        setSelectedExternalIds(prev => { const newSet = new Set(prev); if (checked) newSet.add(externalId); else newSet.delete(externalId); return newSet; });
    };
    const handleSelectAllPotentialFixtures = (checked: boolean) => {
        setSelectedExternalIds(checked ? new Set(potentialFixtures.map(f => f.externalId)) : new Set());
    };

    const handleFetchResults = async () => {
        if (user?.role !== 'ADMIN' || !token || isNaN(roundId)) {
            toast.error("Admin authentication required or invalid round.");
            return;
        }
        // Update check to include isFetchingResults
        if (isAddingFixture || isDeletingFixture || isGeneratingResults || isFetchingExternal || isImportingSelected || isFetchingResults) {
             toast.error("Another action is already in progress.");
             return;
        }

        setIsFetchingResults(true);
        setError(null); // Clear previous page errors
        const toastId = toast.loading("Fetching latest results...");

        try {
            const result = await fetchRoundResultsAdmin(roundId, token); // Call the API function
            toast.success(result.message || `Fetched results: ${result.updatedCount} fixtures updated.`, { id: toastId });
            await fetchRoundAndFixtures(roundId); // Refresh the fixture list on the page
        } catch (err: unknown) {
            console.error(`Error fetching results for round ${roundId}:`, err);
            const message = err instanceof ApiError ? err.message : 'Failed to fetch results.';
            toast.error(`Fetch failed: ${message}`, { id: toastId });
            setError(message); // Optionally display error on page too
        } finally {
            setIsFetchingResults(false);
        }
    };
    // --- END Handlers ---


    // --- Render Logic ---
    if (isNaN(roundId) && !isAuthLoading) return <p className="p-4 text-red-600 dark:text-red-400">Invalid Round ID.</p>;
    if (isAuthLoading) return <p className="p-4 text-gray-500 dark:text-gray-400">Loading...</p>;
    if (!user || user.role !== 'ADMIN') return <p className="p-4 text-red-600 dark:text-red-400">Access Denied.</p>;
    if (!token) return <p className="p-4 text-red-600 dark:text-red-400">Auth Error.</p>;

    const isAnyActionRunning = isAddingFixture || isDeletingFixture || isGeneratingResults || isFetchingExternal || isImportingSelected;

    const sectionContainerClasses = "bg-gray-800 rounded-lg shadow border border-gray-700 p-6";

    // ===============================================================
    // ==================== START OF JSX (Refactored) ====================
    // ===============================================================
    return (
        <div className="space-y-6 p-4 md:p-6">
            {/* --- Header --- */}
            

            {/* --- Global Messages --- */}
            {error && <p className="text-sm text-red-600 dark:text-red-400 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800 rounded">{error}</p>}
            {importSuccess && <p className="text-sm text-green-600 dark:text-green-400 p-3 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-800 rounded">{importSuccess}</p>}

            {/* --- Admin Sections --- */}
            {user?.role === 'ADMIN' && (
                <div className="space-y-6">
                    {/* --- Import by Date Card --- */}
                    <div className="bg-gray-800 rounded-lg shadow border border-gray-700 p-6"><h2 className="text-xl font-semibold mb-1 text-gray-200">Import Fixtures by Date Range</h2>
                    <p className="text-sm text-gray-400 mb-4">Fetch & select fixtures from football-data.org for Round {roundId}.</p><div className="space-y-4 pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                            <div className="md:col-span-2 space-y-1.5"><Label htmlFor="idc-date">Competition</Label><Select onValueChange={setImportDateCompCode} value={importDateCompCode} disabled={isAnyActionRunning}><SelectTrigger id="idc-date"><SelectValue placeholder="-- Select --" /></SelectTrigger><SelectContent>{COMPETITIONS.map(c => <SelectItem key={c.code} value={c.code}>{c.name} ({c.code})</SelectItem>)}</SelectContent></Select></div>
                            <div className='space-y-1.5'><Label htmlFor="startDate">Start Date</Label><Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={isAnyActionRunning} required /></div>
                            <div className='space-y-1.5'><Label htmlFor="endDate">End Date</Label><Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={isAnyActionRunning} required /></div>
                        </div>
                        <div className="flex items-center justify-between"><Button onClick={handleFetchExternal} disabled={isAnyActionRunning || !importDateCompCode || !startDate || !endDate} isLoading={isFetchingExternal}><FaExternalLinkAlt className="mr-2 h-4 w-4" /> Fetch Available</Button>{fetchError && <p className="text-sm text-red-600 dark:text-red-400 ml-4">{fetchError}</p>}</div>
                        {potentialFixtures.length > 0 && (<div className="mt-4 border-t dark:border-gray-700 pt-4 space-y-3">
                            <h3 className="text-md font-semibold">Select Fixtures ({potentialFixtures.length} Found):</h3>
                            <div className="border rounded-md overflow-x-auto dark:border-gray-700"><Table><TableHeader><TableRow>
                                <TableHead className="w-10 px-2"><Checkbox id="sel-all" checked={selectedExternalIds.size > 0 && (selectedExternalIds.size === potentialFixtures.length ? true : 'indeterminate')} onCheckedChange={(c) => handleSelectAllPotentialFixtures(!!c)} aria-label="Select all"/></TableHead>
                                <TableHead>Home</TableHead><TableHead>Away</TableHead><TableHead>Date/Time (UTC)</TableHead>
                            </TableRow></TableHeader><TableBody>
                                {potentialFixtures.map(f => (<TableRow key={f.externalId}>
                                    <TableCell className="px-2"><Checkbox id={`p-${f.externalId}`} checked={selectedExternalIds.has(f.externalId)} onCheckedChange={(c) => handlePotentialFixtureCheckChange(f.externalId, !!c)} aria-label={`Select ${f.homeTeam} vs ${f.awayTeam}`}/></TableCell>
                                    <TableCell>{f.homeTeam}</TableCell><TableCell>{f.awayTeam}</TableCell><TableCell className="text-xs text-gray-500 dark:text-gray-400">{formatDateTime(f.matchTime)}</TableCell>
                                </TableRow>))}
                            </TableBody></Table></div>
                            <div className="text-right"><Button onClick={handleImportSelected} disabled={isAnyActionRunning || selectedExternalIds.size === 0} isLoading={isImportingSelected} variant="secondary"><FaFileUpload className="mr-2 h-4 w-4" /> Import Selected ({selectedExternalIds.size})</Button></div>
                        </div>)}
                    </div></div>

                    

                    {/* --- Add Manually Card --- */}
                    <div className="bg-gray-800 rounded-lg shadow border border-gray-700 p-6"><h2 className="text-xl font-semibold mb-1 text-gray-200">Add Fixture Manually</h2>
                    {/* Moved error below description */}
                    <p className="text-sm text-gray-400 mb-4">Add a single fixture if it cannot be imported.</p>
                    {addFixtureError && <p className="text-sm text-red-400 mb-3">{addFixtureError}</p>}<div>
                        <form onSubmit={handleAddFixture}><div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                            <div className='space-y-1.5'><Label htmlFor="homeTeam">Home Team</Label><Input id="homeTeam" type="text" value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)} required disabled={isAnyActionRunning} /></div>
                            <div className='space-y-1.5'><Label htmlFor="awayTeam">Away Team</Label><Input id="awayTeam" type="text" value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)} required disabled={isAnyActionRunning} /></div>
                            <div className='space-y-1.5'><Label htmlFor="matchTime">Match Time (Local)</Label><Input id="matchTime" type="datetime-local" value={matchTime} onChange={(e) => setMatchTime(e.target.value)} required disabled={isAnyActionRunning} /></div>
                            <div><Button type="submit" className="w-full md:w-auto" disabled={isAnyActionRunning} isLoading={isAddingFixture}><FaPlus className="mr-2 h-4 w-4" /> Add Fixture</Button></div>
                        </div></form>
                    </div></div>

                    {/* --- Generate Random Results Section --- */}
                    
                </div> // End Admin Sections Wrapper
            )}

            

            {/* --- Existing Fixtures Table Section --- */}
            <div className={`${sectionContainerClasses} mt-8`}> {/* Use styled div, add margin-top */}
                {/* Optional header */}
                <div className="px-6 py-4 border-b border-gray-700 flex justify-between items-center"> {/* Header inside container */}
                     <div> {/* Wrapper for text */}
                         <h2 className="text-xl font-semibold text-gray-200">Existing Fixtures ({fixtures.length})</h2>
                         <p className="text-sm text-gray-400 mt-1">Manage results for fixtures currently in Round {roundId}.</p>
                     </div>
                     <div className="flex items-center gap-2"> {/* Wrapper for the button */}

                            {/* --- ADD Fetch Results Button --- */}
                          <Button
                          onClick={handleFetchResults}
                          variant="outline" // Or another variant
                          size="sm"
                          disabled={isAnyActionRunning || isLoading || isFetchingResults} // Disable during any action
                          isLoading={isFetchingResults}
                          title="Fetch Latest Results from External API"
                      >
                          <FaSyncAlt className={`mr-2 h-4 w-4 ${isFetchingResults ? 'animate-spin' : ''}`} /> {/* Add icon with optional spin */}
                          Fetch Results
                      </Button>
                      {/* --- END Fetch Results Button --- */}
                          {/* Generate Random Button */}
                          <Button
                              onClick={openGenerateRandomModal}
                              variant="primary" // Or outline/ghost if preferred
                              size="sm"
                              disabled={isAnyActionRunning || isLoading || fixtures.length === 0}
                              isLoading={isGeneratingResults}
                              title="Generate Random Results"
                              className="p-2" // Adjust padding for icon button
                          >
                              <Image src="/Random.png" alt="Generate Random Results" width={20} height={20} />
                              <span className="sr-only">Generate Random Results</span>
                          </Button>
                     </div>
                </div>

                {/* Loading/Empty States */}
                {isLoading && <div className="text-center p-6 text-gray-400"><Spinner className="inline w-5 h-5 mr-2"/> Loading fixtures...</div>}
                {!isLoading && fixtures.length === 0 && !error && <p className="text-center text-gray-400 italic py-6">No fixtures found for this round.</p>}

                {/* Table Container - border/rounding removed */}
                {!isLoading && fixtures.length > 0 && (
                    <div className="overflow-x-auto"> {/* Removed border/rounded */}
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {/* Header Cells: 1=ID, 2=Home, 3=Away, 4=Time, 5=Result, 6=Status, 7=Actions(Admin only) */}
                                    <TableHead className="w-[50px] px-6 py-3">ID</TableHead>
                                    <TableHead className="px-6 py-3">Home</TableHead>
                                    <TableHead className="px-6 py-3">Away</TableHead>
                                    <TableHead className="px-6 py-3">Time (Local)</TableHead>
                                    <TableHead className="text-center w-[100px] px-6 py-3">Result</TableHead>
                                    <TableHead className="text-center w-[120px] px-6 py-3">Status</TableHead>
                                    {user?.role === 'ADMIN' && <TableHead className="text-center w-[100px] px-6 py-3">Actions</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {fixtures.map(fixture => {
                                    const isDeletingThis = isDeletingFixture && fixtureToDelete?.fixtureId === fixture.fixtureId;
                                    const statusClass = fixture.status === 'FINISHED' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' : fixture.status === 'IN_PLAY' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 animate-pulse' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
                                    return (
                                    <TableRow key={fixture.fixtureId} data-state={isDeletingThis ? 'disabled' : undefined} className={isDeletingThis ? 'opacity-50 pointer-events-none' : ''}>
                                        {/* Cell 1: ID */}
                                        <TableCell className="font-medium px-6 py-4 align-middle">{fixture.fixtureId}</TableCell>
                                        {/* Cell 2: Home */}
                                        <TableCell className="px-6 py-4 align-middle">{fixture.homeTeam}</TableCell>
                                        {/* Cell 3: Away */}
                                        <TableCell className="px-6 py-4 align-middle">{fixture.awayTeam}</TableCell>
                                        {/* Cell 4: Time */}
                                        <TableCell className="text-xs text-gray-400 px-6 py-4 align-middle">{formatDateTime(fixture.matchTime)}</TableCell>
                                        {/* Cell 5: Result */}
                                        <TableCell className="text-center font-mono px-6 py-4 align-middle">{fixture.homeScore !== null && fixture.awayScore !== null ? `${fixture.homeScore}-${fixture.awayScore}` : <span className="text-gray-500 italic text-xs">Pend</span>}</TableCell>
                                        {/* Cell 6: Status */}
                                        <TableCell className="text-center px-6 py-4 align-middle">
                                            <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}`}>{fixture.status || 'SCHED'}</span>
                                        </TableCell>
                                        {/* Cell 7: Actions (Conditional) - Only rendered for ADMIN users */}
                                        {user?.role === 'ADMIN' && (
                                            <TableCell className="text-center px-6 py-4 align-middle">
                                                <div className="flex items-center justify-center space-x-1">
                                                    {/* Edit/Enter Result Button */}
                                                    <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white" onClick={() => openResultModal(fixture)} disabled={isAnyActionRunning || isDeletingThis} title={fixture.homeScore !== null ? "Edit Result" : "Enter Result"}>
                                                        <FaEdit className="h-4 w-4" />
                                                        <span className="sr-only">{fixture.homeScore !== null ? 'Edit' : 'Result'}</span>
                                                    </Button>
                                                    {/* Delete Button */}
                                                    <Button variant="ghost" size="sm" className="text-gray-400 hover:text-red-400 hover:bg-red-900/30" onClick={() => openDeleteFixtureModal(fixture)} disabled={isAnyActionRunning || isDeletingThis} isLoading={isDeletingThis} title="Delete Fixture">
                                                        <FaTrashAlt className="h-4 w-4" />
                                                        <span className="sr-only">Delete</span>
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                 )}
            </div>
             {/* --- End Existing Fixtures Section --- */}

            {/* --- Modals --- */}
            {user?.role === 'ADMIN' && selectedFixture && ( <ResultModal fixture={selectedFixture} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmit={handleResultSubmit} /> )}
            {user?.role === 'ADMIN' && fixtureToDelete && ( <ConfirmationModal isOpen={isConfirmDeleteFixtureOpen} onClose={closeDeleteFixtureModal} onConfirm={handleConfirmDeleteFixture} title={`Delete Fixture?`} message={<> <p>Delete fixture “{fixtureToDelete.homeTeam} vs {fixtureToDelete.awayTeam}” (ID: {fixtureToDelete.fixtureId})?</p> <p className="font-semibold text-red-700 dark:text-red-400 mt-2">Associated predictions will also be deleted. Cannot be undone.</p> </>} confirmText="Delete Fixture" isConfirming={isDeletingFixture} /> )}
            {user?.role === 'ADMIN' && ( <ConfirmationModal isOpen={isConfirmGenerateOpen} onClose={closeGenerateRandomModal} onConfirm={handleConfirmGenerateRandom} title="Generate Random Results?" message={<> <p>Generate random scores (0-4) for ALL fixtures in Round {roundId}?</p> <p className="font-semibold text-orange-600 dark:text-orange-400 mt-2">Overwrites existing results & marks fixtures FINISHED.</p> </>} confirmText="Generate Results" isConfirming={isGeneratingResults} /> )}

        </div> // End page container
    );
    // ===============================================================
    // ===================== END OF JSX ==============================
    // ===============================================================
}