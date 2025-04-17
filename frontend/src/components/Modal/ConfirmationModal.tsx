// frontend/src/components/Modal/ConfirmationModal.tsx
'use client';

import React from 'react';
import { Button, ButtonProps } from '@/components/ui/Button';
// Ensure Card and its parts are imported correctly
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card';
import { clsx } from 'clsx'; // Import clsx if needed for combining classes

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    isConfirming?: boolean;
    confirmButtonVariant?: ButtonProps['variant'];
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
    confirmButtonVariant = 'primary',
}: ConfirmationModalProps) {

    React.useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);


    if (!isOpen) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4"
            onClick={onClose}
        >
            {/* Explicitly apply background and border to the Card */}
            <Card
                className={clsx(
                    "w-full max-w-md", // Keep width constraint
                    "bg-gray-800",    // Explicit background surface color
                    "border border-gray-700" // Explicit default border color
                    // Add other base Card classes if needed, clsx handles merging
                )}
                onClick={(e) => e.stopPropagation()}
            >
                <CardHeader>
                    {/* Ensure CardTitle uses appropriate text color (likely handled by CardTitle component) */}
                    <CardTitle>{title}</CardTitle>
                </CardHeader>
                <CardContent>
                    {/* Update message text color for dark theme consistency */}
                    <div className="text-sm text-gray-300 space-y-2"> {/* Use primary text color */}
                        {message}
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end space-x-3">
                     {/* Buttons should inherit styles correctly */}
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={isConfirming}
                    >
                        {cancelText}
                    </Button>
                    <Button
                        variant={confirmButtonVariant} // Uses 'danger' in the delete case
                        onClick={onConfirm}
                        disabled={isConfirming}
                        isLoading={isConfirming}
                    >
                        {confirmText}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}