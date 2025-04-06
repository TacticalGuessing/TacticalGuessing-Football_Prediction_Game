// frontend/src/utils/__tests__/formatters.test.ts

import { formatDateTime } from '../formatters'; // Import the function to test

// Mocking the system timezone can be complex. We'll primarily test
// the function's handling of different inputs and the general format,
// acknowledging that the exact time might vary based on test environment timezone.

describe('formatDateTime Utility', () => {
  // Test cases for invalid or edge-case inputs
  it('should return "Date unavailable" for null input', () => {
    expect(formatDateTime(null)).toBe('Date unavailable');
  });

  it('should return "Date unavailable" for undefined input', () => {
    expect(formatDateTime(undefined)).toBe('Date unavailable');
  });

  it('should return "Invalid Date" for unparseable string input', () => {
    expect(formatDateTime('this is definitely not a date')).toBe('Invalid Date');
  });

  it('should return "Invalid Date" for an invalid Date object', () => {
    // Creating a Date object from an invalid string results in an invalid date
    expect(formatDateTime(new Date('invalid-date-string'))).toBe('Invalid Date');
  });

  // Test cases for valid inputs
  it('should format a valid UTC ISO string correctly (en-GB, medium date, short time)', () => {
    const isoString = '2024-04-09T10:30:00.000Z'; // 9th April 2024, 10:30 AM UTC
    const formattedDate = formatDateTime(isoString);

    // Expect format like "9 Apr 2024, HH:mm" - Time depends on test environment timezone
    // Regex to check the overall structure is safer
    expect(formattedDate).toMatch(/^\d{1,2} \w{3} \d{4}, \d{2}:\d{2}$/);

    // Check specific parts that shouldn't change with timezone (usually date part)
    expect(formattedDate).toContain('9 Apr 2024');
  });

  it('should format a valid Date object correctly', () => {
    // Month is 0-indexed (3 = April)
    const dateObject = new Date(Date.UTC(2023, 3, 25, 14, 45, 0)); // 25th April 2023, 2:45 PM UTC
    const formattedDate = formatDateTime(dateObject);

    expect(formattedDate).toMatch(/^\d{1,2} \w{3} \d{4}, \d{2}:\d{2}$/);
    expect(formattedDate).toContain('25 Apr 2023');
  });

  it('should format midnight correctly (00:00)', () => {
    const isoString = '2024-01-01T00:00:00.000Z'; // Midnight UTC on Jan 1st
    const formattedDate = formatDateTime(isoString);

    expect(formattedDate).toMatch(/^\d{1,2} \w{3} \d{4}, 00:00$/); // Check time is 00:00
    expect(formattedDate).toContain('1 Jan 2024');
  });

  it('should format noon correctly (12:00)', () => {
    const isoString = '2024-07-15T12:00:00.000Z'; // Noon UTC on Jul 15th
    const formattedDate = formatDateTime(isoString);

    expect(formattedDate).toMatch(/^\d{1,2} \w{3} \d{4}, \d{2}:00$/); // Check time ends in :00
    expect(formattedDate).toContain('15 Jul 2024');
     // Note: exact hour (e.g., 12:00 vs 13:00) depends on timezone
  });

});