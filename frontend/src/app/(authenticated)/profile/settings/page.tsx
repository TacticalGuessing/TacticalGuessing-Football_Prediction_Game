// frontend/src/app/(authenticated)/profile/settings/page.tsx
'use client';

import React, { useState, useEffect, FormEvent, useRef, ChangeEvent } from 'react';
import { useAuth } from '@/context/AuthContext'; // Using the hook
import { toast } from 'react-hot-toast';
import { setTeamName, uploadAvatar, ApiError } from '@/lib/api'; // Import both API functions and ApiError
import Image from 'next/image';
import { FaUserCircle } from 'react-icons/fa'; // Default icon

// Example Spinner component (replace with your actual implementation if you have one)
const Spinner = () => (
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);


export default function ProfileSettingsPage() {
    // Get context data using the hook
    const { user, token, isLoading: isAuthLoading, updateUserContext } = useAuth();

    // State for Team Name
    const [teamNameInput, setTeamNameInput] = useState<string>('');

    // State for Avatar Upload
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Shared state for loading and error display for both forms
    const [isSaving, setIsSaving] = useState<boolean>(false); // Shared loading state
    const [error, setError] = useState<string | null>(null);   // Shared error message

    // Effect to initialize team name input when user context loads/changes
    useEffect(() => {
        if (user) {
            setTeamNameInput(user.teamName || '');
        }
    }, [user]);

    // Effect to clean up object URL for avatar preview
    useEffect(() => {
        // Revoke the object URL to avoid memory leaks
        return () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);

    // --- Team Name Handler ---
    const handleTeamNameSave = async (e: FormEvent) => {
        e.preventDefault();
        if (!token || isSaving || !user) return;

        if (teamNameInput === (user.teamName || '')) {
            toast.success("No changes to save for Team Name.");
            return;
        }

        setIsSaving(true);
        setError(null);
        const originalTeamName = user.teamName || '';
        const toastId = toast.loading('Updating team name...');

        try {
            const updatedUser = await setTeamName(teamNameInput, token);
            updateUserContext(updatedUser); // Update context
            toast.success('Team Name updated successfully!', { id: toastId });
        } catch (err: unknown) {
            console.error("Failed to update team name:", err);
            const message = err instanceof ApiError ? err.message : (err instanceof Error ? err.message : "An unknown error occurred.");
            setError(`Team Name Error: ${message}`);
            toast.error(`Update failed: ${message}`, { id: toastId });
            setTeamNameInput(originalTeamName); // Revert input on error
        } finally {
            setIsSaving(false);
        }
    };

    // --- Avatar Handlers ---
    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        setError(null); // Clear previous errors on new selection
        const files = event.target.files;
        if (files && files.length > 0) {
            const file = files[0];
            const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            const maxSize = 5 * 1024 * 1024; // 5MB

            if (!allowedTypes.includes(file.type)) {
                setError('Invalid file type. Please select a JPG, PNG, GIF, or WEBP image.');
                setSelectedFile(null); setPreviewUrl(null); event.target.value = '';
                return;
            }
            if (file.size > maxSize) {
                setError('File is too large. Maximum size is 5MB.');
                setSelectedFile(null); setPreviewUrl(null); event.target.value = '';
                return;
            }

            setSelectedFile(file);
            const newPreviewUrl = URL.createObjectURL(file);
            if (previewUrl) URL.revokeObjectURL(previewUrl); // Clean previous before setting new
            setPreviewUrl(newPreviewUrl);

        } else { // No file selected or selection cancelled
            setSelectedFile(null);
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
        }
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    const handleAvatarUpload = async () => { // Renamed from handleUpload to be specific
        if (!selectedFile || !token || isSaving) return;

        setIsSaving(true);
        setError(null);
        const toastId = toast.loading('Uploading avatar...');

        try {
            const updatedUserData = await uploadAvatar(selectedFile, token);

            // --- ADD LOG ---
            console.log("[SettingsPage] Received updated user data after upload:", updatedUserData);
            // ---------------

            updateUserContext(updatedUserData); // Update context with new user data (incl. avatarUrl)
            toast.success('Avatar updated successfully!', { id: toastId });
            setSelectedFile(null);
             if (previewUrl) URL.revokeObjectURL(previewUrl);
             setPreviewUrl(null);
             if (fileInputRef.current) fileInputRef.current.value = ''; // Reset file input

        } catch (err) {
            console.error("Avatar upload failed:", err);
            const message = err instanceof ApiError ? err.message : (err instanceof Error ? err.message : "An unknown error occurred.");
            setError(`Avatar Upload Error: ${message}`); // Add context to error message
            toast.error(`Upload failed: ${message}`, { id: toastId });
            // Don't clear selected file on error, user might want to retry
        } finally {
            setIsSaving(false);
        }
    };

    // --- Render Logic ---

    if (isAuthLoading) {
        return <div className="p-4 md:p-6 text-center">Loading profile...</div>;
    }

    if (!user) {
        return <div className="p-4 md:p-6 text-center text-red-600">User not found. Please log in.</div>;
    }

     // --- Construct Avatar URL ---
     // IMPORTANT: Adjust the base URL construction based on your environment setup
     const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL_FOR_IMAGES || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
     // Remove trailing slash if present, especially from API_URL which might have /api
     const baseUrlForImages = apiBaseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');

     const currentAvatarSrc = user.avatarUrl
         ? `${baseUrlForImages}${user.avatarUrl}` // Construct full URL
         : null;
     // Example: if avatarUrl = '/uploads/avatars/...' and baseUrlForImages = 'http://localhost:5001' -> http://localhost:5001/uploads/avatars/...
     // ---------------------------

    return (
        <div className="container mx-auto p-4 md:p-6">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">Profile Settings</h1>

            {/* --- User Info & Team Name Section --- */}
            <div className="bg-white p-4 md:p-6 rounded-lg shadow border border-gray-200 max-w-2xl mx-auto mb-8">
                {/* Display non-editable info */}
                <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2">
                    <p className="text-sm text-gray-500">Name:</p>
                    <p className="font-medium text-gray-800 truncate">{user.name}</p>
                    <p className="text-sm text-gray-500">Email:</p>
                    <p className="font-medium text-gray-800 truncate">{user.email}</p>
                    <p className="text-sm text-gray-500">Role:</p>
                    <p className="font-medium text-gray-800">{user.role}</p>
                </div>

                <hr className="my-4"/>

                {/* Team Name Form */}
                <form onSubmit={handleTeamNameSave} className="space-y-4">
                    <div>
                        <label htmlFor="teamName" className="block text-sm font-medium text-gray-700 mb-1">
                            Team Name (Optional)
                        </label>
                        <input
                            type="text"
                            id="teamName"
                            name="teamName"
                            value={teamNameInput}
                            onChange={(e) => setTeamNameInput(e.target.value)}
                            placeholder="Enter your team name"
                            maxLength={50}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
                            disabled={isSaving}
                        />
                        <p className="text-xs text-gray-500 mt-1">Displayed in standings. Leave blank to use your name.</p>
                    </div>

                    <div className="text-right pt-2">
                        <button
                            type="submit"
                            disabled={isSaving || teamNameInput === (user?.teamName || '')}
                            className="inline-flex justify-center py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSaving ? (
                                <> <Spinner /> Saving... </>
                             ) : 'Save Team Name'}
                        </button>
                    </div>
                </form>
            </div>


            {/* --- Avatar Upload Section --- */}
            <div className="bg-white p-4 md:p-6 rounded-lg shadow border border-gray-200 max-w-2xl mx-auto">
                <h2 className="text-xl font-semibold mb-4 text-gray-700">Profile Picture</h2>
                {/* Flex container for Image and Controls */}
                <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6">

                    {/* Avatar Display (Corrected in previous step) */}
                    <div className="flex-shrink-0 w-24 h-24 relative">
                        {previewUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={previewUrl}
                                alt="Avatar Preview"
                                className="h-full w-full rounded-full object-cover border-2 border-blue-400 shadow"
                            />
                        ) : currentAvatarSrc ? (
                            <Image
                                src={currentAvatarSrc}
                                alt="Current Avatar"
                                fill
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                className="rounded-full object-cover border border-gray-300 shadow"
                                priority={false}
                                onError={(e) => {
                                    console.warn("Failed to load avatar image:", currentAvatarSrc);
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                        ) : (
                            <FaUserCircle className="h-full w-full text-gray-400" />
                        )}
                    </div>
                    {/* End Avatar Display */}

                    {/* Upload Controls <<<< THIS IS THE SECTION TO ADD/CORRECT >>>>> */}
                    <div className="flex-grow">
                        {/* Hidden file input */}
                        <input
                            type="file"
                            accept="image/jpeg, image/png, image/gif, image/webp"
                            ref={fileInputRef}
                            onChange={handleFileChange} // Connect handler
                            className="hidden"
                            aria-label="Upload profile picture"
                            disabled={isSaving}
                        />
                        {/* Button to trigger the hidden input */}
                        <button
                            type="button"
                            onClick={triggerFileInput} // Connect handler
                            disabled={isSaving}
                            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Choose Image
                        </button>

                        {/* Conditional block for Upload button and selected file name */}
                        {selectedFile && (
                            <div className="mt-3 text-sm text-gray-600">
                                <p className="truncate">Selected: <span className="font-medium">{selectedFile.name}</span></p>
                                {/* Upload Avatar button */}
                                <button
                                    type="button"
                                    onClick={handleAvatarUpload} // Connect handler
                                    disabled={isSaving || !selectedFile}
                                    className="mt-2 inline-flex items-center px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSaving ? (
                                        <> <Spinner /> Uploading... </>
                                    ) : (
                                        'Upload Avatar'
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                    {/* End Upload Controls */}

                </div> {/* End Flex container */}
            </div>
            {/* --- End Avatar Upload Section --- */}

            {/* --- Combined Error Display Area --- */}
            {error && (
                <div className="mt-6 max-w-2xl mx-auto p-3 bg-red-50 border border-red-300 rounded-md text-center">
                    <p className="text-sm text-red-700 font-medium">{error}</p>
                </div>
            )}

        </div>
    );
}