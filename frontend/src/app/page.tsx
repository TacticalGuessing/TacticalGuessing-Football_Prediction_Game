// frontend/src/app/page.tsx
'use client'; // Required for hooks like useEffect and useRouter

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext'; // Import your useAuth hook

export default function HomePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Wait until authentication status is determined
    if (!isLoading) {
      if (user) {
        // User is logged in, redirect to dashboard
        console.log('[HomePage] User found, redirecting to /dashboard');
        router.replace('/dashboard'); // Use replace to avoid adding '/' to history
      } else {
        // User is not logged in, redirect to login
        console.log('[HomePage] User not found, redirecting to /login');
        router.replace('/login');
      }
    }
  }, [user, isLoading, router]); // Dependencies for the effect

  // Render a simple loading state while checking auth
  // This page content will likely never be seen if redirects happen quickly
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-gray-500">Loading application...</p>
      {/* You can add a spinner component here */}
    </div>
  );
}