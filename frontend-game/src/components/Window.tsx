import { useState, useRef, useEffect } from 'react';

interface WindowProps {
  id: string;
  title: string;
  initialX?: number;
  initialY?: number;
  initialWidth?: number;
  initialHeight?: number;
  onFocus?: (id: string) => void;
  onMinimize?: (id: string, minimized: boolean) => void;
  onClose?: (id: string) => void;
  isMinimized?: boolean;
  zIndex?: number;
  children?: React.ReactNode;
}

const Window = ({
  id,
  title,
  initialX = 100,
  initialY = 100,
  initialWidth = 600,
  initialHeight = 400,
  onFocus,
  onMinimize,
  onClose,
  isMinimized = false,
  zIndex = 1,
  children
}: WindowProps) => {
  const [position, setPosition] = useState({ x: initialX, y: initialY });
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight });
  const [isMaximized, setIsMaximized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState('');

  const windowRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const resizeStartPos = useRef({ x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0 });
  const savedPosition = useRef({ x: initialX, y: initialY });
  const savedSize = useRef({ width: initialWidth, height: initialHeight });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const deltaX = e.clientX - dragStartPos.current.x;
        const deltaY = e.clientY - dragStartPos.current.y;
        setPosition(prev => ({
          x: prev.x + deltaX,
          y: prev.y + deltaY
        }));
        dragStartPos.current = { x: e.clientX, y: e.clientY };
      }

      if (isResizing) {
        const deltaX = e.clientX - resizeStartPos.current.x;
        const deltaY = e.clientY - resizeStartPos.current.y;

        let newWidth = resizeStartPos.current.width;
        let newHeight = resizeStartPos.current.height;
        let newX = resizeStartPos.current.posX;
        let newY = resizeStartPos.current.posY;

        if (resizeDirection.includes('e')) {
          newWidth = Math.max(300, resizeStartPos.current.width + deltaX);
        }
        if (resizeDirection.includes('s')) {
          newHeight = Math.max(200, resizeStartPos.current.height + deltaY);
        }
        if (resizeDirection.includes('w')) {
          const widthChange = resizeStartPos.current.width - Math.max(300, resizeStartPos.current.width - deltaX);
          newWidth = Math.max(300, resizeStartPos.current.width - deltaX);
          newX = resizeStartPos.current.posX + widthChange;
        }
        if (resizeDirection.includes('n')) {
          const heightChange = resizeStartPos.current.height - Math.max(200, resizeStartPos.current.height - deltaY);
          newHeight = Math.max(200, resizeStartPos.current.height - deltaY);
          newY = resizeStartPos.current.posY + heightChange;
        }

        setSize({ width: newWidth, height: newHeight });
        if (resizeDirection.includes('w') || resizeDirection.includes('n')) {
          setPosition({ x: newX, y: newY });
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setResizeDirection('');
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, resizeDirection]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (onFocus) onFocus(id);
    setIsDragging(true);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleResizeStart = (direction: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onFocus) onFocus(id);
    setIsResizing(true);
    setResizeDirection(direction);
    resizeStartPos.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
      posX: position.x,
      posY: position.y
    };
  };

  const handleMaximize = () => {
    if (isMaximized) {
      setPosition(savedPosition.current);
      setSize(savedSize.current);
      setIsMaximized(false);
    } else {
      savedPosition.current = position;
      savedSize.current = size;
      setPosition({ x: 0, y: 0 });
      setSize({ width: window.innerWidth, height: window.innerHeight - 40 });
      setIsMaximized(true);
    }
  };

  const handleMinimize = () => {
    if (onMinimize) {
      onMinimize(id, !isMinimized);
    }
  };

  const handleClose = () => {
    if (onClose) {
      onClose(id);
    }
  };

  const handleWindowClick = () => {
    if (onFocus) onFocus(id);
  };

  if (isMinimized) {
    return null;
  }

  return (
    <div
      ref={windowRef}
      className="absolute corner-brackets bg-dark-900/95 backdrop-blur-sm border border-cyber-500/30 flex flex-col"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        zIndex
      }}
      onClick={handleWindowClick}
    >
      {/* Title Bar */}
      <div
        className="h-8 bg-dark-800/80 border-b border-cyber-500/20 flex items-center justify-between px-3 cursor-move select-none"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <div className="w-1 h-3 bg-cyber-500 animate-pulse-slow" />
          <span className="text-xs text-gray-100 tracking-wider">{title}</span>
        </div>

        <div className="flex items-center gap-1">
          {/* Minimize */}
          <button
            onClick={handleMinimize}
            className="w-6 h-6 flex items-center justify-center hover:bg-cyber-500/20 transition-colors duration-200"
          >
            <div className="w-3 h-px bg-gray-400" />
          </button>

          {/* Maximize */}
          <button
            onClick={handleMaximize}
            className="w-6 h-6 flex items-center justify-center hover:bg-cyber-500/20 transition-colors duration-200"
          >
            <div className={`w-3 h-3 border border-gray-400 ${isMaximized ? 'border-2' : ''}`} />
          </button>

          {/* Close */}
          <button
            onClick={handleClose}
            className="w-6 h-6 flex items-center justify-center hover:bg-red-500/20 transition-colors duration-200 group"
          >
            <div className="relative w-3 h-3">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-3 h-px bg-gray-400 group-hover:bg-red-500 rotate-45" />
                <div className="w-3 h-px bg-gray-400 group-hover:bg-red-500 -rotate-45 absolute" />
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Window Content */}
      <div className="flex-1 overflow-auto p-4 text-xs text-gray-300">
        {children || (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-gray-500">
              <div className="flex gap-1 justify-center mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-cyber-500 animate-pulse" />
                <div className="w-1.5 h-1.5 rounded-full bg-cyber-500/50 animate-pulse" style={{ animationDelay: '0.5s' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-cyber-500/30 animate-pulse" style={{ animationDelay: '1s' }} />
              </div>
              <p>Window content goes here</p>
            </div>
          </div>
        )}
      </div>

      {/* Resize Handles */}
      {!isMaximized && (
        <>
          {/* Corners */}
          <div className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize" onMouseDown={handleResizeStart('nw')} />
          <div className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize" onMouseDown={handleResizeStart('ne')} />
          <div className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize" onMouseDown={handleResizeStart('sw')} />
          <div className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize" onMouseDown={handleResizeStart('se')} />

          {/* Edges */}
          <div className="absolute top-0 left-3 right-3 h-1 cursor-n-resize" onMouseDown={handleResizeStart('n')} />
          <div className="absolute bottom-0 left-3 right-3 h-1 cursor-s-resize" onMouseDown={handleResizeStart('s')} />
          <div className="absolute left-0 top-3 bottom-3 w-1 cursor-w-resize" onMouseDown={handleResizeStart('w')} />
          <div className="absolute right-0 top-3 bottom-3 w-1 cursor-e-resize" onMouseDown={handleResizeStart('e')} />
        </>
      )}
    </div>
  );
};

export default Window;
