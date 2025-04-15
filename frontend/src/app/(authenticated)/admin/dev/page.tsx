// frontend/src/app/(authenticated)/admin/dev/page.tsx
'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'react-hot-toast';
// Import the API function (assuming it exists in lib/api)
import { resetGameDataForDev } from '@/lib/api';
// Import UI Components
import { Button } from '@/components/ui/Button';
import { FaSyncAlt, FaExclamationTriangle, FaTools } from 'react-icons/fa'; // Import icons
//import Spinner from '@/components/ui/Spinner'; // Assuming Spinner exists

export default function DevToolsPage() {
    const { token, user } = useAuth(); // Need token and user role check maybe?
    const [isResetting, setIsResetting] = useState(false);
    const [resetError, setResetError] = useState<string | null>(null);

    const handleResetData = async () => {
        // Double confirmation!
       if (!window.confirm("DANGER ZONE! Are you absolutely sure you want to delete ALL rounds, fixtures, and predictions? This CANNOT be undone.")) {
           return;
       }
        if (!window.confirm("SECOND CONFIRMATION: Seriously, delete everything except users?")) {
            return;
        }
        if (!token) { toast.error("Auth error"); return; }

        setIsResetting(true);
        setResetError(null);
        const toastId = toast.loading("Resetting game data...");

        try {
            const response = await resetGameDataForDev(token);
            toast.success(response.message || "Game data reset successfully! Page will reload.", { id: toastId, duration: 4000 });
            // Force reload after a short delay to see changes
            setTimeout(() => window.location.reload(), 2000);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to reset data.";
            setResetError(message);
            toast.error(`Reset Failed: ${message}`, { id: toastId });
        } finally {
            setIsResetting(false);
        }
    };

    // Basic check (layout should also protect this route)
    if (!user || user.role !== 'ADMIN') {
         return <p className="p-4 text-red-400">Access Denied.</p>;
    }

    // Only render button in development
    const isDevelopment = process.env.NODE_ENV === 'development';

    return (
        <div className="space-y-6 p-4 md:p-6">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-100 flex items-center">
                <FaTools className="mr-3 text-gray-400" /> Developer Tools
            </h1>

            {/* --- DEV RESET BUTTON --- */}
            <div className={`p-6 border rounded-lg ${isDevelopment ? 'border-red-700 bg-red-900/30' : 'border-yellow-700 bg-yellow-900/30'}`}>
                 <h3 className={`text-lg font-bold flex items-center justify-center mb-3 ${isDevelopment ? 'text-red-300' : 'text-yellow-300'}`}>
                     <FaExclamationTriangle className="mr-2" /> {isDevelopment ? 'Development Action: Reset Data' : 'Data Reset Disabled'}
                 </h3>

                 {resetError && <p className="text-sm text-red-200 text-center mb-3">{resetError}</p>}

                 <p className={`text-sm text-center mb-4 ${isDevelopment ? 'text-red-200' : 'text-yellow-200'}`}>
                     {isDevelopment
                        ? "This will delete ALL Rounds, Fixtures, and Predictions. User accounts will remain. Use with extreme caution!"
                        : "Data Reset functionality is disabled in the current environment."
                     }
                 </p>

                 {isDevelopment && ( // Only show button in dev
                     <div className="flex justify-center">
                        <Button
                            variant="danger"
                            onClick={handleResetData}
                            isLoading={isResetting}
                            disabled={isResetting}
                        >
                            <FaSyncAlt className="mr-2" /> Reset All Game Data
                        </Button>
                     </div>
                 )}
             </div>
             {/* --- END DEV RESET BUTTON --- */}

             {/* Add placeholders for other future dev tools here */}

        </div>
    );
}