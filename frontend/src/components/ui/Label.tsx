// frontend/src/components/ui/Label.tsx
import * as React from 'react';
import { clsx } from 'clsx';

// Assuming you might use Radix UI Label later, but starting simple
// import * as LabelPrimitive from "@radix-ui/react-label"

// Using basic HTML label for now
const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    // Example base styling - adjust text color/weight to your theme
    // Using 'foreground' assumes it's defined in your tailwind.config.ts
    // Otherwise, replace with e.g., text-gray-700 dark:text-gray-300
    className={clsx(
      'text-sm font-medium leading-none text-gray-300 dark:text-gray-300 peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
      className
    )}
    {...props}
  />
));
Label.displayName = 'Label';

export { Label };