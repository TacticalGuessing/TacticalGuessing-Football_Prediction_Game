// frontend/src/app/(authPages)/login/page.tsx
'use client'; // Keep this directive

// Import Suspense from React
import React, { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { loginUser, AuthResponse, ApiError } from '@/lib/api'; // Import ApiError too
import { useAuth } from '@/context/AuthContext';

// --- Step 1: Create the inner component containing Suspense-dependent logic ---
function LoginFormContent() {
  // All the original state, hooks, effects, and handlers go inside here
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams(); // <<< useSearchParams is used here
  const { login } = useAuth(); // <-- Get login function from context

  // useEffect for registration success message
  useEffect(() => {
    if (searchParams.get('registered') === 'true') {
      setSuccessMessage('Registration successful! Please log in.');
      // Optional: Clear query param
      // router.replace('/login', { scroll: false });
    }
    // Clear success message if user starts typing again or on error
    if (error || email || password) {
        // Set timeout to allow message to be seen briefly if needed
        // setTimeout(() => setSuccessMessage(null), 3000);
        // Or clear immediately:
        // setSuccessMessage(null);
    }

  }, [searchParams, error, email, password]); // Added dependencies to clear message

  // useEffect to clear error when user types
  useEffect(() => {
    if (email || password) {
        setError(null);
    }
  }, [email, password]);


  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null); // Clear success message on new attempt
    setIsLoading(true);

    try {
      const response: AuthResponse = await loginUser({ email, password });

      if (response && response.user && response.token) {
         login(response.user, response.token);
         // Determine redirect path (use dashboard as default)
         const redirectPath = searchParams.get('redirect') || '/dashboard';
         router.push(redirectPath);
      } else {
          throw new Error("Invalid response received from login API.");
      }

    } catch (err) {
      console.error('Login failed:', err);
      // Use ApiError for better messages if available
      setError(err instanceof ApiError ? err.message : (err instanceof Error ? err.message : 'An unexpected error occurred.'));
    } finally {
      setIsLoading(false);
    }
  };

  // Return the form JSX and related messages
  return (
    <>
      {error && <p className="mb-4 text-center text-red-500 bg-red-100 p-2 rounded">{error}</p>}
      {successMessage && <p className="mb-4 text-center text-green-600 bg-green-100 p-2 rounded">{successMessage}</p>}
      <form onSubmit={handleSubmit}>
        {/* Email Input */}
        <div className="mb-4">
          <label htmlFor="email" className="block text-gray-700 dark:text-gray-300 mb-2">Email</label>
          <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600" disabled={isLoading}/>
        </div>
        {/* Password Input */}
        <div className="mb-6">
          <label htmlFor="password" className="block text-gray-700 dark:text-gray-300 mb-2">Password</label>
          <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600" disabled={isLoading}/>
        </div>
        {/* Submit Button */}
        <button type="submit" disabled={isLoading} className={`w-full py-2 px-4 rounded text-white font-semibold ${isLoading ? 'bg-blue-300 dark:bg-blue-800 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800'} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50`}>
          {isLoading ? 'Logging in...' : 'Login'}
        </button>
      </form>
      <p className="mt-6 text-center text-gray-600 dark:text-gray-400">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="text-blue-600 hover:underline dark:text-blue-400">
          Register here
        </Link>
      </p>
    </>
  );
}
// --- End of inner component ---


// --- Step 2: Modify the main Page component ---
export default function LoginPage() {
  // This component now only provides structure and the Suspense boundary

  return (
     <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="p-8 bg-white dark:bg-gray-800 rounded shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800 dark:text-gray-100">Login</h2>

        {/* --- Step 3: Wrap the inner component with Suspense --- */}
        <Suspense fallback={<div className="text-center py-10 text-gray-500 dark:text-gray-400">Loading form...</div>}>
          <LoginFormContent />
        </Suspense>
        {/* --- End Suspense wrapper --- */}

      </div>
    </div>
  );
}