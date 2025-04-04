// frontend/src/app/(authPages)/login/page.tsx
'use client';
import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

// Import the API function AND the useAuth hook
import { loginUser, AuthResponse } from '@/lib/api'; // Import AuthResponse type too
import { useAuth } from '@/context/AuthContext';     // <-- Import useAuth

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get the login function from the context
  const { login } = useAuth(); // <-- Get login function from context

  // useEffect for registration success message (remains the same)
  useEffect(() => {
    if (searchParams.get('registered') === 'true') {
      setSuccessMessage('Registration successful! Please log in.');
      // Optional: Clear query param from URL without full reload
      // Using window.history.replaceState might be cleaner if needed
      // router.replace('/login', { scroll: false });
    }
  }, [searchParams]); // Removed router dependency as it's stable

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null); // Clear success message on new attempt
    setIsLoading(true);

    try {
      // --- Step 1: Call API and capture the response ---
      const response: AuthResponse = await loginUser({ email, password });

      // --- Step 2: Update Auth Context with received data ---
      // Check if response is valid (optional, loginUser throws on error)
      if (response && response.user && response.token) {
         login(response.user, response.token); // <-- Call context login function

         // --- Step 3: Redirect AFTER updating context ---
         router.push('/dashboard'); // Redirect to dashboard
      } else {
          // Handle unexpected case where API succeeded but response is invalid
          throw new Error("Invalid response received from login API.");
      }

    } catch (err) {
      console.error('Login failed:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- JSX remains the same ---
  return (
     <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="p-8 bg-white rounded shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Login</h2>
        {error && <p className="mb-4 text-center text-red-500 bg-red-100 p-2 rounded">{error}</p>}
        {successMessage && <p className="mb-4 text-center text-green-600 bg-green-100 p-2 rounded">{successMessage}</p>}
        <form onSubmit={handleSubmit}>
          {/* Email Input */}
          <div className="mb-4">
            <label htmlFor="email" className="block text-gray-700 mb-2">Email</label>
            <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700" disabled={isLoading}/>
          </div>
          {/* Password Input */}
          <div className="mb-6">
            <label htmlFor="password" className="block text-gray-700 mb-2">Password</label>
            <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700" disabled={isLoading}/>
          </div>
          {/* Submit Button */}
          <button type="submit" disabled={isLoading} className={`w-full py-2 px-4 rounded text-white font-semibold ${isLoading ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50`}>
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <p className="mt-6 text-center text-gray-600"> Don&apos;t have an account?{' '} <Link href="/register" className="text-blue-600 hover:underline">Register here</Link> </p>
      </div>
    </div>
  );
}