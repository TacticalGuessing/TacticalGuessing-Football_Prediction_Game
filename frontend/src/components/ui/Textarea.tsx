// frontend/src/components/ui/Textarea.tsx
import * as React from "react"
import { clsx } from "clsx"

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={clsx(
          // Base styles - match Input component where applicable
          "flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm shadow-sm", // Added min-h, adjust as needed
          // Border styles
          "border-gray-600 dark:border-gray-700", // Match Input border
          // Background styles
          "bg-gray-700 dark:bg-gray-800", // Match Input background (adjust if different)
          // Text styles
          "text-gray-100 dark:text-gray-100", // Match Input text
          // Placeholder styles
          "placeholder:text-gray-400 dark:placeholder:text-gray-400", // Match Input placeholder
          // Focus styles - match Button/Input focus ring
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1", // Basic ring structure
          "focus-visible:ring-gray-100 dark:focus-visible:ring-gray-100", // Example focus color (use your primary or accent)
          "focus-visible:ring-offset-gray-900 dark:focus-visible:ring-offset-gray-900", // Match focus offset
          // Disabled styles
          "disabled:cursor-not-allowed disabled:opacity-50",
          // Merge with any additional classes passed via props
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea } // Export the component