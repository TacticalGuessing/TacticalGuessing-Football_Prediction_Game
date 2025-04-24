// frontend/src/app/verify-email/page.tsx
'use client';

import React, { useEffect, useState, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
// import Link from 'next/link'; // Removed unused import
import { verifyEmail, ApiError } from '@/lib/api'; // Import the API function
import Spinner from '@/components/ui/Spinner'; // Import your Spinner
import { Button } from '@/components/ui/Button'; // Import Button
import { FaCheckCircle, FaTimesCircle } from 'react-icons/fa'; // Icons

// A component to handle the verification logic, wrapped in Suspense
function VerifyEmailComponent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token');

    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState<string>('');
    // <<< Use useRef to track if verification has been initiated >>>
    const verificationInitiated = useRef(false);

    useEffect(() => {
        // Only run if verification hasn't been initiated yet AND we have a token
        if (!verificationInitiated.current && token) {
            // <<< Mark as initiated immediately >>>
            verificationInitiated.current = true;

            const verify = async () => {
                setStatus('loading');
                setMessage('Verifying your email...');
                try {
                    console.log(`[VerifyEmailPage] Attempting to verify token: ${token.substring(0, 5)}...`);
                    const result = await verifyEmail(token);
                    console.log("[VerifyEmailPage] API call returned:", result);

                    if (result && result.success === true) {
                        setMessage(result.message || 'Email successfully verified!');
                        setStatus('success');
                        console.log(`[VerifyEmailPage] Verification successful.`);
                    } else {
                        console.error("[VerifyEmailPage] Verification API returned success status but unexpected payload:", result);
                        setMessage(result?.message || "Verification failed: Unexpected server response.");
                        setStatus('error');
                    }
                } catch (err) {
                    console.error("[VerifyEmailPage] Verification failed (catch block):", err);
                    const errorMsg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'An unknown error occurred.';
                    setMessage(errorMsg.includes("invalid or has expired") ? errorMsg : `Verification failed: ${errorMsg}`);
                    setStatus('error');
                }
            };
            verify();
        } else if (!token && status === 'idle') {
            // Handle missing token on initial load (only if not already loading/processed)
            setMessage('Verification token missing or invalid.');
            setStatus('error');
            verificationInitiated.current = true; // Also mark as handled
        }
        // Depend only on token, let the ref prevent re-runs
    }, [token, status]); // Keep status dependency to handle the initial !token case correctly


    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-6">
            <div className="bg-gray-800 p-8 rounded-lg shadow-xl border border-gray-700 text-center max-w-md w-full">
                {/* Show loading state */}
                {status === 'loading' && (
                    <>
                        <Spinner className="h-8 w-8 text-blue-400 mx-auto mb-4" />
                        <h1 className="text-xl font-semibold text-gray-200">{message}</h1>
                    </>
                )}
                {/* Show success state */}
                {status === 'success' && (
                    <>
                        <FaCheckCircle className="text-green-500 text-5xl mx-auto mb-4" />
                        <h1 className="text-xl font-semibold text-green-400 mb-2">Verification Successful!</h1>
                        <p className="text-gray-300 mb-6">{message}</p>
                        <Button onClick={() => router.push('/login')}>Proceed to Login</Button>
                    </>
                )}
                {/* Show error state */}
                {status === 'error' && (
                     <>
                        <FaTimesCircle className="text-red-500 text-5xl mx-auto mb-4" />
                        <h1 className="text-xl font-semibold text-red-400 mb-2">Verification Failed</h1>
                        <p className="text-gray-300 mb-6">{message}</p>
                         <Button variant="secondary" onClick={() => router.push('/login')}>Go to Login</Button>
                    </>
                )}
                 {/* Show initial idle state (optional, can be covered by loading) */}
                 {status === 'idle' && !token && (
                     <>
                        <FaTimesCircle className="text-red-500 text-5xl mx-auto mb-4" />
                        <h1 className="text-xl font-semibold text-red-400 mb-2">Invalid Link</h1>
                        <p className="text-gray-300 mb-6">{message || 'Verification token missing.'}</p>
                         <Button variant="secondary" onClick={() => router.push('/login')}>Go to Login</Button>
                    </>
                 )}
            </div>
        </div>
    );
}

// Export the main page component that includes Suspense boundary
export default function VerifyEmailPage() {
    // Suspense is needed because useSearchParams() can suspend rendering
    return (
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen"><Spinner className="h-8 w-8"/></div>}>
             <VerifyEmailComponent />
         </Suspense>
    );
}