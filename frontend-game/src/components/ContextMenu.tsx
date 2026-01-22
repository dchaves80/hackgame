import { useEffect, useRef } from 'react';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onCopy?: () => void;
  onCut?: () => void;
  onPaste?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  canPaste?: boolean;
}

const ContextMenu = ({ x, y, onClose, onCopy, onCut, onPaste, onRename, onDelete, canPaste = false }: ContextMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleMenuClick = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="fixed bg-dark-900/95 backdrop-blur-sm border border-cyber-500/30 corner-brackets min-w-[150px]"
      style={{ left: x, top: y, zIndex: 9999 }}
    >
      <div className="py-1">
        {onCopy && (
          <button
            onClick={() => handleMenuClick(onCopy)}
            className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-cyber-500/10 hover:text-cyber-500 transition-colors flex items-center gap-2"
          >
            <span>📋</span>
            <span>Copy</span>
            <span className="ml-auto text-gray-600">Ctrl+C</span>
          </button>
        )}

        {onCut && (
          <button
            onClick={() => handleMenuClick(onCut)}
            className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-cyber-500/10 hover:text-cyber-500 transition-colors flex items-center gap-2"
          >
            <span>✂️</span>
            <span>Cut</span>
            <span className="ml-auto text-gray-600">Ctrl+X</span>
          </button>
        )}

        {onPaste && (
          <button
            onClick={() => handleMenuClick(onPaste)}
            disabled={!canPaste}
            className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2 ${
              canPaste
                ? 'text-gray-300 hover:bg-cyber-500/10 hover:text-cyber-500'
                : 'text-gray-600 cursor-not-allowed'
            }`}
          >
            <span>📄</span>
            <span>Paste</span>
            <span className="ml-auto text-gray-600">Ctrl+V</span>
          </button>
        )}

        {(onCopy || onCut || onPaste) && (onRename || onDelete) && (
          <div className="border-t border-cyber-500/20 my-1" />
        )}

        {onRename && (
          <button
            onClick={() => handleMenuClick(onRename)}
            className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-cyber-500/10 hover:text-cyber-500 transition-colors flex items-center gap-2"
          >
            <span>✏️</span>
            <span>Rename</span>
            <span className="ml-auto text-gray-600">F2</span>
          </button>
        )}

        {onRename && onDelete && (
          <div className="border-t border-cyber-500/20 my-1" />
        )}

        {onDelete && (
          <button
            onClick={() => handleMenuClick(onDelete)}
            className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-500 transition-colors flex items-center gap-2"
          >
            <span>🗑️</span>
            <span>Delete</span>
            <span className="ml-auto text-gray-600">Del</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default ContextMenu;
