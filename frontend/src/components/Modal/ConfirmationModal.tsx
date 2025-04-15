// frontend/src/components/Modal/ConfirmationModal.tsx
'use client';

import React from 'react'; // Import useEffect from React

// --- UI Component Imports ---
import { Button, ButtonProps } from '@/components/ui/Button'; // Assuming ButtonProps is now exported
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card'; // Removed CardDescription

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: React.ReactNode; // Allow JSX in the message
    confirmText?: string;
    cancelText?: string;
    isConfirming?: boolean; // Loading state for confirm button
    confirmButtonVariant?: ButtonProps['variant']; // Use variant type from ButtonProps
}

export default function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isConfirming = false,
    confirmButtonVariant = 'primary', // Default to primary, can be overridden (e.g., 'danger')
}: ConfirmationModalProps) {

    // --- Moved useEffect HERE (before the early return) ---
    // Optional: Prevent background scroll when modal is open
    React.useEffect(() => {
        // Only add/remove overflow style if modal is actually open
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        }
        // Cleanup function ALWAYS resets overflow when component unmounts
        // or BEFORE the effect runs again if isOpen changes from true to false
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]); // Added isOpen dependency
    // --- END MOVED useEffect ---


    // Early return if not open
    if (!isOpen) {
        return null;
    }

    // --- Refactored JSX using UI Components ---
    return (
        // Modal backdrop
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4"
            onClick={onClose} // Close on backdrop click
        >
            {/* Use Card for modal content - stop propagation so clicking card doesn't close it */}
            <Card
                className="w-full max-w-md dark:bg-gray-800"
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside card
            >
                <CardHeader>
                    <CardTitle>{title}</CardTitle>
                     {/* Optionally add description if needed via props later */}
                     {/* <CardDescription>Optional description here</CardDescription> */}
                </CardHeader>
                <CardContent>
                    {/* Render the message content (can be simple text or complex JSX) */}
                    <div className="text-sm text-gray-600 dark:text-gray-300 space-y-2">
                        {message}
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end space-x-3">
                     {/* Cancel Button */}
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={isConfirming}
                    >
                        {cancelText}
                    </Button>
                    {/* Confirm Button */}
                    <Button
                        // Use the passed variant prop, default to primary/danger
                        variant={confirmButtonVariant}
                        onClick={onConfirm}
                        disabled={isConfirming}
                        isLoading={isConfirming} // Pass loading state
                    >
                        {confirmText}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}