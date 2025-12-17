import React, { useEffect } from 'react';

interface PopupProps {
  message: string;
  stageName: string;
  onClose: () => void;
  duration?: number; // Optional duration in milliseconds, defaults to 5000 (5 seconds)
}

const Popup: React.FC<PopupProps> = ({ message, stageName, onClose, duration = 5000 }) => {
  useEffect(() => {
    // If duration is 0 or negative, don't auto-close
    if (duration <= 0) return;
    
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [onClose, duration]);

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white p-4 rounded-lg shadow-lg z-50 max-w-md">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-medium">{message}</p>
          <div className="mt-2 text-sm font-bold">{`Current Stage: ${stageName}`}</div>
        </div>
        <button 
          onClick={onClose}
          className="ml-4 text-white hover:text-gray-200 focus:outline-none"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default Popup;