// frontend/src/app/(authenticated)/profile/statistics/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getUserPredictionStats, UserPredictionStatsResponse, ApiError } from '@/lib/api';

// Import UI Components
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import Spinner from '@/components/ui/Spinner';
import { FaPercentage, FaCalculator, FaChartLine, FaAward } from 'react-icons/fa';

// Import Recharts components
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    //Legend,
    ResponsiveContainer,
    TooltipProps
} from 'recharts';
import { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';

// Helper function to format percentage
const formatPercent = (value: number | null | undefined): string => {
    if (value === null || typeof value === 'undefined') return 'N/A';
    return `${(value * 100).toFixed(0)}%`; // Simple percentage, no decimals
};

// Helper function to format number (e.g., avg points)
const formatNumber = (value: number | null | undefined, decimals: number = 1): string => {
     if (value === null || typeof value === 'undefined') return 'N/A';
     return value.toFixed(decimals);
};

type CustomTooltipProps = TooltipProps<ValueType, NameType>;


export default function ProfileStatisticsPage() {
    const { token, isLoading: isAuthLoading } = useAuth();

    const [statsData, setStatsData] = useState<UserPredictionStatsResponse | null>(null);
    const [isLoadingStats, setIsLoadingStats] = useState(true);
    const [statsError, setStatsError] = useState<string | null>(null);

    // Fetch Stats Data
    const fetchStats = useCallback(async () => {
        if (!token) { setIsLoadingStats(false); return; }
        setIsLoadingStats(true);
        setStatsError(null);
        try {
            console.log("Fetching user prediction stats...");
            const data = await getUserPredictionStats(token);
            setStatsData(data);
            console.log("Stats data received:", data);
        } catch (error) {
            console.error("Failed to fetch stats:", error);
            const message = error instanceof ApiError ? error.message : (error instanceof Error ? error.message : "Could not load statistics.");
            setStatsError(message);
        } finally {
            setIsLoadingStats(false);
        }
    }, [token]);

    useEffect(() => {
        if (token && !isAuthLoading) {
            fetchStats();
        }
    }, [token, isAuthLoading, fetchStats]);

    // Custom Tooltip for Chart
    const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
        if (active && payload && payload.length) {
            return (
            <div className="p-2 bg-gray-700 border border-gray-600 rounded shadow-lg text-sm">
                <p className="label text-gray-300">{`Round: ${label}`}</p>
                <p className="intro text-blue-400">{`Points: ${payload[0].value}`}</p>
            </div>
            );
        }
        return null;
    };


    // --- Render Logic ---
    if (isAuthLoading || isLoadingStats) {
        return <div className="p-6 text-center"><Spinner /> Loading statistics...</div>;
    }

    if (statsError) {
        return <p className="p-4 text-red-400">Error loading statistics: {statsError}</p>;
    }

    if (!statsData) {
         return <p className="p-4 text-gray-400 italic">No statistics data available.</p>;
    }

    // Prepare data for chart (handle potentially long names)
    const chartData = statsData.pointsPerRoundHistory.map(item => ({
        ...item,
        // Truncate or shorten round name for X-axis if needed
        roundLabel: item.roundName.length > 15 ? item.roundName.substring(0, 12) + '...' : item.roundName
    }));


    return (
        <div className="space-y-6 px-1 !md:px-1 !pb-1 !pt-1">
            <h1 className="text-2xl md:text-1xl font-bold text-gray-100">Season 24/25 Statistics</h1>

            {/* KPIs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Overall Accuracy Card */}
                 <Card className="dark:bg-gray-800 border border-gray-700 p-1">
                    <CardHeader className="p-0 flex flex-row items-center justify-between space-y-0 pb-0">
                        <CardTitle className="text-sm font-medium text-gray-400">Overall Accuracy</CardTitle>
                        <FaPercentage className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="text-2xl font-bold text-gray-100">
                             {formatPercent(statsData.overallAccuracy)}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Correct Win/Draw/Loss predictions</p>
                    </CardContent>
                </Card>

                {/* Average Points Card */}
                 <Card className="dark:bg-gray-800 border border-gray-700 p-1">
                     <CardHeader className="p-0 flex flex-row items-center justify-between space-y-0 pb-0">
                        <CardTitle className="text-sm font-medium text-gray-400">Avg Points / Round</CardTitle>
                        <FaCalculator className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="text-2xl font-bold text-gray-100">
                            {formatNumber(statsData.averagePointsPerRound, 1)}
                        </div>
                         <p className="text-xs text-gray-500 mt-1">Average across participated rounds</p>
                    </CardContent>
                </Card>

                 {/* Best Round Card */}
                 <Card className="dark:bg-gray-800 border border-gray-700 p-1">
                     <CardHeader className="p-0 flex flex-row items-center justify-between space-y-0 pb-0">
                        <CardTitle className="text-sm font-medium text-gray-400">Best Round</CardTitle>
                        <FaAward className="h-4 w-4 text-yellow-500" /> {/* Gold color */}
                    </CardHeader>
                    <CardContent className="p-0">
                         {statsData.bestRound ? (
                             <>
                                <div className="text-2xl font-bold text-gray-100">
                                    {statsData.bestRound.points} pts
                                </div>
                                <p className="text-xs text-gray-500 mt-1" title={statsData.bestRound.roundName}>
                                     {/* Truncate long round names */}
                                     {statsData.bestRound.roundName.length > 25
                                        ? statsData.bestRound.roundName.substring(0, 22) + '...'
                                        : statsData.bestRound.roundName}
                                </p>
                            </>
                         ) : (
                            <div className="text-lg font-bold text-gray-400 italic">N/A</div>
                         )}
                    </CardContent>
                </Card>
            </div>

            {/* Points Trend Chart Card */}
            <Card className="dark:bg-gray-800 border border-gray-700">
                 <CardHeader>
                    <CardTitle className="flex items-center">
                         <FaChartLine className="mr-2 text-blue-400"/> Points Per Round Trend
                    </CardTitle>
                     <CardDescription className="text-xs text-gray-500 mt-1">Your points scored in each completed round you participated in.</CardDescription>
                </CardHeader>
                <CardContent>
                     {statsData.pointsPerRoundHistory.length > 0 ? (
                         // Ensure chart has enough vertical space
                         <div style={{ width: '100%', height: 300 }}>
                             <ResponsiveContainer>
                                <LineChart
                                    data={chartData} // Use prepared data with shorter labels if needed
                                    margin={{ top: 5, right: 20, left: -10, bottom: 5 }} // Adjust margins
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" /> {/* Grid color */}
                                    <XAxis
                                        dataKey="roundLabel" // Use the shortened label
                                        stroke="#9CA3AF" // Axis label color
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        // Consider angle if labels overlap: angle={-45} textAnchor="end" height={60}
                                    />
                                    <YAxis
                                        stroke="#9CA3AF"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        allowDecimals={false} // Points are usually integers
                                    />
                                     <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(107, 114, 128, 0.1)' }}/>
                                    {/* <Legend /> */} {/* Legend might be overkill for one line */}
                                    <Line
                                        type="monotone"
                                        dataKey="points"
                                        stroke="#3B82F6" // Example line color (blue-500)
                                        strokeWidth={2}
                                        dot={{ r: 4, fill: '#3B82F6' }}
                                        activeDot={{ r: 6, stroke: '#60A5FA' }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                         </div>
                     ) : (
                         <p className="text-gray-500 italic text-center py-8">No round history data available to plot.</p>
                     )}
                </CardContent>
            </Card>
        </div>
    );
}