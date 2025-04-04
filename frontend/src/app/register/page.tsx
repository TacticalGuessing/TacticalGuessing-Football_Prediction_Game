// frontend/src/app/register/page.tsx
'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { registerUser } from '@/lib/api';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(null); setIsLoading(true);
    try {
      await registerUser({ name, email, password });
      router.push('/login?registered=true');
    } catch (err) {
      console.error('Registration failed:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally { setIsLoading(false); }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="p-8 bg-white rounded shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Register</h2>
        {error && <p className="mb-4 text-center text-red-500 bg-red-100 p-2 rounded">{error}</p>}
        <form onSubmit={handleSubmit}>
           {/* Name Input */}
           <div className="mb-4">
             <label htmlFor="name" className="block text-gray-700 mb-2">Name</label>
             <input type="text" id="name" value={name} onChange={(e) => setName(e.target.value)} required className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700" disabled={isLoading}/>
           </div>
           {/* Email Input */}
           <div className="mb-4">
             <label htmlFor="email" className="block text-gray-700 mb-2">Email</label>
             <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700" disabled={isLoading}/>
           </div>
           {/* Password Input */}
           <div className="mb-6">
             <label htmlFor="password" className="block text-gray-700 mb-2">Password</label>
             <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700" disabled={isLoading}/>
             <p className="text-xs text-gray-500 mt-1">Minimum 6 characters.</p>
           </div>
           {/* Submit Button */}
           <button type="submit" disabled={isLoading} className={`w-full py-2 px-4 rounded text-white font-semibold ${isLoading ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50`}>
             {isLoading ? 'Registering...' : 'Register'}
           </button>
        </form>
        <p className="mt-6 text-center text-gray-600"> Already have an account?{' '} <Link href="/login" className="text-blue-600 hover:underline">Login here</Link> </p>
      </div>
    </div>
  );
}