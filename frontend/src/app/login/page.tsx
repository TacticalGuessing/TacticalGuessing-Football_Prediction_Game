// frontend/src/app/(authPages)/login/page.tsx
'use client';

import React, { Suspense, useState, useEffect, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { loginUser, AuthResponse, ApiError } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
// --- Import UI Components ---
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
// --- End UI Imports ---


function LoginFormContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null); // State variable
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  // --- CORRECTED: Effect for registration success message ---
  useEffect(() => {
    if (searchParams.get('registered') === 'true') {
      setSuccessMessage('Registration successful! Please log in.'); // USE setSuccessMessage
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      // window.history.replaceState(null, '', '/login'); // Optional: remove param
      return () => clearTimeout(timer);
    }
  }, [searchParams]);
  // --- END CORRECTION ---

  // Effect to clear error when user types
  useEffect(() => { if (email || password) setError(null); }, [email, password]);

  // Handle submit logic remains the same
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null); setIsLoading(true);
    try {
      const response: AuthResponse = await loginUser({ email, password });
      if (response?.user && response?.token) {
         login(response.user, response.token);
         const redirectPath = searchParams.get('redirect') || '/dashboard';
         router.push(redirectPath);
      } else { throw new Error("Invalid login response."); }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : (err instanceof Error ? err.message : 'Login failed.');
      setError(message); console.error('Login failed:', err);
    } finally { setIsLoading(false); }
  };


  // JSX using successMessage state variable
  return (
    <>
      {error && ( <div role="alert" className="mb-4 text-center text-red-300 bg-red-900/30 border border-red-700/50 p-3 rounded-md text-sm">{error}</div> )}
      {/* This line USES successMessage */}
      {successMessage && ( <div role="status" className="mb-4 text-center text-green-300 bg-green-900/30 border border-green-700/50 p-3 rounded-md text-sm">{successMessage}</div> )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input type="email" id="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isLoading} />
        </div>
        <div className="space-y-1.5 mb-1">
          <Label htmlFor="password">Password</Label>
          <Input type="password" id="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isLoading} />
        </div>
        <Button type="submit" variant="primary" isLoading={isLoading} className="w-full !mt-6">
          {isLoading ? 'Logging in...' : 'Login'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-400">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="font-medium text-accent hover:text-amber-300 hover:underline"> Register here </Link>
      </p>
    </>
  );
}

// Main page component remains the same
export default function LoginPage() {
  return (
     <div className="flex items-center justify-center min-h-screen bg-gray-900 px-4 bg-cover bg-center bg-no-repeat bg-[url('/BG01.png')]">
      <div className="relative p-8 bg-gray-800/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-xl w-full max-w-md border border-gray-700">
         <div className="flex justify-center mb-6">
           <Image src="/tactical-guessing-logo.png" alt="Tactical Guessing Logo" width={250} height={50} priority />
         </div>
         <h2 className="text-xl font-semibold mb-6 text-center text-gray-100"> -Sign In-</h2>
         <Suspense fallback={<div className="text-center py-10 text-gray-400">Loading...</div>}>
           <LoginFormContent />
         </Suspense>
      </div>
    </div>
  );
}