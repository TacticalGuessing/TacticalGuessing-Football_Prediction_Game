// frontend/src/app/(authenticated)/dashboard/page.tsx
'use client';

// --- Imports ---
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'; // Keep all Table imports
import { FaRegCalendarAlt, FaTrophy, FaStar, FaNewspaper, FaArrowRight } from 'react-icons/fa';
import MovementIndicator from '@/components/Standings/MovementIndicator'; // Keep MovementIndicator import
import { getActiveRound, getStandings, ActiveRoundResponse, StandingEntry } from '@/lib/api'; // Removed ApiError, ensure StandingEntry includes needed fields
import { formatDateTime } from '@/utils/formatters';
import Spinner from '@/components/ui/Spinner';
import { clsx } from 'clsx';
import Avatar from '@/components/Avatar'; // Keep Avatar import

// --- Styling ---
const sectionContainerClasses = "bg-gray-800 rounded-lg shadow border border-gray-700 p-4 md:p-6";

export default function DashboardPage() {
    const { user, token, isLoading: isAuthLoading } = useAuth();

    // --- State ---
    const [activeRound, setActiveRound] = useState<ActiveRoundResponse | null>(null);
    const [isLoadingRound, setIsLoadingRound] = useState(true);
    const [roundError, setRoundError] = useState<string | null>(null);
    const [isDeadlinePassed, setIsDeadlinePassed] = useState(false);
    const [standings, setStandings] = useState<StandingEntry[]>([]);
    const [isLoadingStandings, setIsLoadingStandings] = useState(true);
    const [standingsError, setStandingsError] = useState<string | null>(null);

    // --- Fetch Active Round Data ---
    const fetchActiveRound = useCallback(async () => {
        if (!token) { setIsLoadingRound(false); return; }
        setIsLoadingRound(true); setRoundError(null); setActiveRound(null);
        try {
            const data = await getActiveRound(token);
            setActiveRound(data);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to load round data.";
            setRoundError(message); console.error("[Dashboard] Error fetching active round:", err);
        } finally { setIsLoadingRound(false); }
    }, [token]);

    // --- Fetch Overall Standings Data ---
    const fetchStandingsData = useCallback(async () => {
        if (!token) { setIsLoadingStandings(false); return; }
        setIsLoadingStandings(true); setStandingsError(null); setStandings([]);
        try {
            const data = await getStandings(token);
            setStandings((data || []).slice(0, 10)); // Get Top 5
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to load standings.";
            setStandingsError(message); console.error("[Dashboard] Error fetching standings:", err);
        } finally { setIsLoadingStandings(false); }
    }, [token]);


    // --- Fetch Data on Mount/Token Change ---
    useEffect(() => {
        if (token && !isAuthLoading) {
            fetchActiveRound();
            fetchStandingsData();
        } else if (!token && !isAuthLoading) {
             setIsLoadingRound(false); setIsLoadingStandings(false);
        }
    }, [token, isAuthLoading, fetchActiveRound, fetchStandingsData]);

    // --- Deadline Check Effect ---
    useEffect(() => {
        if (activeRound?.deadline) {
            const checkDeadline = () => {
                try { setIsDeadlinePassed(new Date() >= new Date(activeRound.deadline)); }
                // Use _e to indicate the error variable is intentionally unused here
                catch (_e) { setIsDeadlinePassed(false); console.error("Error parsing deadline:", _e); }
            };
            checkDeadline(); const timerId = setInterval(checkDeadline, 30000);
            return () => clearInterval(timerId);
        } else { setIsDeadlinePassed(false); }
    }, [activeRound?.deadline]);


    // --- Determine Action Link/Text etc. ---
    // Use const where applicable
    const roundActionLink = activeRound && (isDeadlinePassed || activeRound.status === 'CLOSED' || activeRound.status === 'COMPLETED') ? "/results" : "/predictions";
    const roundActionText = activeRound && (isDeadlinePassed || activeRound.status === 'CLOSED' || activeRound.status === 'COMPLETED') ? "View Results" : activeRound?.status === 'SETUP' ? "Round Not Open" : "Make Predictions";
    let roundStatusText = "Loading...";
    let roundStatusColor = "text-gray-400";

    if (activeRound) {
         roundStatusText = activeRound.status;
         if (activeRound.status === 'OPEN' && !isDeadlinePassed) { roundStatusColor = "text-green-400"; }
         else if (activeRound.status === 'CLOSED') { roundStatusColor = "text-red-400"; }
         else if (activeRound.status === 'COMPLETED') { roundStatusColor = "text-blue-400"; }
         else if (isDeadlinePassed && activeRound.status === 'OPEN') { roundStatusText = "DEADLINE PASSED"; roundStatusColor = "text-red-400"; }
         else if (activeRound.status === 'SETUP') { roundStatusColor = "text-yellow-400"; }
    }


    // --- Render Logic ---
    return (
        <div className="space-y-6 p-4 md:p-6">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-100"> Welcome{user?.name ? `, ${user.name}` : ''}! </h1>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* --- Left Column --- */}
                <div className="lg:col-span-3 space-y-6">
                     {/* --- 1. Current Round Section --- */}
                     <div className={sectionContainerClasses}>
                         <h2 className="text-xl font-semibold text-gray-200 mb-3 flex items-center"> <FaRegCalendarAlt className="mr-3 text-blue-400" /> Current Round </h2>
                         {isLoadingRound ? ( <div className="flex items-center text-gray-400"><Spinner className="mr-2 h-4 w-4"/> Loading...</div> )
                          : roundError ? ( <p className="text-red-400">{roundError}</p> )
                          : activeRound ? (
                            <div className="space-y-3">
                                <p className="text-lg font-medium text-gray-100">{activeRound.name}</p>
                                <div className="text-sm text-gray-400 space-y-1">
                                    <p>Status: <span className={`font-semibold ${roundStatusColor}`}>{roundStatusText}</span></p>
                                    <p>Deadline: <span className={isDeadlinePassed ? 'text-red-300' : 'text-accent'}>{formatDateTime(activeRound.deadline)}</span></p>
                                </div>
                                <div className="pt-2">
                                    <Link
                                        href={activeRound.status === 'SETUP' ? '#' : roundActionLink}
                                        className={clsx( /* Base button styles */ 'inline-flex items-center justify-center rounded-sm border border-transparent font-semibold shadow-sm focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-offset-gray-900 transition-colors duration-150 ease-in-out', /* Size styles */ 'px-3 py-1.5 text-xs', /* Conditional variants */ { 'bg-green-700 hover:bg-[#228B22] text-white focus:ring-[#228B22]': !isDeadlinePassed && activeRound.status === 'OPEN', 'bg-[#FBBF24] hover:bg-amber-500 text-gray-900 focus:ring-[#FBBF24]': isDeadlinePassed || (activeRound.status !== 'OPEN' && activeRound.status !== 'SETUP'), 'opacity-50 cursor-not-allowed bg-gray-600 hover:bg-gray-600': activeRound.status === 'SETUP' })}
                                        aria-disabled={activeRound.status === 'SETUP'}
                                        onClick={(e) => { if (activeRound.status === 'SETUP') e.preventDefault(); }}
                                    > {roundActionText} {activeRound.status !== 'SETUP' && <FaArrowRight className="ml-2 h-3 w-3"/>} </Link>
                                </div>
                            </div>
                         ) : ( <p className="text-gray-400 italic">No active round.</p> )}
                     </div>
                     {/* --- End Current Round --- */}

                     {/* --- Other Sections (Highlights, News) --- */}
                     <div className={sectionContainerClasses}> <h2 className="text-xl font-semibold text-gray-200 mb-3 flex items-center"> <FaStar className="mr-3 text-yellow-400" /> Highlights </h2> <p className="text-gray-400 italic"> [Placeholder: Stats...] </p> </div>
                     <div className={sectionContainerClasses}> <h2 className="text-xl font-semibold text-gray-200 mb-3 flex items-center"> <FaNewspaper className="mr-3 text-gray-400" /> News & Updates </h2> <div className="space-y-3"> <p className="text-gray-400 italic pb-2 border-b border-gray-700">[Placeholder: News 1]</p> <p className="text-gray-400 italic pb-2 border-b border-gray-700">[Placeholder: News 2]</p> <p className="text-gray-400 italic">[Placeholder: News 3]</p> </div> </div>
                </div> {/* End Left Column */}

                {/* --- Right Column --- */}
                <div className="lg:col-span-2 space-y-6">
                     {/* --- Condensed Standings Table Section - RESTORED FULL JSX --- */}
                     <div className={sectionContainerClasses}>
                          <div className="flex justify-between items-center mb-3">
                             <h2 className="text-xl font-semibold text-gray-200 flex items-center"> <FaTrophy className="mr-3 text-amber-400" /> Standings </h2>
                             <Link href="/standings" className="text-sm text-accent hover:text-amber-300 hover:underline"> View All </Link>
                          </div>
                          {/* Loading/Error States for Standings */}
                          {isLoadingStandings && <div className="flex items-center justify-center text-gray-400 py-4"><Spinner className="mr-2 h-4 w-4"/> Loading...</div>}
                          {standingsError && <p className="text-center text-red-400 py-4">{standingsError}</p>}
                          {/* Standings Table */}
                          {!isLoadingStandings && !standingsError && (
                               <div className="overflow-y-auto max-h-[800px]">
                                   <Table>
                                       <TableHeader>
                                           <TableRow>
                                                {/* These TableHeads ARE used */}
                                               <TableHead className="w-[40px] text-center">Pos</TableHead>
                                               <TableHead className="w-[30px] text-center">+/-</TableHead>
                                               <TableHead>Name</TableHead>
                                               <TableHead className="text-right w-[60px]">Pts</TableHead>
                                           </TableRow>
                                       </TableHeader>
                                       <TableBody>
                                           {standings.length === 0 ? (
                                                <TableRow><TableCell colSpan={4} className="text-center py-6 text-gray-400 italic">No data.</TableCell></TableRow>
                                           ) : (
                                                standings.map((entry) => (
                                                   <TableRow key={entry.userId}>
                                                       <TableCell className="text-center font-medium">{entry.rank}</TableCell>
                                                       {/* This uses MovementIndicator */}
                                                       <TableCell className="text-center"><MovementIndicator movement={entry.movement} /></TableCell>
                                                       <TableCell>
                                                           <div className="flex items-center space-x-2">
                                                                {/* This uses Avatar */}
                                                               <Avatar size="xs" name={entry.name} fullAvatarUrl={entry.avatarUrl} />
                                                               <span className="truncate" title={entry.teamName || entry.name}>{entry.teamName || entry.name}</span>
                                                           </div>
                                                       </TableCell>
                                                       <TableCell className="text-right font-semibold">{entry.points}</TableCell>
                                                   </TableRow>
                                                  ))
                                           )}
                                       </TableBody>
                                   </Table>
                               </div>
                          )}
                     </div>
                     {/* --- End Condensed Standings --- */}
                </div> {/* End Right Column */}
            </div> {/* End Main Grid */}
        </div> // End Page Container
    );
}