import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const SynapseLoading = () => {
  const [progress, setProgress] = useState(0);
  const [currentMessage, setCurrentMessage] = useState('');
  const [showLogo, setShowLogo] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const loadingMessages = [
    'INITIALIZING SYNAPSE CORE...',
    'LOADING KERNEL MODULES...',
    'ESTABLISHING SECURE CONNECTION...',
    'MOUNTING FILESYSTEM...',
    'STARTING NETWORK SERVICES...',
    'LOADING USER ENVIRONMENT...',
    'SYNAPSE READY'
  ];

  useEffect(() => {
    // Show logo first
    const logoTimer = setTimeout(() => setShowLogo(true), 100);

    // Show progress bar
    const progressTimer = setTimeout(() => setShowProgress(true), 800);

    // Simulate loading progress
    const interval = setInterval(() => {
      setProgress(prev => {
        const next = prev + Math.random() * 15;
        if (next >= 100) {
          clearInterval(interval);
          // Navigate to desktop after completion
          setTimeout(() => navigate('/desktop'), 500);
          return 100;
        }
        return next;
      });
    }, 300);

    return () => {
      clearTimeout(logoTimer);
      clearTimeout(progressTimer);
      clearInterval(interval);
    };
  }, [navigate]);

  useEffect(() => {
    // Update message based on progress
    const messageIndex = Math.floor((progress / 100) * loadingMessages.length);
    if (messageIndex < loadingMessages.length) {
      setCurrentMessage(loadingMessages[messageIndex]);
    }
  }, [progress]);

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-dark-950">
      {/* Animated background grid */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(0, 163, 255, 0.1) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(0, 163, 255, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }}
        />
      </div>

      {/* Scan line effect */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-full h-px bg-gradient-to-r from-transparent via-cyber-500/30 to-transparent animate-scan" />
      </div>

      {/* Loading container */}
      <div className="relative w-full max-w-md px-4">
        {/* Logo/Brand */}
        <div className={`text-center mb-12 transition-opacity duration-700 ${showLogo ? 'opacity-100' : 'opacity-0'}`}>
          <div className="inline-block">
            <h1 className="text-4xl font-bold text-cyber-500 text-glow tracking-wider mb-2">
              SYNAPSE
            </h1>
            <div className="h-px bg-gradient-to-r from-transparent via-cyber-500/50 to-transparent" />
            <p className="text-xs text-gray-400 mt-2 tracking-wider">NEURAL OPERATING SYSTEM</p>
          </div>
        </div>

        {/* Progress section */}
        <div className={`transition-opacity duration-500 ${showProgress ? 'opacity-100' : 'opacity-0'}`}>
          {/* Progress bar container */}
          <div className="corner-brackets bg-dark-900/80 backdrop-blur-sm p-6">
            {/* Status message */}
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 bg-cyber-500 animate-pulse-slow" />
              <span className="text-xs text-cyber-500 tracking-wider">
                {currentMessage}
              </span>
            </div>

            {/* Progress bar */}
            <div className="relative h-2 bg-dark-800 border border-cyber-500/30 overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyber-700 via-cyber-500 to-cyber-300 transition-all duration-300"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
              </div>
            </div>

            {/* Progress percentage */}
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-gray-400 tracking-wide">
                PROGRESS
              </span>
              <span className="text-xs text-cyber-500 font-medium tracking-wider">
                {Math.floor(progress)}%
              </span>
            </div>
          </div>

          {/* User info */}
          {user && (
            <div className="mt-4 text-center">
              <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
                <span>USER: {user.username.toUpperCase()}</span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom decorative element */}
        <div className={`mt-8 flex justify-center transition-opacity duration-500 ${showProgress ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex gap-2">
            <div className="w-12 h-px bg-gradient-to-r from-transparent to-cyber-500/50" />
            <div className="w-1 h-px bg-cyber-500" />
            <div className="w-12 h-px bg-gradient-to-l from-transparent to-cyber-500/50" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SynapseLoading;
