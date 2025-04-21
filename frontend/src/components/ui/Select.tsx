// frontend/src/components/ui/Select.tsx
'use client';

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { FaCheck, FaChevronDown } from 'react-icons/fa';
import { clsx } from 'clsx';

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

// --- Select Trigger (the button part) ---
const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    // Example styling - adjust to match Input component's look
    className={clsx(
      'flex h-10 w-full items-center justify-between border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-0 focus:ring-ring focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 rounded-sm',
      // Example concrete: 'flex h-10 w-full items-center justify-between rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm ...',
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <FaChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

// --- Select Content (the dropdown part) ---
const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', sideOffset = 4, ...props }, ref) => ( // Added sideOffset
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      // Match table body styling: Dark background, subtle border, minimal rounding
      className={clsx(
        'relative z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-sm', // Use same rounding as trigger/inputs
        'border border-gray-700 dark:border-gray-700', // Same subtle border as trigger/table
        'bg-gray-800 dark:bg-gray-800', // Same dark background as table body/containers
        'text-gray-100 dark:text-gray-100', // Default text color
        'shadow-md', // Keep a subtle shadow for layering
        // Radix animation classes (keep these)
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        // Popper positioning adjustments (keep these)
        position === 'popper' &&
          'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
        className
      )}
      position={position}
      sideOffset={sideOffset} // Use sideOffset prop
      {...props}
    >
      <SelectPrimitive.Viewport
        // Adjust padding if needed, remove width/height constraints from popper default
        className={clsx(
          'p-1', // Standard padding around items
           position === 'popper' && '' // Remove popper-specific viewport sizing if causing issues
          // 'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]' // Removed these
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

// --- Select Item (individual option) ---
const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={clsx(
      // Base styles
      'relative flex w-full cursor-default select-none items-center',
      'py-1.5 pl-8 pr-2 text-sm outline-none',
      // Default Text Color
      'text-gray-100 dark:text-gray-100',

      // --- HOVER State ---
      // Try a more distinct background color on hover
      'hover:bg-gray-700 dark:hover:bg-gray-700', // Using bg-gray-700 for hover
      'hover:text-white dark:hover:text-white', // Ensure text stays white

      // Focus state - keep subtle or remove
      'focus:bg-gray-700 dark:focus:bg-gray-600/50',

      // Data attributes
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className
    )}
    {...props}
  >
    {/* Checkmark Indicator */}
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <FaCheck className="h-4 w-4 text-accent" />
      </SelectPrimitive.ItemIndicator>
    </span>

    {/* Item Text */}
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

// --- Export all components ---
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem, // Ensure SelectItem is exported
};