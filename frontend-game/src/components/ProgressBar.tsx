interface ProgressBarProps {
  progress: number; // 0-100
  label?: string;
  fileSize?: number;
  speed?: number; // MB/s
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const ProgressBar = ({ progress, label, fileSize, speed }: ProgressBarProps) => {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-dark-900/95 border border-cyber-500/30 corner-brackets p-6 min-w-[400px]">
        <div className="mb-4">
          <div className="text-cyber-500 font-mono text-sm mb-2">
            {label || 'Copying file...'}
          </div>
          {fileSize !== undefined && speed !== undefined && (
            <div className="text-gray-400 text-xs font-mono mb-3">
              Size: {formatFileSize(fileSize)} • Speed: {speed} MB/s
            </div>
          )}
        </div>

        {/* Progress bar container */}
        <div className="relative h-6 bg-dark-800 border border-cyber-500/20 overflow-hidden">
          {/* Progress fill */}
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyber-500/50 to-cyber-500 transition-all duration-100"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />

          {/* Animated scan line effect */}
          <div
            className="absolute inset-y-0 w-1 bg-cyber-500 animate-pulse"
            style={{ left: `${Math.min(progress, 100)}%` }}
          />

          {/* Progress text */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white font-mono text-xs font-bold drop-shadow-lg">
              {Math.round(progress)}%
            </span>
          </div>

          {/* Grid overlay for cyber effect */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, #00ff00 2px, #00ff00 4px)',
            }}
          />
        </div>

        <div className="mt-2 text-gray-500 text-xs font-mono text-center">
          Please wait...
        </div>
      </div>
    </div>
  );
};

export default ProgressBar;
