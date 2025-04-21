// frontend/src/app/(authenticated)/dashboard/page.tsx
'use client';

// --- Imports ---
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'react-hot-toast'; // <-- Import toast



// Import API functions and types
import {
    getDashboardHighlights,
    DashboardHighlightsResponse,
    getActiveRound,
    getStandings,
    ActiveRoundResponse,
    StandingEntry,
    ApiError,
    getNewsItems,
    deleteNewsItemAdmin,
    
} from '@/lib/api';

// Import UI Components used IN THIS FILE
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import Spinner from '@/components/ui/Spinner';
import Avatar from '@/components/Avatar';
import { Button } from '@/components/ui/Button';
import MovementIndicator from '@/components/Standings/MovementIndicator';
import ConfirmationModal from '@/components/Modal/ConfirmationModal'; // <-- Ensure this is imported

// Import Icons used IN THIS FILE
import {
    //FaRegCalendarAlt,
    FaTrophy,
    FaStar,
    FaNewspaper,
    FaArrowRight,
    FaUserCheck,
    FaTrashAlt,
    FaBullhorn,
    
} from 'react-icons/fa';

// Import Utilities
import Link from 'next/link';
import { formatDateTime } from '@/utils/formatters';
import { clsx } from 'clsx';

// --- Styling ---
const sectionContainerClasses = "bg-gray-800 rounded-sm shadow border border-gray-700";

// --- Type Definitions ---
interface LeaderInfo { userId: number, name: string, avatarUrl?: string | null }
interface ScorerInfo extends LeaderInfo { score: number }
interface NewsItem {
    newsItemId: number;
    content: string;
    createdAt: string;
    postedBy?: { name: string; } | null;
}

