// frontend/src/components/Button.tsx
'use client';

import React from 'react';
import { clsx } from 'clsx';
// import Spinner from './Spinner'; // Assuming you have this component

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      className = '',
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center rounded-sm border border-transparent font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed';

    const sizeStyles = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    };

    // --- Updated Variant Styles ---
    const variantStyles = {
      // Use arbitrary hex values for default background to work around v4 alpha issue
      primary:   `bg-green-700 hover:bg-[#228B22] text-white focus:ring-[#228B22]`, // Forest Green
      secondary: `bg-[#FBBF24] hover:bg-amber-500 text-gray-900 focus:ring-[#FBBF24]`, // Amber-400 (Accent)
      danger:    `bg-[#DC2626] hover:bg-red-700   text-white focus:ring-[#DC2626]`, // Red-600 (Danger)
      // Outline and Ghost use transparent bg, likely okay without arbitrary values
      outline:   `bg-transparent border-gray-600 text-gray-300 hover:bg-gray-700 focus:ring-gray-500`,
      ghost:     `bg-transparent border-transparent text-gray-300 hover:text-white hover:bg-gray-700/50 focus:ring-gray-500`,
    };
    // --- End Updated Variant Styles ---

    const combinedClassName = clsx(
      baseStyles,
      sizeStyles[size],
      variantStyles[variant],
      { 'cursor-wait': isLoading },
      className
    );

    return (
      <button
        ref={ref}
        className={combinedClassName}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Spinner className="-ml-1 mr-2 h-4 w-4" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

// Example Spinner (assuming it exists)
const Spinner = ({ className = '' }: { className?: string }) => (
    <svg className={`animate-spin h-5 w-5 text-white ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

// Make sure the actual component export is present if Button is not the default export
// export default Button; // Or keep named export as is