// frontend/src/app/reset-password/[token]/page.tsx
'use client';

import React, { useState, FormEvent, useEffect, Suspense } from 'react'; // Added Suspense
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image'; // <-- Import Image
import { toast } from 'react-hot-toast';
import { resetPassword, ApiError } from '@/lib/api';

// Import UI Components
import { Label } from '@/components/ui/Label';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { FaCheckCircle } from 'react-icons/fa'; // Keep icon for success

// Wrap content in Suspense-compatible component
function ResetPasswordFormContent() {
    const router = useRouter();
    const params = useParams();
    const token = typeof params.token === 'string' ? params.token : '';

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    useEffect(() => {
        if (!token) {
            setError("Invalid or missing reset token.");
            toast.error("Invalid or missing reset token link.");
        }
    }, [token]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);
        if (!token) { setError("Invalid or missing reset token."); return; }
        if (password.length < 6) { setError('Password must be at least 6 characters long.'); toast.error('Password must be at least 6 characters long.'); return; }
        if (password !== confirmPassword) { setError('Passwords do not match.'); toast.error('Passwords do not match.'); return; }
        setIsLoading(true);
        const toastId = toast.loading('Resetting password...');
        try {
            const response = await resetPassword(token, password);
            setSuccessMessage(response.message);
            toast.success(response.message, { id: toastId });
            setTimeout(() => { router.push('/login'); }, 2000);
        } catch (err) {
            console.error("Reset password error:", err);
            const message = err instanceof ApiError ? err.message : 'An unexpected error occurred.';
            setError(message);
            toast.error(`Error: ${message}`, { id: toastId });
        } finally { setIsLoading(false); }
    };

    // Show Success Message and hide form
    if (successMessage) {
        return (
             <div className="text-center space-y-4 py-8">
                 <FaCheckCircle className="h-12 w-12 text-green-500 mx-auto" />
                 <p className="text-green-300">{successMessage}</p>
                 <p className="text-sm text-gray-400">Redirecting to login...</p>
             </div>
         );
     }

    // Show Form
    return (
        <>
            {error && (
                <div role="alert" className="mb-4 text-center text-red-300 bg-red-900/30 border border-red-700/50 p-3 rounded-md text-sm">
                    {error}
                </div>
            )}
            {/* Only show form fields if token exists */}
            {token && (
                 <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="password" className="text-gray-300">New Password</Label>
                         {/* Removed icon wrapper */}
                        <Input
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={isLoading}
                            // Removed pl-10
                        />
                    </div>
                    <div className="space-y-1.5 mb-1">
                        <Label htmlFor="confirmPassword" className="text-gray-300">Confirm New Password</Label>
                         {/* Removed icon wrapper */}
                        <Input
                            id="confirmPassword"
                            type="password"
                            placeholder="••••••••"
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            disabled={isLoading}
                            // Removed pl-10
                       />
                    </div>
                     <Button type="submit" variant="primary" className="w-full !mt-6" disabled={isLoading || !token} isLoading={isLoading}>
                         Reset Password
                     </Button>
                 </form>
            )}
             <p className="mt-6 text-center text-sm text-gray-400">
                 <Link href="/login" className="font-medium text-accent hover:text-amber-300 hover:underline">
                    Back to Login
                </Link>
            </p>
        </>
    );
}

// Main Page Component
export default function ResetPasswordPage() {
    return (
        // --- MATCH LOGIN PAGE STYLING ---
        <div className="flex items-center justify-center min-h-screen bg-gray-900 px-4 bg-cover bg-center bg-no-repeat bg-[url('/BG01.png')]">
            <div className="relative p-8 bg-gray-800/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-xl w-full max-w-md border border-gray-700">
                {/* Logo */}
                <div className="flex justify-center mb-6">
                <Image src="/tactical-guessing-logo.png" alt="Tactical Guessing Logo" width={250} height={50} priority />
                </div>
                {/* Title */}
                <h2 className="text-xl font-semibold mb-6 text-center text-gray-100"> -Reset Password-</h2>
                 {/* Description */}
                <p className="text-center text-gray-400 mb-6 text-sm">
                    Enter and confirm your new password below.
                </p>
                {/* Form Content */}
                <Suspense fallback={<div className="text-center py-10 text-gray-400">Loading...</div>}>
                    <ResetPasswordFormContent />
                </Suspense>
            </div>
        </div>
        // --- END MATCH LOGIN PAGE STYLING ---
    );
}