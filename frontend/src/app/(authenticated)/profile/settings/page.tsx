// frontend/src/app/(authenticated)/profile/settings/page.tsx
'use client';

import React, { useState, useEffect, FormEvent, useRef, ChangeEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'react-hot-toast';
import { setTeamName, uploadAvatar, updateUserNotificationSettings, UpdateNotificationSettingsPayload, User  } from '@/lib/api';
//import Image from 'next/image';
import { useRouter } from 'next/navigation';

// --- UI Component Imports ---
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import Avatar from '@/components/Avatar'; // Assuming your display Avatar component is here
//import Spinner from '@/components/ui/Spinner';
import { FaUserEdit, FaImage, FaUpload, FaSave, FaBell } from 'react-icons/fa'; // Added relevant icons

export default function ProfileSettingsPage() {
    // --- Hooks ---
    const { user, token, isLoading: isAuthLoading, updateUserContext } = useAuth();
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- State ---
    const [teamNameInput, setTeamNameInput] = useState<string>('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isSavingTeamName, setIsSavingTeamName] = useState<boolean>(false);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // --- NEW Notification State ---
    const [notifyNewRound, setNotifyNewRound] = useState(false);
    const [notifyDeadline, setNotifyDeadline] = useState(false);
    const [notifyResults, setNotifyResults] = useState(false);
    const [isSavingSettings, setIsSavingSettings] = useState(false);

    const checkboxClasses = "h-4 w-4 rounded border-gray-500 bg-gray-600 text-accent focus:ring-accent focus:ring-offset-gray-800 disabled:opacity-50";

    // --- Role Check Effect ---
    useEffect(() => {
        if (!isAuthLoading && user && user.role === 'VISITOR') {
            toast.error("Visitors cannot access settings.");
            router.replace('/dashboard');
        }
    }, [user, isAuthLoading, router]);

    // --- Initialization and Cleanup Effects ---
    useEffect(() => {
        if (user) {
            setTeamNameInput(user.teamName || '');
            // Initialize notification toggles from user context
            setNotifyNewRound(user.notifiesNewRound ?? true); // Default to true if field doesn't exist yet on user obj
            setNotifyDeadline(user.notifiesDeadlineReminder ?? true);
            setNotifyResults(user.notifiesRoundResults ?? true);
        }
     }, [user]); // Run only when user context changes
    useEffect(() => { return () => { if (previewUrl) { URL.revokeObjectURL(previewUrl); } }; }, [previewUrl]);

    // --- Handlers ---
    const handleTeamNameSave = async (e: FormEvent) => {
        e.preventDefault();
        if (!token || isSavingTeamName || isUploadingAvatar || !user || teamNameInput === (user.teamName || '')) return;
        setIsSavingTeamName(true); setError(null);
        const toastId = toast.loading('Updating team name...');
        try {
            const updatedUser = await setTeamName(teamNameInput.trim(), token); // Trim name
            updateUserContext(updatedUser);
            toast.success('Team Name updated!', { id: toastId });
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to update team name.";
            setError(message); toast.error(`Update failed: ${message}`, { id: toastId });
            // Don't revert input on error, let user see what they typed
        } finally { setIsSavingTeamName(false); }
    };

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        setError(null); const file = event.target.files?.[0];
        if (!file) { setSelectedFile(null); setPreviewUrl(null); return; }
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']; const maxSize = 5 * 1024 * 1024;
        if (!allowedTypes.includes(file.type)) { setError('Invalid file type (JPG, PNG, GIF, WEBP only).'); toast.error('Invalid file type.'); return; }
        if (file.size > maxSize) { setError('File too large (Max 5MB).'); toast.error('File too large (Max 5MB).'); return; }
        setSelectedFile(file);
        const newPreviewUrl = URL.createObjectURL(file);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(newPreviewUrl);
    };

    const triggerFileInput = () => fileInputRef.current?.click();

    const handleAvatarUpload = async () => {
        if (!selectedFile || !token || isUploadingAvatar || isSavingTeamName) return;
        setIsUploadingAvatar(true); setError(null);
        const toastId = toast.loading('Uploading avatar...');
        try {
            const updatedUserData = await uploadAvatar(selectedFile, token);
            updateUserContext(updatedUserData);
            toast.success('Avatar updated!', { id: toastId });
            setSelectedFile(null); if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to upload avatar.";
            setError(message); toast.error(`Upload failed: ${message}`, { id: toastId });
        } finally { setIsUploadingAvatar(false); }
    };

    // --- Handle Notification Settings Save ---
    const handleSettingsSave = async () => {
        if (!token || !user || isSavingSettings) return;

        const changedSettings: UpdateNotificationSettingsPayload = {};
        // Compare current state with initial state from user context
        if (notifyNewRound !== (user.notifiesNewRound ?? true)) {
            changedSettings.notifiesNewRound = notifyNewRound;
        }
        if (notifyDeadline !== (user.notifiesDeadlineReminder ?? true)) {
            changedSettings.notifiesDeadlineReminder = notifyDeadline;
        }
        if (notifyResults !== (user.notifiesRoundResults ?? true)) {
            changedSettings.notifiesRoundResults = notifyResults;
        }

        // Only save if something actually changed
        if (Object.keys(changedSettings).length === 0) {
            toast('No notification settings were changed.');
            return;
        }

        setIsSavingSettings(true);
        setError(null);
        const toastId = toast.loading('Saving notification settings...');

        try {
            // Ensure the type from lib/api.ts is used if necessary
            const updatedUser: User = await updateUserNotificationSettings(changedSettings, token);
            updateUserContext(updatedUser); // Update context with ALL fields returned
            toast.success('Notification settings saved!', { id: toastId });
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to save settings.";
            setError(message); toast.error(`Save failed: ${message}`, { id: toastId });
            // Revert state on error?
            // setNotifyNewRound(user.notifiesNewRound ?? true);
            // setNotifyDeadline(user.notifiesDeadlineReminder ?? true);
            // setNotifyResults(user.notifiesRoundResults ?? true);
        } finally {
            setIsSavingSettings(false);
        }
    };

    // --- Render Logic ---
    if (isAuthLoading) return <div className="p-6 text-center text-gray-400">Loading profile...</div>;
    if (!user || user.role === 'VISITOR') return <div className="p-6 text-center text-red-400">Access Denied or User Not Found.</div>; // Handle visitor case more gracefully

    // Use consistent container style
    const sectionContainerClasses = "bg-gray-800 rounded-lg shadow border border-gray-700";

    const settingsChanged =
        (user && notifyNewRound !== (user.notifiesNewRound ?? true)) ||
        (user && notifyDeadline !== (user.notifiesDeadlineReminder ?? true)) ||
        (user && notifyResults !== (user.notifiesRoundResults ?? true));

    return (
        <div className="space-y-8 p-4 md:p-6 max-w-3xl mx-auto"> {/* Constrain width, add more vertical space */}
            <h1 className="text-2xl md:text-3xl font-bold text-gray-100 flex items-center">
                <FaUserEdit className="mr-3 text-gray-400" /> Profile Settings
            </h1>

            {/* Combined Error Display */}
            {error && (
                <div role="alert" className="p-3 bg-red-900/30 border border-red-700/50 rounded-md text-center">
                    <p className="text-sm text-red-300 font-medium">{error}</p>
                </div>
            )}

            {/* --- Team Name Section --- */}
            <Card className={sectionContainerClasses}> {/* Use Card for structure */}
                <CardHeader>
                    <CardTitle>Team Name</CardTitle>
                    <CardDescription>This name will be shown in the standings. Leave blank to use your registered name.</CardDescription>
                </CardHeader>
                <form onSubmit={handleTeamNameSave}>
                    <CardContent>
                        <Label htmlFor="teamName" className="sr-only">Team Name</Label> {/* Screen reader only label */}
                        <Input
                            id="teamName"
                            type="text"
                            value={teamNameInput}
                            onChange={(e) => setTeamNameInput(e.target.value)}
                            placeholder={user.name} // Show registered name as placeholder
                            maxLength={50}
                            disabled={isSavingTeamName || isUploadingAvatar}
                            aria-describedby="teamNameHelp"
                        />
                        <p id="teamNameHelp" className="text-xs text-gray-400 mt-1.5">Max 50 characters.</p>
                    </CardContent>
                    <CardFooter className="flex justify-end">
                        <Button
                            type="submit"
                            size="sm"
                            disabled={isSavingTeamName || isUploadingAvatar || teamNameInput === (user?.teamName || '')}
                            isLoading={isSavingTeamName}
                        >
                             <FaSave className="mr-2 h-4 w-4" /> Save Team Name
                        </Button>
                    </CardFooter>
                </form>
            </Card>

            {/* --- Avatar Upload Section --- */}
            <Card className={sectionContainerClasses}> {/* Use Card */}
                <CardHeader>
                    <CardTitle>Profile Picture</CardTitle>
                    <CardDescription>Upload a new avatar (Max 5MB: JPG, PNG, GIF, WEBP).</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                        {/* Avatar Display */}
                        <div className="flex-shrink-0">
                            {/* Use AvatarDisplay component, pass preview if available */}
                            <Avatar
                                fullAvatarUrl={previewUrl || user.avatarUrl} // Show preview preferentially
                                name={user.name}
                                size="lg" // Larger size for settings page
                                className="ring-2 ring-offset-2 ring-offset-gray-800 ring-gray-600" // Add ring for emphasis
                            />
                        </div>

                        {/* Upload Controls */}
                        <div className="flex-grow w-full space-y-3">
                             {/* Hidden file input */}
                            <input type="file" accept="image/jpeg, image/png, image/gif, image/webp" ref={fileInputRef} onChange={handleFileChange} className="hidden" disabled={isUploadingAvatar || isSavingTeamName}/>
                            {/* Button to trigger */}
                            <Button
                                type="button"
                                variant="outline"
                                onClick={triggerFileInput}
                                disabled={isUploadingAvatar || isSavingTeamName}
                                className="w-full sm:w-auto" // Responsive width
                            >
                                <FaImage className="mr-2 h-4 w-4" /> Choose Image...
                            </Button>

                            {/* Selected file info and Upload button */}
                            {selectedFile && (
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-gray-700/50">
                                    <p className="text-sm text-gray-400 truncate flex-grow">
                                        Selected: <span className="font-medium text-gray-300">{selectedFile.name}</span>
                                    </p>
                                    <Button
                                        type="button"
                                        variant="secondary" // Accent color
                                        size="sm"
                                        onClick={handleAvatarUpload}
                                        disabled={isUploadingAvatar || isSavingTeamName || !selectedFile}
                                        isLoading={isUploadingAvatar}
                                        className="w-full sm:w-auto flex-shrink-0" // Responsive width
                                    >
                                        <FaUpload className="mr-2 h-4 w-4" /> Upload Avatar
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

             {/* --- Notification Settings Section (Using Checkboxes) --- */}
            <Card className={sectionContainerClasses}>
                <CardHeader>
                    <CardTitle className="flex items-center">
                        <FaBell className="mr-3 text-gray-400" /> Notification Preferences
                    </CardTitle>
                    <CardDescription>Choose which game-related emails you want to receive.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5"> {/* Increased spacing slightly */}

                    {/* New Round Notification */}
                    <div className="flex items-start justify-between gap-4"> {/* Use items-start, add gap */}
                        {/* Wrap Label and Description together */}
                        <div className="flex-grow">
                            <Label htmlFor="notifyNewRoundToggle" className="font-medium text-gray-100 cursor-pointer">
                                New Round Opened
                            </Label>
                            <p id="notifyNewRoundDesc" className="text-xs font-normal text-gray-400 mt-0.5">
                                Get notified when an admin opens a new prediction round.
                            </p>
                        </div>
                         {/* Checkbox */}
                         <input
                            type="checkbox"
                            id="notifyNewRoundToggle"
                            checked={notifyNewRound}
                            onChange={(e) => setNotifyNewRound(e.target.checked)}
                            disabled={isSavingSettings}
                            className={checkboxClasses} // Apply custom styles
                            aria-describedby="notifyNewRoundDesc"
                        />
                    </div>

                    {/* Deadline Reminder Notification */}
                    <div className="flex items-start justify-between gap-4">
                         <div className="flex-grow">
                            <Label htmlFor="notifyDeadlineToggle" className="font-medium text-gray-100 cursor-pointer">
                                Prediction Deadline Reminder
                            </Label>
                            <p id="notifyDeadlineDesc" className="text-xs font-normal text-gray-400 mt-0.5">
                                Receive a reminder if you haven&apos;t predicted close to the deadline (approx. 12h before).
                            </p>
                        </div>
                        <input
                            type="checkbox"
                            id="notifyDeadlineToggle"
                            checked={notifyDeadline}
                            onChange={(e) => setNotifyDeadline(e.target.checked)}
                            disabled={isSavingSettings}
                            className={checkboxClasses}
                            aria-describedby="notifyDeadlineDesc"
                        />
                    </div>

                    {/* Round Results Notification */}
                    <div className="flex items-start justify-between gap-4">
                         <div className="flex-grow">
                            <Label htmlFor="notifyResultsToggle" className="font-medium text-gray-100 cursor-pointer">
                                Round Results & Scoring
                            </Label>
                            <p id="notifyResultsDesc" className="text-xs font-normal text-gray-400 mt-0.5">
                                Get an email with your results when a round has been scored.
                            </p>
                        </div>
                        <input
                            type="checkbox"
                            id="notifyResultsToggle"
                            checked={notifyResults}
                            onChange={(e) => setNotifyResults(e.target.checked)}
                            disabled={isSavingSettings}
                            className={checkboxClasses}
                            aria-describedby="notifyResultsDesc"
                        />
                    </div>

                </CardContent>
                <CardFooter className="flex justify-end border-t border-gray-700 pt-4"> {/* Added border/padding */}
                    <Button
                        type="button"
                        size="sm"
                        onClick={handleSettingsSave}
                        disabled={isSavingSettings || isSavingTeamName || isUploadingAvatar || !settingsChanged}
                        isLoading={isSavingSettings}
                    >
                        <FaSave className="mr-2 h-4 w-4" /> Save Notification Settings
                    </Button>
                </CardFooter>
            </Card>

            {/* Display Basic Info (Read Only) */}
             <Card className={sectionContainerClasses}>
                 <CardHeader>
                     <CardTitle>Account Information</CardTitle>
                     <CardDescription>Your registered details (cannot be changed).</CardDescription>
                 </CardHeader>
                 <CardContent>
                     <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm">
                         <div className="sm:col-span-1"><dt className="font-medium text-gray-400">Name</dt></div>
                         <div className="sm:col-span-2"><dd className="text-gray-100">{user.name}</dd></div>

                         <div className="sm:col-span-1"><dt className="font-medium text-gray-400">Email</dt></div>
                         <div className="sm:col-span-2"><dd className="text-gray-100">{user.email}</dd></div>

                         <div className="sm:col-span-1"><dt className="font-medium text-gray-400">Role</dt></div>
                         <div className="sm:col-span-2"><dd className="text-gray-100">{user.role}</dd></div>
                     </dl>
                 </CardContent>
             </Card>

        </div> // End Page Container
    );
}