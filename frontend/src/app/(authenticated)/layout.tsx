// frontend/src/app/(authenticated)/layout.tsx
import React from 'react';
import Header from '@/components/Header'; // Adjust path if your component is elsewhere
//import { AuthProvider } from '@/context/AuthContext'; // Assuming AuthProvider wraps the root layout, otherwise add it here or ensure context is available

export default function AuthenticatedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        // If AuthProvider doesn't wrap the root layout.tsx, you might need it here.
        // However, it's usually better practice to have it higher up in layout.tsx.
        // <AuthProvider>
            <>
                <Header />
                <main className="container mx-auto px-4 py-6">
                    {children}
                </main>
                {/* You could add a shared footer here if needed */}
            </>
        // </AuthProvider>
    );
}

// Optional: Add metadata if needed for this layout segment
// export const metadata = {
//   title: 'User Area - Predictor Game',
// };