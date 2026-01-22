import { useState } from 'react';

interface DesktopIconProps {
  name: string;
  type: string;
  path: string;
  onDoubleClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  isCut?: boolean;
}

const DesktopIcon = ({ name, type, path, onDoubleClick, onContextMenu, isCut = false }: DesktopIconProps) => {
  const [clickCount, setClickCount] = useState(0);
  const [clickTimeout, setClickTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isSelected, setIsSelected] = useState(false);

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'directory':
        return '📁';
      case 'systemBinary':
        return '⚙️';
      case 'binary':
        return '🔧';
      case 'source':
        return '📄';
      case 'text':
        return '📝';
      default:
        return '📄';
    }
  };

  const handleClick = () => {
    setIsSelected(true);

    if (clickTimeout) {
      clearTimeout(clickTimeout);
    }

    const newClickCount = clickCount + 1;
    setClickCount(newClickCount);

    if (newClickCount === 2) {
      // Double click
      onDoubleClick();
      setClickCount(0);
      setClickTimeout(null);
    } else {
      // Single click - wait for potential second click
      const timeout = setTimeout(() => {
        setClickCount(0);
      }, 300);
      setClickTimeout(timeout);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsSelected(true);
    if (onContextMenu) {
      onContextMenu(e);
    }
  };

  return (
    <div
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      className={`w-20 h-24 flex flex-col items-center justify-center p-2 cursor-pointer select-none transition-all duration-200 ${
        isSelected
          ? 'bg-cyber-500/20 border border-cyber-500/50'
          : 'hover:bg-cyber-500/10 border border-transparent'
      } ${isCut ? 'opacity-50' : ''}`}
    >
      {/* Icon */}
      <div className="text-4xl mb-1">{getFileIcon(type)}</div>

      {/* Name */}
      <div className="text-xs text-gray-100 text-center break-words w-full leading-tight">
        {name}
      </div>
    </div>
  );
};

export default DesktopIcon;
