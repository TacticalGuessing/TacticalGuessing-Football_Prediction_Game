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
    deleteNewsItemAdmin, // <-- Import deleteNewsItemAdmin
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
    FaRegCalendarAlt,
    FaTrophy,
    FaStar,
    FaNewspaper,
    FaArrowRight,
    FaUserCheck,
    FaTrashAlt,
} from 'react-icons/fa';

// Import Utilities
import Link from 'next/link';
import { formatDateTime } from '@/utils/formatters';
import { clsx } from 'clsx';

// --- Styling ---
const sectionContainerClasses = "bg-gray-800 rounded-lg shadow border border-gray-700";

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

    // State for News Deletion
    const [newsToDelete, setNewsToDelete] = useState<NewsItem | null>(null);
    const [isDeletingNews, setIsDeletingNews] = useState<number | null>(null);
    const [isConfirmNewsDeleteOpen, setIsConfirmNewsDeleteOpen] = useState(false); // This state IS used by the modal

    // --- Fetch Functions (useCallback) ---
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
    const openNewsDeleteConfirmation = (item: NewsItem) => {
        setNewsToDelete(item);
        setIsConfirmNewsDeleteOpen(true);
    };

    // This function IS used by the ConfirmationModal's onConfirm prop
    const handleNewsDelete = async () => {
        if (!newsToDelete || !token) return;
        const itemId = newsToDelete.newsItemId;
        setIsDeletingNews(itemId);
        setIsConfirmNewsDeleteOpen(false);
        const toastId = toast.loading(`Deleting news item #${itemId}...`); // toast IS used here
        try {
            await deleteNewsItemAdmin(itemId, token); // deleteNewsItemAdmin IS used here
            setNewsItems(currentItems => currentItems.filter(item => item.newsItemId !== itemId));
            toast.success(`News item #${itemId} deleted.`, { id: toastId }); // toast IS used here
            setNewsToDelete(null);
        } catch (err) {
            console.error(`Failed to delete news item ${itemId}:`, err);
            const message = err instanceof ApiError ? err.message : "Failed to delete item.";
            toast.error(`Error: ${message}`, { id: toastId }); // toast IS used here
        } finally {
            setIsDeletingNews(null);
        }
    };

    // --- Effects ---
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
    const renderHighlightsContent = () => {
        if (isLoadingHighlights) return <div className="text-center py-4"><Spinner /> Loading highlights...</div>;
        if (highlightsError) return <p className="text-red-400 text-sm">Error: {highlightsError}</p>;
        if (highlightsData) {
            const { overallLeader: overallLeaderData, lastRoundHighlights: lastRoundData, userLastRoundStats: userStatsData } = highlightsData;
            return (
                <div className="space-y-3 text-sm text-gray-300">
                    {overallLeaderData ? (
                        <div className="flex items-center space-x-3 p-2 rounded bg-gray-700/50">
                            <FaTrophy className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                            <div>
                                <span className="font-semibold text-gray-100">Current Leader{overallLeaderData.leaders.length > 1 ? 's' : ''}: </span>
                                {overallLeaderData.leaders.map((leader: LeaderInfo, index: number) => (
                                    <span key={leader.userId} className="inline-flex items-center mr-2">

                                        <span className="ml-1">{leader.name}</span>
                                        {index < overallLeaderData.leaders.length - 1 && ', '}
                                    </span>
                                ))}
                                <span className="text-gray-400">({overallLeaderData.leadingScore} pts)</span>
                            </div>
                        </div>
                    ) : <p className="text-gray-500 italic">No overall leader data yet.</p>}

                    {lastRoundData ? (
                        <div className="flex items-center space-x-3 p-2 rounded bg-gray-700/50">
                            <FaUserCheck className="h-5 w-5 text-green-500 flex-shrink-0" />
                            <div>
                                <span className="font-semibold text-gray-100">Last Round ({lastRoundData.roundName}) Top Scorer{lastRoundData.topScorers.length > 1 ? 's' : ''}: </span>
                                {lastRoundData.topScorers.map((scorer: ScorerInfo, index: number) => (
                                    <span key={scorer.userId} className="inline-flex items-center mr-2">

                                        <span className="ml-1">{scorer.name}</span>
                                        {index < lastRoundData.topScorers.length - 1 && ', '}
                                    </span>
                                ))}
                                <span className="text-gray-400">({lastRoundData.topScorers[0]?.score ?? 0} pts)</span>
                            </div>
                        </div>
                    ) : <p className="text-gray-500 italic">No completed rounds yet.</p>}

                    {userStatsData && lastRoundData ? (
                        <div className="flex items-center space-x-3 p-2 rounded bg-gray-700/50">
                            <Avatar size="xs" name={user?.name || ''} fullAvatarUrl={user?.avatarUrl || undefined} />
                            <div className="ml-1">
                                <span className="font-semibold text-gray-100">Your Last Round ({lastRoundData.roundName}): </span>
                                {userStatsData.score} points (Rank {userStatsData.rank})
                            </div>
                        </div>
                    ) : (
                        lastRoundData ?
                            <p className="text-gray-500 italic p-2">You did not participate in the last completed round.</p>
                            : <p className="text-gray-500 italic p-2">No completed rounds with stats yet.</p>
                    )}
                </div>
            );
        }
        return <p className="text-gray-400 italic">No highlights data available.</p>;
    };

    const renderNewsContent = () => {
        if (isLoadingNews) return <div className="text-center py-4"><Spinner /> Loading news...</div>;
        if (newsError) return <p className="text-red-400 text-sm">Error: {newsError}</p>;
        if (newsItems.length > 0) {
            return (
                <div className="space-y-3">
                    {newsItems.map((item) => (
                        <div key={item.newsItemId} className="pb-3 border-b border-gray-700 last:border-b-0">
                            <p className="text-sm text-gray-200 mb-1">{item.content}</p>
                            <div className="flex justify-between items-center mt-1">
                                <p className="text-xs text-gray-500">
                                    {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                                    {item.postedBy?.name && (
                                        <span className="ml-1"> by {item.postedBy.name}</span>
                                    )}
                                </p>
                                {user?.role === 'ADMIN' && (
                                    <Button
                                        variant="ghost" size="icon"
                                        className="text-red-500 hover:text-red-400 hover:bg-red-900/20 h-6 w-6 p-1"
                                        onClick={() => openNewsDeleteConfirmation(item)}
                                        disabled={isDeletingNews === item.newsItemId}
                                        isLoading={isDeletingNews === item.newsItemId}
                                        title="Delete News Item"
                                    >
                                        {isDeletingNews !== item.newsItemId && <FaTrashAlt className="h-3 w-3" />}
                                    </Button>
                                )}
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
        <div className="space-y-6 p-4 md:p-6">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-100"> Welcome{user?.name ? `, ${user.name}` : ''}! </h1>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* --- Left Column --- */}
                <div className="lg:col-span-3 space-y-6">
                    {/* Current Round Card */}
                    <Card className={sectionContainerClasses + " p-2 md:p-3"}>
                        <CardHeader className="p-0 mb-0"><CardTitle className="text-xl font-semibold text-gray-200 flex items-center"><FaRegCalendarAlt className="mr-3 text-blue-400" /> Current Round</CardTitle></CardHeader>
                        <CardContent className="p-0">
                            {isLoadingRound ? <div className="flex items-center text-gray-400"><Spinner className="mr-2 h-4 w-4" /> Loading...</div>
                                : roundError ? <p className="text-red-400">{roundError}</p>
                                    : activeRound ? (
                                        <div className="space-y-3">
                                            <p className="text-lg font-medium text-gray-100">{activeRound.name}</p>
                                            <div className="text-sm text-gray-400 space-y-1">
                                                <p>Status: <span className={`font-semibold ${roundStatusColor}`}>{roundStatusText}</span></p>
                                                <p>Deadline: <span className={isDeadlinePassed ? 'text-red-300' : 'text-accent'}>{formatDateTime(activeRound.deadline)}</span></p>
                                            </div>
                                            <div className="pt-2">
                                                <Link href={activeRound.status === 'SETUP' ? '#' : roundActionLink} className={clsx('inline-flex items-center justify-center rounded-sm border border-transparent font-semibold shadow-sm focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-offset-gray-900 transition-colors duration-150 ease-in-out', 'px-3 py-1.5 text-xs', { 'bg-green-700 hover:bg-[#228B22] text-white focus:ring-[#228B22]': !isDeadlinePassed && activeRound.status === 'OPEN', 'bg-[#FBBF24] hover:bg-amber-500 text-gray-900 focus:ring-[#FBBF24]': isDeadlinePassed || (activeRound.status !== 'OPEN' && activeRound.status !== 'SETUP'), 'opacity-50 cursor-not-allowed bg-gray-600 hover:bg-gray-600': activeRound.status === 'SETUP' })} aria-disabled={activeRound.status === 'SETUP'} onClick={(e) => { if (activeRound.status === 'SETUP') e.preventDefault(); }}> {roundActionText} {activeRound.status !== 'SETUP' && <FaArrowRight className="ml-2 h-3 w-3" />} </Link>
                                            </div>
                                        </div>
                                    ) : <p className="text-gray-400 italic">No active round.</p>}
                        </CardContent>
                    </Card>

                    {/* Highlights Card */}
                    <Card className={sectionContainerClasses + " p-2 md:p-3"}>
                        <CardHeader className="p-0 mb-3"><CardTitle className="text-xl font-semibold text-gray-200 flex items-center"><FaStar className="mr-3 text-yellow-400" /> Highlights</CardTitle></CardHeader>
                        <CardContent className="p-0">{renderHighlightsContent()}</CardContent>
                    </Card>

                    {/* News Card */}
                    <Card className={sectionContainerClasses + " p-2 md:p-3"}>
                        <CardHeader className="p-0 mb-3"><CardTitle className="text-xl font-semibold text-gray-200 flex items-center"><FaNewspaper className="mr-3 text-gray-400" /> News & Updates</CardTitle></CardHeader>
                        <CardContent className="p-0">{renderNewsContent()}</CardContent>
                    </Card>
                </div> {/* End Left Column */}

                {/* --- Right Column (Standings Preview) --- */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className={sectionContainerClasses + " p-2 md:p-3"}>
                        <CardHeader className="p-0 mb-0 flex justify-between items-center"><CardTitle className="text-xl font-semibold text-gray-200 flex items-center"><FaTrophy className="mr-3 text-amber-400" /> Standings</CardTitle></CardHeader>
                        <CardContent className="p-0">
                            {isLoadingStandings && <div className="flex items-center justify-center text-gray-400 py-4"><Spinner className="mr-2 h-4 w-4" /> Loading...</div>}
                            {standingsError && <p className="text-center text-red-400 py-4">{standingsError}</p>}
                            {!isLoadingStandings && !standingsError && (
                                <div className="overflow-y-auto overflow-x-hidden max-h-[calc(100vh-200px)]">
                                    <Table>
                                        <TableHeader><TableRow><TableHead className="w-[40px] text-center">Pos</TableHead><TableHead className="w-[30px] text-center">+/-</TableHead><TableHead>Name</TableHead><TableHead className="text-right w-[60px]">Pts</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {standings.length === 0 ? (
                                                <TableRow><TableCell colSpan={4} className="text-center py-6 text-gray-400 italic">No players in standings.</TableCell></TableRow>
                                            ) : (
                                                standings.map((entry) => (
                                                    <TableRow key={entry.userId}>
                                                        <TableCell className="text-center font-medium">{entry.rank}</TableCell>
                                                        <TableCell className="text-center"><MovementIndicator movement={entry.movement} /></TableCell>
                                                        <TableCell><div className="flex items-center space-x-2"><Avatar size="xs" name={entry.name} fullAvatarUrl={entry.avatarUrl} /><span className="truncate" title={entry.teamName || entry.name}>{entry.teamName || entry.name}</span></div></TableCell>
                                                        <TableCell className="text-right font-semibold">{entry.points}</TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>

                        <div className="pt-4 flex justify-end"> {/* Added padding-top, align right */}
                            <Link href="/standings" className="text-sm text-accent hover:text-amber-300 hover:underline">
                                View All Standings
                            </Link>
                        </div>
                    </Card>
                </div> {/* End Right Column */}
            </div> {/* End Main Grid */}

            {/* --- ADDED Confirmation Modal for News Delete --- */}
            {/* This uses ConfirmationModal, isConfirmNewsDeleteOpen, handleNewsDelete */}
            <ConfirmationModal
                isOpen={isConfirmNewsDeleteOpen}
                onClose={() => setIsConfirmNewsDeleteOpen(false)}
                onConfirm={handleNewsDelete}
                title="Confirm News Deletion"
                message={
                    <span>
                        Are you sure you want to delete this news item?
                        <br />
                        <blockquote className="mt-2 pl-3 border-l-2 border-gray-600 italic text-gray-400 text-xs">
                            {newsToDelete?.content?.substring(0, 100)}
                            {newsToDelete && newsToDelete.content.length > 100 ? '...' : ''}
                        </blockquote>
                        <br />
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