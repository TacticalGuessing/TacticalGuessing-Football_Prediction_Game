// frontend/src/components/ui/Checkbox.tsx
'use client';

import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { FaCheck } from 'react-icons/fa';
import { clsx } from 'clsx';

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    // Example styling - box appearance, focus, checked state
    className={clsx(
        'peer h-4 w-4 shrink-0 rounded-sm border border-gray-400 dark:border-gray-600', // Border color
        'ring-offset-gray-900 dark:ring-offset-gray-900', // Focus offset
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2', // Focus ring
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:bg-blue-600 dark:data-[state=checked]:bg-blue-600', // Checked background (adjust color)
        'data-[state=checked]:text-white dark:data-[state=checked]:text-white', // Checkmark color
        'data-[state=indeterminate]:bg-blue-600 data-[state=indeterminate]:text-white', // Indeterminate state
        className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={clsx('flex items-center justify-center text-current')}
    >
      {/* Adjust check icon size/style if needed */}
      <FaCheck className="h-3 w-3" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };