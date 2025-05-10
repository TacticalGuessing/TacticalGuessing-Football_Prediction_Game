// frontend/src/components/PlayerCard/PlayerCard.tsx
import React from 'react';
import Image from 'next/image';
import { StandingEntry } from '@/lib/api'; // Import the enhanced type
import Avatar from '@/components/Avatar'; // Import your Avatar component
import { clsx } from 'clsx'; // Import clsx for conditional classes if needed

interface PlayerCardProps {
    playerData: StandingEntry | null; // Allow null for initial state before selection
    className?: string; // Allow passing additional classes
}

// Helper function to format accuracy
const formatAccuracy = (acc: number | null | undefined): string => {
    if (acc === null || typeof acc === 'undefined') return 'N/A';
    return `${acc.toFixed(0)}%`; // Example: 75%
};

// Helper function to format average points
const formatAvgPoints = (avg: number | null | undefined): string => {
     if (avg === null || typeof avg === 'undefined') return 'N/A';
    return avg.toFixed(1); // Example: 6.5
};

export default function PlayerCard({ playerData, className }: PlayerCardProps) {

    // Handle null playerData gracefully (e.g., when modal is opening but data isn't set yet)
    if (!playerData) {
        // Optional: Render a loading skeleton or placeholder card
        return (
             <div className={clsx("relative w-[200px] aspect-[280/380] rounded-lg overflow-hidden shadow-lg bg-gray-700 animate-pulse", className)}>
                 {/* Placeholder structure */}
             </div>
        );
    }

    // Fallback for team name
    const displayName = playerData.teamName || playerData.name || 'Unknown Player';
    const rank = playerData.rank ?? '-';
    const totalPoints = playerData.points ?? 0;

    // Define stat abbreviations and values
    // Use nullish coalescing (??) for safer access in case fields are unexpectedly missing
    const stats = [
        { label: 'AVG', value: formatAvgPoints(playerData.averagePointsPerRound) },
        { label: 'ACC', value: formatAccuracy(playerData.accuracy) },
        { label: 'RND', value: playerData.roundsPlayed ?? 'N/A' },
        { label: 'BES', value: playerData.bestRoundScore ?? 'N/A' },
        { label: 'EXA', value: playerData.exactScores ?? 'N/A' },
        { label: 'JOK', value: playerData.totalSuccessfulJokers ?? 'N/A' },
    ];

    return (
        // Main card container
        // Combine passed className with default styles
        <div className={clsx(
            "relative w-[220px] aspect-[280/380] rounded-xl overflow-hidden shadow-xl border border-gray-700/50", // Slightly larger, more rounding, subtle border
            className // Allow overriding via props
        )}>
            {/* Background Image */}
            <Image
                src="/playerCard.png" // Path from /public folder
                alt="" // Decorative background
                layout="fill"
                objectFit="cover"
                quality={90}
                priority // May cause many LCP elements if used in a list, consider removing if performance issues arise
                className="-z-10" // Put background behind content
            />

            {/* Content positioned absolutely */}
            {/* Added slight padding adjustment (p-2 instead of p-3) */}
            <div className="absolute inset-0 p-2 text-white flex flex-col justify-between text-shadow-sm">
                {/* Top Section */}
                <div className="flex flex-col items-center text-center mt-1"> {/* Added margin-top */}
                     {/* Rank */}
                     <div className="font-bold text-2xl text-yellow-300/90 mb-1 drop-shadow-md"> {/* Adjusted size/color */}
                         #{rank}
                     </div>
                     {/* Avatar */}
                    <div className="mb-1.5 scale-90"> {/* Scaled avatar slightly */}
                        <Avatar
                            size="md" // Kept medium size
                            name={playerData.name} // Real name for alt text
                            fullAvatarUrl={playerData.avatarUrl}
                            className="border-2 border-gray-400/60 rounded-full shadow-md" // Adjusted border/shadow
                        />
                    </div>
                     {/* Team/Display Name */}
                     <div className="font-semibold text-sm leading-tight px-1 truncate w-[90%]" title={displayName}> {/* Slightly wider truncation */}
                         {displayName}
                     </div>
                </div>

                {/* Divider Area - Can add a subtle visual element here if desired */}
                {/* Example: <div className="h-[1px] bg-white/10 my-1 mx-2"></div> */}

                 {/* Bottom Section (Stats Grid) */}
                 <div className="relative z-10 mb-1"> {/* Added margin-bottom */}
                     {/* Total Points */}
                     <div className="text-center font-bold text-3xl mb-2 text-yellow-300/90 drop-shadow-md"> {/* Adjusted size/color */}
                         {totalPoints} PTS
                     </div>
                     {/* Stats Grid */}
                     {/* Adjusted gap */}
                    <div className="grid grid-cols-3 gap-x-3 gap-y-1.5">
                        {stats.map((stat) => (
                            <div key={stat.label} className="text-center">
                                <div className="text-xl font-bold leading-tight">{stat.value}</div>
                                <div className="text-[10px] font-semibold opacity-80 uppercase leading-tight tracking-wider">{stat.label}</div> {/* Uppercase label */}
                            </div>
                        ))}
                    </div>
                 </div>
            </div>
        </div>
    );
}

// Add text-shadow utility if not already in global CSS
/* In globals.css:
.text-shadow-sm { text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.6); }
*/