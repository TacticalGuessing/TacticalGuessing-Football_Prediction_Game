// src/context/AuthContext.tsx
'use client'; // Context Providers are Client Components

import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// Import User type and necessary API functions
import { User, getPendingRequests, getPendingLeagueInvites} from '@/lib/api'; // Make sure API functions are imported

// Define the shape of the context data and functions
interface AuthContextProps {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    login: (userData: User, authToken: string) => void;
    logout: () => void;
    updateUserContext: (updatedUser: User | null) => void;
    // --- ADDED Notification Status ---
    hasPendingFriendRequests: boolean;
    hasPendingLeagueInvites: boolean;
    refreshNotificationStatus: () => void; // Function to manually trigger refresh
    // --- END Notification Status ---
}

// Provide a default value for createContext that matches the interface shape
const defaultAuthContextValue: AuthContextProps = {
    user: null,
    token: null,
    isLoading: true, // Start loading initially
    login: () => { console.warn("Login function called outside AuthProvider"); },
    logout: () => { console.warn("Logout function called outside AuthProvider"); },
    updateUserContext: () => { console.warn("updateUserContext called outside AuthProvider"); },
    // --- ADDED Defaults ---
    hasPendingFriendRequests: false,
    hasPendingLeagueInvites: false,
    refreshNotificationStatus: () => { console.warn("refreshNotificationStatus called outside AuthProvider"); }
    // --- END Defaults ---
};

