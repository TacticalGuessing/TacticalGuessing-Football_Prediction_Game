// frontend/src/app/register/page.tsx // Adjusted path assumption
'use client';
import React, { useState, FormEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { registerUser, ApiError } from '@/lib/api';
// --- Import UI Components ---
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
// --- End UI Imports ---

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null); setIsLoading(true);
    try {
      await registerUser({ name: name.trim(), email, password }); // Trim name
      router.push('/login?registered=true');
    } catch (err) {
      let message = 'Registration failed.';
      if (err instanceof ApiError) {
        message = err.status === 409 ? "Email already registered." : err.message;
      } else if (err instanceof Error) { message = err.message; }
      setError(message); console.error('Registration failed:', err);
    } finally { setIsLoading(false); }
  };

  // Removed local input/label classes

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 px-4
                   bg-cover bg-center bg-no-repeat bg-[url('/BG01.png')]"> {/* Added px-4 for small screen padding */}
      {/* Consistent Card Styling */}
      <div className="relative p-8 bg-gray-800/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-xl w-full max-w-md border border-gray-700">
        <div className="flex justify-center mb-6">
          <Image src="/tactical-guessing-logo.png" alt="Tactical Guessing Logo" width={250} height={50} priority />
        </div>
        {/* Consistent Heading Style */}
        <h2 className="text-xl font-semibold mb-6 text-center text-gray-100">-Create Your Account-</h2>

        {error && ( <div role="alert" className="mb-4 text-center text-red-300 bg-red-900/30 border border-red-700/50 p-3 rounded-md text-sm">{error}</div> )}

        <form onSubmit={handleSubmit} className="space-y-4">
           {/* Use Label & Input */}
           <div className="space-y-1.5"> {/* Group label and input */}
             <Label htmlFor="name">Name</Label>
             <Input type="text" id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required disabled={isLoading} />
           </div>
           <div className="space-y-1.5">
             <Label htmlFor="email">Email</Label>
             <Input type="email" id="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isLoading} />
           </div>
           <div className="space-y-1.5 mb-1"> {/* Reduced mb */}
             <Label htmlFor="password">Password</Label>
             <Input type="password" id="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} disabled={isLoading} aria-describedby="password-hint" />
             <p id="password-hint" className="text-xs text-gray-400 mt-1">Minimum 6 characters.</p>
           </div>
           {/* Use Button */}
           <Button type="submit" variant="primary" isLoading={isLoading} className="w-full !mt-6"> {/* Added !mt-6 */}
             {isLoading ? 'Registering...' : 'Register'}
           </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-400">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-accent hover:text-amber-300 hover:underline"> Login here </Link>
        </p>
      </div>
    </div>
  );
}