// --- Component ---
export default function DashboardPage() {
    const { user, token, isLoading: isAuthLoading } = useAuth();

    // --- State ---
    // Keep all existing state variables
    const [activeRound, setActiveRound] = useState<ActiveRoundResponse | null>(null);
    const [isLoadingRound, setIsLoadingRound] = useState(true);
    const [roundError, setRoundError] = useState<string | null>(null);
    const [isDeadlinePassed, setIsDeadlinePassed] = useState(false);
    const [standings, setStandings] = useState<StandingEntry[]>([]);
    const [isLoadingStandings, setIsLoadingStandings] = useState(true);
    const [standingsError, setStandingsError] = useState<string | null>(null);
    const [highlightsData, setHighlightsData] = useState<DashboardHighlightsResponse | null>(null);
    const [isLoadingHighlights, setIsLoadingHighlights] = useState(true);
    const [highlightsError, setHighlightsError] = useState<string | null>(null);
    const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
    const [isLoadingNews, setIsLoadingNews] = useState(true);
    const [newsError, setNewsError] = useState<string | null>(null);
    const [newsToDelete, setNewsToDelete] = useState<NewsItem | null>(null);
    const [isDeletingNews, setIsDeletingNews] = useState<number | null>(null);
    const [isConfirmNewsDeleteOpen, setIsConfirmNewsDeleteOpen] = useState(false);
    
    

    // --- Fetch Functions (useCallback) ---
    // Keep all existing fetch functions
    const fetchActiveRound = useCallback(async () => {
        if (!token) { setIsLoadingRound(false); return; }
        setIsLoadingRound(true); setRoundError(null);
        try { const data = await getActiveRound(token); setActiveRound(data); }
        catch (err) { const msg = err instanceof ApiError ? err.message : (err instanceof Error ? err.message : "Failed to load round data."); setRoundError(msg); console.error("[Dashboard] Error fetching active round:", err); }
        finally { setIsLoadingRound(false); }
    }, [token]);
    const fetchStandingsData = useCallback(async () => {
        if (!token) { setIsLoadingStandings(false); return; }
        setIsLoadingStandings(true); setStandingsError(null);
        try { const data = await getStandings(token); setStandings((data || []).slice(0, 10)); }
        catch (err) { const msg = err instanceof ApiError ? err.message : (err instanceof Error ? err.message : "Failed to load standings."); setStandingsError(msg); console.error("[Dashboard] Error fetching standings:", err); }
        finally { setIsLoadingStandings(false); }
    }, [token]);
    const fetchHighlights = useCallback(async () => {
        if (!token) { setIsLoadingHighlights(false); return; }
        setIsLoadingHighlights(true); setHighlightsError(null);
        try { const data = await getDashboardHighlights(token); setHighlightsData(data); }
        catch (error) { const msg = error instanceof ApiError ? error.message : (error instanceof Error ? error.message : "Could not load highlights."); setHighlightsError(msg); console.error("[Dashboard] Failed to fetch highlights:", error); }
        finally { setIsLoadingHighlights(false); }
    }, [token]);
    const fetchNewsItems = useCallback(async () => {
        setIsLoadingNews(true); setNewsError(null);
        try { const data = await getNewsItems(); setNewsItems(data); }
        catch (error) { const msg = error instanceof ApiError ? error.message : (error instanceof Error ? error.message : "Could not load news."); setNewsError(msg); console.error("[Dashboard] Failed to fetch news:", error); }
        finally { setIsLoadingNews(false); }
    }, []);
    

    // --- Handler Functions ---
    // Keep all existing handlers
    const openNewsDeleteConfirmation = (item: NewsItem) => {
        setNewsToDelete(item);
        setIsConfirmNewsDeleteOpen(true);
    };
    const handleNewsDelete = async () => {
        if (!newsToDelete || !token) return;
        const itemId = newsToDelete.newsItemId;
        setIsDeletingNews(itemId);
        setIsConfirmNewsDeleteOpen(false);
        const toastId = toast.loading(`Deleting news item #${itemId}...`);
        try {
            await deleteNewsItemAdmin(itemId, token);
            setNewsItems(currentItems => currentItems.filter(item => item.newsItemId !== itemId));
            toast.success(`News item #${itemId} deleted.`, { id: toastId });
            setNewsToDelete(null);
        } catch (err) {
            console.error(`Failed to delete news item ${itemId}:`, err);
            const message = err instanceof ApiError ? err.message : "Failed to delete item.";
            toast.error(`Error: ${message}`, { id: toastId });
        } finally {
            setIsDeletingNews(null);
        }
    };

    // --- Effects ---
    // Keep all existing Effects
    useEffect(() => {
        if (token && !isAuthLoading) {
            fetchActiveRound();
            fetchStandingsData();
            fetchHighlights();
            fetchNewsItems();
            
        } else if (!token && !isAuthLoading) {
            setIsLoadingRound(false);
            setIsLoadingStandings(false);
            setIsLoadingHighlights(false);
            setIsLoadingNews(false);
             
        }
    }, [token, isAuthLoading, fetchActiveRound, fetchStandingsData, fetchHighlights, fetchNewsItems]);
    useEffect(() => {
        if (activeRound?.deadline) {
            const checkDeadline = () => {
                try { setIsDeadlinePassed(new Date() >= new Date(activeRound.deadline)); }
                catch (_e) { setIsDeadlinePassed(false); console.error("Error parsing deadline:", _e); }
            };
            checkDeadline(); const timerId = setInterval(checkDeadline, 30000);
            return () => clearInterval(timerId);
        } else { setIsDeadlinePassed(false); }
    }, [activeRound?.deadline]);

    // --- Render Variables ---
    // Keep all existing render variables
    const roundActionLink = activeRound && (isDeadlinePassed || activeRound.status === 'CLOSED' || activeRound.status === 'COMPLETED') ? "/results" : "/predictions";
    const roundActionText = activeRound && (isDeadlinePassed || activeRound.status === 'CLOSED' || activeRound.status === 'COMPLETED') ? "View Results" : activeRound?.status === 'SETUP' ? "Round Not Open" : "Make Predictions";
    let roundStatusText = "Loading...";
    let roundStatusColor = "text-gray-400";
    if (activeRound) {
        roundStatusText = activeRound.status;
        if (activeRound.status === 'OPEN' && !isDeadlinePassed) roundStatusColor = "text-green-400";
        else if (activeRound.status === 'CLOSED') roundStatusColor = "text-red-400";
        else if (activeRound.status === 'COMPLETED') roundStatusColor = "text-blue-400";
        else if (isDeadlinePassed && activeRound.status === 'OPEN') { roundStatusText = "DEADLINE PASSED"; roundStatusColor = "text-red-400"; }
        else if (activeRound.status === 'SETUP') roundStatusColor = "text-yellow-400";
    }

    // --- Helper Render Functions ---
    // Keep BOTH existing helper functions
    const renderHighlightsContent = () => {
        if (isLoadingHighlights) return <div className="text-center py-4"><Spinner /> Loading highlights...</div>;
        if (highlightsError) return <p className="text-red-400 text-sm">Error: {highlightsError}</p>;
        if (highlightsData) {
            const { overallLeader: overallLeaderData, lastRoundHighlights: lastRoundData, userLastRoundStats: userStatsData } = highlightsData;
            return (
                // Adjusted padding/spacing INSIDE this div
                <div className="space-y-2 text-sm text-gray-300">
                    {overallLeaderData ? (
                        // Adjusted padding/spacing HERE
                        <div className="flex items-center space-x-2 p-1 rounded bg-gray-700/50">
                            <FaTrophy className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                            <div>
                                <span className="font-semibold text-gray-100">Leader{overallLeaderData.leaders.length > 1 ? 's' : ''}: </span>
                                {overallLeaderData.leaders.map((leader: LeaderInfo, index: number) => (
                                    <span key={leader.userId} className="inline-flex items-center mr-1">

                                        <span className="ml-1">{leader.name}</span>
                                        {index < overallLeaderData.leaders.length - 1 && ', '}
                                    </span>
                                ))}
                                <span className="text-gray-400 ml-1">({overallLeaderData.leadingScore} pts)</span>
                            </div>
                        </div>
                    ) : <p className="text-gray-500 italic px-1">No leader data.</p>}

                    {lastRoundData ? (
                        // Adjusted padding/spacing HERE
                        <div className="flex items-center space-x-2 p-1 rounded bg-gray-700/50">
                            <FaUserCheck className="h-5 w-5 text-green-500 flex-shrink-0" />
                            <div>
                                <span className="font-semibold text-gray-100">Last Rd ({lastRoundData.roundName}) Top: </span>
                                {lastRoundData.topScorers.map((scorer: ScorerInfo, index: number) => (
                                    <span key={scorer.userId} className="inline-flex items-center mr-1">

                                        <span className="ml-1">{scorer.name}</span>
                                        {index < lastRoundData.topScorers.length - 1 && ', '}
                                    </span>
                                ))}
                                <span className="text-gray-400 ml-1">({lastRoundData.topScorers[0]?.score ?? 0} pts)</span>
                            </div>
                        </div>
                    ) : <p className="text-gray-500 italic px-1">No completed rounds.</p>}

                    {userStatsData && lastRoundData ? (
                        // Adjusted padding/spacing HERE
                        <div className="flex items-center space-x-2 p-1 rounded bg-gray-700/50">
                            <Avatar size="xs" name={user?.name || ''} fullAvatarUrl={user?.avatarUrl || undefined} />
                            <div className="ml-1">
                                <span className="font-semibold text-gray-100">Your Last Rd ({lastRoundData.roundName}): </span>
                                {userStatsData.score} pts (Rank {userStatsData.rank})
                            </div>
                        </div>
                    ) : (
                        lastRoundData ?
                            <p className="text-gray-500 italic p-1 px-1">No score last round.</p>
                            : <p className="text-gray-500 italic p-1 px-1">No completed rounds.</p>
                    )}
                </div>
            );
        }
        return <p className="text-gray-400 italic px-1">No highlights available.</p>;
    };
    const renderNewsContent = () => {
        if (isLoadingNews) return <div className="text-center py-4"><Spinner /> Loading news...</div>;
        if (newsError) return <p className="text-red-400 text-sm">Error: {newsError}</p>;
        if (newsItems.length > 0) {
            return (
                <div className="space-y-2"> {/* Adjusted spacing */}
                    {newsItems.map((item) => (
                        <div key={item.newsItemId} className="pb-2 border-b border-gray-700 last:border-b-0"> {/* Adjusted spacing */}
                            <p className="text-sm text-gray-200 mb-0.5">{item.content}</p> {/* Adjusted spacing */}
                            <div className="flex justify-between items-center"> {/* Adjusted spacing */}
                                <p className="text-xs text-gray-500">
                                    {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                                    {item.postedBy?.name && (<span className="ml-1"> by {item.postedBy.name}</span>)}
                                </p>
                                {user?.role === 'ADMIN' && (<Button variant="ghost" size="icon" className="text-red-500 hover:text-red-400 hover:bg-red-900/20 h-5 w-5 p-0.5" onClick={() => openNewsDeleteConfirmation(item)} disabled={isDeletingNews === item.newsItemId} isLoading={isDeletingNews === item.newsItemId} title="Delete News Item" > {isDeletingNews !== item.newsItemId && <FaTrashAlt className="h-3 w-3" />} </Button>)}
                            </div>
                        </div>
                    ))}
                </div>
            );
        }
        return <p className="text-gray-500 italic text-sm">No news items available.</p>;
    };

    // --- Main Render ---
    if (isAuthLoading) {
        return <div className="p-6 text-center"><Spinner /> Loading dashboard...</div>;
    }

    return (
        <div className="space-y-4 p-4 md:p-6"> {/* Main container */}
            {/* 1. Title */}
            <h1 className="text-1xl md:text-1xl font-bold text-gray-100"> Welcome{user?.name ? `, ${user.name}` : ''}! </h1>

            {/* 2. Current Round Bar */}
            <div className={clsx(sectionContainerClasses, "p-3 md:p-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2")}>
                {isLoadingRound ? (<div className="flex items-center text-gray-400 text-sm"><Spinner className="mr-2 h-4 w-4" /> Loading round...</div>)
                    : roundError ? (<p className="text-red-400 text-sm">{roundError}</p>)
                        : activeRound ? (
                            <>
                                <div className="flex-grow flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">

                                    <span className="inline-flex items-center font-semibold text-gray-100 mr-1"> {/* Added inline-flex items-center */}
                                        <FaBullhorn className="mr-2 h-4 w-4 text-blue-400" /> {/* Added Icon */}
                                        Current Round:
                                    </span>
                                    <span className="text-gray-200 mr-3">{activeRound.name}</span>
                                    <span className="text-gray-400 mr-3">Status: <span className={`font-medium ${roundStatusColor}`}>{roundStatusText}</span></span>
                                    <span className="text-gray-400">Deadline: <span className={isDeadlinePassed ? 'text-red-300' : 'text-accent'}>{formatDateTime(activeRound.deadline)}</span></span>
                                </div>
                                <div className="flex-shrink-0">
                                    <Link href={activeRound.status === 'SETUP' ? '#' : roundActionLink} className={clsx('inline-flex items-center justify-center rounded-sm border border-transparent font-semibold shadow-sm focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-offset-gray-900 transition-colors duration-150 ease-in-out', 'px-3 py-1.5 text-xs', { 'bg-green-700 hover:bg-[#228B22] text-white focus:ring-[#228B22]': !isDeadlinePassed && activeRound.status === 'OPEN', 'bg-[#FBBF24] hover:bg-amber-500 text-gray-900 focus:ring-[#FBBF24]': isDeadlinePassed || (activeRound.status !== 'OPEN' && activeRound.status !== 'SETUP'), 'opacity-50 cursor-not-allowed bg-gray-600 hover:bg-gray-600': activeRound.status === 'SETUP' })} aria-disabled={activeRound.status === 'SETUP'} onClick={(e) => { if (activeRound.status === 'SETUP') e.preventDefault(); }}> {roundActionText} {activeRound.status !== 'SETUP' && <FaArrowRight className="ml-2 h-3 w-3" />} </Link>
                                </div>
                            </>
                        ) : (<p className="text-gray-400 italic text-sm">No active round. Watch this Space!</p>)}
            </div>

            {/* 3. Main Content Grid (NEW LAYOUT) */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

                {/* ===== Left Column (News Feed - Larger) ===== */}
                <div className="lg:col-span-3"> {/* Removed space-y-6, card handles spacing */}

                        

                    <Card className={sectionContainerClasses + " p-4 md:p-6"}>
                        <CardHeader className="p-0 mb-0"><CardTitle className="text-xl font-semibold text-gray-200 flex items-center"><FaNewspaper className="mr-3 text-gray-400" /> News & Updates</CardTitle></CardHeader>
                        <CardContent className="p-0">{renderNewsContent()}</CardContent>
                    </Card>
                </div>

                {/* ===== Right Column (Highlights & Standings - Smaller) ===== */}
                <div className="lg:col-span-2 space-y-4"> {/* Keep space-y here for between cards */}
                    <Card className={sectionContainerClasses + " p-4 md:p-6"}>
                        <CardHeader className="p-0 mb-0"><CardTitle className="text-xl font-semibold text-gray-200 flex items-center"><FaStar className="mr-3 text-yellow-400" /> Highlights</CardTitle></CardHeader>
                        <CardContent className="p-0">{renderHighlightsContent()}</CardContent>
                    </Card>

                    <Card className={sectionContainerClasses + " p-4 md:p-6"}> {/* Keep main card padding */}
                        <CardHeader className="p-0 mb-0">
                            <CardTitle className="text-xl font-semibold text-gray-200 flex items-center ">
                                <FaTrophy className="mr-3 text-amber-400" /> Standings
                            </CardTitle>
                        </CardHeader>
                        {/* ADD PADDING TO CardContent */}
                        <CardContent className="p-0"> {/* Keep p-0 here if helper div below handles padding */}
                            {isLoadingStandings && <div className="flex items-center justify-center text-gray-400 py-4"><Spinner className="mr-2 h-4 w-4" /> Loading...</div>}
                            {standingsError && <p className="text-center text-red-400 py-4">{standingsError}</p>}
                            {!isLoadingStandings && !standingsError && (
                                // REMOVED max-h, KEEP overflow-x-hidden
                                <div className="overflow-y-auto overflow-x-hidden"> {/* Removed max-h, kept overflow-x-hidden */}
                                    <Table>
                                        <TableHeader>
                                            {/* Use slightly more padding maybe? */}
                                            <TableRow><TableHead className="w-[40px] text-center px-2 py-3">Pos</TableHead><TableHead className="w-[30px] text-center px-1 py-3">+/-</TableHead><TableHead className="px-3 py-3">Name</TableHead><TableHead className="text-right w-[60px] px-3 py-3">Pts</TableHead></TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {standings.length === 0 ? (<TableRow><TableCell colSpan={4} className="text-center py-6 text-gray-400 italic">No players in standings.</TableCell></TableRow>)
                                                : (standings.map((entry) => (
                                                    <TableRow key={entry.userId}>
                                                        {/* Use slightly more padding maybe? */}
                                                        <TableCell className="text-center font-medium px-2 py-2">{entry.rank}</TableCell>
                                                        <TableCell className="text-center px-1 py-2"><MovementIndicator movement={entry.movement} /></TableCell>
                                                        <TableCell className="px-3 py-2"><div className="flex items-center space-x-2"><Avatar size="xs" name={entry.name} fullAvatarUrl={entry.avatarUrl} /><span className="truncate" title={entry.teamName || entry.name}>{entry.teamName || entry.name}</span></div></TableCell>
                                                        <TableCell className="text-right font-semibold px-3 py-2">{entry.points}</TableCell>
                                                    </TableRow>
                                                )))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                        {/* Keep Footer Div */}
                        <div className="pt-3 flex justify-end">
                            <Link href="/standings" className="text-sm text-accent hover:text-amber-300 hover:underline"> View All Standings </Link>
                        </div>
                    </Card>
                </div> {/* ===== End Right Column ===== */}
            </div> {/* End Main Grid */}

            {/* Confirmation Modal (Keep at end) */}
            <ConfirmationModal
                isOpen={isConfirmNewsDeleteOpen}
                onClose={() => setIsConfirmNewsDeleteOpen(false)}
                onConfirm={handleNewsDelete}
                title="Confirm News Deletion"
                message={
                    <span>
                        Are you sure you want to delete this news item? <br />
                        <blockquote className="mt-2 pl-3 border-l-2 border-gray-600 italic text-gray-400 text-xs">
                            {newsToDelete?.content?.substring(0, 100)}{newsToDelete && newsToDelete.content.length > 100 ? '...' : ''}
                        </blockquote><br />
                        <strong className="text-red-300">This action cannot be undone.</strong>
                    </span>
                }
                confirmText="Delete Item"
                confirmButtonVariant="danger"
                isConfirming={isDeletingNews === newsToDelete?.newsItemId}
            />

            

        </div> // End Page Container
    );
}