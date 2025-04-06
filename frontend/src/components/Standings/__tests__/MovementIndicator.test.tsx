// frontend/src/components/Standings/__tests__/MovementIndicator.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom'; // Import the matchers

// --- Ensure this import path is correct ---
import MovementIndicator from '../MovementIndicator';

describe('<MovementIndicator /> Component Tests', () => { // Changed describe text slightly
  it('should render dash with correct class for null movement', () => {
    // Correct JSX Syntax: <ComponentName propName={propValue} />
    render(<MovementIndicator movement={null} />);
    const indicatorElement = screen.getByText('–');

    expect(indicatorElement).toBeInTheDocument();
    expect(indicatorElement).toHaveClass('text-gray-500');
    expect(indicatorElement).not.toHaveClass('text-green-600', 'text-red-600'); // Check multiple non-expected classes
  });

  it('should render dash with correct class for zero movement', () => {
    // Correct JSX Syntax
    render(<MovementIndicator movement={0} />);
    const indicatorElement = screen.getByText('–');

    expect(indicatorElement).toBeInTheDocument();
    expect(indicatorElement).toHaveClass('text-gray-500');
  });

  it('should render upward arrow, number, and correct classes for positive movement', () => {
    const testMovement = 5;
    // Correct JSX Syntax
    render(<MovementIndicator movement={testMovement} />);

    // Find element containing the text pattern
    const indicatorElement = screen.getByText(`▲${testMovement}`);

    expect(indicatorElement).toBeInTheDocument();
    expect(indicatorElement).toHaveClass('text-green-600', 'font-semibold');
    expect(indicatorElement).not.toHaveClass('text-gray-500', 'text-red-600');
  });

  it('should render downward arrow, absolute number, and correct classes for negative movement', () => {
    const testMovement = -3;
    const expectedNumber = Math.abs(testMovement);
    // Correct JSX Syntax
    render(<MovementIndicator movement={testMovement} />);

    // Find element containing the text pattern
    const indicatorElement = screen.getByText(`▼${expectedNumber}`);

    expect(indicatorElement).toBeInTheDocument();
    expect(indicatorElement).toHaveClass('text-red-600', 'font-semibold');
    expect(indicatorElement).not.toHaveClass('text-gray-500', 'text-green-600');
  });
});