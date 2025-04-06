// frontend/src/utils/formatters.ts

/**
 * Formats an ISO date string or Date object into a locale-specific string (en-GB).
 * Example Output: "9 Apr 2024, 11:30" (based on medium dateStyle)
 * @param isoString - The date string (ISO format recommended) or Date object, or null/undefined.
 * @returns Formatted string, "Date unavailable", or "Invalid Date".
 */
export const formatDateTime = (isoString: string | Date | null | undefined): string => {
    if (!isoString) return "Date unavailable";
    try {
        const date = new Date(isoString);
        // Check if the date is valid after parsing
        if (isNaN(date.getTime())) {
            throw new Error('Invalid date value');
        }
        // Using en-GB locale
        return new Intl.DateTimeFormat('en-GB', {
            dateStyle: 'medium', // e.g., 9 Apr 2024
            timeStyle: 'short',  // e.g., 11:30
            hour12: false       // Use 24-hour format
        }).format(date);
    } catch (e) {
        console.error("Error formatting date:", isoString, e);
        return "Invalid Date";
    }
};

// Add other formatting functions here if needed