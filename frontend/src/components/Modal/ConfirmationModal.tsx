// frontend/src/components/Modal/ConfirmationModal.tsx
import React from 'react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  isConfirming?: boolean; // Optional: To show loading state on confirm button
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isConfirming = false, // Default to false
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full z-50 flex justify-center items-center"
      onClick={onClose} // Close if clicking overlay
    >
      <div
        className="relative mx-auto p-6 border w-full max-w-lg shadow-lg rounded-md bg-white"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal content
      >
        {/* Title */}
        <h3 className="text-xl font-semibold leading-6 text-gray-900 mb-4">
          {title}
        </h3>
        {/* Message */}
        <div className="mb-6 text-sm text-gray-600">
          {typeof message === 'string' ? <p>{message}</p> : message}
        </div>
        {/* Action Buttons */}
        <div className="flex justify-end gap-3 border-t pt-4 mt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isConfirming} // Disable if confirming action is in progress
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming} // Disable while confirming
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-wait"
          >
            {isConfirming ? 'Processing...' : confirmText} {/* Show loading text */}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;