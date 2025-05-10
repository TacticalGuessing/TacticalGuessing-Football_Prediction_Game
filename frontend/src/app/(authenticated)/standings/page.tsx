// frontend/src/app/(authenticated)/standings/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
    getMyLeagues, MyLeagueInfo,
    getStandings, // Global standings
    getLeagueStandings, // League-specific standings
    StandingEntry, // Ensure this type includes ALL card fields
    ApiError
} from '@/lib/api';

// UI Components
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import Spinner from '@/components/ui/Spinner';
import Avatar from '@/components/Avatar';
import MovementIndicator from '@/components/Standings/MovementIndicator';
import PlayerCard from '@/components/PlayerCard/PlayerCard'; // Import PlayerCard
import ConfirmationModal from '@/components/Modal/ConfirmationModal'; // Use for modal structure
import { FaTrophy, FaFilter } from 'react-icons/fa';
import { Label } from '@/components/ui/Label'; // Import Label
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'; // Keep Card imports
//import { Button } from '@/components/ui/Button'; // Import Button for modal close

export default function StandingsPage() {
    const { token, isLoading: isAuthLoading } = useAuth();

    // State
    const [myLeagues, setMyLeagues] = useState<MyLeagueInfo[]>([]);
    const [isLoadingLeagues, setIsLoadingLeagues] = useState(true);
    const [selectedLeagueId, setSelectedLeagueId] = useState<string>('global'); // Default to 'global'
    const [standings, setStandings] = useState<StandingEntry[]>([]);
    const [isLoadingStandings, setIsLoadingStandings] = useState(true); // Start true for initial load
    const [standingsError, setStandingsError] = useState<string | null>(null);
    const [tableTitle, setTableTitle] = useState('Overall Standings'); // Start with Overall title

    // --- State for Player Card Modal ---
    const [isCardModalOpen, setIsCardModalOpen] = useState(false);
    const [selectedPlayerData, setSelectedPlayerData] = useState<StandingEntry | null>(null);

    // Define consistent styling for the select container if needed
    const selectContainerClasses = "bg-gray-800 rounded-lg shadow border border-gray-700 p-4 mb-6"; // Use rounded-lg

    // --- Fetch Leagues ---
    const fetchLeaguesForDropdown = useCallback(async () => {
        if (!token) { setIsLoadingLeagues(false); return; }
        setIsLoadingLeagues(true);
        try {
            const data = await getMyLeagues(token);
            setMyLeagues(data || []);
        } catch (err) {
            console.error("Failed to fetch leagues for dropdown:", err);
        } finally {
            setIsLoadingLeagues(false);
        }
    }, [token]);

    // --- Fetch Standings (Handles Global or League specific) ---
    const fetchStandings = useCallback(async (leagueIdStr: string) => { // Renamed param for clarity
        if (!token) { setIsLoadingStandings(false); return; } // Don't proceed without token

        setIsLoadingStandings(true);
        setStandingsError(null);
        setStandings([]); // Clear previous

        // Determine title early based on selection
        const newTitle = leagueIdStr === 'global'
            ? 'Overall Standings'
            : myLeagues.find(l => String(l.leagueId) === leagueIdStr)?.name + ' Standings' || `League Standings`;
        setTableTitle(newTitle);

        try {
            let data: StandingEntry[];
            if (leagueIdStr === 'global') {
                console.log("Fetching GLOBAL standings...");
                data = await getStandings(token); // Ensure getStandings returns ALL needed card fields
            } else {
                const leagueIdNum = parseInt(leagueIdStr, 10);
                if (isNaN(leagueIdNum)) throw new Error("Invalid League ID selected");
                console.log(`Fetching standings for LEAGUE ID: ${leagueIdNum}...`);
                data = await getLeagueStandings(leagueIdNum, token); // Ensure this returns ALL needed card fields
            }
            // Log data to verify fields
            console.log(`[StandingsPage fetchStandings] Data received for ${newTitle}:`, data);
            setStandings(data || []);

        } catch (err) {
            console.error(`fetchStandings: ERROR for ${leagueIdStr}:`, err);
            const message = err instanceof ApiError ? err.message : (err instanceof Error ? err.message : 'Failed to fetch standings.');
            setStandingsError(message);
            setStandings([]);
            setTableTitle(`Error Loading Standings`); // Update title on error
        } finally {
            setIsLoadingStandings(false);
        }
    }, [token, myLeagues]); // Depends on myLeagues for title name


    // --- Effects ---
    // Initial fetch for leagues AND initial overall standings
    useEffect(() => {
        if (token && !isAuthLoading) {
            fetchLeaguesForDropdown();
            // Fetch initial standings (overall) only once after auth is confirmed
            fetchStandings('global');
        } else if (!isAuthLoading && !token) {
            setIsLoadingLeagues(false); // Ensure loading stops if logged out
            setIsLoadingStandings(false);
        }
        // Rule disabled as fetchStandings depends on myLeagues which is fetched by fetchLeaguesForDropdown
        // causing potential loop if included directly without careful management.
        // Initial fetch logic handles this sequence.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, isAuthLoading, fetchLeaguesForDropdown]);


    // Handle dropdown change
    const handleLeagueChange = (value: string) => {
        if (value === selectedLeagueId) return; // Avoid refetch if selection hasn't changed
        setSelectedLeagueId(value);
        fetchStandings(value); // Fetch new standings based on selection
    };

    // --- Handlers for Player Card Modal ---
    const openPlayerCardModal = (playerData: StandingEntry) => {
        setSelectedPlayerData(playerData);
        setIsCardModalOpen(true);
    };

    const closePlayerCardModal = () => {
        setIsCardModalOpen(false);
        // No need for timeout if modal transition handles it
        setSelectedPlayerData(null);
    };

    // --- Render Logic ---
    if (isAuthLoading) {
        return <div className="p-6 text-center"><Spinner /> Loading Authentication...</div>;
    }

    const numColumns = 8; // Keep track of columns for colspan

    return (
        <div className="p-4 md:p-6 space-y-6">
            {/* Page Title */}
            <h1 className="text-2xl md:text-3xl font-bold text-gray-100 flex items-center">
                <FaTrophy className="mr-3 text-amber-400" /> Standings
            </h1>

            {/* League Selection Card */}
            <div className={`${selectContainerClasses} rounded-lg`}> {/* Use rounded-lg */}
                <Label htmlFor="leagueSelect" className="block text-sm font-medium text-gray-300 mb-1.5">
                    <FaFilter className="inline mr-1.5 mb-0.5" /> View Standings For:
                </Label>
                <Select
                    value={selectedLeagueId}
                    onValueChange={handleLeagueChange}
                    disabled={isLoadingLeagues || isLoadingStandings}
                >
                    <SelectTrigger id="leagueSelect" className="w-full md:w-1/2 lg:w-1/3">
                        {/* Show dynamic title in trigger */}
                        <SelectValue placeholder={isLoadingLeagues ? "Loading Leagues..." : "Select League..."}>
                            {selectedLeagueId === 'global' ? 'Overall Standings' : myLeagues.find(l => String(l.leagueId) === selectedLeagueId)?.name ?? 'Select League...'}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="global">-- Overall Standings --</SelectItem>
                        {isLoadingLeagues ? (
                            <div className="p-2 text-center text-gray-400 italic text-sm">Loading...</div>
                        ) : (
                            myLeagues.map(league => (
                                <SelectItem key={league.leagueId} value={String(league.leagueId)}>
                                    {league.name}
                                </SelectItem>
                            ))
                        )}
                        {myLeagues.length === 0 && !isLoadingLeagues && (
                            <div className="p-2 text-center text-gray-400 italic text-sm">No leagues joined.</div>
                        )}
                    </SelectContent>
                </Select>
            </div>

            {/* Standings Table Section - Wrapped in Card */}
            <Card className="bg-gray-800 rounded-lg shadow border border-gray-700"> {/* Use consistent styling */}
                <CardHeader className="border-b border-gray-700"> {/* Add border */}
                    <CardTitle className="text-lg">{tableTitle}</CardTitle> {/* Dynamic Title */}
                </CardHeader>
                <CardContent className="p-0"> {/* Remove padding from content to allow table full width */}
                    {isLoadingStandings ? (
                        <div className="text-center py-10"><Spinner className="h-6 w-6 inline" /> Loading standings...</div>
                    ) : standingsError ? (
                        <p className="text-red-400 text-center py-10">{standingsError}</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader> {/* Removed header bg */}
                                    <TableRow>
                                        <TableHead className="py-3 px-2 md:px-3 text-xs font-medium text-gray-400 uppercase tracking-wider w-12 text-center">Pos</TableHead>
                                        <TableHead className="py-3 px-1 md:px-2 text-xs font-medium text-gray-400 uppercase tracking-wider w-10 text-center">+/-</TableHead>
                                        <TableHead className="py-3 px-2 md:px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-1/3 sm:w-auto">Player</TableHead>
                                        <TableHead className="py-3 px-2 md:px-3 text-xs font-medium text-gray-400 uppercase tracking-wider w-12 text-center">Pld</TableHead>
                                        <TableHead className="py-3 px-2 md:px-3 text-xs font-medium text-gray-400 uppercase tracking-wider w-16 text-center">Outcome</TableHead>
                                        <TableHead className="py-3 px-2 md:px-3 text-xs font-medium text-gray-400 uppercase tracking-wider w-16 text-center">Exact</TableHead>
                                        <TableHead className="py-3 px-2 md:px-3 text-xs font-medium text-gray-400 uppercase tracking-wider w-16 text-center">Acc %</TableHead>
                                        <TableHead className="py-3 px-2 md:px-4 text-xs font-medium text-gray-400 uppercase tracking-wider w-16 text-right">Points</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="divide-y divide-gray-700"> {/* Use darker divide */}
                                    {standings.length === 0 ? (
                                        <TableRow><TableCell colSpan={numColumns} className="text-center py-10 text-gray-500 italic">No standings data available for this selection.</TableCell></TableRow>
                                    ) : (
                                        standings.map((entry) => (
                                            <TableRow key={entry.userId} className="hover:bg-gray-700/50 transition-colors duration-150">
                                                <TableCell className="py-3 px-2 md:px-3 whitespace-nowrap text-sm font-medium text-gray-200 text-center">{entry.rank}</TableCell>
                                                <TableCell className="py-3 px-1 md:px-2 whitespace-nowrap text-sm text-center"><MovementIndicator movement={entry.movement} /></TableCell>
                                                {/* Player Name Cell */}
                                                <TableCell className="py-2 px-2 md:px-4 whitespace-nowrap text-sm text-gray-100">
                                                    <button
                                                        onClick={() => openPlayerCardModal(entry)} // Trigger modal
                                                        className="flex items-center space-x-3 group text-left hover:opacity-80 transition-opacity w-full" // Make button fill cell
                                                        title="View Player Card"
                                                    >
                                                        <Avatar fullAvatarUrl={entry.avatarUrl} name={entry.name} size="sm" />
                                                        <span className="font-medium truncate group-hover:text-accent" title={entry.teamName || entry.name}>
                                                            {entry.teamName || entry.name}
                                                        </span>
                                                    </button>
                                                </TableCell>
                                                {/* Stats Cells */}
                                                <TableCell className="py-3 px-2 md:px-3 whitespace-nowrap text-sm text-gray-300 text-center">{entry.totalPredictions}</TableCell>
                                                <TableCell className="py-3 px-2 md:px-3 whitespace-nowrap text-sm text-gray-300 text-center">{entry.correctOutcomes}</TableCell>
                                                <TableCell className="py-3 px-2 md:px-3 whitespace-nowrap text-sm text-gray-300 text-center">{entry.exactScores}</TableCell>
                                                <TableCell className="py-3 px-2 md:px-3 whitespace-nowrap text-sm text-gray-300 text-center">
                                                    {entry.accuracy !== null ? `${entry.accuracy.toFixed(0)}%` : '-'} {/* Use 0 decimals for ACC */}
                                                </TableCell>
                                                <TableCell className="py-3 px-2 md:px-4 whitespace-nowrap text-sm text-gray-100 font-semibold text-right">{entry.points}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Player Card Modal */}
            {/* Using ConfirmationModal structure as a basic modal */}
            <ConfirmationModal
                isOpen={isCardModalOpen}
                onClose={closePlayerCardModal}
                showConfirmButton={false} // Hide Confirm
                showCancelButton={true}  // Show Cancel (acts as Close)
                cancelText="Close"
                title={`${selectedPlayerData?.teamName || selectedPlayerData?.name || 'Player'} Card`} // Example title
            // message={undefined} // No message needed
            >
                {/* Render the PlayerCard inside */}
                <div className="flex justify-center items-center pt-2 pb-4" onClick={(e) => e.stopPropagation()}>
                    <PlayerCard playerData={selectedPlayerData} />
                </div>
            </ConfirmationModal>

        </div> // End Page Container
    );
}