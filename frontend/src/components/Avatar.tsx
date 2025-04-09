// frontend/src/components/Avatar.tsx
import React from 'react';
import Image from 'next/image';
import { FaUserCircle } from 'react-icons/fa'; // Assuming react-icons is installed

interface AvatarProps {
    // Changed prop name: Expects the *full, absolute* URL now, or null/undefined
    fullAvatarUrl?: string | null;
    name?: string | null; // For initials fallback
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
}

// Helper function to get initials from a name (Keep as is)
const getInitials = (name?: string | null): string => {
    if (!name) return '?';
    const nameParts = name.trim().split(' ').filter(part => part.length > 0);
    if (nameParts.length === 0) return '?';
    const firstInitial = nameParts[0][0];
    if (nameParts.length === 1) return firstInitial.toUpperCase();
    const lastInitial = nameParts[nameParts.length - 1][0];
    return `${firstInitial}${lastInitial}`.toUpperCase();
};

const Avatar: React.FC<AvatarProps> = ({
    fullAvatarUrl, // Use the new prop name
    name,
    size = 'md',
    className = '',
}) => {
    // Map size prop to Tailwind classes (Keep as is)
    const sizeClasses = {
        xs: 'w-6 h-6 text-xs',
        sm: 'w-8 h-8 text-sm',
        md: 'w-10 h-10 text-base',
        lg: 'w-12 h-12 text-lg',
        xl: 'w-16 h-16 text-xl',
    }[size];

    const initials = getInitials(name);

    // --- REMOVED Base URL Construction Logic ---
    // The component now expects the full URL to be passed in via `fullAvatarUrl` prop.
    // --- END REMOVAL ---

    // Base classes for the container (Keep as is)
    const baseContainerClasses = `relative rounded-full flex items-center justify-center bg-gray-300 dark:bg-gray-600 overflow-hidden ${sizeClasses} ${className}`;

    return (
        <div className={baseContainerClasses}>
            {/* Use the fullAvatarUrl prop directly */}
            {fullAvatarUrl ? (
                <Image
                    src={fullAvatarUrl} // <<< Pass the full URL directly to src
                    alt={name || 'User Avatar'}
                    fill
                    sizes={ // Adjust sizes based on the 'size' prop (example values)
                        size === 'xs' ? '24px' :
                        size === 'sm' ? '32px' :
                        size === 'md' ? '40px' :
                        size === 'lg' ? '48px' :
                        '64px' // xl
                    }
                    className="object-cover" // Image covers the container
                    priority={false}
                    onError={(e) => {
                        // Hide broken image on error
                        console.warn(`[Avatar Component] Failed to load image: ${fullAvatarUrl}`);
                        (e.target as HTMLImageElement).style.display = 'none';
                        // Consider adding state here to show initials/icon as fallback on error if needed
                    }}
                />
            ) : name ? ( // Fallback to initials if no URL but name exists
                <span className="font-semibold text-white dark:text-gray-200 select-none">
                    {initials}
                </span>
            ) : ( // Fallback to default icon if no URL and no name
                <FaUserCircle className={`text-white dark:text-gray-200 w-[60%] h-[60%]`} />
            )}
        </div>
    );
};

export default Avatar;