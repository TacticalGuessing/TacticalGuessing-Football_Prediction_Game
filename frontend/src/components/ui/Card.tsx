// frontend/src/components/ui/Card.tsx
import * as React from 'react';
import { clsx } from 'clsx';

// --- Base Card Container ---
const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    // Example styling - adjust bg, border, shadow, text color based on theme vars or concrete values
    className={clsx(
      'rounded-sm border bg-card text-card-foreground shadow-sm', // Assumes theme vars
      // Example concrete: 'rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-md',
      className
    )}
    {...props}
  />
));
Card.displayName = 'Card';

// --- Card Header ---
const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={clsx('flex flex-col space-y-1.5 p-4 md:p-6', className)} // Standard padding
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

// --- Card Title ---
const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    // Adjust font size/weight as needed
    className={clsx(
      'text-lg font-semibold leading-none tracking-tight text-foreground', // Assumes 'foreground' var
      // Example concrete: 'text-lg font-semibold text-gray-900 dark:text-gray-100',
      className
    )}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

// --- Card Description ---
const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    // Adjust text size/color
    className={clsx(
        'text-sm text-muted-foreground', // Assumes 'muted-foreground' var
        // Example concrete: 'text-sm text-gray-600 dark:text-gray-400',
        className
        )}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

// --- Card Content ---
const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={clsx('p-4 md:p-6 pt-0', className)} // Padding, remove top padding as header has bottom padding
    {...props}
  />
));
CardContent.displayName = 'CardContent';

// --- Card Footer ---
const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={clsx('flex items-center p-4 md:p-6 pt-0', className)} // Padding, remove top padding
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };