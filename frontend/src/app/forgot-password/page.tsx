// frontend/src/app/forgot-password/page.tsx
'use client';

import React, { useState, FormEvent, Suspense } from 'react'; // Added Suspense
import Link from 'next/link';
import Image from 'next/image'; // <-- Import Image
import { toast } from 'react-hot-toast';
import { forgotPassword, ApiError } from '@/lib/api';

// Import UI Components
// Card components not needed if structure matches login
import { Label } from '@/components/ui/Label';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { FaPaperPlane } from 'react-icons/fa'; // Keep icon for button

// Wrap content in Suspense-compatible component if needed, or keep simple
function ForgotPasswordFormContent() {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!email.trim()) {
            toast.error('Please enter your email address.');
            return;
        }
        setIsLoading(true);
        setMessage(null);
        try {
            const response = await forgotPassword(email.trim());
            setMessage(response.message);
            toast.success("Request submitted.");
            setEmail('');
        } catch (error) {
            console.error("Forgot password error:", error);
            const errorMsg = error instanceof ApiError ? error.message : 'An unexpected error occurred.';
            toast.error('Could not process request. Please try again later.');
            setMessage(`Error: ${errorMsg}`);
        } finally {
            setIsLoading(false);
        }
    };

     return (
        <>
            {/* Display Message */}
            {message && !isLoading && (
                 <div role={message.startsWith('Error:') ? 'alert' : 'status'} className={`mb-4 text-center ${message.startsWith('Error:') ? 'text-red-300 bg-red-900/30 border border-red-700/50' : 'text-blue-300 bg-blue-900/50 border border-blue-700/50'} p-3 rounded-md text-sm`}>
                    {message.replace('Error: ','')}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-gray-300">Email Address</Label>
                    {/* Removed icon wrapper */}
                    <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isLoading}
                        // Removed pl-10
                    />
                </div>
                 <Button type="submit" variant="primary" className="w-full !mt-6" disabled={isLoading} isLoading={isLoading}>
                    <FaPaperPlane className="mr-2 h-4 w-4" /> Send Reset Link
                </Button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-400">
                 <Link href="/login" className="font-medium text-accent hover:text-amber-300 hover:underline">
                     Back to Login
                 </Link>
            </p>
        </>
    );
}


// Main Page Component
export default function ForgotPasswordPage() {
  return (
     // --- MATCH LOGIN PAGE STYLING ---
     <div className="flex items-center justify-center min-h-screen bg-gray-900 px-4 bg-cover bg-center bg-no-repeat bg-[url('/BG01.png')]">
      <div className="relative p-8 bg-gray-800/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-xl w-full max-w-md border border-gray-700">
         {/* Logo */}
         <div className="flex justify-center mb-6">
           <Image src="/tactical-guessing-logo.png" alt="Tactical Guessing Logo" width={250} height={50} priority />
         </div>
         {/* Title */}
         <h2 className="text-xl font-semibold mb-6 text-center text-gray-100"> -Forgot Password-</h2>
         {/* Description */}
          <p className="text-center text-gray-400 mb-6 text-sm">
            Enter your email to receive a password reset link.
          </p>
         {/* Form Content */}
         <Suspense fallback={<div className="text-center py-10 text-gray-400">Loading...</div>}>
           <ForgotPasswordFormContent />
         </Suspense>
      </div>
    </div>
    // --- END MATCH LOGIN PAGE STYLING ---
  );
}