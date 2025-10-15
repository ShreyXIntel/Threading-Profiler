import React from 'react';
import { X, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { BtnBgShadow } from '../buttons/btn-bg-shadow';

export const Popup = ({ isOpen, onClose, title, message, type = 'info', onConfirm, confirmText = 'OK', cancelText = 'Cancel' }) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'error':
      case 'warning':
        return <AlertCircle className="w-12 h-12 text-[#d00000]" />;
      case 'success':
        return <CheckCircle className="w-12 h-12 text-[#55d355]" />;
      default:
        return <Info className="w-12 h-12 text-[#2563eb]" />;
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-md mx-4">
        <BtnBgShadow borderRadius="4" translate="4" />
        <div className="relative z-10 bg-[#fffbeb] border-[4px] border-gray-900 rounded-[4px] p-6">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 hover:-translate-y-[1px] transition-all"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-900" />
          </button>

          {/* Icon and Title */}
          <div className="flex flex-col items-center text-center mb-4">
            {getIcon()}
            <h3 className="text-2xl font-black text-gray-900 mt-3">{title}</h3>
          </div>

          {/* Message */}
          <p className="text-center text-base font-bold text-gray-700 mb-6">
            {message}
          </p>

          {/* Buttons */}
          <div className="flex gap-3 justify-center">
            {onConfirm ? (
              <>
                <button
                  onClick={onClose}
                  className="relative px-6 py-2 bg-white border-[3px] border-gray-900 rounded-[4px] font-bold text-gray-900 hover:-translate-x-[1px] hover:-translate-y-[1px] transition-all"
                >
                  {cancelText}
                </button>
                <button
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className="relative px-6 py-2 bg-[#2563eb] border-[3px] border-gray-900 rounded-[4px] font-bold text-white hover:-translate-x-[1px] hover:-translate-y-[1px] transition-all"
                >
                  {confirmText}
                </button>
              </>
            ) : (
              <button
                onClick={onClose}
                className="relative px-6 py-2 bg-[#2563eb] border-[3px] border-gray-900 rounded-[4px] font-bold text-white hover:-translate-x-[1px] hover:-translate-y-[1px] transition-all"
              >
                {confirmText}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
