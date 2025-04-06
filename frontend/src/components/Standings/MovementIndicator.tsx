// frontend/src/components/Standings/MovementIndicator.tsx
import React from 'react';

// Interface defining the props
interface MovementIndicatorProps {
    movement: number | null;
}

// --- MODIFIED: Add React.FC<MovementIndicatorProps> type annotation ---
const MovementIndicator: React.FC<MovementIndicatorProps> = ({ movement }) => {
// --- END MODIFICATION ---
  if (movement === null || movement === 0) {
    return <span className="text-gray-500">–</span>;
  } else if (movement > 0) {
    // Moved up (previous rank was higher number)
    return <span className="text-green-600 font-semibold">▲{movement}</span>;
  } else {
    // Moved down (previous rank was lower number)
    return <span className="text-red-600 font-semibold">▼{Math.abs(movement)}</span>;
  }
};

export default MovementIndicator;