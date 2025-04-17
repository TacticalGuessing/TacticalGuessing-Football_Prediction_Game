// frontend/src/app/(authenticated)/admin/news/page.tsx
'use client';

import React, { useState, FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createNewsItemAdmin, ApiError } from '@/lib/api'; // Import API function
import { toast } from 'react-hot-toast';

// Import UI Components
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea'; // Assuming you have a Textarea component
import { Button } from '@/components/ui/Button';
import { FaNewspaper, FaPaperPlane } from 'react-icons/fa';

// If you don't have a Textarea component, you can use a basic HTML one for now:
// const Textarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />;

export default function AdminPostNewsPage() {
    const { token, user, isLoading: isAuthLoading } = useAuth();
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!token || !content.trim()) {
            toast.error("News content cannot be empty.");
            return;
        }

        setIsSubmitting(true);
        setError(null);
        const toastId = toast.loading("Posting news item...");

        try {
            const newItem = await createNewsItemAdmin(content.trim(), token);
            toast.success(`News item #${newItem.newsItemId} posted successfully!`, { id: toastId });
            setContent(''); // Clear the textarea after successful post
        } catch (err) {
            console.error("Failed to post news item:", err);
            const message = err instanceof ApiError ? err.message : "Could not post news.";
            setError(message);
            toast.error(`Error: ${message}`, { id: toastId });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Basic auth check (layout should ideally handle this)
    if (isAuthLoading) return <div className="p-6 text-center">Loading authentication...</div>;
    if (!user || user.role !== 'ADMIN') return <p className="p-4 text-red-400">Access Denied.</p>;


    return (
        <div className="space-y-6 p-4 md:p-6">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-100 flex items-center">
                <FaNewspaper className="mr-3 text-gray-400" /> Post News Update
            </h1>

             {/* Use Card for the form */}
            <Card className="w-full max-w-2xl mx-auto dark:bg-gray-800 border border-gray-700">
                <CardHeader>
                    <CardTitle>Create New Post</CardTitle>
                    <CardDescription>Enter the news content below. It will appear on the user dashboard.</CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4">
                        {error && (
                            <p className="text-sm text-red-400 p-3 bg-red-900/30 border border-red-800 rounded">Error: {error}</p>
                        )}
                        <div className="space-y-1.5">
                            <Label htmlFor="newsContent">News Content</Label>
                            <Textarea
                                id="newsContent"
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder="Enter news update here..."
                                required
                                rows={5} // Adjust rows as needed
                                className="w-full rounded-md border-gray-600 bg-gray-700 text-gray-100 focus:border-primary-focus-ring focus:ring-primary-focus-ring disabled:opacity-50" // Example styling if using HTML textarea - adjust if using component
                                disabled={isSubmitting}
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-end">
                        <Button type="submit" disabled={isSubmitting || !content.trim()} isLoading={isSubmitting}>
                            <FaPaperPlane className="mr-2 h-4 w-4" /> Post News
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}