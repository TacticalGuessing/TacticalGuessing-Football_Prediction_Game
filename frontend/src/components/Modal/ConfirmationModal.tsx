// frontend/src/components/Modal/ConfirmationModal.tsx
'use client';

import React from 'react';
import { Button, ButtonProps} from '@/components/ui/Button'; // Ensure buttonVariants is exported or use keyof typeof ButtonProps['variant']
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/Card'; // Added CardDescription
import { X } from 'lucide-react'; // Optional: Import close icon
import { clsx } from 'clsx';

// Update Props Interface
export interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm?: () => void; // Make onConfirm optional
    title: string;
    message?: React.ReactNode; // Make message optional
    children?: React.ReactNode; // Add optional children prop
    confirmText?: string;
    cancelText?: string;
    isConfirming?: boolean;
    confirmButtonVariant?: ButtonProps['variant']; // Use variant type from ButtonProps
    showConfirmButton?: boolean; // Prop to control confirm button visibility
    showCancelButton?: boolean; // Prop to control cancel button visibility
    // Optional: Add className prop for further styling overrides if needed
    className?: string;
    contentClassName?: string; // Allow styling the content area
}

export default function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm, // Optional now
    title,
    message,
    children, // Destructure children
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isConfirming = false,
    confirmButtonVariant = 'primary', // Default variant
    showConfirmButton = true, // Default to show
    showCancelButton = true, // Default to show
    className, // Destructure className
    contentClassName // Destructure contentClassName
}: ConfirmationModalProps) {

    // Effect to prevent body scroll when modal is open
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

    // Backdrop click handler
    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    // Determine if default buttons should be shown
    const shouldShowFooter = showCancelButton || (showConfirmButton && onConfirm);

    return (
        // Modal Backdrop
        <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-center items-center p-4 transition-opacity duration-300"
            onClick={handleBackdropClick} // Close on backdrop click
        >
            {/* Modal Card */}
            <Card
                className={clsx(
                    "w-full max-w-md", // Default width constraint
                    "bg-gray-800",
                    "border border-gray-700",
                    "shadow-lg relative animate-fade-in-scale", // Add animation class if defined
                    className // Allow overriding via prop
                )}
                onClick={(e) => e.stopPropagation()} // Prevent clicks inside from closing
            >
                {/* Optional Close Button */}
                 <button
                    onClick={onClose}
                    className="absolute top-2 right-2 p-1 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition-colors z-10" // Ensure button is above content
                    aria-label="Close modal"
                    disabled={isConfirming} // Disable if an action is in progress
                 >
                    <X size={18} />
                 </button>

                {/* Card Header */}
                <CardHeader>
                    <CardTitle>{title}</CardTitle>
                     {/* Render message as description ONLY if children are NOT present */}
                     {!children && message && (
                        <CardDescription className="mt-2 text-sm text-gray-300">
                            {message}
                        </CardDescription>
                     )}
                </CardHeader>

                 {/* Card Content - Render children OR message */}
                 {/* Adjust padding based on whether children are present */}
                 <CardContent className={clsx(contentClassName, children ? 'p-0' : 'pt-0')}>
                     {children ? children : message ? null : <p className="text-sm text-gray-400 italic">(No content)</p>}
                     {/* If message wasn't in header, could render here: */}
                     {/* {!children && message && (<div className="text-sm text-gray-300">{message}</div>)} */}
                 </CardContent>

                {/* Card Footer (Conditional) */}
                {shouldShowFooter && (
                    <CardFooter className="flex justify-end space-x-3 pt-4 border-t border-gray-700"> {/* Add top border */}
                        {showCancelButton && (
                            <Button
                                variant="outline"
                                onClick={onClose}
                                disabled={isConfirming}
                            >
                                {cancelText}
                            </Button>
                        )}
                        {/* Only show Confirm button if needed AND handler provided */}
                        {showConfirmButton && onConfirm && (
                            <Button
                                variant={confirmButtonVariant}
                                onClick={onConfirm}
                                disabled={isConfirming}
                                isLoading={isConfirming}
                            >
                                {confirmText}
                            </Button>
                        )}
                    </CardFooter>
                 )}
            </Card>
        </div>
    );
}