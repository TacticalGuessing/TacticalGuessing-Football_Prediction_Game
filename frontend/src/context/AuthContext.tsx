// src/context/AuthContext.tsx
'use client'; // Context Providers are Client Components

import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
// Remove the incorrect import - api.ts does not export apiLogout
// import { apiLogout } from '@/lib/api';

// Import User type
import { User } from '@/lib/api';

// Define the shape of the context data and functions
interface AuthContextProps {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    login: (userData: User, authToken: string) => void;
    logout: () => void;
    updateUserContext: (updatedUser: User | null) => void; // <<< ADDED definition
}

// Provide a default value for createContext that matches the interface shape
const defaultAuthContextValue: AuthContextProps = {
    user: null,
    token: null,
    isLoading: true, // Start loading initially
    login: () => { console.warn("Login function called outside AuthProvider"); }, // Use console.warn or no-op
    logout: () => { console.warn("Logout function called outside AuthProvider"); }, // Use console.warn or no-op
    updateUserContext: () => { console.warn("updateUserContext called outside AuthProvider"); }, // <<< ADDED dummy function here
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
    const router = useRouter();

    // Effect to load token and user info from localStorage on initial mount
    useEffect(() => {
        console.log("AuthProvider Effect: Running initial check...");
        try {
            const storedToken = localStorage.getItem('authToken');
            const storedUserInfo = localStorage.getItem('userInfo');

            if (storedToken && storedUserInfo) {
                const parsedUser: User = JSON.parse(storedUserInfo);

                if (parsedUser && typeof parsedUser === 'object' && 'userId' in parsedUser && 'name' in parsedUser) {
                    setUser(parsedUser);
                    setToken(storedToken);
                } else {
                    throw new Error("Parsed user info is invalid.");
                }
            }
        } catch (error) {
            console.error("AuthProvider Effect: ERROR during auth state loading:", error);
            localStorage.removeItem('authToken');
            localStorage.removeItem('userInfo');
            setUser(null); setToken(null);
        } finally {
            setIsLoading(false);
            console.log("AuthProvider Effect: Final state -> isLoading: false");
        }
    }, []);

    const login = (userData: User, authToken: string) => {
        console.log("AuthProvider: login called", { userData: userData.name, token: '[Token]' });
        try {
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('userInfo', JSON.stringify(userData));
            setUser(userData);
            setToken(authToken);
        } catch (error) {
             console.error("AuthProvider: Error during login storage:", error);
        }
    };

    const logout = () => {
        console.log("AuthProvider: logout called");
        try {
            localStorage.removeItem('authToken');
            localStorage.removeItem('userInfo');
        } catch (error) {
             console.error("AuthProvider: Error removing items from localStorage on logout:", error);
        } finally {
            setUser(null); setToken(null);
            router.push('/login');
        }
    };

    // --- IMPLEMENT the updateUserContext function ---
    const updateUserContext = (updatedUser: User | null) => {
        // Update the user state
        setUser(updatedUser);
        // Also update localStorage if the user object exists
        if (updatedUser) {
             try {
                localStorage.setItem('userInfo', JSON.stringify(updatedUser));
                console.log("AuthContext: User context and localStorage updated", updatedUser);
            } catch (error) {
                 console.error("AuthProvider: Error updating userInfo in localStorage:", error);
            }
        } else {
            // If updatedUser is null, potentially clear storage? Or assume logout handles this.
            // Let's assume logout handles clearing storage if the user becomes null.
             console.log("AuthContext: User context updated to null");
        }
    };
    // --- END IMPLEMENTATION ---

    // Ensure the value passed to Provider includes the new function
    const value: AuthContextProps = { // Explicitly type 'value' for clarity
        user,
        token,
        isLoading,
        login,
        logout,
        updateUserContext // <<< INCLUDE the implemented function
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

// Custom hook to use the AuthContext
export const useAuth = (): AuthContextProps => {
    const context = useContext(AuthContext);
    // Check against the default value object instance
    if (context === defaultAuthContextValue) {
        // This check might be too strict if the default values are recreated.
        // A check for a specific property might be better, e.g., if (!context.token && context.isLoading)
        // Or simply rely on the fact that AuthProvider *will* provide a non-default value.
        // Let's simplify the check - if context isn't the default object, it's likely provided.
        console.warn("useAuth potentially used outside AuthProvider or before provider is ready.");
        // However, throwing an error is safer to catch setup issues:
         throw new Error('useAuth must be used within an AuthProvider');
    }
    // Removed check for undefined as createContext now has a default value
    return context;
};