// frontend/src/app/(authenticated)/standings/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
    getMyLeagues, MyLeagueInfo,
    getStandings, // Global standings
    getLeagueStandings, // League-specific standings
    StandingEntry, // IMPORTANT: Assumes this type includes ALL columns needed
    ApiError
} from '@/lib/api';

// UI Components
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import Spinner from '@/components/ui/Spinner';
import Avatar from '@/components/Avatar';
import MovementIndicator from '@/components/Standings/MovementIndicator';
import { FaTrophy } from 'react-icons/fa';
import { Label } from '@/components/ui/Label'; // Import Label
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

export default function StandingsPage() {
    const { token, isLoading: isAuthLoading } = useAuth();

    // State
    const [myLeagues, setMyLeagues] = useState<MyLeagueInfo[]>([]);
    const [isLoadingLeagues, setIsLoadingLeagues] = useState(true);
    const [selectedLeagueId, setSelectedLeagueId] = useState<string>('global'); // Default to 'global'
    const [standings, setStandings] = useState<StandingEntry[]>([]);
    const [isLoadingStandings, setIsLoadingStandings] = useState(true);
    const [standingsError, setStandingsError] = useState<string | null>(null);
    const [tableTitle, setTableTitle] = useState('Overall Standings');

    // Define consistent styling for the select container if needed
    const selectContainerClasses = "bg-gray-800 rounded-sm shadow border border-gray-700 p-4 mb-6";

    // --- Fetch Leagues ---
    const fetchLeaguesForDropdown = useCallback(async () => {
        if (!token) { setIsLoadingLeagues(false); return; }
        setIsLoadingLeagues(true);
        try {
            const data = await getMyLeagues(token);
            setMyLeagues(data || []);
        } catch (err) {
            console.error("Failed to fetch leagues for dropdown:", err);
            // Handle error silently or show a small indicator?
        } finally {
            setIsLoadingLeagues(false);
        }
    }, [token]);

    // --- Fetch Standings (Handles Global or League specific) ---
    const fetchStandings = useCallback(async () => {
        if (!token || !selectedLeagueId) { setIsLoadingStandings(false); return; }

        setIsLoadingStandings(true);
        setStandingsError(null);
        setStandings([]); // Clear previous

        try {
            let data: StandingEntry[];
            let title = 'Standings'; // Temporary title

            if (selectedLeagueId === 'global') {
                console.log("Fetching GLOBAL standings...");
                data = await getStandings(token);
                title = 'Overall Standings';
            } else {
                const leagueIdNum = parseInt(selectedLeagueId, 10);
                if (isNaN(leagueIdNum)) throw new Error("Invalid League ID selected");
                console.log(`Fetching standings for LEAGUE ID: ${leagueIdNum}...`);
                data = await getLeagueStandings(leagueIdNum, token);
                const leagueName = myLeagues.find(l => String(l.leagueId) === selectedLeagueId)?.name;
                title = leagueName ? `${leagueName} Standings` : `League Standings`;
            }
            setStandings(data || []);
            setTableTitle(title); // Set title after data fetch attempt

        } catch (err) {
            console.error(`fetchStandings: ERROR for ${selectedLeagueId}:`, err);
            const message = err instanceof ApiError ? err.message : (err instanceof Error ? err.message : 'Failed to fetch standings.');
            setStandingsError(message);
            setStandings([]);
            setTableTitle(`Error Loading Standings`); // Update title on error
        } finally {
            setIsLoadingStandings(false);
        }
    }, [token, selectedLeagueId, myLeagues]); // Include myLeagues as title depends on it


    // --- Effects ---
    // Initial fetch for leagues
    useEffect(() => {
        if (token && !isAuthLoading) {
            fetchLeaguesForDropdown();
        }
    }, [token, isAuthLoading, fetchLeaguesForDropdown]);

    // Fetch standings when selection changes OR initially after leagues load
    useEffect(() => {
         if (token && !isAuthLoading && !isLoadingLeagues) {
             fetchStandings();
         }
    }, [token, isAuthLoading, isLoadingLeagues, selectedLeagueId, fetchStandings]);


    // Handle dropdown change
    const handleLeagueChange = (value: string) => {
        setSelectedLeagueId(value); // Update state, triggers useEffect for fetchStandings
    };

    // --- Render Logic ---
     if (isAuthLoading) {
        return <div className="p-6 text-center"><Spinner /> Loading...</div>;
    }

    const numColumns = 8; // Update colspan based on new headers

    return (
        <div className="p-4 md:p-6 space-y-6"> {/* Add space-y here */}
            {/* Page Title */}
            <h1 className="text-2xl md:text-3xl font-bold text-gray-100 flex items-center">
               <FaTrophy className="mr-3 text-amber-400" /> Standings
            </h1>

            {/* League Selection Card */}
            <div className={`${selectContainerClasses} rounded-sm`}>
                 <Label htmlFor="leagueSelect" className="block text-sm font-medium text-gray-300 mb-1">
                     View Standings For:
                 </Label>
                 <Select
                     value={selectedLeagueId}
                     onValueChange={handleLeagueChange}
                     disabled={isLoadingLeagues || isLoadingStandings} // Disable while loading either
                 >
                    {/* Add id for label association */}
                    <SelectTrigger id="leagueSelect" className="w-full md:w-1/2 lg:w-1/3">
                         <SelectValue placeholder="Select League..." />
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


            {/* Standings Table Section - Wrapped in Card for consistency */}
            <Card className="bg-gray-900 rounded-sm shadow border border-gray-900 p-4 mb-6">
                <CardHeader >
                     <CardTitle className="text-lg">{tableTitle}</CardTitle> {/* Dynamic Title */}
                 </CardHeader>
                 <CardContent className="p-0">
                     {isLoadingStandings ? (
                         <div className="text-center py-10"><Spinner /> Loading standings...</div>
                     ) : standingsError ? (
                          <p className="text-red-400 text-center py-10">{standingsError}</p>
                     ) : (
                         <div className="overflow-x-auto">
                             <Table>
                                 <TableHeader className="bg-green-800 "> {/* Apply background to header */}
                                     <TableRow>
                                        {/* Updated Headers based on image */}
                                        <TableHead className="py-3 px-2 md:px-3 text-xs font-medium text-gray-300 uppercase tracking-wider w-12 text-center rounded-tl-lg">Pos</TableHead>
                                        <TableHead className="py-3 px-1 md:px-2 text-xs font-medium text-gray-300 uppercase tracking-wider w-10 text-center">+/-</TableHead>
                                        <TableHead className="py-3 px-2 md:px-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-1/3 sm:w-auto">Name</TableHead>
                                        <TableHead className="py-3 px-2 md:px-3 text-xs font-medium text-gray-300 uppercase tracking-wider w-12 text-center">Pld</TableHead>
                                        <TableHead className="py-3 px-2 md:px-3 text-xs font-medium text-gray-300 uppercase tracking-wider w-16 text-center">Outcome</TableHead>
                                        <TableHead className="py-3 px-2 md:px-3 text-xs font-medium text-gray-300 uppercase tracking-wider w-16 text-center">Exact</TableHead>
                                        <TableHead className="py-3 px-2 md:px-3 text-xs font-medium text-gray-300 uppercase tracking-wider w-16 text-center">Acc %</TableHead>
                                        <TableHead className="py-3 px-2 md:px-4 text-xs font-medium text-gray-300 uppercase tracking-wider w-16 text-right rounded-tr-lg">Points</TableHead>
                                     </TableRow>
                                 </TableHeader>
                                 <TableBody className="bg-gray-800 divide-y divide-gray-600">
                                     {standings.length === 0 ? (
                                         <TableRow><TableCell colSpan={numColumns} className="text-center py-10 text-gray-400 italic">No standings data available for this selection.</TableCell></TableRow>
                                     ) : (
                                         standings.map((item) => {
                                             const itemAvatarSrc = (item.avatarUrl && item.avatarUrl.startsWith('http')) ? item.avatarUrl : null;
                                             return (
                                                <TableRow key={item.userId} className="hover:bg-gray-700/50 transition-colors duration-150">
                                                    {/* Pos */}
                                                    <TableCell className="py-3 px-2 md:px-3 whitespace-nowrap text-sm font-medium text-gray-200 text-center">{item.rank}</TableCell>
                                                    {/* +/- */}
                                                    <TableCell className="py-3 px-1 md:px-2 whitespace-nowrap text-sm text-center"><MovementIndicator movement={item.movement} /></TableCell>
                                                    {/* Name Cell */}
                                                    <TableCell className="py-2 px-2 md:px-4 whitespace-nowrap text-sm text-gray-100">
                                                        <div className="flex items-center space-x-3">
                                                            <Avatar fullAvatarUrl={itemAvatarSrc} name={item.name} size="sm" />
                                                            <span className="font-medium truncate" title={item.teamName || item.name}>{item.teamName || item.name}</span>
                                                        </div>
                                                    </TableCell>
                                                     {/* Pld - Display directly */}
                                                    <TableCell className="py-3 px-2 md:px-3 whitespace-nowrap text-sm text-gray-300 text-center">{item.totalPredictions}</TableCell>
                                                     {/* Outcome - Display directly */}
                                                    <TableCell className="py-3 px-2 md:px-3 whitespace-nowrap text-sm text-gray-300 text-center">{item.correctOutcomes}</TableCell>
                                                     {/* Exact - Display directly */}
                                                    <TableCell className="py-3 px-2 md:px-3 whitespace-nowrap text-sm text-gray-300 text-center">{item.exactScores}</TableCell>
                                                     {/* Acc % - Revert to original check for null */}
                                                    <TableCell className="py-3 px-2 md:px-3 whitespace-nowrap text-sm text-gray-300 text-center">
                                                        {item.accuracy !== null ? `${item.accuracy.toFixed(1)}%` : '-'}
                                                    </TableCell>
                                                     {/* Points */}
                                                    <TableCell className="py-3 px-2 md:px-4 whitespace-nowrap text-sm text-gray-100 font-semibold text-right">{item.points}</TableCell>
                                                </TableRow>
                                             );
                                         })
                                     )}
                                 </TableBody>
                             </Table>
                         </div>
                     )}
                 </CardContent>
             </Card>
        </div>
    );
}