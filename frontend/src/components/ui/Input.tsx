// frontend/src/components/ui/Input.tsx
import * as React from 'react';
import { clsx } from 'clsx';

// *** MODIFIED: Use type alias instead of empty interface extension ***
export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  // ... rest of the component remains the same
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={clsx(
          'flex h-10 w-full rounded-sm border border-gray-600 dark:border-gray-700', // Border
          'bg-gray-700 dark:bg-gray-700', // Background
          'px-3 py-2 text-sm text-gray-100 dark:text-gray-100', // Text
          'ring-offset-gray-900 dark:ring-offset-gray-900', // Focus Ring Offset
          'placeholder:text-gray-400 dark:placeholder:text-gray-500', // Placeholder
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2', // Focus Ring (using forest green)
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-600', // Disabled state
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };