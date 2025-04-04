// src/context/AuthContext.tsx
'use client'; // Context Providers are Client Components

import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
// Remove the incorrect import - api.ts does not export apiLogout
// import { apiLogout } from '@/lib/api';

// Define the structure for User Info (Uses the User type from api.ts if desired, or keep local)
// Let's import it for consistency
import { User } from '@/lib/api'; // Import User type

// Define the shape of the context data and functions
interface AuthContextProps {
    user: User | null;
    token: string | null;
    isLoading: boolean; // To track initial loading of auth state
    login: (userData: User, authToken: string) => void;
    logout: () => void;
}

// Provide a default value for createContext that matches the interface shape
// This avoids the null! assertion and provides better type safety downstream
const defaultAuthContextValue: AuthContextProps = {
    user: null,
    token: null,
    isLoading: true, // Start loading initially
    login: () => { throw new Error("Login function not implemented"); },
    logout: () => { throw new Error("Logout function not implemented"); },
};

const AuthContext = createContext<AuthContextProps>(defaultAuthContextValue);

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true); // Start in loading state
    const router = useRouter();

    // Effect to load token and user info from localStorage on initial mount
    useEffect(() => {
        console.log("AuthProvider Effect: Running initial check...");
        try {
            const storedToken = localStorage.getItem('authToken');
            const storedUserInfo = localStorage.getItem('userInfo');

            // console.log("AuthProvider Effect: Raw token from localStorage:", storedToken ? "[Token Present]" : "[No Token]");
            // console.log("AuthProvider Effect: Raw userInfo from localStorage:", storedUserInfo ? "[UserInfo Present]" : "[No UserInfo]");

            if (storedToken && storedUserInfo) {
                // console.log("AuthProvider Effect: Attempting to parse userInfo...");
                const parsedUser: User = JSON.parse(storedUserInfo); // Add type assertion
                // console.log("AuthProvider Effect: Parsed user:", parsedUser);

                // Basic validation of parsed user structure (optional but recommended)
                if (parsedUser && typeof parsedUser === 'object' && 'userId' in parsedUser && 'name' in parsedUser) {
                    setUser(parsedUser);
                    setToken(storedToken);
                    // console.log("AuthProvider Effect: State updated with valid user/token.");
                } else {
                    throw new Error("Parsed user info is invalid."); // Throw error if structure is wrong
                }

            } else {
                // console.log("AuthProvider Effect: Token or userInfo missing from localStorage. Setting state to null.");
                // State is already null by default, no need to set again unless clearing previously valid state
            }
        } catch (error) {
            console.error("AuthProvider Effect: ERROR during auth state loading:", error);
            // Clear potentially corrupted storage
            localStorage.removeItem('authToken');
            localStorage.removeItem('userInfo');
            setUser(null); // Ensure state is null
            setToken(null);
        } finally {
            setIsLoading(false); // Finished loading attempt
            console.log("AuthProvider Effect: Final state -> isLoading: false");
        }
    }, []); // Empty dependency array means run only once on mount

    const login = (userData: User, authToken: string) => {
        console.log("AuthProvider: login called", { userData: userData.name, token: '[Token]' });
        try {
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('userInfo', JSON.stringify(userData));
            setUser(userData);
            setToken(authToken);
        } catch (error) {
             console.error("AuthProvider: Error during login storage:", error);
             // Handle potential storage errors (e.g., storage full)
        }
    };

    const logout = () => {
        console.log("AuthProvider: logout called");
        try {
            // Replace apiLogout() call with direct localStorage removal
            localStorage.removeItem('authToken');
            localStorage.removeItem('userInfo');
        } catch (error) {
             console.error("AuthProvider: Error removing items from localStorage on logout:", error);
        } finally {
            // Reset state regardless of storage errors
            setUser(null);
            setToken(null);
             // Redirect to login page
            router.push('/login');
        }
    };

    // Memoize the context value if performance becomes an issue, but likely fine for now
    const value = { user, token, isLoading, login, logout };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

// Custom hook to use the AuthContext
export const useAuth = (): AuthContextProps => {
    const context = useContext(AuthContext);
    // The check for undefined/null is less critical now with a default value,
    // but keep it as a safeguard against improper usage.
    if (context === defaultAuthContextValue || context === undefined || context === null) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};