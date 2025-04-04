// src/providers/AppProviders.tsx
'use client'; // This component wraps providers and uses client features

import React, { ReactNode } from 'react';
import { AuthProvider } from '@/context/AuthContext';
// Import other providers here if you add them later (e.g., ThemeProvider)

interface AppProvidersProps {
    children: ReactNode;
}

export default function AppProviders({ children }: AppProvidersProps) {
    return (
        <AuthProvider>
            {/* Wrap with other providers here */}
            {children}
        </AuthProvider>
    );
}