// frontend/src/components/Avatar.tsx
'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { FaUserCircle } from 'react-icons/fa';

interface AvatarProps {
    fullAvatarUrl?: string | null;
    name?: string | null;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
}

// Helper function to get initials from a name
const getInitials = (name?: string | null): string => {
    if (!name?.trim()) return '?';
    const nameParts = name.trim().split(' ').filter(part => part.length > 0);
    if (nameParts.length === 0) return '?';
    const firstInitial = nameParts[0][0];
    if (nameParts.length === 1) return firstInitial.toUpperCase();
    const lastInitial = nameParts[nameParts.length - 1][0];
    return `${firstInitial}${lastInitial}`.toUpperCase();
};

const Avatar: React.FC<AvatarProps> = ({
    fullAvatarUrl,
    name,
    size = 'md',
    className = '',
}) => {
    const [hasError, setHasError] = useState(false);

    const sizeClasses = {
        xs: 'w-6 h-6 text-xs',
        sm: 'w-8 h-8 text-sm',
        md: 'w-10 h-10 text-base',
        lg: 'w-12 h-12 text-lg',
        xl: 'w-32 h-32 text-xl',
    }[size];

    const initials = getInitials(name);

    const baseContainerClasses = `relative rounded-full flex items-center justify-center bg-gray-300 dark:bg-gray-700 overflow-hidden ${sizeClasses} ${className}`;

    const showImage = fullAvatarUrl && !hasError;

    // Define fallback content separately
    const fallbackContent = name ? (
        <span className="font-semibold text-gray-200 select-none">{initials}</span>
    ) : (
        <FaUserCircle className={`text-gray-400 w-[60%] h-[60%]`} />
    );

    return (
        <div className={baseContainerClasses}>
            {showImage ? ( // Render image if showImage is true
                <Image
                    src={fullAvatarUrl!} // Can use non-null assertion if showImage guarantees it's defined
                    alt={name || 'User Avatar'}
                    fill
                    sizes={
                        size === 'xs' ? '24px' :
                        size === 'sm' ? '32px' :
                        size === 'md' ? '40px' :
                        size === 'lg' ? '48px' :
                        size === 'xl' ? '264px' :
                        '64px'
                    }
                    className="object-cover"
                    priority={false}
                    onError={() => {
                        console.warn(`[Avatar Component] Failed to load image: ${fullAvatarUrl}`);
                        setHasError(true);
                    }}
                />
            ) : ( // Otherwise, render the determined fallback content
                fallbackContent
            )}
        </div> // This closes the main div
    ); // This closes the return statement
}; // This closes the component function

export default Avatar;