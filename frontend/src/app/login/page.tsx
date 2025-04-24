// frontend/src/app/(authPages)/login/page.tsx
'use client';

import React, { Suspense, useState, useEffect, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { loginUser, AuthResponse, ApiError, resendVerificationEmail } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'react-hot-toast';
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
  const [needsVerification, setNeedsVerification] = useState(false);
  const [isResending, setIsResending] = useState(false);
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
  useEffect(() => {
    if (email || password) {
      setError(null);
      setNeedsVerification(false); // <<< Reset verification flag on typing >>>
    }
  }, [email, password]);

  // Handle submit logic remains the same
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNeedsVerification(false); // <<< Reset verification flag on new submit >>>
    setIsLoading(true);
    try {
      const response: AuthResponse = await loginUser({ email, password });
      if (response?.user && response?.token) {
        login(response.user, response.token);
        const redirectPath = searchParams.get('redirect') || '/dashboard';
        router.push(redirectPath);
      } else { throw new Error("Invalid login response."); }
    } catch (err) {
      console.error('Login failed:', err);
      let errorMessage = "Login failed. Please check your credentials."; // Default

      // <<< MODIFY Catch Block >>>
      if (err instanceof ApiError && err.message === 'EMAIL_NOT_VERIFIED') {
        errorMessage = "Please verify your email address before logging in. Check your inbox (and spam folder) for the verification link.";
        setNeedsVerification(true); // <<< Set flag for specific UI >>>
      } else if (err instanceof ApiError) {
        errorMessage = err.message; // Use message from other ApiErrors
      } else if (err instanceof Error) {
        errorMessage = err.message; // Use message from standard Error
      }
      // <<< END MODIFY >>>

      setError(errorMessage);
    } finally { setIsLoading(false); }
  };

   // --- >>> ADD Resend Handler <<< ---
   const handleResendVerification = async () => {
    if (!email) {
      toast.error("Please enter your email address in the field above first.");
      return;
    }
    if (isResending) return; // Prevent double clicks

    setIsResending(true);
    setError(null); // Clear previous errors
    setNeedsVerification(false); // Hide the resend button temporarily

    try {
      const response = await resendVerificationEmail(email);
      toast.success(response.message); // Show success message from backend
    } catch (err) {
        console.error("Resend verification error:", err);
        const message = err instanceof ApiError ? err.message : "Failed to resend verification email.";
        toast.error(message);
        setError(message); // Show error message again
        setNeedsVerification(true); // Show the resend button again on error
    } finally {
      setIsResending(false);
    }
  };
  // --- >>> END Resend Handler <<< ---

  console.log('[LoginFormContent Render] Error State:', error);
  console.log('[LoginFormContent Render] Needs Verification State:', needsVerification);


  // JSX using successMessage state variable
  return (
    <>
      {error && (
        <div role="alert" className="mb-4 text-center text-red-300 bg-red-900/30 border border-red-700/50 p-3 rounded-md text-sm">
          {error}
          {/* Conditionally add Resend link/button */}
          {needsVerification && (
            <button
              type="button"
              onClick={handleResendVerification} // Uncomment when handler is implemented
              className="ml-2 underline text-red-300 hover:text-red-200 text-sm"
            >
              (Resend verification?) {/* Add actual API call later */}
            </button>
          )}
        </div>
      )}
      {/* This line USES successMessage */}
      {successMessage && (<div role="status" className="mb-4 text-center text-green-300 bg-green-900/30 border border-green-700/50 p-3 rounded-md text-sm">{successMessage}</div>)}

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
        <Link href="/forgot-password" className="font-medium text-accent hover:text-amber-300 hover:underline">
          Forgot Password?
        </Link>
      </p>

      <p className="mt-6 text-center text-sm text-gray-400">

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