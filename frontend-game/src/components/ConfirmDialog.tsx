import { useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
}

const ConfirmDialog = ({
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDangerous = false
}: ConfirmDialogProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onCancel]);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center">
        {/* Dialog */}
        <div
          ref={dialogRef}
          className="bg-dark-900/95 border border-cyber-500/30 corner-brackets w-full max-w-md mx-4 animate-fade-in"
        >
          {/* Header */}
          <div className="flex items-center gap-2 p-4 border-b border-cyber-500/20">
            <div className="w-1 h-4 bg-cyber-500 animate-pulse-slow" />
            <h3 className="text-sm text-cyber-500 tracking-wider">{title}</h3>
          </div>

          {/* Content */}
          <div className="p-4">
            <p className="text-xs text-gray-300 leading-relaxed">{message}</p>
          </div>

          {/* Footer */}
          <div className="flex gap-2 justify-end p-4 border-t border-cyber-500/20">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-xs text-gray-400 border border-gray-600/30 hover:bg-gray-600/10 transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`px-4 py-2 text-xs border transition-colors ${
                isDangerous
                  ? 'text-red-400 border-red-500/30 hover:bg-red-500/10'
                  : 'text-cyber-500 border-cyber-500/30 hover:bg-cyber-500/10'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ConfirmDialog;