// Create the context with the default value
const AuthContext = createContext<AuthContextProps>(defaultAuthContextValue);

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true); // Start in loading state
    // --- ADDED Notification State ---
    const [hasPendingFriendRequests, setHasPendingFriendRequests] = useState(false);
    const [hasPendingLeagueInvites, setHasPendingLeagueInvites] = useState(false);
    // --- END Notification State ---
    const router = useRouter();

    // Effect to load token and user info from localStorage on initial mount
    useEffect(() => {
        //console.log("AuthProvider Effect: Running initial check...");
        try {
            const storedToken = localStorage.getItem('authToken');
            const storedUserInfo = localStorage.getItem('userInfo');

            if (storedToken && storedUserInfo) {
                const parsedUser: User = JSON.parse(storedUserInfo);
                // Add robust check for parsedUser structure
                if (parsedUser && typeof parsedUser === 'object' && 'userId' in parsedUser && 'name' in parsedUser) {
                    setUser(parsedUser);
                    setToken(storedToken);
                     //console.log("AuthProvider Effect: Loaded user from localStorage", parsedUser.name);
                } else {
                     console.warn("AuthProvider Effect: Parsed user info from localStorage is invalid.");
                     throw new Error("Parsed user info is invalid."); // Throw to trigger catch block
                }
            } else {
                 //console.log("AuthProvider Effect: No token/user info in localStorage.");
            }
        } catch (error) {
            console.error("AuthProvider Effect: ERROR during auth state loading:", error);
            // Ensure cleanup happens on error
            localStorage.removeItem('authToken');
            localStorage.removeItem('userInfo');
            setUser(null); setToken(null);
        } finally {
            // Set loading to false regardless of success/failure
            setIsLoading(false);
            //console.log("AuthProvider Effect: Initial load finished. isLoading: false");
        }
    
    }, []); // Empty dependency array ensures this runs only once on mount


    // --- ADDED Function to fetch notification status ---
    const fetchNotificationStatus = useCallback(async () => {
        // Fetches only run AFTER initial loading is complete AND a token exists
        if (!token || isLoading) {
            // If no token (logged out or initial load failed), ensure flags are false
            if (!token) {
                
                setHasPendingFriendRequests(false);
                setHasPendingLeagueInvites(false);
            }
            // console.log("AuthProvider: Skipping notification fetch (no token or initial load ongoing)");
            return;
        }

        //console.log("AuthProvider: Fetching notification statuses...");
        let friendStatus = false;
        let leagueStatus = false;

        try {
            // Fetch both statuses concurrently using Promise.allSettled for robustness
            const results = await Promise.allSettled([
                getPendingRequests(token),
                getPendingLeagueInvites(token)
            ]);

            // Check friend requests result
            if (results[0].status === 'fulfilled' && results[0].value.length > 0) {
                friendStatus = true;
            } else if (results[0].status === 'rejected') {
                console.error("Error fetching pending friend requests:", results[0].reason);
            }

            // Check league invites result
            if (results[1].status === 'fulfilled' && results[1].value.length > 0) {
                leagueStatus = true;
            } else if (results[1].status === 'rejected') {
                console.error("Error fetching pending league invites:", results[1].reason);
            }

            //console.log("[fetchNotificationStatus] Determined statuses -> Friends:", friendStatus, "Leagues:", leagueStatus);

            //console.log("AuthProvider: Fetched Status -> Friends:", friendStatus, "Leagues:", leagueStatus);
            setHasPendingFriendRequests(friendStatus);
            setHasPendingLeagueInvites(leagueStatus);

        } catch (error) {
            // Catch unexpected errors beyond Promise.allSettled
            console.error("AuthProvider: Unexpected error fetching notification statuses:", error);
            setHasPendingFriendRequests(false); // Reset flags on error
            setHasPendingLeagueInvites(false);
        }
    }, [token, isLoading]); // Depend on token and initial loading state

    // Effect to run the fetch function when token changes or initial loading completes
     useEffect(() => {
         fetchNotificationStatus();
     }, [fetchNotificationStatus]); // Dependency array now includes fetchNotificationStatus


     // --- ADDED Manual refresh function ---
     const refreshNotificationStatus = useCallback(() => {
        //console.log("AuthProvider: Manual notification refresh triggered.");
        // Call fetch directly, which checks token/isLoading internally
        fetchNotificationStatus();
    
    }, [fetchNotificationStatus]); // Depend on the fetch function itself

    // --- END Notification Fetch Logic ---


    // Existing login function
    const login = (userData: User, authToken: string) => {
        //console.log("AuthProvider: login called", { name: userData.name, token: '[Token]' });
        try {
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('userInfo', JSON.stringify(userData));
            setUser(userData);
            setToken(authToken);
            // Don't explicitly call fetchNotificationStatus here, let the useEffect handle it
        } catch (error) {
             console.error("AuthProvider: Error during login storage:", error);
        }
    };

    // Existing logout function
    const logout = () => {
        //console.log("--- LOGOUT START ---");
        console.log("AuthProvider: logout called");
        const redirectPath = '/login';
    
        // --- Initiate Navigation Immediately ---
        console.log(`AuthProvider: Pushing redirect to ${redirectPath} NOW.`);
        router.push(redirectPath);
    
        // --- Delay State Clearing ---
        // Use setTimeout to clear state slightly after navigation starts
        setTimeout(() => {
            console.log("AuthProvider: Clearing state via setTimeout...");
            try {
                localStorage.removeItem('authToken');
                localStorage.removeItem('userInfo');
            } catch (error) {
                 console.error("AuthProvider: Error removing items from localStorage on logout (delayed):", error);
            } finally {
                setUser(null);
                setToken(null);
                setHasPendingFriendRequests(false);
                setHasPendingLeagueInvites(false);
                console.log("AuthProvider: Local state and storage cleared (delayed).");
            }
        }, 50); // Small delay (e.g., 50ms)
    };

    // Existing updateUserContext function
    const updateUserContext = (updatedUser: User | null) => {
        setUser(updatedUser);
        if (updatedUser) {
             try {
                localStorage.setItem('userInfo', JSON.stringify(updatedUser));
                console.log("AuthContext: User context and localStorage updated", updatedUser);
            } catch (error) {
                 console.error("AuthProvider: Error updating userInfo in localStorage:", error);
            }
        } else {
             console.log("AuthContext: User context updated to null");
        }
    };


    // Ensure the value passed to Provider includes the new function and states
    const value: AuthContextProps = {
        user,
        token,
        isLoading,
        login,
        logout,
        updateUserContext,
        // --- ADDED Values ---
        hasPendingFriendRequests,
        hasPendingLeagueInvites,
        refreshNotificationStatus
        // --- END Values ---
    };

    // If initial loading is happening, you might want to render a loading indicator
    // instead of the children, or handle it within consuming components.
    // For simplicity here, we render children immediately, but isLoading flag is available.
    // if (isLoading) {
    //    return <div>Loading Authentication...</div>; // Or your global loader
    // }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

// Custom hook to use the AuthContext (keep existing)
export const useAuth = (): AuthContextProps => {
    const context = useContext(AuthContext);
    if (context === defaultAuthContextValue || context === undefined) { // Check for undefined too just in case
         // This typically means the hook was used outside of the provider tree.
         throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};